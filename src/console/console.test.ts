import { describe, expect, it } from 'vitest';
import { openDecisions } from '@/command-room/model';
import { createSession, dispatch as dispatchSession, type MissionSession } from '@/engine/mission/session';
import { BUILDING_47 } from '@/scenarios/building47';
import { COMMANDS, completeInput, execute, findCommand } from './commands';
import { commonPrefix, complete, tokenize } from './parse';
import type { ConsoleContext, View } from './types';

const harness = (seed = 'console-test') => {
  let session: MissionSession = createSession(BUILDING_47, seed, 'D');
  let playing = true;
  const calls = { views: [] as View[], review: 0, exported: 0, replay: 0, newSession: [] as Array<string | undefined>, closed: 0 };
  const context: ConsoleContext = {
    session: () => session,
    manifest: BUILDING_47,
    epochMs: Date.UTC(2026, 9, 29, 14, 0, 0),
    dispatch: (command) => {
      const result = dispatchSession(session, command);
      if (!result.accepted) return { accepted: false, reason: result.reason };
      session = result.session;
      return { accepted: true };
    },
    clock: { playing: () => playing, setPlaying: (value) => (playing = value) },
    show: (view) => calls.views.push(view),
    openReview: () => (calls.review += 1),
    exportRecord: () => {
      calls.exported += 1;
      return 'orpheus-session.json';
    },
    openReplay: () => (calls.replay += 1),
    newSession: (value) => calls.newSession.push(value),
    egress: () => ({ supported: true, sameOrigin: 9, external: [] }),
    selfTest: async () => [{ id: 'sha256-kat', label: 'SHA-256 known-answer test (FIPS 180-4)', status: 'pass', detail: '3/3 vectors' }],
    close: () => (calls.closed += 1),
  };
  const run = async (input: string) => execute(input, context);
  const text = async (input: string) => (await run(input)).lines.map((line) => line.text).join('\n');
  return { context, calls, run, text, session: () => session, isPlaying: () => playing };
};

describe('console parsing and completion', () => {
  it('tokenizes on whitespace and keeps quoted words together', () => {
    expect(tokenize('  commit  1 2 ')).toEqual(['commit', '1', '2']);
    expect(tokenize('new "alpha 1" x')).toEqual(['new', 'alpha 1', 'x']);
    expect(commonPrefix(['redteam', 'replay', 'resume', 'review'])).toBe('re');
  });

  it('completes unique words, extends ambiguous ones to their common prefix, and lists the candidates', () => {
    const words = (index: number) => (index === 0 ? ['status', 'step', 'sitrep', 'seal'] : ['on', 'off']);
    expect(complete('si', words)).toEqual({ input: 'sitrep ', candidates: ['sitrep'] });
    expect(complete('st', words)).toEqual({ input: 'st', candidates: ['status', 'step'] });
    expect(complete('auto o', words)).toEqual({ input: 'auto o', candidates: ['off', 'on'] });
    expect(complete('auto of', words).input).toBe('auto off ');
    expect(complete('zz', words)).toEqual({ input: 'zz', candidates: [] });
  });

  it('completes command names and decision numbers from the live session', () => {
    const { context } = harness();
    expect(completeInput('verif', context).input).toBe('verify ');
    expect(completeInput('brief ', context).candidates).toEqual(['1', '2']);
    expect(completeInput('redteam o', context).candidates).toEqual(['off', 'on']);
  });

  it('documents every command and resolves aliases', () => {
    expect(new Set(COMMANDS.map((command) => command.name)).size).toBe(COMMANDS.length);
    for (const command of COMMANDS) expect(command.summary.length, command.name).toBeGreaterThan(5);
    expect(findCommand('LS')?.name).toBe('decisions');
    expect(findCommand('emcon')?.name).toBe('egress');
  });
});

describe('console commands', () => {
  it('reports an unknown command without throwing', async () => {
    const { run } = harness();
    const result = await run('launch-missiles');
    expect(result.lines[0]).toEqual({ text: 'orpheus: command not found: launch-missiles. Type `help`.', tone: 'error' });
  });

  it('prints status, seal and seed from the session', async () => {
    const { text } = harness('ALPHA-1');
    const status = await text('status');
    expect(status).toContain('seed ALPHA-1 · T+00:00 · 291400Z OCT 26 · clock RUNNING');
    expect(status).toContain('phase 1/4 · Phase 1 · Approach');
    expect(await text('seed')).toContain('/?seed=ALPHA-1');
    expect(await text('seal')).toMatch(/SEAL [0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}/);
  });

  it('numbers decisions the way the matrix does and briefs them with graded evidence and an ICD 203 line', async () => {
    const { text, context } = harness();
    const listing = await text('decisions');
    const open = openDecisions(context.session().state, BUILDING_47);
    expect(listing).toContain(`[1] ${open[0].spec.title}`);
    expect(listing).toContain(`[2] ${open[1].spec.title}`);
    const briefing = await text('brief 1');
    expect(briefing).toContain('ANALYST · UNCERTAINTY-AWARE · ICD 203');
    expect(briefing).toMatch(/\n {2}[A-F][1-6] {2}/);
    expect(briefing).toMatch(/CONFIDENCE (HIGH|MODERATE|LOW)/);
    expect(await text('brief 9')).toBe('brief: choose a decision from 1 to 2.');
  });

  it('asks before committing, records the course in the chain, and refuses bad input', async () => {
    const { run, session } = harness();
    expect((await run('commit 1')).lines[0].text).toMatch(/^commit: choose a course from 1 to 3/);
    const before = session().log.length;
    const pending = await run('commit 1 3');
    expect(pending.confirm?.prompt).toMatch(/\[y\/N\]$/);
    expect(session().log.length).toBe(before);
    const outcome = pending.confirm!.onConfirm();
    expect(outcome[0].text).toMatch(/^COURSE COMMITTED · entry #\d+ · seal /);
    expect(session().log.length).toBe(before + 1);
    expect(session().state.resolved).toHaveLength(1);
  });

  it('drives the clock and phases through validated engine commands', async () => {
    const { text, run, session, isPlaying } = harness();
    expect(await text('pause')).toMatch(/PAUSED/);
    expect(isPlaying()).toBe(false);
    expect(await text('step 12')).toBe('T+00:12 (+12 s)');
    expect(session().state.tick).toBe(12);
    expect(await text('step 0')).toMatch(/^step: seconds must be/);
    expect(await text('redteam on')).toBe('redteam: The red-team simulation unlocks at phase 2.');
    expect(await text('advance')).toBe('PHASE 2/4 · Phase 2 · Contact');
    expect(await text('redteam on')).toBe('red team ON');
    expect(await text('auto on')).toBe('auto advance ON');
    expect(await text('auto on')).toBe('auto advance is already on.');
    expect((await run('resume')).lines[0].text).toBe('clock RUNNING');
  });

  it('verifies the live session by re-executing it from its seed', async () => {
    const { text, run } = harness();
    await run('step 40');
    const pending = await run('commit 2 1');
    pending.confirm!.onConfirm();
    await run('advance');
    const report = await text('verify');
    expect(report).toContain('VERIFIED — the record reproduces the live session exactly.');
    expect(report).toMatch(/3\/3 entries link/);
  });

  it('shows the command log with chained hashes', async () => {
    const { text, run } = harness();
    expect(await text('log')).toMatch(/log is empty/);
    await run('step 3');
    await run('advance');
    expect(await text('log')).toMatch(/#0000 {2}advance 3 ticks\s+\w{4}…\w{4} → \w{4}…\w{4}\n#0001 {2}advance phase/);
  });

  it('hands off views, export, replay, egress, self-tests and new sessions to the room', async () => {
    const { run, text, calls } = harness();
    await run('matrix');
    await run('map');
    await run('review');
    expect(calls.views).toEqual(['decisions', 'map']);
    expect(calls.review).toBe(1);
    expect(await text('export')).toContain('Record written: orpheus-session.json');
    await run('replay');
    expect(calls.replay).toBe(1);
    expect(await text('egress')).toContain('✓ NO EXTERNAL EMISSIONS');
    expect(await text('selftest')).toContain('ALL SELF-TESTS PASSED');
    expect(await text('new bad/seed')).toMatch(/^new: a seed is/);
    const pending = await run('new Bravo-7');
    expect(calls.newSession).toEqual([]);
    pending.confirm!.onConfirm();
    expect(calls.newSession).toEqual(['Bravo-7']);
    expect((await run('clear')).clear).toBe(true);
    await run('exit');
    expect(calls.closed).toBe(1);
  });

  it('prints help for every command', async () => {
    const { text } = harness();
    const listing = await text('help');
    for (const command of COMMANDS) expect(listing).toContain(command.usage);
    expect(await text('help sitrep')).toContain('Precedence: Z FLASH');
  });
});

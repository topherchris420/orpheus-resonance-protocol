import { afterEach, describe, expect, it, vi } from 'vitest';
import { BUILDING_47 } from '@/scenarios/building47';
import { ORIENTATION } from '@/scenarios/orientation';
import type { ScenarioManifest } from '@/scenarios/types';
import { appendEntry, genesisHash } from '../log';
import { SCHEMA } from '../version';
import { createSessionRecord, importSessionRecord } from './record';
import { reduceMission } from './reducer';
import { assistantFor, evidenceReportFor, shortlist } from './selectors';
import { createSession, dispatch, reconstructState, stateHash, verifyReplay, type MissionSession } from './session';
import type { MissionCommand } from './types';

const run = (session: MissionSession, commands: MissionCommand[]) => {
  let current = session;
  for (const command of commands) {
    const result = dispatch(current, command);
    if (!result.accepted) throw new Error(`Rejected ${command.type}: ${result.reason}`);
    current = result.session;
  }
  return current;
};

const ticks = (count: number): MissionCommand[] => Array.from({ length: count }, () => ({ type: 'advance', ticks: 1 }));

/** A full scripted session: plays every decision across all phases with the red team active. */
const scriptedSession = (seed = 'replay-seed', condition: 'A' | 'B' | 'C' | 'D' = 'D') => {
  let session = createSession(BUILDING_47, seed, condition);
  session = run(session, ticks(20));
  for (let guard = 0; guard < 20 && session.state.decisions.some((decision) => decision.status !== 'resolved'); guard += 1) {
    const [next] = shortlist(session.state, BUILDING_47);
    if (next) {
      const spec = BUILDING_47.decisions.find((candidate) => candidate.id === next.id)!;
      const item = next.evidence!.items[0];
      session = run(session, [
        { type: 'inspectEvidence', pointId: next.id, evidenceId: item.id },
        { type: 'commitDecision', pointId: next.id, optionId: spec.options[guard % spec.options.length].id, actor: 'participant', confidence: 70, latencyMs: 4200, selectionChanges: 1 },
        ...ticks(7),
      ]);
    } else {
      session = run(session, [{ type: 'advancePhase' }, ...ticks(5)]);
      if (session.state.phase === 2 && !session.state.redTeam.active) session = run(session, [{ type: 'toggleRedTeam' }, ...ticks(11)]);
    }
  }
  return session;
};

afterEach(() => vi.restoreAllMocks());

describe('deterministic mission engine', () => {
  it('creates identical sessions from identical seeds and different ones otherwise', () => {
    expect(stateHash(createSession(BUILDING_47, 'alpha', 'D').state)).toBe(stateHash(createSession(BUILDING_47, 'alpha', 'D').state));
    expect(stateHash(createSession(BUILDING_47, 'alpha', 'D').state)).not.toBe(stateHash(createSession(BUILDING_47, 'beta', 'D').state));
  });

  it('never reads wall-clock time or unseeded randomness', () => {
    vi.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('Date.now used');
    });
    vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random used');
    });
    const session = scriptedSession('no-clock');
    expect(session.state.resolved).toHaveLength(BUILDING_47.decisions.length);
  });

  it('reproduces the same final state for the same seed and inputs', () => {
    const first = scriptedSession('same-inputs');
    const second = scriptedSession('same-inputs');
    expect(stateHash(first.state)).toBe(stateHash(second.state));
    expect(first.log.map((entry) => entry.hash)).toEqual(second.log.map((entry) => entry.hash));
    expect(stateHash(scriptedSession('other-inputs').state)).not.toBe(stateHash(first.state));
  });

  it('records every catalog decision exactly once across phases', () => {
    const session = scriptedSession();
    expect(session.state.resolved.map((decision) => decision.pointId).sort()).toEqual(BUILDING_47.decisions.map((spec) => spec.id).sort());
    expect(session.state.objectives.every((objective) => objective.progress >= 0 && objective.progress <= 1)).toBe(true);
    expect(session.state.modifiers.hostilePressure).toBeGreaterThanOrEqual(0);
    expect(session.state.modifiers.hostilePressure).toBeLessThanOrEqual(1);
    expect(session.state.resolved.every((decision) => decision.assistant?.condition === 'D')).toBe(true);
    expect(session.state.inspections).toHaveLength(BUILDING_47.decisions.length);
  });

  it('keeps the v1 effect model for a course that does not rely on an assumption', () => {
    const session = run(createSession(BUILDING_47, 'v1-parity', 'A'), [
      { type: 'commitDecision', pointId: 'dp-breach', optionId: 'dp-breach-hold', actor: 'participant' },
    ]);
    expect(session.state.modifiers.hostilePressure).toBeCloseTo(0.52);
    expect(session.state.objectives[0].progress).toBeCloseTo(0.18);
    expect(session.state.resolved[0]).toMatchObject({ correctness: 'deferred', utility: 0, assistant: null });
  });

  it('scores committed courses against the sampled ground truth and applies the wrong-assumption penalty', () => {
    const session = run(createSession(BUILDING_47, 'scoring', 'D'), [
      { type: 'commitDecision', pointId: 'dp-breach', optionId: 'dp-breach-dynamic', actor: 'participant' },
    ]);
    const [decision] = session.state.resolved;
    const truth = session.state.decisions.find((candidate) => candidate.id === 'dp-breach')!.truth;
    expect(decision.reliedOn).toBe('two');
    expect(decision.correctness).toBe(truth === 'two' ? 'correct' : 'wrong');
    expect(decision.utility).toBe(truth === 'two' ? 1 : -4);
    expect(decision.appliedEffects.assumptionWrong).toBe(truth !== 'two');
    if (truth !== 'two') expect(decision.polarityError).toBe('miss');
  });
});

describe('decision rules', () => {
  const fresh = () => createSession(BUILDING_47, 'rules', 'D');

  it('rejects locked, unknown and mismatched decisions without logging them', () => {
    const session = fresh();
    const cases: Array<[MissionCommand, RegExp]> = [
      [{ type: 'commitDecision', pointId: 'dp-exfil', optionId: 'dp-exfil-viper', actor: 'participant' }, /not available/],
      [{ type: 'commitDecision', pointId: 'dp-breach', optionId: 'fake', actor: 'participant' }, /does not belong/],
      [{ type: 'commitDecision', pointId: 'dp-breach', optionId: 'dp-casualty-evac', actor: 'participant' }, /does not belong/],
      [{ type: 'commitDecision', pointId: 'nope', optionId: 'x', actor: 'participant' }, /Unknown decision/],
      [{ type: 'commitDecision', pointId: 'dp-breach', optionId: 'dp-breach-hold', actor: 'participant', confidence: 150 }, /Confidence/],
      [{ type: 'advance', ticks: 0 }, /between 1 and 600/],
      [{ type: 'toggleRedTeam' }, /unlocks at phase 2/],
    ];
    for (const [command, reason] of cases) {
      const result = dispatch(session, command);
      expect(result.accepted).toBe(false);
      if (!result.accepted) expect(result.reason).toMatch(reason);
      expect(result.session.log).toHaveLength(0);
    }
  });

  it('never lets the assistant commit a decision', () => {
    const command = { type: 'commitDecision', pointId: 'dp-breach', optionId: 'dp-breach-hold', actor: 'assistant' } as unknown as MissionCommand;
    const result = reduceMission(fresh().state, command, BUILDING_47);
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reason).toMatch(/participant or a simulated agent/);
  });

  it('prevents duplicate and conflicting commitments for the same event', () => {
    const first = dispatch(fresh(), { type: 'commitDecision', pointId: 'dp-breach', optionId: 'dp-breach-hold', actor: 'participant' });
    expect(first.accepted).toBe(true);
    for (const optionId of ['dp-breach-hold', 'dp-breach-dynamic']) {
      const again = dispatch(first.session, { type: 'commitDecision', pointId: 'dp-breach', optionId, actor: 'participant' });
      expect(again.accepted).toBe(false);
      expect(again.session.log).toHaveLength(1);
    }
  });

  it('opens orientation decisions in order', () => {
    let session = createSession(ORIENTATION, 'tour', 'D');
    expect(shortlist(session.state, ORIENTATION).map((decision) => decision.id)).toEqual(['or-route']);
    session = run(session, [{ type: 'commitDecision', pointId: 'or-route', optionId: 'or-route-go', actor: 'participant' }]);
    expect(shortlist(session.state, ORIENTATION).map((decision) => decision.id)).toEqual(['or-overpass']);
  });
});

describe('evidence inside the mission', () => {
  it('reports missing observations and stale reports', () => {
    let session = createSession(BUILDING_47, 'evidence', 'D');
    session = run(session, [{ type: 'advancePhase' }, { type: 'advancePhase' }]);
    const exfil = evidenceReportFor(session.state, BUILDING_47, 'dp-exfil')!;
    expect(exfil.missing.map((item) => item.id)).toEqual(['dp-exfil:isr-viper']);
    expect(exfil.items.find((item) => item.id === 'dp-exfil:survey')?.flags).toContain('stale');
  });

  it('sets aside the unverified second feed and the replayed chatter in the conflict arbitration', () => {
    const session = run(createSession(BUILDING_47, 'deception', 'D'), [{ type: 'advancePhase' }]);
    const report = evidenceReportFor(session.state, BUILDING_47, 'dp-deception')!;
    const exclusion = (id: string) => report.items.find((item) => item.id === `dp-deception:${id}`)?.exclusion;
    expect(exclusion('second-feed')).toBe('unverifiable-source');
    expect(exclusion('old-intercept')).toBe('expired');
    expect(exclusion('replayed-chatter')).toBe('expired');
  });

  it('lets evidence age as simulated time passes', () => {
    let session = createSession(BUILDING_47, 'aging', 'D');
    const before = evidenceReportFor(session.state, BUILDING_47, 'dp-casualty')!;
    session = run(session, [{ type: 'advance', ticks: 400 }]);
    const after = evidenceReportFor(session.state, BUILDING_47, 'dp-casualty')!;
    expect(before.items.find((item) => item.id === 'dp-casualty:telemetry')?.admissible).toBe(true);
    expect(after.items.find((item) => item.id === 'dp-casualty:telemetry')?.exclusion).toBe('expired');
  });

  it('injects adversarial reports into open decisions when the red team activates', () => {
    let session = run(createSession(BUILDING_47, 'red-team', 'D'), [{ type: 'advancePhase' }]);
    expect(session.state.decisions.find((decision) => decision.id === 'dp-breach')?.evidence?.items.some((item) => item.id === 'dp-breach:injected-stairwell')).toBe(false);
    session = run(session, [{ type: 'toggleRedTeam' }]);
    const report = evidenceReportFor(session.state, BUILDING_47, 'dp-breach')!;
    expect(report.items.find((item) => item.id === 'dp-breach:injected-stairwell')?.exclusion).toBe('unverifiable-source');
  });

  it('runs the orientation lessons as scripted', () => {
    let session = createSession(ORIENTATION, 'lessons', 'D');
    expect(assistantFor(session.state, ORIENTATION, 'or-route')?.output?.status).toBe('assessment');
    session = run(session, [{ type: 'commitDecision', pointId: 'or-route', optionId: 'or-route-go', actor: 'participant' }]);
    expect(assistantFor(session.state, ORIENTATION, 'or-overpass')?.output?.abstention?.explanation).toBe(
      'Two reports disagree, and neither has independent confirmation. Orpheus cannot establish which is accurate.',
    );
    session = run(session, [{ type: 'commitDecision', pointId: 'or-overpass', optionId: 'or-overpass-look', actor: 'participant' }]);
    const bravo = assistantFor(session.state, ORIENTATION, 'or-bravo')?.output;
    expect(bravo?.status).toBe('abstention');
    expect(bravo?.flags.map((flag) => flag.code)).toEqual(expect.arrayContaining(['integrity-failure', 'missing-observation']));
    const conventional = run(createSession(ORIENTATION, 'lessons', 'B'), [
      { type: 'commitDecision', pointId: 'or-route', optionId: 'or-route-go', actor: 'participant' },
      { type: 'commitDecision', pointId: 'or-overpass', optionId: 'or-overpass-look', actor: 'participant' },
    ]);
    expect(assistantFor(conventional.state, ORIENTATION, 'or-bravo')?.output?.assessment?.hypothesisId).toBe('genuine');
  });
});

describe('replay, export and import', () => {
  it('verifies an exported session by exact replay', () => {
    const session = scriptedSession('export');
    const record = JSON.parse(JSON.stringify(createSessionRecord(session, '2026-10-27T00:00:00.000Z')));
    const imported = importSessionRecord(record);
    expect(imported.kind).toBe('session');
    if (imported.kind !== 'session') return;
    expect(imported.verification.chain.ok).toBe(true);
    expect(imported.verification.verified).toBe(true);
    expect(imported.verification.checkpointsMatched).toBe(imported.verification.checkpointsChecked);
    expect(imported.verification.checkpointsChecked).toBeGreaterThan(10);
  });

  it('reconstructs any intermediate state from the seed and the log', () => {
    const session = scriptedSession('intermediate');
    const middle = Math.floor(session.log.length / 2);
    const checkpoint = session.checkpoints.find((candidate) => candidate.seq >= middle)!;
    expect(stateHash(reconstructState(BUILDING_47, session.header, session.log, checkpoint.seq))).toBe(checkpoint.stateHash);
    expect(stateHash(reconstructState(BUILDING_47, session.header, session.log, session.log.length - 1))).toBe(stateHash(session.state));
  });

  it('detects edited, reordered and re-chained records', () => {
    const session = scriptedSession('tamper');
    const record = createSessionRecord(session);
    const edited = JSON.parse(JSON.stringify(record));
    const commit = edited.log.findIndex((entry: { command: MissionCommand }) => entry.command.type === 'commitDecision');
    edited.log[commit].command.optionId = BUILDING_47.decisions[0].options[2].id;
    const editedResult = importSessionRecord(edited);
    expect(editedResult.kind).toBe('session');
    if (editedResult.kind === 'session') {
      expect(editedResult.verification.chain).toMatchObject({ ok: false, firstInvalidSeq: commit });
      expect(editedResult.verification.verified).toBe(false);
    }

    const reordered = JSON.parse(JSON.stringify(record));
    [reordered.log[2], reordered.log[3]] = [reordered.log[3], reordered.log[2]];
    const reorderedResult = importSessionRecord(reordered);
    expect(reorderedResult.kind).toBe('session');
    if (reorderedResult.kind === 'session') expect(reorderedResult.verification.chain).toMatchObject({ ok: false, firstInvalidSeq: 2 });

    // Someone rebuilds a consistent chain around a changed input: the checkpoints catch it.
    let rechained = [] as typeof session.log;
    for (const entry of session.log) {
      const command = entry.seq === 0 ? ({ type: 'advance', ticks: 2 } as MissionCommand) : entry.command;
      rechained = appendEntry(rechained, command, session.genesis);
    }
    const verification = verifyReplay(BUILDING_47, session.header, session.genesis, rechained, record.checkpoints);
    expect(verification.chain.ok).toBe(true);
    expect(verification.verified).toBe(false);
    expect(verification.firstDivergence).not.toBeNull();
  });

  it('refuses exact replay when the scenario or engine version differs', () => {
    const session = scriptedSession('versions');
    const record = createSessionRecord(session);
    const changed: ScenarioManifest = { ...BUILDING_47, version: '1.0.1', title: 'Building 47 (edited)' };
    const scenarioMismatch = verifyReplay(changed, record.header, record.genesis, record.log, record.checkpoints);
    expect(scenarioMismatch.compatibility.replayable).toBe(false);
    expect(scenarioMismatch.compatibility.issues[0]).toMatch(/changed since recording/);
    // A consistent record from another engine major version: intact, but not replayable here.
    const oldHeader = { ...record.header, engineVersion: '1.4.0' };
    const oldGenesis = genesisHash(oldHeader);
    let oldLog = [] as typeof session.log;
    for (const entry of session.log) oldLog = appendEntry(oldLog, entry.command, oldGenesis);
    const engineMismatch = verifyReplay(BUILDING_47, oldHeader, oldGenesis, oldLog, record.checkpoints);
    expect(engineMismatch.chain.ok).toBe(true);
    expect(engineMismatch.compatibility.replayable).toBe(false);
    expect(engineMismatch.compatibility.issues[0]).toMatch(/engine 1\.4\.0/);
    expect(engineMismatch.verified).toBe(false);
    // Editing the header of a record breaks its link to the log.
    const forged = verifyReplay(BUILDING_47, oldHeader, record.genesis, record.log, record.checkpoints);
    expect(forged.error).toMatch(/genesis/);
  });

  it('imports v1 records for reading only', () => {
    const legacy = {
      schema: SCHEMA.legacySession,
      startedAt: '2026-09-30T10:00:00.000Z',
      exportedAt: '2026-09-30T10:05:00.000Z',
      provenance: { mission: 'generated simulation' },
      phase: 2,
      decisionModel: 'One course per event',
      decisions: [
        { pointId: 'dp-breach', pointTitle: 'Breach Or Bypass — Building 47', timestamp: 1, phase: 1, outcome: { id: 'dp-breach-hold', title: 'Hold and call for ISR', risk: 'LOW', authoredWeight: 0.85, consequences: 'Full picture', effects: {} } },
      ],
      objectives: [{ id: 'obj-secure', label: 'OBJ-A Secure', progress: 0.18 }],
      events: [],
      metrics: [],
    };
    const result = importSessionRecord(legacy);
    expect(result.kind).toBe('legacy');
    if (result.kind === 'legacy') {
      expect(result.note).toMatch(/cannot be replayed/);
      expect(result.decisions[0].course).toBe('Hold and call for ISR');
    }
  });

  it('rejects files that are not session records', () => {
    expect(importSessionRecord({ hello: 'world' })).toEqual({ kind: 'invalid', errors: ['Not an Orpheus session record.'] });
    const broken = createSessionRecord(createSession(BUILDING_47, 'broken', 'A'));
    expect(importSessionRecord({ ...broken, genesis: 'zz' }).kind).toBe('invalid');
  });

  it('keeps raw audio and personal data out of records', () => {
    const session = run(createSession(BUILDING_47, 'privacy', 'D'), [
      { type: 'note', label: 'Microphone enabled', detail: 'Local audio energy analysis started.', severity: 'watch' },
    ]);
    const serialized = JSON.stringify(createSessionRecord(session));
    expect(serialized).not.toMatch(/audioLevel|samples|getUserMedia|email/);
    expect(createSessionRecord(session).privacy.audio).toMatch(/never recorded/);
  });
});

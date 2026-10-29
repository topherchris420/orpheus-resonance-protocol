import { describe, expect, it } from 'vitest';
import { createSession, dispatch, type MissionSession } from '@/engine/mission/session';
import type { IntelItem } from '@/engine/mission/types';
import { BUILDING_47 } from '@/scenarios/building47';
import type { DecisionSpec } from '@/scenarios/types';
import { analystView, effectsText, feedLines, missionUxInput, openDecisions, stanceText, temporalCoordinates } from './model';

const run = (session: MissionSession, ...commands: Parameters<typeof dispatch>[1][]) =>
  commands.reduce((current, command) => {
    const result = dispatch(current, command);
    if (!result.accepted) throw new Error(result.reason);
    return result.session;
  }, session);

const spec = (id: string): DecisionSpec => BUILDING_47.decisions.find((candidate) => candidate.id === id)!;

describe('command-room model', () => {
  it('numbers open decisions from 1 in shortlist order', () => {
    const { state } = createSession(BUILDING_47, 'model-1', 'D');
    const open = openDecisions(state, BUILDING_47);
    expect(open.map((decision) => decision.index)).toEqual([1, 2]);
    expect(open.map((decision) => decision.runtime.id).sort()).toEqual(['dp-breach', 'dp-casualty']);
  });

  it('says what each course assumes', () => {
    const breach = spec('dp-breach');
    expect(breach.options.map((option) => stanceText(breach, option))).toEqual([
      'Assumes: Two, as reported',
      'Holds whatever the answer',
      'Verifies before relying on any interpretation',
    ]);
    const deception = spec('dp-deception');
    expect(stanceText(deception, deception.options[0])).toBe('Acts on: SIGINT feed');
    expect(effectsText({ stress: 0.18, cohesion: -0.03, hostilePressure: 0 })).toBe('STRESS +18 · COHESION -3 · PRESSURE +0');
  });

  it('grades every claim-bearing evidence item and states the analyst view in ICD 203 terms', () => {
    const { state } = createSession(BUILDING_47, 'model-2', 'D');
    const view = analystView(state, BUILDING_47, 'dp-breach')!;
    expect(view.question).toBe('How many people hold the northern stairwell?');
    const codes = Object.fromEntries(view.evidence.map((line) => [line.item.title, line.code]));
    expect(codes['Access assumption']).toBe('··');
    expect(codes['Occupancy estimate']).toBe('··');
    expect(codes['Thermal UAV pass']).toMatch(/^A[1-6]$/);
    expect(codes['Intercepted chatter']).toMatch(/^B[1-6]$/);
    if (view.status === 'assessment') {
      expect(view.likelihood === null).toBe(view.likelihoodWithheld !== null);
      if (view.likelihood) expect(view.likelihood.probability).toBeGreaterThanOrEqual(view.likelihood.from);
    } else {
      expect(view.headline).toMatch(/^ASSESSMENT WITHHELD — /);
    }
    expect(['HIGH', 'MODERATE', 'LOW']).toContain(view.confidence.level);
    expect(analystView(state, BUILDING_47, 'dp-exfil')).toBeNull();
  });

  it('shows the analyst abstaining when the red team injects an unweighable contradiction', () => {
    let session = createSession(BUILDING_47, 'model-3', 'D');
    session = run(session, { type: 'advancePhase' }, { type: 'toggleRedTeam' });
    const view = analystView(session.state, BUILDING_47, 'dp-breach')!;
    const relay = view.evidence.find((line) => line.item.title === 'Unverified relay')!;
    expect(relay.code).toBe('F6');
    expect(relay.admissible).toBe(false);
  });

  it('prints the SITREP newest first, filtered by clearance, with precedence and grades', () => {
    const intel: IntelItem[] = [
      { id: 'a', tick: 10, message: 'Patrol Alpha-2 reports all clear in sector B-3', priority: 'LOW', source: 'FIELD', clearance: 1, origin: 'generated' },
      { id: 'b', tick: 20, message: 'Satellite imagery shows a possible obstruction at Riverside', priority: 'HIGH', source: 'IMINT', clearance: 3, origin: 'generated' },
      { id: 'c', tick: 30, message: 'Breach executed at Building 47', priority: 'CRITICAL', source: 'COMMAND', clearance: 1, origin: 'command' },
    ];
    const epoch = Date.UTC(2026, 9, 29, 14, 0, 0);
    const lines = feedLines(intel, 2, BUILDING_47, epoch);
    expect(lines.map((line) => line.item.id)).toEqual(['c', 'a']);
    expect(lines[0]).toMatchObject({ code: 'OWN', dtg: '291400Z OCT 26', elapsed: 'T+00:30', precedence: { label: 'FLASH' } });
    expect(lines[1]).toMatchObject({ code: 'B3', precedence: { label: 'ROUTINE', prosign: 'R' } });
    expect(feedLines(intel, 3, BUILDING_47, epoch).map((line) => line.item.id)).toEqual(['c', 'b', 'a']);
  });

  it('derives the temporal archive coordinates from committed decisions and the phase window', () => {
    let session = createSession(BUILDING_47, 'model-4', 'D');
    expect(temporalCoordinates(session.state, BUILDING_47)).toEqual({ timeline: 0, moment: 0 });
    session = run(session, { type: 'advance', ticks: 12 });
    expect(temporalCoordinates(session.state, BUILDING_47)).toEqual({ timeline: 0, moment: 0.4 });
    session = run(session, { type: 'commitDecision', pointId: 'dp-breach', optionId: 'dp-breach-hold', actor: 'participant' }, { type: 'advance', ticks: 30 });
    expect(temporalCoordinates(session.state, BUILDING_47)).toEqual({ timeline: 1, moment: 0.4 });
  });

  it('feeds the mission strip from engine state and the audio status', () => {
    const { state } = createSession(BUILDING_47, 'model-5', 'D');
    const input = missionUxInput(state, { enabled: true, connected: false, error: null }, 10);
    expect(input).toMatchObject({ phase: 1, simulationMode: false, isRedTeamModeActive: false, audioEnabled: true, microphoneConnected: false, bioResonanceFrequency: 10 });
    expect(input.threatCount).toBe(state.world.tracks.length);
  });
});

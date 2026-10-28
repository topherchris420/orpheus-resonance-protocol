import { describe, expect, it } from 'vitest';
import { commitDecision, createMissionSession, pendingDecisionPoints } from './missionSession';
import { createSessionRecord } from './sessionRecord';
const context = { phase: 1, hostileThreatCount: 2, cohesionScore: 0.7, cognitiveStressIndex: 0.4, redTeamActive: false };

describe('authoritative mission decisions', () => {
  it('commits one canonical course and rejects both duplicate and conflicting courses', () => {
    const initial = createMissionSession();
    const next = commitDecision(initial, context, 'dp-breach', 'dp-breach-hold', 1000);
    expect(next.hostilePressure).toBeCloseTo(0.52);
    expect(next.objectives[0].progress).toBeCloseTo(0.18);
    expect(initial.resolvedDecisions).toHaveLength(0);
    expect(next.resolvedDecisions).toHaveLength(1);
    expect(commitDecision(next, context, 'dp-breach', 'dp-breach-hold', 1001)).toBe(next);
    expect(commitDecision(next, context, 'dp-breach', 'dp-breach-dynamic', 1002)).toBe(next);
    expect(pendingDecisionPoints(context, next).some((point) => point.id === 'dp-breach')).toBe(false);
  });
  it('rejects locked events, unknown outcomes, mismatched IDs and invalid timestamps', () => {
    const initial = createMissionSession();
    for (const [point, outcome] of [['dp-exfil', 'dp-exfil-viper'], ['dp-breach', 'fake'], ['dp-breach', 'dp-casualty-evac']]) {
      expect(commitDecision(initial, context, point, outcome, 1)).toBe(initial);
    }
    expect(commitDecision(initial, context, 'dp-breach', 'dp-breach-hold', NaN)).toBe(initial);
  });
  it('replenishes the shortlist and allows every event exactly once across phase changes', () => {
    let session = createMissionSession();
    const finalContext = { ...context, phase: 4, redTeamActive: true };
    while (pendingDecisionPoints(finalContext, session).length) {
      const point = pendingDecisionPoints(finalContext, session)[0];
      session = commitDecision(session, finalContext, point.id, point.outcomes[0].id, 1000);
    }
    expect(session.resolvedDecisions).toHaveLength(5);
    expect(pendingDecisionPoints(context, session)).toHaveLength(0);
    expect(session.objectives.every((objective) => objective.progress >= 0 && objective.progress <= 1)).toBe(true);
    expect(session.hostilePressure).toBeGreaterThanOrEqual(0);
    expect(session.hostilePressure).toBeLessThanOrEqual(1);
    const record = createSessionRecord({ startedAt: 0, exportedAt: 2000, phase: 4, microphoneActive: false, events: [], metrics: [], decisions: session.resolvedDecisions, objectives: session.objectives });
    expect(record.decisions).toHaveLength(5);
    expect(record.decisions[0].outcome.authoredWeight).toBeGreaterThan(0);
    expect(record.objectives[0].progress).toBe(session.objectives[0].progress);
  });
});

import { describe, expect, it } from 'vitest';
import { calculateSquadCohesion, getSessionGuidance, sessionDecisionCount } from './sessionGuidance';

describe('session guidance', () => {
  it('directs a new visitor to decisions', () =>
    expect(getSessionGuidance(1, 2, 0).action).toBe('decisions'));
  it('opens the next phase only when current decisions are exhausted', () => {
    expect(getSessionGuidance(1, 0, 2).action).toBe('advance');
    expect(getSessionGuidance(2, 1, 2).action).toBe('decisions');
  });
  it('finishes when the catalog is exhausted, without requiring an empty fourth phase', () =>
    expect(getSessionGuidance(3, 0, sessionDecisionCount).action).toBe('review'));
  it('does not advance past the final phase', () =>
    expect(getSessionGuidance(4, 0, 1).action).toBe('review'));
});

describe('view-independent squad cohesion', () => {
  it('combines average stress and communications', () =>
    expect(calculateSquadCohesion([0.2, 0.4], 0.9)).toBeCloseTo(0.8));
  it('handles an empty squad and clamps the model output', () => {
    expect(calculateSquadCohesion([], 0.8)).toBe(0.9);
    expect(calculateSquadCohesion([3], 0)).toBe(0);
    expect(calculateSquadCohesion([-1], 2)).toBe(1);
  });
});

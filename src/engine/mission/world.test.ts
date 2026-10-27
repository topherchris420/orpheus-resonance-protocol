import { describe, expect, it } from 'vitest';
import { BUILDING_47 } from '@/scenarios/building47';
import { Rng } from '../rng';
import { MAX_METRICS, MAX_TIMELINE } from './reducer';
import { calculateSquadCohesion, nextStep, shortlist } from './selectors';
import { createSession, dispatch, type MissionSession } from './session';
import type { MissionCommand } from './types';
import { createTracks, generateIntel, MAP_SIZE, MAX_INTEL, MAX_TRACKS } from './world';

/**
 * World-model bounds and session guidance. These port the v1 tests of the realistic-data generator,
 * the session guidance and the record size limits to the deterministic engine.
 */
const run = (session: MissionSession, commands: MissionCommand[]) => {
  let current = session;
  for (const command of commands) {
    const result = dispatch(current, command);
    if (!result.accepted) throw new Error(`Rejected ${command.type}: ${result.reason}`);
    current = result.session;
  }
  return current;
};

const advance = (session: MissionSession, ticks: number) => {
  let current = session;
  for (let remaining = ticks; remaining > 0; remaining -= 600) current = run(current, [{ type: 'advance', ticks: Math.min(600, remaining) }]);
  return current;
};

describe('world model bounds', () => {
  it('keeps the intel feed to the most recent entries', () => {
    const session = advance(createSession(BUILDING_47, 'intel-cap', 'A'), 1500);
    const intel = session.state.world.intel;
    expect(intel.length).toBe(MAX_INTEL);
    const ticks = intel.map((item) => item.tick);
    expect([...ticks].sort((a, b) => a - b)).toEqual(ticks);
    expect(session.state.counters.intel).toBeGreaterThan(MAX_INTEL);
  });

  it('never gives a report a clearance above the current phase', () => {
    const rng = Rng.fromSeed('clearance');
    for (let index = 0; index < 200; index += 1) {
      const phase = 1 + (index % 4);
      const item = generateIntel(rng, `i${index}`, index, phase);
      expect(item.clearance).toBeGreaterThanOrEqual(1);
      expect(item.clearance).toBeLessThanOrEqual(phase);
    }
  });

  it('places tracks inside the map with quality in range, and never exceeds the track limit', () => {
    const created = createTracks(Rng.fromSeed('tracks'), 6, 1, 0);
    expect(created).toHaveLength(6);
    for (const track of created) {
      expect(track.x).toBeGreaterThanOrEqual(10);
      expect(track.x).toBeLessThanOrEqual(389);
      expect(track.y).toBeGreaterThanOrEqual(10);
      expect(track.y).toBeLessThanOrEqual(389);
      expect(track.quality).toBeGreaterThanOrEqual(60);
      expect(track.quality).toBeLessThanOrEqual(99);
    }
    const session = advance(createSession(BUILDING_47, 'track-cap', 'A'), 1200);
    expect(session.state.world.tracks.length).toBeGreaterThan(0);
    expect(session.state.world.tracks.length).toBeLessThanOrEqual(MAX_TRACKS);
    for (const track of session.state.world.tracks) {
      for (const coordinate of [track.x, track.y]) {
        expect(coordinate).toBeGreaterThanOrEqual(10);
        expect(coordinate).toBeLessThanOrEqual(MAP_SIZE - 10);
      }
    }
  });

  it('limits timeline and metric history in long sessions', () => {
    let session = createSession(BUILDING_47, 'history-cap', 'A');
    for (let index = 0; index < MAX_TIMELINE + 20; index += 1) {
      session = run(session, [{ type: 'note', label: 'Note', detail: `Entry ${index}`, severity: 'nominal' }]);
    }
    session = advance(session, 600);
    expect(session.state.timeline.length).toBe(MAX_TIMELINE);
    expect(session.state.metrics.length).toBe(MAX_METRICS);
  });
});

describe('squad cohesion model', () => {
  it('combines average stress and communications', () => expect(calculateSquadCohesion([0.2, 0.4], 0.9)).toBeCloseTo(0.8));
  it('handles an empty squad and clamps the output', () => {
    expect(calculateSquadCohesion([], 0.8)).toBe(0.9);
    expect(calculateSquadCohesion([3], 0)).toBe(0);
    expect(calculateSquadCohesion([-1], 2)).toBe(1);
  });
});

describe('session guidance', () => {
  it('directs a new visitor to the open decision', () => {
    const session = advance(createSession(BUILDING_47, 'guidance', 'A'), 5);
    expect(shortlist(session.state, BUILDING_47).length).toBeGreaterThan(0);
    expect(nextStep(session.state, BUILDING_47)).toBe('decide');
  });

  it('offers the next phase only when no decision is open, and review once the catalog is done', () => {
    let session = advance(createSession(BUILDING_47, 'guidance-full', 'A'), 5);
    const seen: string[] = [];
    for (let guard = 0; guard < 40 && nextStep(session.state, BUILDING_47) !== 'review'; guard += 1) {
      const step = nextStep(session.state, BUILDING_47);
      seen.push(step);
      if (step === 'decide') {
        const [open] = shortlist(session.state, BUILDING_47);
        expect(open).toBeDefined();
        const spec = BUILDING_47.decisions.find((candidate) => candidate.id === open.id)!;
        session = run(session, [{ type: 'commitDecision', pointId: open.id, optionId: spec.options[0].id, actor: 'participant' }]);
      } else if (step === 'advance') {
        expect(session.state.decisions.some((decision) => decision.status === 'open')).toBe(false);
        session = run(session, [{ type: 'advancePhase' }]);
        if (session.state.phase === 2 && !session.state.redTeam.active) session = run(session, [{ type: 'toggleRedTeam' }]);
      }
      session = advance(session, 12);
    }
    expect(nextStep(session.state, BUILDING_47)).toBe('review');
    expect(seen).toContain('advance');
    expect(session.state.decisions.every((decision) => decision.status === 'resolved')).toBe(true);
  });
});

import { describe, expect, test } from 'vitest';
import {
  appendOperatorEvent,
  deriveMissionUx,
  getTelemetryAssessment,
} from './missionUx';

describe('deriveMissionUx', () => {
  test('prioritizes red-team conflict as critical next action', () => {
    const state = deriveMissionUx({
      phase: 3,
      simulationMode: true,
      isRedTeamModeActive: true,
      cognitiveStressIndex: 0.42,
      cohesionScore: 0.72,
      threatCount: 2,
      hostileThreatCount: 1,
      audioEnabled: true,
      microphoneConnected: true,
      audioError: null,
      conflictingIntel: 'Conflicting intel report detected.',
      bioResonanceFrequency: 8,
    });

    expect(state.threatLevel).toBe('critical');
    expect(state.nextAction).toBe('Resolve conflicting intel before advancing the simulation.');
    expect(state.alerts[0]).toMatchObject({
      id: 'red-team-conflict',
      severity: 'critical',
    });
  });

  test('surfaces audio permission as a watch alert without overriding critical stress', () => {
    const state = deriveMissionUx({
      phase: 2,
      simulationMode: true,
      isRedTeamModeActive: false,
      cognitiveStressIndex: 0.86,
      cohesionScore: 0.68,
      threatCount: 1,
      hostileThreatCount: 0,
      audioEnabled: true,
      microphoneConnected: false,
      audioError: 'Microphone access was denied.',
      conflictingIntel: null,
      bioResonanceFrequency: 10,
    });

    expect(state.threatLevel).toBe('critical');
    expect(state.alerts.map((alert) => alert.id)).toContain('operator-stress');
    expect(state.alerts.map((alert) => alert.id)).toContain('audio-error');
  });
});

describe('getTelemetryAssessment', () => {
  test('returns severity, trend, and recommendation for operator telemetry', () => {
    expect(
      getTelemetryAssessment({
        hrv: 48,
        respiratoryRate: 22,
        cognitiveStressIndex: 0.76,
        previousCognitiveStressIndex: 0.52,
      }),
    ).toMatchObject({
      severity: 'watch',
      trend: 'up',
      recommendation: 'Reduce task load and shift bio-resonance support toward calm.',
    });
  });
});

describe('appendOperatorEvent', () => {
  test('keeps the newest events first and caps history', () => {
    const events = Array.from({ length: 14 }, (_, index) =>
      appendOperatorEvent([], {
        id: `event-${index}`,
        timestamp: index,
        label: `Event ${index}`,
        detail: 'Generated event',
        severity: 'nominal',
      })[0],
    );

    const history = events.reduce(
      (current, event) => appendOperatorEvent(current, event, 10),
      [],
    );

    expect(history).toHaveLength(10);
    expect(history[0].id).toBe('event-13');
    expect(history[9].id).toBe('event-4');
  });
});

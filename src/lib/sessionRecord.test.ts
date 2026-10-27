import { describe, expect, it } from 'vitest';
import { createSessionRecord } from './sessionRecord';

describe('simulation record', () => {
  it('limits history and identifies generated signals without microphone samples', () => {
    const record = createSessionRecord({
      startedAt: 0,
      exportedAt: 1000,
      phase: 2,
      microphoneActive: true,
      events: Array.from({ length: 140 }, (_, index) => ({
        id: String(index), timestamp: index, label: 'Scenario', detail: 'Generated', severity: 'nominal' as const,
      })),
      metrics: Array.from({ length: 60 }, (_, index) => ({
        timestamp: index, stress: 0.2, cohesion: 0.8, hostilePressure: 0.3, intelAccuracy: 0.9,
      })),
    });
    expect(record.schema).toBe('orpheus.simulation-session.v1');
    expect(record.provenance.vitals).toBe('generated simulation');
    expect(record.provenance.microphone).toContain('samples excluded');
    expect(record.events).toHaveLength(120);
    expect(record.metrics).toHaveLength(48);
    expect(JSON.stringify(record)).not.toContain('"id"');
  });
});

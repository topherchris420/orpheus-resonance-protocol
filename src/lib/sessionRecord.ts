import type { ResolvedDecision } from './missionSession';
import type { MissionObjective } from '../data/decisionScenarios';
import type { MetricSample } from '@/hooks/useMetricsHistory';
import type { OperatorEvent } from './missionUx';

export interface SessionRecordInput {
  startedAt: number;
  exportedAt: number;
  phase: number;
  microphoneActive: boolean;
  events: OperatorEvent[];
  metrics: MetricSample[];
  decisions?: ResolvedDecision[];
  objectives?: MissionObjective[];
}

/** A bounded, explicit snapshot. Raw microphone samples and browser credentials are never inputs. */
export const createSessionRecord = ({ startedAt, exportedAt, phase, microphoneActive, events, metrics, decisions = [], objectives = [] }: SessionRecordInput) => ({
  schema: 'orpheus.simulation-session.v1' as const,
  startedAt: new Date(startedAt).toISOString(),
  exportedAt: new Date(exportedAt).toISOString(),
  provenance: {
    mission: 'generated simulation',
    squad: 'generated simulation',
    vitals: 'generated simulation',
    metrics: 'generated simulation',
    microphone: microphoneActive ? 'local audio energy enabled; samples excluded' : 'off',
  },
  phase,
  decisionModel: 'One course per event; deterministic authored effects; weights are not calibrated probabilities.',
  decisions: decisions.map(({ pointId, pointTitle, timestamp, phase, outcome }) => ({
    pointId, pointTitle, timestamp, phase,
    outcome: { id: outcome.id, title: outcome.title, risk: outcome.risk, authoredWeight: outcome.probability,
      consequences: outcome.consequences, effects: { ...outcome.effects } },
  })),
  objectives: objectives.map(({ id, label, progress }) => ({ id, label, progress })),
  events: events.slice(0, 120).map(({ timestamp, label, detail, severity }) => ({ timestamp, label, detail, severity })),
  metrics: metrics.slice(-48).map(({ timestamp, stress, cohesion, hostilePressure, intelAccuracy }) => ({
    timestamp, stress, cohesion, hostilePressure, intelAccuracy,
  })),
});

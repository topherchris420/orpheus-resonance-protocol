import type { AssessmentOutput, AssistanceCondition } from '@/assistant/schema';
import type { GeneratedEvidence } from '@/scenarios/evidence';
import type { OptionStance, Severity } from '@/scenarios/types';
import type { RngState } from '../rng';

export interface Point {
  x: number;
  y: number;
}

export type TrackKind = 'hostile' | 'unknown' | 'friendly';

/** A fictional contact on the situation map. `quality` is a generated track attribute, not an AI estimate. */
export interface Track {
  id: string;
  kind: TrackKind;
  x: number;
  y: number;
  quality: number;
  updatedTick: number;
}

export interface SquadMember {
  id: string;
  callSign: string;
  x: number;
  y: number;
  status: 'active' | 'wounded' | 'offline';
  /** Generated values; nothing here measures a person. */
  heartRate: number;
  oxygenSat: number;
}

export interface IntelItem {
  id: string;
  tick: number;
  message: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  source: string;
  clearance: number;
  origin: 'generated' | 'command' | 'red-team';
}

/** Generated vitals of the fictional operator character. */
export interface SimulatedVitals {
  hrv: number;
  respiratoryRate: number;
  stress: number;
}

export interface WorldState {
  tracks: Track[];
  squad: SquadMember[];
  route: Point[];
  intel: IntelItem[];
  vitals: SimulatedVitals;
  nextIntelTick: number;
}

export interface TimelineEvent {
  id: string;
  tick: number;
  label: string;
  detail: string;
  severity: Severity;
}

export interface MetricSample {
  tick: number;
  stress: number;
  cohesion: number;
  hostilePressure: number;
  feedReliability: number;
}

export interface DecisionRuntime {
  id: string;
  status: 'locked' | 'open' | 'resolved';
  /** Hidden ground truth, fixed when the session is created. */
  truth: string;
  openedAtTick: number | null;
  evidence: GeneratedEvidence | null;
  /** Whether red-team items have been injected into this decision's evidence. */
  redTeamInjected: boolean;
}

export type Correctness = 'correct' | 'wrong' | 'deferred';

export interface ResolvedDecision {
  pointId: string;
  pointTitle: string;
  optionId: string;
  optionTitle: string;
  stance: OptionStance;
  /** Hypothesis the course relied on, if it committed to one. */
  reliedOn: string | null;
  truth: string;
  correctness: Correctness;
  polarityError: 'false-alarm' | 'miss' | null;
  utility: number;
  tick: number;
  phase: number;
  actor: 'participant' | 'agent';
  condition: AssistanceCondition;
  confidence: number | null;
  latencyMs: number | null;
  selectionChanges: number | null;
  /** Exactly what the assistant showed when the decision was committed. */
  assistant: AssessmentOutput | null;
  /** Whether the declared-model analysis judged the evidence sufficient at commit time. */
  evidenceSufficient: boolean;
  appliedEffects: { stress: number; cohesion: number; hostilePressure: number; objectiveProgress: number; assumptionWrong: boolean };
  narrative: string;
}

export interface MissionState {
  schema: 'orpheus.mission-state.v1';
  scenario: { id: string; version: string; manifestHash: string };
  seed: string;
  condition: AssistanceCondition;
  tick: number;
  phase: number;
  phaseStartedTick: number;
  autoAdvance: boolean;
  rng: { world: RngState; intel: RngState; redTeam: RngState };
  world: WorldState;
  redTeam: { active: boolean; intensity: number; line: string | null };
  modifiers: { hostilePressure: number; stressModifier: number; cohesionModifier: number };
  objectives: Array<{ id: string; label: string; detail: string; progress: number }>;
  decisions: DecisionRuntime[];
  resolved: ResolvedDecision[];
  timeline: TimelineEvent[];
  metrics: MetricSample[];
  inspections: Array<{ tick: number; pointId: string; evidenceId: string }>;
  counters: { event: number; track: number; intel: number };
}

export type MissionCommand =
  | { type: 'advance'; ticks: number }
  | { type: 'advancePhase' }
  | { type: 'setAutoAdvance'; enabled: boolean }
  | { type: 'toggleRedTeam' }
  | { type: 'setCondition'; condition: AssistanceCondition }
  | { type: 'inspectEvidence'; pointId: string; evidenceId: string }
  | {
      type: 'commitDecision';
      pointId: string;
      optionId: string;
      actor: 'participant' | 'agent';
      confidence?: number;
      latencyMs?: number;
      selectionChanges?: number;
    }
  | { type: 'note'; label: string; detail: string; severity: Severity };

export type CommandResult = { state: MissionState; accepted: true } | { state: MissionState; accepted: false; reason: string };

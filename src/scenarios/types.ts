import type { EvidenceKind, Hypothesis, PayloadValue, SourceProfile } from '@/evidence/types';

export type ScenarioTag = 'hostile' | 'cohesion' | 'stress' | 'redteam' | 'baseline' | 'orientation';
export type Severity = 'nominal' | 'watch' | 'critical';

export interface OutcomeEffects {
  /** Change to the modeled stress of the fictional operator (-1..1). */
  stress: number;
  /** Change to modeled squad cohesion (0..1 scale). */
  cohesion: number;
  /** Change to hostile pressure, which drives contact generation. */
  hostilePressure: number;
  /** Report injected into the feed when the course is committed. */
  intel: string;
  severity: Severity;
  /** Objective progress contribution (0..1). */
  objectiveProgress: number;
}

/**
 * What a course of action assumes about the world.
 * - commit: acts as if a hypothesis is true.
 * - commit-claim: acts on whatever a specific report claims ("trust SIGINT").
 * - verify: gathers more evidence before relying on any interpretation.
 * - hedge: acts in a way that does not depend on the open question.
 */
export type OptionStance =
  | { kind: 'commit'; hypothesisId: string }
  | { kind: 'commit-claim'; evidenceId: string }
  | { kind: 'verify' }
  | { kind: 'hedge' };

export interface DecisionOption {
  id: string;
  title: string;
  consequences: string;
  risk: 'LOW' | 'MODERATE' | 'HIGH';
  /** Authored scenario metadata from the original catalog. Not a probability of success. */
  authoredWeight: number;
  effects: OutcomeEffects;
  stance: OptionStance;
}

export type ClaimMode =
  /** Honest source: asserts the state of the world when observed, with its class accuracy. */
  | { mode: 'truthful' }
  /** Adversarial or spoofed: asserts the opposite of the truth. */
  | { mode: 'opposite' }
  /** Asserts the opposite of another item's claim (the two always disagree). */
  | { mode: 'contradicts'; evidenceId: string }
  /** Scripted claim, used by the guided orientation so the lesson is the same for everyone. */
  | { mode: 'fixed'; hypothesisId: string }
  /** Context only. */
  | { mode: 'none' };

export interface EvidenceRecipe {
  id: string;
  kind: EvidenceKind;
  title: string;
  /** Text by claimed hypothesis id, or one text for context items. */
  text: string | Record<string, string>;
  sourceId?: string;
  claim: ClaimMode;
  /** Ticks relative to when the decision becomes available (negative = earlier). */
  observedOffset: number;
  /** Transmission delay in ticks. */
  delay?: number;
  originId?: string;
  relayOf?: string;
  fulfills?: string;
  fields?: Record<string, PayloadValue>;
  /** Extra payload fields that depend on the claim. */
  claimFields?: Record<string, Record<string, PayloadValue>>;
  selfReportedConfidence?: 'low' | 'moderate' | 'high';
  parents?: string[];
  /** Corrupted in transit: the receiver sees the flipped claim; the digest no longer matches. */
  corrupt?: boolean;
  /** Present only when the red-team simulation is active when the decision opens. */
  onlyWhenRedTeam?: boolean;
}

export interface DecisionSpec {
  id: string;
  title: string;
  situation: string;
  question: string;
  tag: ScenarioTag;
  objectiveId: string;
  minPhase: number;
  /** Decision becomes available only after this decision is resolved. */
  after?: string;
  hypotheses: Hypothesis[];
  prior: Record<string, number>;
  truth: { mode: 'sampled' } | { mode: 'fixed'; hypothesisId: string };
  evidence: EvidenceRecipe[];
  expected?: Array<{ id: string; sourceId: string; label: string; dueOffset: number }>;
  shifts?: Array<{ id: string; sourceId: string; fromOffset: number; note: string }>;
  options: DecisionOption[];
  /** Added to a committed course's effects when the interpretation it relied on was false. */
  ifAssumptionWrong: { effects: Omit<OutcomeEffects, 'intel' | 'severity'>; narrative: string };
}

export interface WorldConfig {
  squad: string[];
  initialTracks: number;
  redTeamAvailable: boolean;
  intel: boolean;
}

export interface ScenarioManifest {
  schema: 'orpheus.scenario-manifest.v1';
  id: string;
  version: string;
  title: string;
  summary: string;
  fictionNotice: string;
  tickSeconds: number;
  phases: Array<{ index: number; label: string; description: string }>;
  autoAdvanceTicks: number;
  shortlistSize: number;
  sources: SourceProfile[];
  objectives: Array<{ id: string; label: string; detail: string; initialProgress: number }>;
  decisions: DecisionSpec[];
  world: WorldConfig;
  payoff: Payoff;
}

/** Decision payoffs. The threshold for concluding follows from them (see `thresholdFromPayoff`). */
export interface Payoff {
  correct: number;
  wrong: number;
  defer: number;
}

/** Conclude iff P(correct) * correct + (1 - P) * wrong >= defer. */
export const thresholdFromPayoff = ({ correct, wrong, defer }: Payoff): number => (defer - wrong) / (correct - wrong);

export const DEFAULT_PAYOFF: Payoff = { correct: 1, wrong: -4, defer: 0 };

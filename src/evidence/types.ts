/**
 * Evidence model shared by the simulation, the assistant and the interface.
 *
 * Everything in `EvidenceContext` is what a participant (and the assistant) can see. Ground truth and
 * the generator's hidden behavior never appear here; they live in the trial's `TruthRecord`, which the
 * assistant cannot receive.
 */

/**
 * - observation: a direct simulated sensor observation.
 * - report: a generated intelligence report relayed by a person or channel.
 * - derived: an estimate computed from other items (never independent evidence).
 * - assumption: a declared modeling assumption or scenario premise (context, not evidence).
 * - ai-statement: text produced by an assistant. Never admissible as evidence.
 */
export type EvidenceKind = 'observation' | 'report' | 'derived' | 'assumption' | 'ai-statement';

/** Source reliability grades adapted from the public Admiralty (NATO) grading scheme. */
export type ReliabilityClass = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export type HypothesisPolarity = 'alarm' | 'benign' | 'neutral';

export interface Hypothesis {
  id: string;
  /** Full statement, e.g. "Activity is present at Overpass Delta". */
  label: string;
  /** Short label for compact displays, e.g. "Activity present". */
  short: string;
  /** Used to classify wrong conclusions as false alarms or misses. */
  polarity: HypothesisPolarity;
}

export type SourceMedium = 'sensor' | 'telemetry' | 'signals' | 'human' | 'relay' | 'open';

export interface SourceProfile {
  id: string;
  label: string;
  medium: SourceMedium;
  reliability: ReliabilityClass;
  /** Ticks for which this source's claims are treated as current. */
  freshnessTicks: number;
  description?: string;
}

export type PayloadValue = string | number | boolean;

export interface EvidenceItem {
  id: string;
  kind: EvidenceKind;
  title: string;
  text: string;
  sourceId?: string;
  /** Hypothesis asserted by the payload; absent for context-only items. */
  claim?: string;
  observedAtTick: number;
  receivedAtTick: number;
  /** Independence group: items with the same origin are not independent confirmations. */
  originId: string;
  /** Set when this item relays another item. */
  relayOf?: string;
  /** Scheduled observation this item fulfills, if any. */
  fulfills?: string;
  /** Structured fields as transmitted. `claim` mirrors the payload's claim field. */
  payload: Record<string, PayloadValue>;
  /** Digest transmitted with the payload. A mismatch means the contents changed after sending. */
  digest: string;
  /** The source's own statement about its confidence. Recorded, never used as weight. */
  selfReportedConfidence?: 'low' | 'moderate' | 'high';
  /** Items a derived estimate was computed from. */
  parents?: string[];
}

export interface ExpectedObservation {
  id: string;
  sourceId: string;
  label: string;
  dueTick: number;
}

export interface AssumptionShift {
  id: string;
  sourceId: string;
  fromTick: number;
  note: string;
}

export interface EvidenceContext {
  decisionId: string;
  question: string;
  hypotheses: Hypothesis[];
  /** Declared prior over hypotheses (sums to 1). */
  prior: Record<string, number>;
  /** Declared source registry: the public model the assistant reasons with. */
  sources: SourceProfile[];
  items: EvidenceItem[];
  expected: ExpectedObservation[];
  shifts: AssumptionShift[];
  nowTick: number;
  tickSeconds: number;
}

export type ExclusionReason =
  | 'ai-statement'
  | 'assumption'
  | 'derived'
  | 'no-claim'
  | 'integrity-failure'
  | 'implausible-field'
  | 'unverifiable-source'
  | 'source-model-changed'
  | 'expired'
  | 'duplicate-origin';

export type ItemFlag = 'stale' | 'late-arrival' | 'confidence-claim-unsupported' | 'relay' | 'conflicting';

export interface ItemAssessment {
  id: string;
  admissible: boolean;
  exclusion?: ExclusionReason;
  /** Explanation of the exclusion in plain language. */
  exclusionDetail?: string;
  /** Declared accuracy for the source class, before discounts. */
  declaredAccuracy?: number;
  /** Accuracy actually used after staleness discount. */
  effectiveAccuracy?: number;
  ageTicks: number;
  flags: ItemFlag[];
}

export type AbstentionReason =
  | 'no-admissible-evidence'
  | 'model-misfit'
  | 'unresolved-conflict'
  | 'insufficient-confidence';

export interface ConflictRecord {
  hypotheses: [string, string];
  itemIds: [string[], string[]];
}

export interface EvidenceReport {
  method: 'aware-bayes-v1' | 'naive-bayes-v1';
  threshold: number;
  items: ItemAssessment[];
  admissibleIds: string[];
  missing: ExpectedObservation[];
  conflicts: ConflictRecord[];
  /** Number of distinct admissible origins supporting each hypothesis. */
  support: Record<string, number>;
  posterior: Record<string, number>;
  leading: string;
  leadingProbability: number;
  misfit: { checked: boolean; tailProbability: number | null; detected: boolean };
  shiftedSources: string[];
  domain: { evaluated: boolean; reasons: string[] };
  sufficiency: { sufficient: boolean; reason?: AbstentionReason };
}

import type { ABSTENTION_REASONS } from '@/assistant/schema';
import { assistantFor, effectiveCohesion, evidenceContextFor, evidenceReportFor, hostileTrackCount, shortlist, specFor } from '@/engine/mission/selectors';
import type { DecisionRuntime, IntelItem, MissionState } from '@/engine/mission/types';
import { RELIABILITY_LABEL } from '@/evidence/sources';
import type { EvidenceItem, ExclusionReason } from '@/evidence/types';
import type { MissionUxInput } from '@/lib/missionUx';
import type { DecisionOption, DecisionSpec, OutcomeEffects, ScenarioManifest } from '@/scenarios/types';
import { CREDIBILITY_LABEL, gradeCode, gradeEvidence, gradeFeed, type FeedGrade, type Grade } from '@/tradecraft/admiralty';
import { formatDtg, formatElapsed, tickInstant } from '@/tradecraft/dtg';
import { analyticConfidence, estimativeFor, type AnalyticConfidence, type EstimativeTerm } from '@/tradecraft/estimative';
import { precedenceOf, type Precedence } from '@/tradecraft/precedence';

/**
 * What the command room shows, computed from engine state. The panels and the operator console both
 * read these functions, so a decision numbered [2] in the matrix is [2] at the prompt, and an
 * evidence grade is the same wherever it appears.
 */

export interface OpenDecision {
  /** 1-based position on the shortlist, as shown and as typed (`brief 2`). */
  index: number;
  runtime: DecisionRuntime;
  spec: DecisionSpec;
}

export const openDecisions = (state: MissionState, manifest: ScenarioManifest): OpenDecision[] =>
  shortlist(state, manifest).map((runtime, position) => ({ index: position + 1, runtime, spec: specFor(manifest, runtime.id)! }));

const hypothesisShort = (spec: DecisionSpec, id: string) => spec.hypotheses.find((hypothesis) => hypothesis.id === id)?.short ?? id;

/** What a course of action takes for granted about the open question. */
export const stanceText = (spec: DecisionSpec, option: DecisionOption): string => {
  switch (option.stance.kind) {
    case 'commit':
      return `Assumes: ${hypothesisShort(spec, option.stance.hypothesisId)}`;
    case 'commit-claim': {
      const evidenceId = option.stance.evidenceId;
      return `Acts on: ${spec.evidence.find((recipe) => recipe.id === evidenceId)?.title ?? evidenceId}`;
    }
    case 'verify':
      return 'Verifies before relying on any interpretation';
    case 'hedge':
      return 'Holds whatever the answer';
  }
};

const signed = (value: number) => `${value >= 0 ? '+' : ''}${Math.round(value * 100)}`;

export const effectsText = (effects: Pick<OutcomeEffects, 'stress' | 'cohesion' | 'hostilePressure'>): string =>
  `STRESS ${signed(effects.stress)} · COHESION ${signed(effects.cohesion)} · PRESSURE ${signed(effects.hostilePressure)}`;

// --- Analyst assessment ----------------------------------------------------------------------------

export interface EvidenceLine {
  item: EvidenceItem;
  /** Admiralty grade; null for context (assumptions, derived estimates). */
  grade: Grade | null;
  code: string;
  sourceLabel: string;
  admissible: boolean;
  exclusion: ExclusionReason | null;
  exclusionDetail: string | null;
}

export const ABSTENTION_LABEL: Record<(typeof ABSTENTION_REASONS)[number], string> = {
  'no-admissible-evidence': 'NO ADMISSIBLE EVIDENCE',
  'model-misfit': 'EVIDENCE DOES NOT FIT THE SOURCE MODEL',
  'unresolved-conflict': 'UNRESOLVED CONFLICT',
  'insufficient-confidence': 'INSUFFICIENT CONFIDENCE',
  'guardrail-rejection': 'ASSESSMENT REJECTED BY GUARDRAILS',
  'assistant-unavailable': 'ANALYST UNAVAILABLE',
};

export interface AnalystView {
  question: string;
  status: 'assessment' | 'abstention';
  /** The assessed interpretation, or the reason none is given. */
  headline: string;
  /** ICD 203 likelihood when the probability is reportable; null when withheld or abstaining. */
  likelihood: (EstimativeTerm & { probability: number }) | null;
  likelihoodWithheld: string | null;
  confidence: AnalyticConfidence;
  explanation: string;
  recommendation: string | null;
  evidence: EvidenceLine[];
}

/**
 * The uncertainty-aware analyst's view of one decision: the engine's evidence report with Admiralty
 * grades, and the guardrailed assessment (or abstention) in ICD 203 terms. A probability is put into
 * words only when the assistant itself reports it, i.e. when it is calibrated for these conditions.
 */
export const analystView = (state: MissionState, manifest: ScenarioManifest, pointId: string): AnalystView | null => {
  const context = evidenceContextFor(state, manifest, pointId);
  const report = evidenceReportFor(state, manifest, pointId);
  const output = assistantFor(state, manifest, pointId)?.output;
  const spec = specFor(manifest, pointId);
  if (!context || !report || !output || !spec) return null;

  const grades = gradeEvidence(context, report);
  const assessments = new Map(report.items.map((assessment) => [assessment.id, assessment]));
  const sources = new Map(context.sources.map((source) => [source.id, source]));
  const evidence = context.items.map((item): EvidenceLine => {
    const grade = grades.get(item.id) ?? null;
    const assessment = assessments.get(item.id);
    return {
      item,
      grade,
      code: grade ? gradeCode(grade) : '··',
      sourceLabel: item.sourceId ? (sources.get(item.sourceId)?.label ?? item.sourceId) : item.kind === 'assumption' ? 'Premise' : 'Derived',
      admissible: assessment?.admissible ?? false,
      exclusion: assessment?.exclusion ?? null,
      exclusionDetail: assessment?.exclusionDetail ?? null,
    };
  });

  const probability = output.uncertainty?.probability;
  const likelihood = probability ? { ...estimativeFor(probability.value), probability: probability.value } : null;
  const assessed = output.status === 'assessment' && output.assessment;
  const leadingLabel = spec.hypotheses.find((hypothesis) => hypothesis.id === report.leading)?.label ?? report.leading;
  return {
    question: context.question,
    status: assessed ? 'assessment' : 'abstention',
    headline: assessed ? leadingLabel : `ASSESSMENT WITHHELD — ${ABSTENTION_LABEL[output.abstention?.reason ?? 'insufficient-confidence']}`,
    likelihood: assessed ? likelihood : null,
    likelihoodWithheld: assessed && !likelihood ? (output.uncertainty?.probabilityWithheld ?? 'Probability not reportable.') : null,
    confidence: analyticConfidence(report),
    explanation: output.status === 'abstention' ? (output.abstention?.explanation ?? '') : (output.explanation ?? ''),
    recommendation: output.recommendation?.text ?? null,
    evidence,
  };
};

export const describeGrade = (grade: Grade): string =>
  `${gradeCode(grade)} · ${RELIABILITY_LABEL[grade.reliability]} source · ${CREDIBILITY_LABEL[grade.credibility]}`;

// --- SITREP ----------------------------------------------------------------------------------------

export interface FeedLine {
  item: IntelItem;
  dtg: string;
  elapsed: string;
  precedence: Precedence;
  grade: FeedGrade;
  /** "B2", "F6", or "OWN" for your own recorded courses. */
  code: string;
}

/** The SITREP feed, newest first, filtered to what the given clearance may read. */
export const feedLines = (intel: readonly IntelItem[], clearance: number, manifest: Pick<ScenarioManifest, 'tickSeconds'>, epochMs: number): FeedLine[] => {
  const grades = gradeFeed(intel);
  return intel
    .filter((item) => item.clearance <= clearance)
    .slice()
    .reverse()
    .map((item) => {
      const grade = grades.get(item.id)!;
      return {
        item,
        dtg: formatDtg(tickInstant(epochMs, item.tick, manifest.tickSeconds)),
        elapsed: formatElapsed(item.tick, manifest.tickSeconds),
        precedence: precedenceOf(item.priority),
        grade,
        code: grade.kind === 'own' ? 'OWN' : gradeCode(grade),
      };
    });
};

// --- Instruments -----------------------------------------------------------------------------------

export interface AudioStatus {
  enabled: boolean;
  connected: boolean;
  error: string | null;
}

/** Input for the mission strip and alert queue (see lib/missionUx). */
export const missionUxInput = (state: MissionState, audio: AudioStatus, displayMarker: number): MissionUxInput => ({
  phase: state.phase,
  simulationMode: state.phase >= 2,
  isRedTeamModeActive: state.redTeam.active,
  cognitiveStressIndex: state.world.vitals.stress,
  cohesionScore: effectiveCohesion(state),
  threatCount: state.world.tracks.length + (state.redTeam.line ? 1 : 0),
  hostileThreatCount: hostileTrackCount(state),
  audioEnabled: audio.enabled,
  microphoneConnected: audio.connected,
  audioError: audio.error,
  conflictingIntel: state.redTeam.line,
  bioResonanceFrequency: displayMarker,
});

/**
 * Coordinates of the temporal archive. Each committed decision opens a new timeline; the moment cycles
 * through the current phase's auto-advance window. Both follow from state, so the archive reads the
 * same on replay.
 */
export const temporalCoordinates = (state: MissionState, manifest: ScenarioManifest): { timeline: number; moment: number } => {
  const window = Math.max(1, manifest.autoAdvanceTicks);
  const elapsed = Math.max(0, state.tick - state.phaseStartedTick);
  return { timeline: state.resolved.length, moment: (elapsed % window) / window };
};

/** Clearance follows the phase, as it did in the original archive. */
export const clearanceOf = (state: MissionState): number => state.phase;

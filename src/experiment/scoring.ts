import type { AssessmentOutput } from '@/assistant/schema';
import { assessEvidence } from '@/evidence/engine';
import type { EvidenceReport } from '@/evidence/types';
import type { TrialOptionId, TrialSpec } from '@/scenarios/taskFamily';
import type { Payoff } from '@/scenarios/types';

/**
 * Trial scoring against the predeclared ground truth and payoff matrix. The "declared analysis" used
 * for reference agreement and missed critical information is the uncertainty-aware evidence analysis
 * under the public source model — the standard a careful analyst could reach from what was shown.
 */
export interface TrialScore {
  committed: boolean;
  committedHypothesis: 'alarm' | 'benign' | null;
  correct: boolean;
  utility: number;
  falseAlarm: boolean;
  miss: boolean;
  referenceOption: TrialOptionId;
  matchesReference: boolean;
  /** The trial contains a data-quality problem a careful analyst must account for. */
  hasQualityIssue: boolean;
  missedCritical: boolean;
  evidenceSufficient: boolean;
}

export const optionHypothesis = (optionId: TrialOptionId): 'alarm' | 'benign' | null =>
  optionId === 'conclude-alarm' ? 'alarm' : optionId === 'conclude-benign' ? 'benign' : null;

export const hypothesisOption = (hypothesis: string): TrialOptionId =>
  hypothesis === 'alarm' ? 'conclude-alarm' : hypothesis === 'benign' ? 'conclude-benign' : 'verify';

export const declaredAnalysis = (trial: TrialSpec, threshold: number): EvidenceReport => assessEvidence(trial.context, { threshold });

export const referenceOption = (report: EvidenceReport): TrialOptionId =>
  report.sufficiency.sufficient ? hypothesisOption(report.leading) : 'verify';

/** The option a participant adopts by following the assistant: its conclusion, or "verify" if it abstained. */
export const adviceOption = (output: AssessmentOutput | null): TrialOptionId | null => {
  if (!output) return null;
  if (output.status === 'abstention' || !output.assessment) return 'verify';
  return hypothesisOption(output.assessment.hypothesisId);
};

export const scoreTrial = (trial: TrialSpec, finalOption: TrialOptionId, payoff: Payoff, threshold: number): TrialScore => {
  const report = declaredAnalysis(trial, threshold);
  const committedHypothesis = optionHypothesis(finalOption);
  const committed = committedHypothesis !== null;
  const correct = committed && committedHypothesis === trial.truth;
  const reference = referenceOption(report);
  const hasQualityIssue = trial.condition !== 'clean' && trial.condition !== 'overload' && trial.condition !== 'ai-contradictory';
  return {
    committed,
    committedHypothesis,
    correct,
    utility: !committed ? payoff.defer : correct ? payoff.correct : payoff.wrong,
    falseAlarm: committed && committedHypothesis === 'alarm' && trial.truth === 'benign',
    miss: committed && committedHypothesis === 'benign' && trial.truth === 'alarm',
    referenceOption: reference,
    matchesReference: finalOption === reference,
    hasQualityIssue,
    missedCritical: hasQualityIssue && committed && (!report.sufficiency.sufficient || committedHypothesis !== report.leading),
    evidenceSufficient: report.sufficiency.sufficient,
  };
};

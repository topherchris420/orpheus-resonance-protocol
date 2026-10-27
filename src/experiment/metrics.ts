import type { AssistanceCondition } from '@/assistant/schema';
import type { InformationCondition } from '@/scenarios/taskFamily';
import { TLX_SUBSCALES, type MetricId } from './protocol';
import { optionHypothesis } from './scoring';
import { median, meanOf } from './stats';
import type { QuestionnaireResponse, TrialResponse } from './study';

/**
 * Metric values for a set of responses. Every value is a ratio of counts (numerator / denominator),
 * kept together so pooled proportions and their intervals can be computed honestly. A metric with a
 * zero denominator is `null`, never 0.
 */
export interface Ratio {
  numerator: number;
  denominator: number;
  value: number | null;
}

export type MetricValues = Record<MetricId, Ratio>;

const ratio = (numerator: number, denominator: number): Ratio => ({ numerator, denominator, value: denominator > 0 ? numerator / denominator : null });
const average = (values: number[]): Ratio => ({ numerator: values.reduce((total, value) => total + value, 0), denominator: values.length, value: values.length ? meanOf(values) : null });

export const computeMetrics = (responses: readonly TrialResponse[], questionnaires: readonly QuestionnaireResponse[] = []): MetricValues => {
  const committed = responses.filter((response) => response.score.committed);
  const benign = responses.filter((response) => response.truth === 'benign');
  const alarm = responses.filter((response) => response.truth === 'alarm');
  const quality = responses.filter((response) => response.score.hasQualityIssue);
  const assisted = responses.filter((response) => response.condition !== 'A' && response.initial);
  const withConclusion = responses.filter((response) => response.adviceCorrect !== null);
  const wrongAdvice = withConclusion.filter((response) => response.adviceCorrect === false);
  const rightAdvice = withConclusion.filter((response) => response.adviceCorrect === true);
  const follows = (response: TrialResponse) => response.adviceOption !== null && response.final.optionId === response.adviceOption;
  const initialCorrect = (response: TrialResponse) => response.initial !== null && optionHypothesis(response.initial.optionId) === response.truth;
  const rairBase = withConclusion.filter((response) => response.adviceCorrect && response.initial && !initialCorrect(response));
  const rsrBase = withConclusion.filter((response) => !response.adviceCorrect && response.initial && initialCorrect(response));
  const abstained = responses.filter((response) => response.advice?.status === 'abstention');
  const brierTerms = committed.map((response) => {
    const confidence = response.final.confidence / 100;
    const outcome = response.score.correct ? 1 : 0;
    return (confidence - outcome) * (confidence - outcome);
  });
  const accuracy = ratio(committed.filter((response) => response.score.correct).length, committed.length);
  const meanConfidence = committed.length ? meanOf(committed.map((response) => response.final.confidence / 100)) : null;
  const times = responses.map((response) => (response.initial?.latencyMs ?? 0) + response.final.latencyMs).filter((time) => time > 0);
  const workload = questionnaires.map((questionnaire) => meanOf(TLX_SUBSCALES.map(({ id }) => questionnaire.tlx[id])));
  const comprehensionTotal = questionnaires.reduce((total, questionnaire) => total + Object.keys(questionnaire.comprehension).length, 0);

  return {
    utility: average(responses.map((response) => response.score.utility)),
    accuracy,
    coverage: ratio(committed.length, responses.length),
    wrongCommitRate: ratio(committed.filter((response) => !response.score.correct).length, responses.length),
    falseAlarmRate: ratio(benign.filter((response) => response.score.falseAlarm).length, benign.length),
    missRate: ratio(alarm.filter((response) => response.score.miss).length, alarm.length),
    referenceAgreement: ratio(responses.filter((response) => response.score.matchesReference).length, responses.length),
    missedCritical: ratio(quality.filter((response) => response.score.missedCritical).length, quality.length),
    timeToDecision: { numerator: times.length ? median(times) : 0, denominator: times.length, value: times.length ? median(times) : null },
    switchRate: ratio(assisted.filter((response) => response.initial!.optionId !== response.final.optionId).length, assisted.length),
    overreliance: ratio(wrongAdvice.filter(follows).length, wrongAdvice.length),
    appropriateAcceptance: ratio(rightAdvice.filter(follows).length, rightAdvice.length),
    appropriateRejection: ratio(wrongAdvice.filter((response) => !follows(response)).length, wrongAdvice.length),
    rair: ratio(rairBase.filter(follows).length, rairBase.length),
    rsr: ratio(rsrBase.filter((response) => response.final.optionId === response.initial!.optionId).length, rsrBase.length),
    abstentionAcceptance: ratio(abstained.filter((response) => response.final.optionId === 'verify').length, abstained.length),
    brier: average(brierTerms),
    overconfidence: {
      numerator: meanConfidence === null || accuracy.value === null ? 0 : meanConfidence - accuracy.value,
      denominator: committed.length,
      value: meanConfidence === null || accuracy.value === null ? null : meanConfidence - accuracy.value,
    },
    workload: average(workload),
    comprehension: ratio(questionnaires.reduce((total, questionnaire) => total + questionnaire.comprehensionCorrect, 0), comprehensionTotal),
    comfort: average(questionnaires.map((questionnaire) => questionnaire.comfort)),
  };
};

export const byCondition = <T extends { condition: AssistanceCondition }>(items: readonly T[]) => {
  const groups: Record<AssistanceCondition, T[]> = { A: [], B: [], C: [], D: [] };
  for (const item of items) groups[item.condition].push(item);
  return groups;
};

export const byInformationCondition = (responses: readonly TrialResponse[]) => {
  const groups = new Map<InformationCondition, TrialResponse[]>();
  for (const response of responses) groups.set(response.informationCondition, [...(groups.get(response.informationCondition) ?? []), response]);
  return groups;
};

export interface AssistantBehavior {
  trials: number;
  concluded: number;
  abstained: number;
  correctConclusions: number;
  wrongConclusions: number;
  flagged: number;
  guardrailRejections: number;
}

/** What the assistant itself did, independent of the participant: when did it recognize unreliable evidence? */
export const assistantBehavior = (responses: readonly TrialResponse[]): AssistantBehavior => {
  const advised = responses.filter((response) => response.advice !== null);
  return {
    trials: advised.length,
    concluded: advised.filter((response) => response.advice!.status === 'assessment').length,
    abstained: advised.filter((response) => response.advice!.status === 'abstention').length,
    correctConclusions: advised.filter((response) => response.adviceCorrect === true).length,
    wrongConclusions: advised.filter((response) => response.adviceCorrect === false).length,
    flagged: advised.filter((response) => response.advice!.flags.length > 0 || response.advice!.status === 'abstention').length,
    guardrailRejections: advised.filter((response) => response.guardrailViolations.length > 0).length,
  };
};

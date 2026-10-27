import type { AssistanceCondition } from '@/assistant/schema';
import { deriveSeed } from '@/engine/rng';
import { INFORMATION_CONDITIONS, TASK_FORMS, type InformationCondition } from '@/scenarios/taskFamily';
import { AGENTS, agentById, runAgentSession } from './agents';
import { CONDITION_ORDER } from './counterbalance';
import { assistantBehavior, byCondition, computeMetrics, type AssistantBehavior, type MetricValues } from './metrics';
import { HYPOTHESES, PROTOCOL, type Hypothesis, type MetricId } from './protocol';
import { bootstrapMean, bootstrapPValue, holm, wilson, type Interval } from './stats';
import { defaultStudyConfig, scoredResponses, type StudySession, type TrialResponse } from './study';

export interface BatchConfig {
  agentIds: string[];
  participantsPerAgent: number;
  seed: string;
  trialsPerBlock: number;
  showQualityFlags: boolean;
  resamples: number;
  /**
   * `protocol`: every simulated participant sees the protocol's fixed materials, as people would.
   * `resampled`: each participant index gets freshly generated materials (shared across policies), to
   * estimate how a policy behaves across the generator rather than on one fixed test.
   */
  materials: 'protocol' | 'resampled';
  /**
   * Optional custom design (omitted = protocol design). `blockMix` lists the information conditions in
   * every block, one trial each; `formIds` selects the scenarios; `conditions` the assistance conditions.
   */
  blockMix?: InformationCondition[];
  formIds?: string[];
  conditions?: AssistanceCondition[];
}

export const MAX_BLOCK_TRIALS = 40;

/** Why a configuration cannot run, or null. Checked before running and when reproducing a package. */
export const batchConfigProblem = (config: BatchConfig): string | null => {
  if (config.agentIds.length === 0) return 'Choose at least one policy.';
  const unknownAgent = config.agentIds.find((id) => !AGENTS.some((agent) => agent.id === id));
  if (unknownAgent) return `Unknown policy "${unknownAgent}".`;
  if (!Number.isInteger(config.participantsPerAgent) || config.participantsPerAgent < 1 || config.participantsPerAgent > 500) return 'Participants per policy must be between 1 and 500.';
  if (!config.seed) return 'Set a seed.';
  if (config.blockMix) {
    if (config.blockMix.length === 0 || config.blockMix.length > MAX_BLOCK_TRIALS) return `A block needs between 1 and ${MAX_BLOCK_TRIALS} trials.`;
    if (config.blockMix.some((condition) => !INFORMATION_CONDITIONS.includes(condition))) return 'Unknown information condition.';
  } else if (!Number.isInteger(config.trialsPerBlock) || config.trialsPerBlock < 1 || config.trialsPerBlock > PROTOCOL.blockMix.length) {
    return `Trials per block must be between 1 and ${PROTOCOL.blockMix.length}.`;
  }
  if (config.formIds && (config.formIds.length === 0 || config.formIds.some((id) => !TASK_FORMS.some((form) => form.id === id)))) return 'Choose at least one known scenario.';
  if (config.conditions && (config.conditions.length === 0 || config.conditions.some((condition) => !CONDITION_ORDER.includes(condition)))) {
    return 'Choose at least one assistance condition.';
  }
  return null;
};

export const DEFAULT_BATCH: BatchConfig = {
  agentIds: ['follow-ai', 'noisy-reliance', 'declared-analyst', 'face-value', 'majority'],
  participantsPerAgent: 8,
  seed: 'workbench-1',
  trialsPerBlock: PROTOCOL.trialsPerBlock,
  showQualityFlags: true,
  resamples: 2000,
  materials: 'protocol',
};

export interface ConditionSummary {
  condition: AssistanceCondition;
  metrics: MetricValues;
  /** Bootstrap interval over participants for mean utility; Wilson intervals for pooled proportions. */
  utilityInterval: Interval | null;
  proportionIntervals: Partial<Record<MetricId, Interval | null>>;
  assistant: AssistantBehavior;
}

export interface HypothesisResult {
  hypothesis: Hypothesis;
  pairs: number;
  difference: Interval | null;
  pValue: number | null;
  adjustedPValue: number | null;
  supported: boolean | null;
  note: string;
}

export interface RobustnessRow {
  informationCondition: InformationCondition;
  byCondition: Record<AssistanceCondition, { trials: number; utility: number | null; wrongCommitRate: number | null; aiAbstained: number; aiWrong: number }>;
}

export interface GroupSummary {
  agentId: string;
  participants: number;
  conditions: ConditionSummary[];
  hypotheses: HypothesisResult[];
  robustness: RobustnessRow[];
}

const PROPORTIONS: MetricId[] = ['accuracy', 'coverage', 'wrongCommitRate', 'falseAlarmRate', 'missRate', 'referenceAgreement', 'missedCritical', 'overreliance', 'appropriateAcceptance', 'appropriateRejection', 'abstentionAcceptance'];

export const summarizeCondition = (condition: AssistanceCondition, responses: TrialResponse[], perParticipantUtility: number[], seed: string, resamples: number): ConditionSummary => {
  const metrics = computeMetrics(responses);
  return {
    condition,
    metrics,
    utilityInterval: bootstrapMean(perParticipantUtility, `${seed}/utility/${condition}`, resamples),
    proportionIntervals: Object.fromEntries(PROPORTIONS.map((id) => [id, wilson(metrics[id].numerator, metrics[id].denominator)])),
    assistant: assistantBehavior(responses),
  };
};

const participantMetric = (responses: TrialResponse[], metric: MetricId, subset?: InformationCondition[]) => {
  const filtered = subset ? responses.filter((response) => subset.includes(response.informationCondition)) : responses;
  return computeMetrics(filtered)[metric].value;
};

export const evaluateHypotheses = (sessions: StudySession[], seed: string, resamples: number): HypothesisResult[] => {
  const raw = HYPOTHESES.map((hypothesis): HypothesisResult => {
    if (hypothesis.comparison[0] === hypothesis.comparison[1]) {
      return { hypothesis, pairs: 0, difference: null, pValue: null, adjustedPValue: null, supported: null, note: 'Between-subjects factor; requires participants in both feedback groups.' };
    }
    const pairs: Array<[number, number]> = [];
    for (const session of sessions) {
      const groups = byCondition(scoredResponses(session.state));
      const first = participantMetric(groups[hypothesis.comparison[0]], hypothesis.metric, hypothesis.subset);
      const second = participantMetric(groups[hypothesis.comparison[1]], hypothesis.metric, hypothesis.subset);
      if (first !== null && second !== null) pairs.push([first, second]);
    }
    const differences = pairs.map(([first, second]) => first - second);
    const difference = bootstrapMean(differences, `${seed}/${hypothesis.id}`, resamples);
    const pValue = bootstrapPValue(differences, `${seed}/${hypothesis.id}`, resamples);
    return { hypothesis, pairs: pairs.length, difference, pValue, adjustedPValue: null, supported: null, note: pairs.length < 2 ? 'Too few paired participants for an interval.' : '' };
  });
  const confirmatory = raw.filter((result) => result.hypothesis.family === 'confirmatory' && result.pValue !== null);
  const adjusted = holm(confirmatory.map((result) => result.pValue!));
  confirmatory.forEach((result, index) => {
    result.adjustedPValue = adjusted[index];
  });
  for (const result of raw) {
    if (!result.difference || result.pValue === null) continue;
    const p = result.hypothesis.family === 'confirmatory' ? result.adjustedPValue! : result.pValue;
    const excludesZero = result.difference.lower > 0 || result.difference.upper < 0;
    const rightDirection =
      result.hypothesis.direction === 'two-sided' ||
      (result.hypothesis.direction === 'greater' ? result.difference.estimate > 0 : result.difference.estimate < 0);
    result.supported = excludesZero && rightDirection && p < PROTOCOL.analysis.alpha;
  }
  return raw;
};

export const robustnessTable = (responses: TrialResponse[]): RobustnessRow[] =>
  INFORMATION_CONDITIONS.map((informationCondition) => {
    const subset = responses.filter((response) => response.informationCondition === informationCondition);
    const groups = byCondition(subset);
    const row = {} as RobustnessRow['byCondition'];
    for (const condition of ['A', 'B', 'C', 'D'] as AssistanceCondition[]) {
      const metrics = computeMetrics(groups[condition]);
      const behavior = assistantBehavior(groups[condition]);
      row[condition] = {
        trials: groups[condition].length,
        utility: metrics.utility.value,
        wrongCommitRate: metrics.wrongCommitRate.value,
        aiAbstained: behavior.abstained,
        aiWrong: behavior.wrongConclusions,
      };
    }
    return { informationCondition, byCondition: row };
  });

export const summarizeGroup = (agentId: string, sessions: StudySession[], seed: string, resamples: number): GroupSummary => {
  const scored = sessions.flatMap((session) => scoredResponses(session.state));
  const groups = byCondition(scored);
  const perParticipant = (condition: AssistanceCondition) =>
    sessions
      .map((session) => computeMetrics(byCondition(scoredResponses(session.state))[condition]).utility.value)
      .filter((value): value is number => value !== null);
  return {
    agentId,
    participants: sessions.length,
    conditions: (['A', 'B', 'C', 'D'] as AssistanceCondition[]).map((condition) =>
      summarizeCondition(condition, groups[condition], perParticipant(condition), `${seed}/${agentId}`, resamples),
    ),
    hypotheses: evaluateHypotheses(sessions, `${seed}/${agentId}`, resamples),
    robustness: robustnessTable(scored),
  };
};

export interface BatchResult {
  config: BatchConfig;
  sessions: Array<{ agentId: string; session: StudySession }>;
  groups: GroupSummary[];
}

/** Runs simulated participants through the full protocol. Deterministic for a given configuration. */
export const runBatch = (config: BatchConfig): BatchResult => {
  const problem = batchConfigProblem(config);
  if (problem) throw new Error(problem);
  const sessions: BatchResult['sessions'] = [];
  for (const agentId of config.agentIds) {
    const policy = agentById(agentId);
    for (let index = 0; index < config.participantsPerAgent; index += 1) {
      const studyConfig = defaultStudyConfig({
        participantCode: `${agentId}-${String(index + 1).padStart(2, '0')}`,
        participantIndex: index,
        seed: deriveSeed(config.seed, agentId, index),
        showQualityFlags: config.showQualityFlags,
        trialsPerBlock: config.blockMix?.length ?? config.trialsPerBlock,
        ...(config.materials === 'resampled' ? { materialsSeed: deriveSeed(config.seed, 'materials', index) } : {}),
        ...(config.blockMix ? { blockMix: [...config.blockMix] } : {}),
        ...(config.formIds ? { formIds: [...config.formIds] } : {}),
        ...(config.conditions ? { conditions: [...config.conditions] } : {}),
      });
      sessions.push({ agentId, session: runAgentSession(studyConfig, policy) });
    }
  }
  const groups = config.agentIds.map((agentId) =>
    summarizeGroup(
      agentId,
      sessions.filter((entry) => entry.agentId === agentId).map((entry) => entry.session),
      config.seed,
      config.resamples,
    ),
  );
  return { config, sessions, groups };
};

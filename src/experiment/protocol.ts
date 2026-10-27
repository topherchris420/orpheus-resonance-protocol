import { hashValue } from '@/engine/canonical';
import type { AssistanceCondition } from '@/assistant/schema';
import { DEFAULT_BLOCK_MIX, TASK_FAMILY_VERSION, type InformationCondition } from '@/scenarios/taskFamily';
import { DEFAULT_PAYOFF, thresholdFromPayoff, type Payoff } from '@/scenarios/types';

/**
 * The preregistered human–AI teaming protocol, as data. Hypotheses, metric definitions, design and
 * analysis plan are fixed here before any participant is run; every research package records this
 * protocol's hash so results can be tied to the definitions that produced them.
 */

export type MetricId =
  | 'utility'
  | 'accuracy'
  | 'coverage'
  | 'wrongCommitRate'
  | 'falseAlarmRate'
  | 'missRate'
  | 'referenceAgreement'
  | 'missedCritical'
  | 'timeToDecision'
  | 'switchRate'
  | 'overreliance'
  | 'appropriateAcceptance'
  | 'appropriateRejection'
  | 'rair'
  | 'rsr'
  | 'abstentionAcceptance'
  | 'brier'
  | 'overconfidence'
  | 'workload'
  | 'comprehension'
  | 'comfort';

export interface MetricDefinition {
  id: MetricId;
  label: string;
  definition: string;
  unit: 'per-trial' | 'proportion' | 'ms' | 'score';
  better: 'higher' | 'lower' | 'neither';
}

export const METRICS: MetricDefinition[] = [
  { id: 'utility', label: 'Decision utility', definition: 'Mean payoff per trial: +1 for a correct conclusion, −4 for a wrong conclusion, 0 for "verify first".', unit: 'per-trial', better: 'higher' },
  { id: 'accuracy', label: 'Accuracy of conclusions', definition: 'Correct conclusions divided by all conclusions (trials answered with "verify" are excluded).', unit: 'proportion', better: 'higher' },
  { id: 'coverage', label: 'Conclusion rate', definition: 'Share of trials on which the participant concluded rather than asked to verify.', unit: 'proportion', better: 'neither' },
  { id: 'wrongCommitRate', label: 'Wrong conclusions', definition: 'Wrong conclusions divided by all trials.', unit: 'proportion', better: 'lower' },
  { id: 'falseAlarmRate', label: 'False alarms', definition: 'Concluding the alarm interpretation when the benign one was true, divided by trials whose truth was benign.', unit: 'proportion', better: 'lower' },
  { id: 'missRate', label: 'Misses', definition: 'Concluding the benign interpretation when the alarm one was true, divided by trials whose truth was alarm.', unit: 'proportion', better: 'lower' },
  { id: 'referenceAgreement', label: 'Agreement with the declared analysis', definition: 'Share of trials matching the declared-model analysis: conclude its leading interpretation when it reaches 0.80, otherwise verify.', unit: 'proportion', better: 'higher' },
  { id: 'missedCritical', label: 'Missed critical information', definition: 'Conclusions that the declared analysis does not support after its data-quality rules are applied (it would verify, or it leads elsewhere), divided by trials containing a data-quality problem.', unit: 'proportion', better: 'lower' },
  { id: 'timeToDecision', label: 'Time to decision', definition: 'Median milliseconds from trial onset to the final response (initial and advice stages combined).', unit: 'ms', better: 'neither' },
  { id: 'switchRate', label: 'Changes of decision', definition: 'Share of assisted trials whose final response differs from the initial response.', unit: 'proportion', better: 'neither' },
  { id: 'overreliance', label: 'Overreliance', definition: 'Share of trials with a wrong AI conclusion on which the final response adopts that conclusion.', unit: 'proportion', better: 'lower' },
  { id: 'appropriateAcceptance', label: 'Appropriate acceptance', definition: 'Share of trials with a correct AI conclusion on which the final response adopts it.', unit: 'proportion', better: 'higher' },
  { id: 'appropriateRejection', label: 'Appropriate rejection', definition: 'Share of trials with a wrong AI conclusion on which the final response does not adopt it.', unit: 'proportion', better: 'higher' },
  { id: 'rair', label: 'Relative AI reliance (RAIR)', definition: 'Among trials where the initial response was wrong and the AI conclusion correct, the share where the participant switched to the AI.', unit: 'proportion', better: 'higher' },
  { id: 'rsr', label: 'Relative self-reliance (RSR)', definition: 'Among trials where the initial response was correct and the AI conclusion wrong, the share where the participant kept the initial response.', unit: 'proportion', better: 'higher' },
  { id: 'abstentionAcceptance', label: 'Abstention acceptance', definition: 'Share of trials where the assistant declined to conclude on which the final response is "verify".', unit: 'proportion', better: 'neither' },
  { id: 'brier', label: 'Confidence calibration (Brier)', definition: 'Mean squared difference between stated confidence (0–1) and correctness, over conclusions.', unit: 'score', better: 'lower' },
  { id: 'overconfidence', label: 'Overconfidence', definition: 'Mean stated confidence minus accuracy, over conclusions.', unit: 'score', better: 'neither' },
  { id: 'workload', label: 'Perceived workload (NASA-TLX, raw)', definition: 'Unweighted mean of the six NASA-TLX subscales (0–100), once per block.', unit: 'score', better: 'lower' },
  { id: 'comprehension', label: 'Comprehension', definition: 'Share of comprehension questions answered correctly after each block.', unit: 'proportion', better: 'higher' },
  { id: 'comfort', label: 'Comfort', definition: 'Self-reported comfort with the interface during the block (1–7).', unit: 'score', better: 'higher' },
];

export interface Hypothesis {
  id: string;
  statement: string;
  metric: MetricId;
  comparison: [AssistanceCondition, AssistanceCondition];
  direction: 'greater' | 'less' | 'two-sided';
  subset?: InformationCondition[];
  family: 'confirmatory' | 'secondary' | 'exploratory';
}

export const DEGRADED_CONDITIONS: InformationCondition[] = ['conflict', 'missing', 'stale', 'corrupted'];

export const HYPOTHESES: Hypothesis[] = [
  { id: 'H1', statement: 'Decision utility is higher with the uncertainty-aware assistant (D) than with the conventional assistant (B).', metric: 'utility', comparison: ['D', 'B'], direction: 'greater', family: 'confirmatory' },
  { id: 'H2', statement: 'Wrong conclusions are less frequent with D than with B.', metric: 'wrongCommitRate', comparison: ['D', 'B'], direction: 'less', family: 'confirmatory' },
  { id: 'H3', statement: 'On trials with conflicting, missing, stale or corrupted information, utility is higher with D than with the explainable assistant (C).', metric: 'utility', comparison: ['D', 'C'], direction: 'greater', subset: DEGRADED_CONDITIONS, family: 'confirmatory' },
  { id: 'H4', statement: 'Decision utility is higher with D than without an assistant (A).', metric: 'utility', comparison: ['D', 'A'], direction: 'greater', family: 'secondary' },
  { id: 'H5', statement: 'Explanations change overreliance on wrong suggestions (C versus B); no direction is predicted.', metric: 'overreliance', comparison: ['C', 'B'], direction: 'two-sided', family: 'secondary' },
  { id: 'H6', statement: "Participants' confidence is better calibrated with D than with A.", metric: 'brier', comparison: ['D', 'A'], direction: 'less', family: 'secondary' },
  { id: 'H7', statement: 'Ambient sensory feedback changes utility, comprehension or comfort; no direction is predicted (between-subjects factor).', metric: 'utility', comparison: ['D', 'D'], direction: 'two-sided', family: 'exploratory' },
];

export interface ComprehensionItem {
  id: string;
  question: string;
  options: string[];
  correct: number;
}

export const COMPREHENSION_ITEMS: ComprehensionItem[] = [
  {
    id: 'q-ai-evidence',
    question: 'Can a statement written by the assistant count as evidence about the situation?',
    options: ['Yes, if the assistant is confident', 'No, assistant statements are never treated as observations', 'Only in the uncertainty-aware condition'],
    correct: 1,
  },
  {
    id: 'q-relay',
    question: 'A report relayed through a second channel appears twice. How many independent confirmations is that?',
    options: ['Two', 'One', 'None'],
    correct: 1,
  },
  {
    id: 'q-abstain',
    question: 'What does it mean when the assistant declines to conclude?',
    options: ['The assistant is broken', 'The available evidence does not establish any interpretation at the required level', 'The alarm interpretation is true'],
    correct: 1,
  },
  {
    id: 'q-integrity',
    question: 'A report fails its integrity check. What should you assume about its contents?',
    options: ['They are accurate but late', 'They may not be what the source sent', 'They confirm the other reports'],
    correct: 1,
  },
];

export const TLX_SUBSCALES = [
  { id: 'mental', label: 'Mental demand', prompt: 'How mentally demanding was the task?' },
  { id: 'physical', label: 'Physical demand', prompt: 'How physically demanding was the task?' },
  { id: 'temporal', label: 'Temporal demand', prompt: 'How hurried or rushed was the pace of the task?' },
  { id: 'performance', label: 'Performance', prompt: 'How successful were you in accomplishing what you were asked to do? (0 = perfect, 100 = failure)' },
  { id: 'effort', label: 'Effort', prompt: 'How hard did you have to work to accomplish your level of performance?' },
  { id: 'frustration', label: 'Frustration', prompt: 'How insecure, discouraged, irritated, stressed or annoyed were you?' },
] as const;
export type TlxSubscale = (typeof TLX_SUBSCALES)[number]['id'];

export interface StudyProtocol {
  id: string;
  version: string;
  title: string;
  question: string;
  design: string;
  conditions: AssistanceCondition[];
  taskFamilyVersion: string;
  materialsSeed: string;
  trialsPerBlock: number;
  blockMix: InformationCondition[];
  practiceMix: InformationCondition[];
  advicePresentation: 'sequential';
  feedbackDuringBlocks: false;
  payoff: Payoff;
  threshold: number;
  plannedSample: { participants: number; note: string };
  analysis: {
    primary: string;
    intervals: string;
    alpha: number;
    multiplicity: string;
    exclusions: string[];
  };
  hypotheses: Hypothesis[];
  metrics: MetricDefinition[];
  questionnaires: { workload: string; comprehension: ComprehensionItem[]; comfort: string };
  sensoryFeedback: string;
  ethics: string[];
}

export const PROTOCOL: StudyProtocol = {
  id: 'orpheus-hat',
  version: '1.0.0',
  title: 'Advise, explain, or abstain: an uncertainty-aware assistant for decisions under uncertainty',
  question:
    'Can an AI system improve human decisions under uncertainty by knowing when to advise, when to explain, and when to refuse to make a recommendation?',
  design:
    'Within-subjects, four blocks (A human only, B conventional AI, C explainable AI, D uncertainty-aware AI). Block order follows a 4×4 Williams Latin square (balanced for first-order carryover); trial sets and narrative forms rotate with the square so materials are counterbalanced with conditions. Two unscored practice trials precede the first block.',
  conditions: ['A', 'B', 'C', 'D'],
  taskFamilyVersion: TASK_FAMILY_VERSION,
  materialsSeed: 'orpheus-hat-materials-v1',
  trialsPerBlock: DEFAULT_BLOCK_MIX.length,
  blockMix: DEFAULT_BLOCK_MIX,
  practiceMix: ['clean', 'conflict'],
  advicePresentation: 'sequential',
  feedbackDuringBlocks: false,
  payoff: DEFAULT_PAYOFF,
  threshold: thresholdFromPayoff(DEFAULT_PAYOFF),
  plannedSample: {
    participants: 24,
    note: 'Six complete Latin-square cycles. To be revised after a pilot of eight participants, using simulation-based power analysis with effect sizes estimated from the pilot.',
  },
  analysis: {
    primary: 'Paired difference in mean utility per trial between conditions D and B, computed per participant.',
    intervals: 'Percentile bootstrap over participants (10,000 resamples, seeded); Wilson intervals for pooled proportions.',
    alpha: 0.05,
    multiplicity: 'Holm–Bonferroni across the confirmatory family H1–H3. Secondary and exploratory results are reported with unadjusted intervals and labeled as such.',
    exclusions: [
      'Practice trials are never analyzed.',
      'Sessions with fewer than half of the scored trials completed are excluded and reported.',
      'No other exclusions; outlier response times are reported, not removed.',
    ],
  },
  hypotheses: HYPOTHESES,
  metrics: METRICS,
  questionnaires: {
    workload: 'NASA-TLX, raw (unweighted) version: six subscales from 0 to 100 in steps of 5, after each block.',
    comprehension: COMPREHENSION_ITEMS,
    comfort: 'One item after each block: "How comfortable was the interface during this block?" (1 = very uncomfortable, 7 = very comfortable).',
  },
  sensoryFeedback:
    'Optional between-subjects factor: ambient breath-paced visual feedback on or off for the whole session. No microphone is used in studies. No benefit is assumed.',
  ethics: [
    'Fictional scenarios only; no real operations, targets or people.',
    'No personal information: participants are identified by a random code.',
    'Data stay in the browser until the researcher downloads them; nothing is transmitted.',
    'Participants may stop at any time; partial records are clearly marked.',
  ],
};

export const protocolHash = (protocol: StudyProtocol = PROTOCOL): string => hashValue(protocol);

export const metricDefinition = (id: MetricId): MetricDefinition => METRICS.find((metric) => metric.id === id)!;

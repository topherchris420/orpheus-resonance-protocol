import type { AssessmentOutput } from '@/assistant/schema';
import { assessEvidence, assessNaive } from '@/evidence/engine';
import { deriveSeed, Rng } from '@/engine/rng';
import type { TrialOptionId } from '@/scenarios/taskFamily';
import { PROTOCOL, TLX_SUBSCALES } from './protocol';
import { adviceOption, hypothesisOption } from './scoring';
import { adviceFor, createStudySession, currentTrial, dispatchStudy, type PlannedTrial, type StageResponse, type StudyConfig, type StudySession } from './study';

/**
 * Baseline evaluators: scripted participants that need no AI service. They validate the pipeline,
 * bound what is achievable, and show how policies of reliance play out. Their results describe these
 * policies inside this simulation; they are not data about people.
 */
export interface AgentPolicy {
  id: string;
  label: string;
  description: string;
  initial(trial: PlannedTrial, rng: Rng): StageResponse;
  final(trial: PlannedTrial, initial: StageResponse | null, advice: AssessmentOutput | null, rng: Rng): StageResponse;
}

const respond = (optionId: TrialOptionId, confidence: number): StageResponse => ({ optionId, confidence: Math.round(Math.min(100, Math.max(0, confidence))), latencyMs: 0, selectionChanges: 0 });

const majorityVote = (trial: PlannedTrial): StageResponse => {
  const claims = trial.spec.context.items.filter((item) => item.claim !== undefined && item.kind !== 'ai-statement');
  const alarm = claims.filter((item) => item.claim === 'alarm').length;
  const benign = claims.length - alarm;
  if (alarm === benign) return respond('verify', 50);
  return respond(alarm > benign ? 'conclude-alarm' : 'conclude-benign', (100 * Math.max(alarm, benign)) / claims.length);
};

const declared = (trial: PlannedTrial): StageResponse => {
  const report = assessEvidence(trial.spec.context, { threshold: PROTOCOL.threshold });
  return respond(report.sufficiency.sufficient ? hypothesisOption(report.leading) : 'verify', report.leadingProbability * 100);
};

const faceValue = (trial: PlannedTrial): StageResponse => {
  const report = assessNaive(trial.spec.context);
  return respond(hypothesisOption(report.leading), report.leadingProbability * 100);
};

const followAdvice = (initial: StageResponse | null, advice: AssessmentOutput | null, fallback: StageResponse): StageResponse => {
  const advised = adviceOption(advice);
  if (!advised) return initial ?? fallback;
  const probability = advice?.uncertainty?.probability?.value;
  return respond(advised, probability !== undefined ? probability * 100 : advised === 'verify' ? 50 : 80);
};

export const AGENTS: AgentPolicy[] = [
  {
    id: 'oracle',
    label: 'Oracle (upper bound)',
    description: 'Knows the ground truth. Shows the maximum utility of 1 per trial.',
    initial: (trial) => respond(hypothesisOption(trial.spec.truth), 100),
    final: (trial) => respond(hypothesisOption(trial.spec.truth), 100),
  },
  {
    id: 'declared-analyst',
    label: 'Careful analyst',
    description: "Applies the declared data-quality rules and Bayes' rule itself, concludes only at 0.80, ignores the assistant.",
    initial: declared,
    final: (trial) => declared(trial),
  },
  {
    id: 'face-value',
    label: 'Face-value analyst',
    description: 'Weighs every claim at face value by source grade and always concludes; ignores the assistant.',
    initial: faceValue,
    final: (trial) => faceValue(trial),
  },
  {
    id: 'majority',
    label: 'Majority vote',
    description: 'Counts claims regardless of source, verifies on ties; ignores the assistant.',
    initial: majorityVote,
    final: (trial) => majorityVote(trial),
  },
  {
    id: 'follow-ai',
    label: 'Always follows the assistant',
    description: 'Starts with a majority vote, then adopts whatever the assistant says, including "verify" when it abstains.',
    initial: majorityVote,
    final: (trial, initial, advice) => followAdvice(initial, advice, majorityVote(trial)),
  },
  {
    id: 'cautious',
    label: 'Always verifies',
    description: 'Never concludes. Utility is exactly 0 per trial.',
    initial: () => respond('verify', 50),
    final: () => respond('verify', 50),
  },
  {
    id: 'noisy-reliance',
    label: 'Synthetic participant (assumed behavior)',
    description:
      'A planning model, not data: majority-vote initial answer; follows a conclusion 70% of the time, follows an abstention 60% of the time, and notices a flagged data problem 50% of the time.',
    initial: majorityVote,
    final: (trial, initial, advice, rng) => {
      const own = initial ?? majorityVote(trial);
      const advised = adviceOption(advice);
      if (!advised) {
        const quality = assessEvidence(trial.spec.context, { threshold: PROTOCOL.threshold });
        const noticed = quality.items.some((item) => !item.admissible && item.exclusion !== 'no-claim' && item.exclusion !== 'assumption') && rng.chance(0.5);
        return noticed ? respond('verify', 55) : own;
      }
      if (advised === 'verify') return rng.chance(0.6) ? respond('verify', 55) : own;
      return rng.chance(0.7) ? respond(advised, 75) : own;
    },
  },
];

export const agentById = (id: string): AgentPolicy => {
  const agent = AGENTS.find((candidate) => candidate.id === id);
  if (!agent) throw new Error(`Unknown agent "${id}"`);
  return agent;
};

const neutralQuestionnaire = () => ({
  tlx: Object.fromEntries(TLX_SUBSCALES.map(({ id }) => [id, 50])) as Record<(typeof TLX_SUBSCALES)[number]['id'], number>,
  comprehension: Object.fromEntries(PROTOCOL.questionnaires.comprehension.map((item) => [item.id, item.correct])),
  comfort: 4,
});

/** Drives a full study session with an agent policy through the same reducer a person uses. */
export const runAgentSession = (config: StudyConfig, policy: AgentPolicy): StudySession => {
  let session = createStudySession({ ...config, participantKind: `agent:${policy.id}` });
  const rng = Rng.fromSeed(deriveSeed(config.seed, 'agent', policy.id));
  const step = (command: Parameters<typeof dispatchStudy>[1]) => {
    const result = dispatchStudy(session, command);
    if (!result.accepted) throw new Error(`Agent ${policy.id} command rejected: ${result.reason}`);
    session = result.session;
  };
  for (let guard = 0; guard < 1000; guard += 1) {
    const { state } = session;
    if (state.stage === 'complete' || state.stage === 'withdrawn') break;
    if (state.stage === 'questionnaire') {
      step({ type: 'questionnaire', block: state.plan[state.cursor - 1].block, ...neutralQuestionnaire() });
      continue;
    }
    const trial = currentTrial(state)!;
    if (state.stage === 'initial') {
      step({ type: 'initialResponse', trialId: trial.spec.id, ...policy.initial(trial, rng) });
    } else {
      const advice = trial.condition === 'A' ? null : adviceFor(trial).output;
      step({ type: 'finalResponse', trialId: trial.spec.id, ...policy.final(trial, state.pendingInitial, advice, rng) });
    }
  }
  return session;
};

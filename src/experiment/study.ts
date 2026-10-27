import { runAssistant } from '@/assistant/index';
import type { AssessmentOutput, AssistanceCondition } from '@/assistant/schema';
import { hashValue } from '@/engine/canonical';
import { appendEntry, genesisHash, verifyChain, type ChainVerification, type LogEntry } from '@/engine/log';
import { deriveSeed, Rng } from '@/engine/rng';
import { ENGINE_VERSION, SCHEMA } from '@/engine/version';
import {
  generateStructureSet,
  generateStructure,
  renderTrial,
  TASK_FORMS,
  TRIAL_OPTIONS,
  type InformationCondition,
  type TrialOptionId,
  type TrialSpec,
} from '@/scenarios/taskFamily';
import { assignParticipant, type Assignment } from './counterbalance';
import { COMPREHENSION_ITEMS, PROTOCOL, protocolHash, TLX_SUBSCALES, type StudyProtocol, type TlxSubscale } from './protocol';
import { adviceOption, scoreTrial, type TrialScore } from './scoring';

export interface StudyConfig {
  protocolId: string;
  protocolVersion: string;
  protocolHash: string;
  participantCode: string;
  participantIndex: number;
  participantKind: 'human' | `agent:${string}`;
  /** Participant-level seed: only the order of trials within blocks depends on it. */
  seed: string;
  /** Show data-quality flags (integrity, staleness, relays) in the evidence panel. */
  showQualityFlags: boolean;
  /** Between-subjects sensory feedback factor. */
  ambientFeedback: boolean;
  /** Shortened sessions use the first k conditions of the protocol mix (demonstrations only). */
  trialsPerBlock: number;
  /** Trial materials. Studies use the protocol's fixed materials; simulations may resample them. */
  materialsSeed: string;
}

export interface PlannedTrial {
  /** -1 for practice. */
  block: number;
  condition: AssistanceCondition;
  spec: TrialSpec;
}

export interface StageResponse {
  optionId: TrialOptionId;
  confidence: number;
  latencyMs: number;
  selectionChanges: number;
}

export interface TrialResponse {
  trialId: string;
  block: number;
  practice: boolean;
  condition: AssistanceCondition;
  formId: string;
  structureId: string;
  informationCondition: InformationCondition;
  truth: 'alarm' | 'benign';
  initial: StageResponse | null;
  final: StageResponse;
  advice: AssessmentOutput | null;
  adviceOption: TrialOptionId | null;
  adviceCorrect: boolean | null;
  guardrailViolations: string[];
  inspected: string[];
  score: TrialScore;
}

export interface QuestionnaireResponse {
  block: number;
  condition: AssistanceCondition;
  tlx: Record<TlxSubscale, number>;
  comprehension: Record<string, number>;
  comprehensionCorrect: number;
  comfort: number;
}

export type StudyStage = 'initial' | 'final' | 'questionnaire' | 'complete' | 'withdrawn';

export interface StudyState {
  schema: typeof SCHEMA.study;
  config: StudyConfig;
  assignment: Assignment;
  plan: PlannedTrial[];
  cursor: number;
  stage: StudyStage;
  pendingInitial: StageResponse | null;
  pendingInspected: string[];
  responses: TrialResponse[];
  questionnaires: QuestionnaireResponse[];
}

export type StudyCommand =
  | ({ type: 'initialResponse'; trialId: string } & StageResponse)
  | ({ type: 'finalResponse'; trialId: string } & StageResponse)
  | { type: 'inspectEvidence'; trialId: string; evidenceId: string }
  | { type: 'questionnaire'; block: number; tlx: Record<TlxSubscale, number>; comprehension: Record<string, number>; comfort: number }
  | { type: 'withdraw' };

export const defaultStudyConfig = (overrides: Partial<StudyConfig> & Pick<StudyConfig, 'participantCode' | 'participantIndex' | 'seed'>): StudyConfig => ({
  protocolId: PROTOCOL.id,
  protocolVersion: PROTOCOL.version,
  protocolHash: protocolHash(),
  participantKind: 'human',
  showQualityFlags: true,
  ambientFeedback: false,
  trialsPerBlock: PROTOCOL.trialsPerBlock,
  materialsSeed: PROTOCOL.materialsSeed,
  ...overrides,
});

/** Builds the trial plan: practice under condition A, then four blocks in Latin-square order. */
export const planStudy = (config: StudyConfig, protocol: StudyProtocol = PROTOCOL): { assignment: Assignment; plan: PlannedTrial[] } => {
  const assignment = assignParticipant(config.participantIndex);
  const mix = protocol.blockMix.slice(0, config.trialsPerBlock);
  const practiceForm = TASK_FORMS[(assignment.row + 1) % TASK_FORMS.length];
  const practice: PlannedTrial[] = protocol.practiceMix.map((condition, index) => ({
    block: -1,
    condition: 'A',
    spec: renderTrial(
      generateStructure(Rng.fromSeed(deriveSeed(config.materialsSeed, 'practice', index)), `P-${index + 1}`, condition, index % 2 === 0 ? 'alarm' : 'benign'),
      practiceForm,
      `practice-${index + 1}`,
    ),
  }));
  const blocks = assignment.conditions.flatMap((condition, block) => {
    const structures = generateStructureSet(config.materialsSeed, assignment.structureSets[block], mix);
    const form = TASK_FORMS[assignment.forms[block]];
    const order = Rng.fromSeed(deriveSeed(config.seed, 'order', block)).shuffle(structures);
    return order.map((structure, index): PlannedTrial => ({
      block,
      condition,
      spec: renderTrial(structure, form, `b${block + 1}-t${String(index + 1).padStart(2, '0')}`),
    }));
  });
  return { assignment, plan: [...practice, ...blocks] };
};

const stageFor = (trial: PlannedTrial | undefined): StudyStage => (!trial ? 'complete' : trial.condition === 'A' ? 'final' : 'initial');

export const createStudyState = (config: StudyConfig): StudyState => {
  const { assignment, plan } = planStudy(config);
  return {
    schema: SCHEMA.study,
    config,
    assignment,
    plan,
    cursor: 0,
    stage: stageFor(plan[0]),
    pendingInitial: null,
    pendingInspected: [],
    responses: [],
    questionnaires: [],
  };
};

export const currentTrial = (state: StudyState): PlannedTrial | undefined =>
  state.stage === 'initial' || state.stage === 'final' ? state.plan[state.cursor] : undefined;

/** The advice a trial shows. Pure, so replay reproduces it exactly. */
export const adviceFor = (trial: PlannedTrial) =>
  runAssistant({ condition: trial.condition, context: trial.spec.context, perturbation: trial.spec.aiPerturbation, threshold: PROTOCOL.threshold });

const validStage = (response: StageResponse) =>
  (TRIAL_OPTIONS as readonly string[]).includes(response.optionId) &&
  Number.isInteger(response.confidence) &&
  response.confidence >= 0 &&
  response.confidence <= 100 &&
  Number.isFinite(response.latencyMs) &&
  response.latencyMs >= 0 &&
  Number.isInteger(response.selectionChanges) &&
  response.selectionChanges >= 0;

export type StudyResult = { state: StudyState; accepted: true } | { state: StudyState; accepted: false; reason: string };

const lastTrialOfBlock = (state: StudyState) => state.plan[state.cursor + 1]?.block !== state.plan[state.cursor].block;

export const reduceStudy = (state: StudyState, command: StudyCommand): StudyResult => {
  const reject = (reason: string): StudyResult => ({ state, accepted: false, reason });
  const trial = currentTrial(state);
  switch (command.type) {
    case 'inspectEvidence':
      if (!trial || trial.spec.id !== command.trialId) return reject('No such trial in progress.');
      if (!trial.spec.context.items.some((item) => item.id === command.evidenceId)) return reject('Unknown evidence item.');
      if (state.pendingInspected.includes(command.evidenceId)) return { state, accepted: true };
      return { state: { ...state, pendingInspected: [...state.pendingInspected, command.evidenceId] }, accepted: true };
    case 'initialResponse':
      if (!trial || state.stage !== 'initial' || trial.spec.id !== command.trialId) return reject('An initial response is not expected now.');
      if (!validStage(command)) return reject('Invalid response.');
      return {
        state: {
          ...state,
          stage: 'final',
          pendingInitial: { optionId: command.optionId, confidence: command.confidence, latencyMs: command.latencyMs, selectionChanges: command.selectionChanges },
        },
        accepted: true,
      };
    case 'finalResponse': {
      if (!trial || state.stage !== 'final' || trial.spec.id !== command.trialId) return reject('A final response is not expected now.');
      if (!validStage(command)) return reject('Invalid response.');
      const final: StageResponse = { optionId: command.optionId, confidence: command.confidence, latencyMs: command.latencyMs, selectionChanges: command.selectionChanges };
      const advice = adviceFor(trial);
      const advised = adviceOption(advice.output);
      const adviceHypothesis = advice.output?.status === 'assessment' ? advice.output.assessment?.hypothesisId ?? null : null;
      const response: TrialResponse = {
        trialId: trial.spec.id,
        block: trial.block,
        practice: trial.block < 0,
        condition: trial.condition,
        formId: trial.spec.formId,
        structureId: trial.spec.structureId,
        informationCondition: trial.spec.condition,
        truth: trial.spec.truth,
        initial: trial.condition === 'A' ? null : state.pendingInitial,
        final,
        advice: advice.output,
        adviceOption: advised,
        adviceCorrect: adviceHypothesis === null ? null : adviceHypothesis === trial.spec.truth,
        guardrailViolations: advice.guardrail?.violations.map((violation) => violation.code) ?? [],
        inspected: state.pendingInspected,
        score: scoreTrial(trial.spec, final.optionId, PROTOCOL.payoff, PROTOCOL.threshold),
      };
      const endOfBlock = lastTrialOfBlock(state);
      const nextCursor = state.cursor + 1;
      const nextStage: StudyStage = endOfBlock && trial.block >= 0 ? 'questionnaire' : stageFor(state.plan[nextCursor]);
      return {
        state: { ...state, responses: [...state.responses, response], cursor: nextCursor, stage: nextStage, pendingInitial: null, pendingInspected: [] },
        accepted: true,
      };
    }
    case 'questionnaire': {
      if (state.stage !== 'questionnaire') return reject('No questionnaire is due.');
      const block = state.plan[state.cursor - 1]?.block;
      if (command.block !== block) return reject('Questionnaire is for a different block.');
      const tlxValid = TLX_SUBSCALES.every(({ id }) => Number.isInteger(command.tlx[id]) && command.tlx[id] >= 0 && command.tlx[id] <= 100);
      const comprehensionValid = COMPREHENSION_ITEMS.every((item) => Number.isInteger(command.comprehension[item.id]) && command.comprehension[item.id] >= 0 && command.comprehension[item.id] < item.options.length);
      if (!tlxValid || !comprehensionValid || !Number.isInteger(command.comfort) || command.comfort < 1 || command.comfort > 7) return reject('Incomplete questionnaire.');
      const condition = state.assignment.conditions[block];
      const questionnaire: QuestionnaireResponse = {
        block,
        condition,
        tlx: { ...command.tlx },
        comprehension: { ...command.comprehension },
        comprehensionCorrect: COMPREHENSION_ITEMS.filter((item) => command.comprehension[item.id] === item.correct).length,
        comfort: command.comfort,
      };
      return { state: { ...state, questionnaires: [...state.questionnaires, questionnaire], stage: stageFor(state.plan[state.cursor]) }, accepted: true };
    }
    case 'withdraw':
      if (state.stage === 'complete' || state.stage === 'withdrawn') return reject('The session has already ended.');
      return { state: { ...state, stage: 'withdrawn', pendingInitial: null, pendingInspected: [] }, accepted: true };
    default:
      return reject('Unknown command.');
  }
};

export interface StudySession {
  state: StudyState;
  genesis: string;
  log: LogEntry<StudyCommand>[];
}

const studyHeader = (config: StudyConfig) => ({ schema: SCHEMA.study, engineVersion: ENGINE_VERSION, config });

export const createStudySession = (config: StudyConfig): StudySession => ({
  state: createStudyState(config),
  genesis: genesisHash(studyHeader(config)),
  log: [],
});

export const dispatchStudy = (session: StudySession, command: StudyCommand): { session: StudySession; accepted: boolean; reason?: string } => {
  const result = reduceStudy(session.state, command);
  if (!result.accepted) return { session, accepted: false, reason: result.reason };
  return { session: { ...session, state: result.state, log: appendEntry(session.log, command, session.genesis) }, accepted: true };
};

export const studyStateHash = (state: StudyState): string => hashValue({ ...state, plan: state.plan.map((trial) => trial.spec.id) });

export interface StudyReplayVerification {
  chain: ChainVerification;
  verified: boolean;
  stateHash: string;
  error: string | null;
}

/** Rebuilds a study session from its configuration and log, and compares the final state hash. */
export const verifyStudyReplay = (config: StudyConfig, genesis: string, log: readonly LogEntry<StudyCommand>[], expectedHash: string): StudyReplayVerification => {
  const chain = verifyChain(log, genesis);
  if (genesisHash(studyHeader(config)) !== genesis) return { chain, verified: false, stateHash: '', error: 'The log does not belong to this configuration.' };
  if (!chain.ok) return { chain, verified: false, stateHash: '', error: 'The log failed its integrity check.' };
  let state = createStudyState(config);
  for (const entry of log) {
    const result = reduceStudy(state, entry.command);
    if (!result.accepted) return { chain, verified: false, stateHash: '', error: `Entry ${entry.seq} was rejected on replay: ${result.reason}` };
    state = result.state;
  }
  const hash = studyStateHash(state);
  return { chain, verified: hash === expectedHash, stateHash: hash, error: hash === expectedHash ? null : 'Replayed state differs from the recorded state.' };
};

export const scoredResponses = (state: Pick<StudyState, 'responses'>) => state.responses.filter((response) => !response.practice);

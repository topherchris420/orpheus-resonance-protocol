import { calibrationRef, committedCalibrationRecord } from '@/assistant/calibrationRegistry';
import { DETERMINISTIC_PROVIDER } from '@/assistant/providers/deterministic';
import { hashValue } from '@/engine/canonical';
import type { LogEntry } from '@/engine/log';
import { APP_VERSION, ENGINE_VERSION, SCHEMA } from '@/engine/version';
import type { EvidenceContext } from '@/evidence/types';
import { TASK_FAMILY_VERSION } from '@/scenarios/taskFamily';
import type { GroupSummary } from './batch';
import { METRICS, PROTOCOL, protocolHash } from './protocol';
import { studyStateHash, type StudyCommand, type StudyConfig, type StudySession, type TrialResponse } from './study';

/**
 * Research packages: one machine-readable file holding configuration, versions, seeds, conditions,
 * every decision with the evidence and assistant output that preceded it, outcomes, metric
 * definitions, summary statistics, replay logs and limitations. `contentHash` covers everything
 * except the generation timestamp, so the same configuration reproduces the same hash.
 */

export const LIMITATIONS = [
  'Packages of kind "agent-batch" contain scripted agents, not people. They test the pipeline and illustrate policies of reliance; they are not evidence about human behavior.',
  'The task generator and the uncertainty-aware assistant share the declared source model. Part of the assistant\'s advantage on degraded trials therefore holds by construction; the open question is how people respond to it.',
  'Calibration was evaluated on data sampled from the declared model. Real sources would not follow it, and calibration outside the evaluated domain is unknown.',
  'All scenarios are fictional. Nothing here is validated against real operations, real sensors or real people.',
  'Time to decision is recorded from the browser and is not meaningful for agents (recorded as 0).',
  'Exact replay shows that the software reproduces the same computation. It is not scientific validation of the simulation or of the conclusions.',
];

/** Human-study packages summarize their participants as one group with this id. */
export const HUMAN_GROUP = 'human';

export const PRIVACY = {
  identifiers: 'Participants are identified only by random codes.',
  excluded: ['Raw microphone audio (never recorded)', 'Names, contact details, accounts', 'Free-text responses (none are collected)', 'Device identifiers'],
  storage: 'Generated in the browser; nothing is transmitted.',
};

export interface TrialRow {
  participant: string;
  participantKind: string;
  block: number;
  condition: string;
  trialId: string;
  material: string;
  structureId: string;
  form: string;
  informationCondition: string;
  truth: string;
  initialOption: string | null;
  initialConfidence: number | null;
  initialLatencyMs: number | null;
  adviceStatus: string | null;
  adviceHypothesis: string | null;
  adviceProbability: number | null;
  adviceAbstentionReason: string | null;
  adviceFlags: string[];
  adviceCorrect: boolean | null;
  guardrailViolations: string[];
  finalOption: string;
  finalConfidence: number;
  finalLatencyMs: number;
  selectionChanges: number;
  switched: boolean | null;
  followedAdvice: boolean | null;
  committed: boolean;
  correct: boolean;
  utility: number;
  falseAlarm: boolean;
  miss: boolean;
  referenceOption: string;
  matchesReference: boolean;
  missedCritical: boolean;
  evidenceSufficient: boolean;
  inspectedCount: number;
}

const materialKey = (response: TrialResponse) => `${response.structureId}@${response.formId}`;

export const trialRows = (config: StudyConfig, responses: readonly TrialResponse[]): TrialRow[] =>
  responses
    .filter((response) => !response.practice)
    .map((response) => ({
      participant: config.participantCode,
      participantKind: config.participantKind,
      block: response.block,
      condition: response.condition,
      trialId: response.trialId,
      material: materialKey(response),
      structureId: response.structureId,
      form: response.formId,
      informationCondition: response.informationCondition,
      truth: response.truth,
      initialOption: response.initial?.optionId ?? null,
      initialConfidence: response.initial?.confidence ?? null,
      initialLatencyMs: response.initial?.latencyMs ?? null,
      adviceStatus: response.advice?.status ?? null,
      adviceHypothesis: response.advice?.assessment?.hypothesisId ?? null,
      adviceProbability: response.advice?.uncertainty?.probability?.value ?? null,
      adviceAbstentionReason: response.advice?.abstention?.reason ?? null,
      adviceFlags: response.advice?.flags.map((flag) => flag.code) ?? [],
      adviceCorrect: response.adviceCorrect,
      guardrailViolations: response.guardrailViolations,
      finalOption: response.final.optionId,
      finalConfidence: response.final.confidence,
      finalLatencyMs: response.final.latencyMs,
      selectionChanges: (response.initial?.selectionChanges ?? 0) + response.final.selectionChanges,
      switched: response.initial ? response.initial.optionId !== response.final.optionId : null,
      followedAdvice: response.adviceOption ? response.final.optionId === response.adviceOption : null,
      committed: response.score.committed,
      correct: response.score.correct,
      utility: response.score.utility,
      falseAlarm: response.score.falseAlarm,
      miss: response.score.miss,
      referenceOption: response.score.referenceOption,
      matchesReference: response.score.matchesReference,
      missedCritical: response.score.missedCritical,
      evidenceSufficient: response.score.evidenceSufficient,
      inspectedCount: response.inspected.length,
    }));

export interface PackageSession {
  config: StudyConfig;
  genesis: string;
  log: LogEntry<StudyCommand>[];
  finalStateHash: string;
  stage: string;
}

export interface ResearchPackageContent {
  kind: 'agent-batch' | 'human-study';
  software: {
    app: 'Orpheus';
    appVersion: string;
    engineVersion: string;
    taskFamilyVersion: string;
    assistantProvider: string;
    calibration: string;
  };
  protocol: { id: string; version: string; hash: string; definition: typeof PROTOCOL };
  configuration: Record<string, unknown>;
  participants: Array<{
    code: string;
    kind: string;
    latinSquareRow: number;
    conditionOrder: string[];
    structureSets: number[];
    forms: number[];
    showQualityFlags: boolean;
    ambientFeedback: boolean;
    status: string;
  }>;
  materials: Record<string, EvidenceContext>;
  trials: TrialRow[];
  modelOutputs: Record<string, unknown>;
  questionnaires: Array<Record<string, unknown>>;
  summary: GroupSummary[];
  evaluationDefinitions: typeof METRICS;
  replay: { sessions: PackageSession[]; instructions: string };
  limitations: string[];
  privacy: typeof PRIVACY;
}

export interface ResearchPackage {
  schema: typeof SCHEMA.researchPackage;
  generatedAt?: string;
  contentHash: string;
  content: ResearchPackageContent;
}

export const buildResearchPackage = (input: {
  kind: ResearchPackageContent['kind'];
  sessions: StudySession[];
  summary: GroupSummary[];
  configuration: Record<string, unknown>;
  generatedAt?: string;
}): ResearchPackage => {
  const materials: Record<string, EvidenceContext> = {};
  const modelOutputs: Record<string, unknown> = {};
  for (const session of input.sessions) {
    for (const trial of session.state.plan) {
      if (trial.block < 0) continue;
      materials[`${trial.spec.structureId}@${trial.spec.formId}`] = trial.spec.context;
    }
    for (const response of session.state.responses) {
      if (!response.practice && response.advice) modelOutputs[`${session.state.config.participantCode}/${response.trialId}`] = response.advice;
    }
  }
  const content: ResearchPackageContent = {
    kind: input.kind,
    software: {
      app: 'Orpheus',
      appVersion: APP_VERSION,
      engineVersion: ENGINE_VERSION,
      taskFamilyVersion: TASK_FAMILY_VERSION,
      assistantProvider: `${DETERMINISTIC_PROVIDER.id}@${DETERMINISTIC_PROVIDER.version}`,
      calibration: calibrationRef(committedCalibrationRecord),
    },
    protocol: { id: PROTOCOL.id, version: PROTOCOL.version, hash: protocolHash(), definition: PROTOCOL },
    configuration: input.configuration,
    participants: input.sessions.map(({ state }) => ({
      code: state.config.participantCode,
      kind: state.config.participantKind,
      latinSquareRow: state.assignment.row,
      conditionOrder: state.assignment.conditions,
      structureSets: state.assignment.structureSets,
      forms: state.assignment.forms,
      showQualityFlags: state.config.showQualityFlags,
      ambientFeedback: state.config.ambientFeedback,
      status: state.stage,
    })),
    materials,
    trials: input.sessions.flatMap(({ state }) => trialRows(state.config, state.responses)),
    modelOutputs,
    questionnaires: input.sessions.flatMap(({ state }) => state.questionnaires.map((questionnaire) => ({ participant: state.config.participantCode, ...questionnaire }))),
    summary: input.summary,
    evaluationDefinitions: METRICS,
    replay: {
      sessions: input.sessions.map((session) => ({
        config: session.state.config,
        genesis: session.genesis,
        log: session.log,
        finalStateHash: studyStateHash(session.state),
        stage: session.state.stage,
      })),
      instructions: 'Open the Research workbench → Reproduce, load this file. Each session is rebuilt from its configuration and log and its final state hash is compared.',
    },
    limitations: LIMITATIONS,
    privacy: PRIVACY,
  };
  return { schema: SCHEMA.researchPackage, ...(input.generatedAt ? { generatedAt: input.generatedAt } : {}), contentHash: hashValue(content), content };
};

const csvCell = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const text = Array.isArray(value) ? value.join('|') : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const trialRowsToCsv = (rows: readonly TrialRow[]): string => {
  if (rows.length === 0) return '';
  const columns = Object.keys(rows[0]) as Array<keyof TrialRow>;
  return [columns.join(','), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(','))].join('\n');
};

export interface PackageVerification {
  schemaOk: boolean;
  contentHashOk: boolean;
  protocolMatches: boolean;
  sessions: Array<{ participant: string; verified: boolean; error: string | null }>;
  reproduced: boolean | null;
  issues: string[];
}

/**
 * Verifies a research package: its content hash, its protocol, and every session by replay. Agent
 * batches can additionally be regenerated from their configuration (`rerun`), which must reproduce
 * the identical content hash.
 */
export const verifyResearchPackage = (
  raw: unknown,
  verifySession: (session: PackageSession) => { verified: boolean; error: string | null },
  rerun?: (configuration: Record<string, unknown>) => ResearchPackage | null,
): PackageVerification => {
  const issues: string[] = [];
  const candidate = raw as Partial<ResearchPackage> | null;
  const schemaOk = !!candidate && candidate.schema === SCHEMA.researchPackage && typeof candidate.content === 'object' && candidate.content !== null;
  if (!schemaOk) return { schemaOk, contentHashOk: false, protocolMatches: false, sessions: [], reproduced: null, issues: ['Not an Orpheus research package.'] };
  const content = candidate.content as ResearchPackageContent;
  let contentHashOk = false;
  try {
    contentHashOk = hashValue(content) === candidate.contentHash;
  } catch {
    contentHashOk = false;
  }
  if (!contentHashOk) issues.push('Content hash does not match: the package was modified after it was generated.');
  const protocolMatches = content.protocol?.hash === protocolHash();
  if (!protocolMatches) issues.push('The package was produced under a different protocol version than this build defines.');
  const sessions = (content.replay?.sessions ?? []).map((session) => {
    const result = verifySession(session);
    if (!result.verified) issues.push(`Session ${session.config?.participantCode ?? '?'}: ${result.error ?? 'replay mismatch'}`);
    return { participant: session.config?.participantCode ?? '?', ...result };
  });
  let reproduced: boolean | null = null;
  if (rerun && content.kind === 'agent-batch') {
    const regenerated = rerun(content.configuration);
    reproduced = regenerated !== null && regenerated.contentHash === candidate.contentHash;
    if (!reproduced) issues.push('Re-running the recorded configuration did not reproduce the same content hash.');
  }
  return { schemaOk, contentHashOk, protocolMatches, sessions, reproduced, issues };
};

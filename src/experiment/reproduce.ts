import { SCHEMA } from '@/engine/version';
import { DEFAULT_BATCH, runBatch, summarizeGroup, type BatchConfig } from './batch';
import { buildResearchPackage, HUMAN_GROUP, verifyResearchPackage, type PackageSession, type PackageVerification, type ResearchPackage } from './package';
import { PROTOCOL, protocolHash } from './protocol';
import { restoreStudySession, studyProgress, verifyStudyReplay, type StudySession } from './study';

/** Builds the research package for an agent batch. */
export const batchPackage = (config: BatchConfig, generatedAt?: string): ResearchPackage => {
  const result = runBatch(config);
  return buildResearchPackage({
    kind: 'agent-batch',
    sessions: result.sessions.map((entry) => entry.session),
    summary: result.groups,
    configuration: { batch: config },
    generatedAt,
  });
};

export const verifyPackageSession = (session: PackageSession) => {
  const result = verifyStudyReplay(session.config, session.genesis, session.log, session.finalStateHash);
  return { verified: result.verified, error: result.error };
};

const asBatchConfig = (configuration: Record<string, unknown>): BatchConfig | null => {
  const batch = configuration.batch as Partial<BatchConfig> | undefined;
  if (!batch || !Array.isArray(batch.agentIds) || typeof batch.seed !== 'string') return null;
  return { ...DEFAULT_BATCH, ...batch } as BatchConfig;
};

export const verifyAndReproduce = (raw: unknown, { rerun = true } = {}) =>
  verifyResearchPackage(raw, verifyPackageSession, rerun ? (configuration) => {
    const config = asBatchConfig(configuration);
    return config ? batchPackage(config) : null;
  } : undefined);

/** Seed and resample count for analyzing human sessions, as the protocol specifies. */
export const HUMAN_ANALYSIS = { seed: `${PROTOCOL.id}-${PROTOCOL.version}-analysis`, resamples: 10000 } as const;

export interface Exclusion {
  participant: string;
  completed: number;
  planned: number;
  reason: string;
}

/**
 * Builds the package for human sessions. The protocol's exclusion rule is applied to the summary:
 * sessions with fewer than half of their scored trials answered are excluded and listed; their
 * records stay in the package so the exclusion can be checked.
 */
export const humanStudyPackage = (sessions: StudySession[], options: { generatedAt?: string; resamples?: number; sources?: string[] } = {}): ResearchPackage => {
  const exclusions: Exclusion[] = [];
  const included = sessions.filter((session) => {
    const { planned, completed } = studyProgress(session.state);
    if (completed * 2 >= planned && completed > 0) return true;
    exclusions.push({ participant: session.state.config.participantCode, completed, planned, reason: 'Fewer than half of the scored trials were answered.' });
    return false;
  });
  const resamples = options.resamples ?? HUMAN_ANALYSIS.resamples;
  return buildResearchPackage({
    kind: 'human-study',
    sessions,
    summary: included.length ? [summarizeGroup(HUMAN_GROUP, included, HUMAN_ANALYSIS.seed, resamples)] : [],
    configuration: {
      analysis: { seed: HUMAN_ANALYSIS.seed, resamples },
      exclusions,
      ...(options.sources ? { combinedFrom: options.sources } : {}),
    },
    generatedAt: options.generatedAt,
  });
};

export interface CombineResult {
  pkg: ResearchPackage | null;
  inputs: Array<{ name: string; contentHash: string | null; verification: PackageVerification }>;
  duplicates: string[];
  /** Sessions not run under the protocol's settings (for example shortened demonstrations). */
  rejected: Array<{ participant: string; reason: string }>;
}

/** Why a session cannot be analyzed with protocol sessions, or null if it can. */
export const nonProtocolReason = (config: StudySession['state']['config']): string | null => {
  if (config.protocolHash !== protocolHash()) return 'Recorded under a different protocol version.';
  if (config.trialsPerBlock !== PROTOCOL.trialsPerBlock) return `Shortened session (${config.trialsPerBlock} trials per block instead of ${PROTOCOL.trialsPerBlock}).`;
  if (config.materialsSeed !== PROTOCOL.materialsSeed) return 'Used materials other than the protocol materials.';
  if (config.participantKind !== 'human') return 'Not a human participant.';
  return null;
};

/**
 * Combines participant packages into one analysis. Every input is verified first; sessions are rebuilt
 * from their logs (never taken from the summary), duplicates by participant code are rejected, and
 * the summary is recomputed over all accepted sessions.
 */
export const combineStudyPackages = (inputs: Array<{ name: string; raw: unknown }>, generatedAt?: string): CombineResult => {
  const sessions = new Map<string, StudySession>();
  const duplicates: string[] = [];
  const rejected: CombineResult['rejected'] = [];
  const sources: string[] = [];
  const results: CombineResult['inputs'] = inputs.map(({ name, raw }) => {
    const verification = verifyAndReproduce(raw, { rerun: false });
    const candidate = raw as Partial<ResearchPackage> | null;
    const contentHash = typeof candidate?.contentHash === 'string' ? candidate.contentHash : null;
    const accepted = verification.schemaOk && verification.contentHashOk && verification.protocolMatches && verification.sessions.every((session) => session.verified);
    if (accepted && candidate?.content?.kind === 'human-study') {
      sources.push(contentHash!);
      for (const recorded of candidate.content.replay.sessions) {
        const restored = restoreStudySession(recorded.config, recorded.genesis, recorded.log);
        if (!restored.session) continue;
        const code = recorded.config.participantCode;
        const reason = nonProtocolReason(recorded.config);
        if (reason) rejected.push({ participant: code, reason });
        else if (sessions.has(code)) duplicates.push(code);
        else sessions.set(code, restored.session);
      }
    } else if (accepted) {
      verification.issues.push('Only human-study packages can be combined.');
    }
    return { name, contentHash, verification };
  });
  const byCode = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  const ordered = [...sessions.values()].sort(
    (a, b) => a.state.config.participantIndex - b.state.config.participantIndex || byCode(a.state.config.participantCode, b.state.config.participantCode),
  );
  return {
    pkg: ordered.length ? humanStudyPackage(ordered, { generatedAt, sources: [...sources].sort() }) : null,
    inputs: results,
    duplicates,
    rejected,
  };
};

export const isResearchPackage = (raw: unknown): raw is ResearchPackage => (raw as { schema?: unknown } | null)?.schema === SCHEMA.researchPackage;

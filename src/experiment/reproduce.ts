import { DEFAULT_BATCH, runBatch, type BatchConfig } from './batch';
import { buildResearchPackage, verifyResearchPackage, type PackageSession, type ResearchPackage } from './package';
import { verifyStudyReplay } from './study';

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

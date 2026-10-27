import { z } from 'zod';
import { getScenario } from '@/scenarios/registry';
import { SCHEMA } from '../version';
import type { LogEntry } from '../log';
import { stateHash, verifyReplay, type Checkpoint, type MissionSession, type ReplayVerification, type SessionHeader } from './session';
import type { MissionCommand, MissionState } from './types';

/**
 * Session records (`orpheus.session.v2`). A record contains everything needed for exact replay — the
 * header (versions, scenario hash, seed, condition), the hash-chained command log and the checkpoint
 * hashes — plus a readable summary. On import the summary is ignored and recomputed from the log.
 * Raw microphone audio and personal information are never part of a record.
 */
export interface SessionSummary {
  scenarioTitle: string;
  ticks: number;
  phase: number;
  decisions: Array<{
    title: string;
    course: string;
    reliedOn: string | null;
    truth: string;
    correctness: 'correct' | 'wrong' | 'deferred';
    utility: number;
    condition: string;
    assistant: string;
  }>;
  objectives: Array<{ label: string; progress: number }>;
  totalUtility: number;
}

export interface SessionRecordV2 {
  schema: typeof SCHEMA.session;
  header: SessionHeader;
  genesis: string;
  log: LogEntry<MissionCommand>[];
  checkpoints: Checkpoint[];
  final: { seq: number; tick: number; stateHash: string };
  summary: SessionSummary;
  privacy: { audio: string; personal: string };
  exportedAt?: string;
}

export const PRIVACY_NOTE = {
  audio: 'Raw microphone audio is never recorded or exported. Microphone use appears only as timeline notes.',
  personal: 'No names, accounts or free text are collected.',
};

const hypothesisLabel = (session: Pick<MissionSession, 'manifest'>, pointId: string, id: string | null) => {
  if (id === null) return null;
  const spec = session.manifest.decisions.find((candidate) => candidate.id === pointId);
  return spec?.hypotheses.find((hypothesis) => hypothesis.id === id)?.label ?? id;
};

export const summarizeState = (session: Pick<MissionSession, 'manifest'>, state: MissionState): SessionSummary => ({
  scenarioTitle: session.manifest.title,
  ticks: state.tick,
  phase: state.phase,
  decisions: state.resolved.map((decision) => ({
    title: decision.pointTitle,
    course: decision.optionTitle,
    reliedOn: hypothesisLabel(session, decision.pointId, decision.reliedOn),
    truth: hypothesisLabel(session, decision.pointId, decision.truth) ?? decision.truth,
    correctness: decision.correctness,
    utility: decision.utility,
    condition: decision.condition,
    assistant: !decision.assistant
      ? 'No assistant'
      : decision.assistant.status === 'abstention'
        ? `Declined to conclude (${decision.assistant.abstention?.reason})`
        : decision.assistant.assessment?.statement ?? '',
  })),
  objectives: state.objectives.map(({ label, progress }) => ({ label, progress })),
  totalUtility: state.resolved.reduce((total, decision) => total + decision.utility, 0),
});

export const createSessionRecord = (session: MissionSession, exportedAt?: string): SessionRecordV2 => ({
  schema: SCHEMA.session,
  header: session.header,
  genesis: session.genesis,
  log: [...session.log],
  checkpoints: [...session.checkpoints, ...(session.checkpoints[session.checkpoints.length - 1]?.seq === session.log.length - 1 ? [] : [{ seq: session.log.length - 1, tick: session.state.tick, stateHash: stateHash(session.state) }])],
  final: { seq: session.log.length - 1, tick: session.state.tick, stateHash: stateHash(session.state) },
  summary: summarizeState(session, session.state),
  privacy: PRIVACY_NOTE,
  ...(exportedAt ? { exportedAt } : {}),
});

const severity = z.enum(['nominal', 'watch', 'critical']);
const condition = z.enum(['A', 'B', 'C', 'D']);
const commandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('advance'), ticks: z.number().int() }).strict(),
  z.object({ type: z.literal('advancePhase') }).strict(),
  z.object({ type: z.literal('setAutoAdvance'), enabled: z.boolean() }).strict(),
  z.object({ type: z.literal('toggleRedTeam') }).strict(),
  z.object({ type: z.literal('setCondition'), condition }).strict(),
  z.object({ type: z.literal('inspectEvidence'), pointId: z.string(), evidenceId: z.string() }).strict(),
  z
    .object({
      type: z.literal('commitDecision'),
      pointId: z.string(),
      optionId: z.string(),
      actor: z.enum(['participant', 'agent']),
      confidence: z.number().optional(),
      latencyMs: z.number().optional(),
      selectionChanges: z.number().optional(),
    })
    .strict(),
  z.object({ type: z.literal('note'), label: z.string(), detail: z.string(), severity }).strict(),
]);

const hex64 = z.string().regex(/^[0-9a-f]{64}$/);

export const sessionRecordSchema = z
  .object({
    schema: z.literal(SCHEMA.session),
    header: z
      .object({
        schema: z.literal(SCHEMA.session),
        engineVersion: z.string(),
        appVersion: z.string(),
        scenario: z.object({ id: z.string(), version: z.string(), manifestHash: hex64 }).strict(),
        seed: z.string().min(1).max(200),
        condition,
      })
      .strict(),
    genesis: hex64,
    log: z.array(z.object({ seq: z.number().int(), command: commandSchema, prevHash: hex64, hash: hex64 }).strict()).max(20000),
    checkpoints: z.array(z.object({ seq: z.number().int(), tick: z.number().int(), stateHash: hex64 }).strict()),
    final: z.object({ seq: z.number().int(), tick: z.number().int(), stateHash: hex64 }).strict(),
    summary: z.unknown(),
    privacy: z.unknown(),
    exportedAt: z.string().optional(),
  })
  .strict();

const legacySchema = z.object({
  schema: z.literal(SCHEMA.legacySession),
  startedAt: z.string(),
  exportedAt: z.string(),
  phase: z.number(),
  decisions: z.array(
    z.object({
      pointId: z.string(),
      pointTitle: z.string(),
      timestamp: z.number(),
      phase: z.number(),
      outcome: z.object({ id: z.string(), title: z.string(), risk: z.string(), consequences: z.string() }).passthrough(),
    }),
  ),
  objectives: z.array(z.object({ id: z.string(), label: z.string(), progress: z.number() })),
  events: z.array(z.object({ timestamp: z.number(), label: z.string(), detail: z.string(), severity: z.string() })).optional(),
});

export type ImportResult =
  | { kind: 'session'; record: SessionRecordV2; verification: ReplayVerification; summary: SessionSummary | null }
  | {
      kind: 'legacy';
      note: string;
      exportedAt: string;
      phase: number;
      decisions: Array<{ title: string; course: string; consequences: string; phase: number }>;
      objectives: Array<{ label: string; progress: number }>;
    }
  | { kind: 'invalid'; errors: string[] };

export const importSessionRecord = (raw: unknown): ImportResult => {
  const schema = typeof raw === 'object' && raw !== null ? (raw as { schema?: unknown }).schema : undefined;
  if (schema === SCHEMA.legacySession) {
    const legacy = legacySchema.safeParse(raw);
    if (!legacy.success) return { kind: 'invalid', errors: legacy.error.issues.slice(0, 5).map((issue) => `${issue.path.join('.')}: ${issue.message}`) };
    return {
      kind: 'legacy',
      note: 'This record was made by Orpheus v1, before sessions were seeded. Its decisions can be read, but it contains no seed or command log, so it cannot be replayed.',
      exportedAt: legacy.data.exportedAt,
      phase: legacy.data.phase,
      decisions: legacy.data.decisions.map((decision) => ({
        title: decision.pointTitle,
        course: decision.outcome.title,
        consequences: decision.outcome.consequences,
        phase: decision.phase,
      })),
      objectives: legacy.data.objectives.map(({ label, progress }) => ({ label, progress })),
    };
  }
  const parsed = sessionRecordSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      kind: 'invalid',
      errors: schema === SCHEMA.session ? parsed.error.issues.slice(0, 5).map((issue) => `${issue.path.join('.')}: ${issue.message}`) : ['Not an Orpheus session record.'],
    };
  }
  const record = parsed.data as unknown as SessionRecordV2;
  const manifest = getScenario(record.header.scenario.id);
  const checkpoints = record.checkpoints.some((checkpoint) => checkpoint.seq === record.final.seq) ? record.checkpoints : [...record.checkpoints, record.final];
  const verification = verifyReplay(manifest, record.header, record.genesis, record.log, checkpoints);
  return { kind: 'session', record, verification, summary: null };
};

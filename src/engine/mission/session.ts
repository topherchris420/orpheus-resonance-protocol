import type { AssistanceCondition } from '@/assistant/schema';
import { manifestHash, scenarioRef } from '@/scenarios/registry';
import type { ScenarioManifest } from '@/scenarios/types';
import { hashValue } from '../canonical';
import { appendEntry, genesisHash, verifyChain, type ChainVerification, type LogEntry } from '../log';
import { APP_VERSION, ENGINE_VERSION, majorVersion, SCHEMA } from '../version';
import { createMissionState, reduceMission } from './reducer';
import type { MissionCommand, MissionState } from './types';

export interface SessionHeader {
  schema: typeof SCHEMA.session;
  engineVersion: string;
  appVersion: string;
  scenario: { id: string; version: string; manifestHash: string };
  seed: string;
  condition: AssistanceCondition;
}

export interface Checkpoint {
  /** -1 is the initial state, before any command. */
  seq: number;
  tick: number;
  stateHash: string;
}

export interface MissionSession {
  manifest: ScenarioManifest;
  header: SessionHeader;
  genesis: string;
  state: MissionState;
  log: LogEntry<MissionCommand>[];
  checkpoints: Checkpoint[];
}

export const CHECKPOINT_EVERY_TICKS = 15;

export const stateHash = (state: MissionState): string => hashValue(state);

export const createSession = (manifest: ScenarioManifest, seed: string, condition: AssistanceCondition): MissionSession => {
  const header: SessionHeader = {
    schema: SCHEMA.session,
    engineVersion: ENGINE_VERSION,
    appVersion: APP_VERSION,
    scenario: scenarioRef(manifest),
    seed,
    condition,
  };
  const state = createMissionState(manifest, seed, condition);
  return { manifest, header, genesis: genesisHash(header), state, log: [], checkpoints: [{ seq: -1, tick: 0, stateHash: stateHash(state) }] };
};

const wantsCheckpoint = (command: MissionCommand, before: MissionState, after: MissionState) =>
  command.type !== 'advance' ||
  command.ticks > 1 ||
  Math.floor(after.tick / CHECKPOINT_EVERY_TICKS) !== Math.floor(before.tick / CHECKPOINT_EVERY_TICKS);

export type DispatchResult = { session: MissionSession; accepted: true } | { session: MissionSession; accepted: false; reason: string };

/** Applies a command. Accepted commands are appended to the hash-chained log; rejected ones change nothing. */
export const dispatch = (session: MissionSession, command: MissionCommand): DispatchResult => {
  const result = reduceMission(session.state, command, session.manifest);
  if (!result.accepted) return { session, accepted: false, reason: result.reason };
  const log = appendEntry(session.log, command, session.genesis);
  const checkpoints = wantsCheckpoint(command, session.state, result.state)
    ? [...session.checkpoints, { seq: log.length - 1, tick: result.state.tick, stateHash: stateHash(result.state) }]
    : session.checkpoints;
  return { session: { ...session, state: result.state, log, checkpoints }, accepted: true };
};

/** Recomputes the state after `throughSeq` (inclusive; -1 = initial) from the seed and the log alone. */
export const reconstructState = (
  manifest: ScenarioManifest,
  header: Pick<SessionHeader, 'seed' | 'condition'>,
  log: readonly LogEntry<MissionCommand>[],
  throughSeq: number,
): MissionState => {
  let state = createMissionState(manifest, header.seed, header.condition);
  for (let index = 0; index <= throughSeq && index < log.length; index += 1) {
    const result = reduceMission(state, log[index].command, manifest);
    if (!result.accepted) throw new ReplayError(index, `Recorded command was rejected on replay: ${result.reason}`);
    state = result.state;
  }
  return state;
};

export class ReplayError extends Error {
  constructor(readonly seq: number, message: string) {
    super(message);
    this.name = 'ReplayError';
  }
}

export interface Compatibility {
  replayable: boolean;
  issues: string[];
}

export const checkCompatibility = (header: SessionHeader, manifest: ScenarioManifest | undefined): Compatibility => {
  const issues: string[] = [];
  if (majorVersion(header.engineVersion) !== majorVersion(ENGINE_VERSION)) {
    issues.push(`Recorded with engine ${header.engineVersion}; this build runs ${ENGINE_VERSION}. The record can be read but not replayed exactly.`);
  }
  if (!manifest) issues.push(`Scenario "${header.scenario.id}" is not available in this build.`);
  else if (manifestHash(manifest) !== header.scenario.manifestHash) {
    issues.push(
      `Scenario "${header.scenario.id}" changed since recording (recorded ${header.scenario.version}, available ${manifest.version}). Exact replay requires the identical manifest.`,
    );
  }
  return { replayable: issues.length === 0, issues };
};

export interface ReplayVerification {
  chain: ChainVerification;
  compatibility: Compatibility;
  checkpointsChecked: number;
  checkpointsMatched: number;
  firstDivergence: { seq: number; tick: number; expected: string; actual: string } | null;
  error: string | null;
  verified: boolean;
}

/** Re-executes a recording from its seed and compares every checkpoint hash. */
export const verifyReplay = (
  manifest: ScenarioManifest | undefined,
  header: SessionHeader,
  genesis: string,
  log: readonly LogEntry<MissionCommand>[],
  checkpoints: readonly Checkpoint[],
): ReplayVerification => {
  const chain = verifyChain(log, genesis);
  const expectedGenesis = genesisHash(header);
  const compatibility = checkCompatibility(header, manifest);
  const base = { chain, compatibility, checkpointsChecked: 0, checkpointsMatched: 0, firstDivergence: null, error: null };
  if (expectedGenesis !== genesis) return { ...base, error: 'The log genesis does not match the session header.', verified: false };
  if (!chain.ok) return { ...base, error: `Log integrity check failed at entry ${chain.firstInvalidSeq}: ${chain.reason}`, verified: false };
  if (!compatibility.replayable || !manifest) return { ...base, error: 'The record is not replayable with this build.', verified: false };

  const bySeq = new Map(checkpoints.map((checkpoint) => [checkpoint.seq, checkpoint]));
  let state = createMissionState(manifest, header.seed, header.condition);
  let checked = 0;
  let matched = 0;
  const compare = (seq: number): ReplayVerification['firstDivergence'] => {
    const checkpoint = bySeq.get(seq);
    if (!checkpoint) return null;
    checked += 1;
    const actual = stateHash(state);
    if (actual === checkpoint.stateHash && state.tick === checkpoint.tick) {
      matched += 1;
      return null;
    }
    return { seq, tick: checkpoint.tick, expected: checkpoint.stateHash, actual };
  };
  let divergence = compare(-1);
  for (let index = 0; index < log.length && !divergence; index += 1) {
    const result = reduceMission(state, log[index].command, manifest);
    if (!result.accepted) {
      return { ...base, checkpointsChecked: checked, checkpointsMatched: matched, error: `Entry ${index} was rejected on replay: ${result.reason}`, verified: false };
    }
    state = result.state;
    divergence = compare(index);
  }
  return {
    ...base,
    checkpointsChecked: checked,
    checkpointsMatched: matched,
    firstDivergence: divergence,
    verified: !divergence && checked === checkpoints.length && checked > 0,
  };
};

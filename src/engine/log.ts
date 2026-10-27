import { canonicalJson, hashValue } from './canonical';
import { sha256Hex } from './sha256';

/**
 * Append-only, hash-chained command log. Each entry commits to its predecessor, so any edit, deletion
 * or reordering of recorded inputs is detected on import. This is integrity checking, not
 * authentication: the chain proves a record is internally consistent, not who produced it.
 */
export interface LogEntry<C> {
  readonly seq: number;
  readonly command: C;
  readonly prevHash: string;
  readonly hash: string;
}

export const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
};

export const genesisHash = (header: unknown): string => sha256Hex(`orpheus.log.genesis:${canonicalJson(header)}`);

const entryHash = (seq: number, command: unknown, prevHash: string) => hashValue({ seq, command, prevHash });

export const createEntry = <C>(seq: number, command: C, prevHash: string): LogEntry<C> =>
  deepFreeze({ seq, command: structuredCloneJson(command), prevHash, hash: entryHash(seq, command, prevHash) });

export const appendEntry = <C>(entries: readonly LogEntry<C>[], command: C, genesis: string): LogEntry<C>[] => {
  const previous = entries[entries.length - 1];
  return [...entries, createEntry(entries.length, command, previous ? previous.hash : genesis)];
};

export type ChainVerification =
  | { ok: true; entries: number }
  | { ok: false; entries: number; firstInvalidSeq: number; reason: string };

export const verifyChain = <C>(entries: readonly LogEntry<C>[], genesis: string): ChainVerification => {
  let previousHash = genesis;
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (entry.seq !== index) {
      return { ok: false, entries: entries.length, firstInvalidSeq: index, reason: `Expected sequence ${index}, found ${entry.seq}` };
    }
    if (entry.prevHash !== previousHash) {
      return { ok: false, entries: entries.length, firstInvalidSeq: index, reason: 'Entry does not link to the previous entry' };
    }
    if (entryHash(entry.seq, entry.command, entry.prevHash) !== entry.hash) {
      return { ok: false, entries: entries.length, firstInvalidSeq: index, reason: 'Entry contents do not match their hash' };
    }
    previousHash = entry.hash;
  }
  return { ok: true, entries: entries.length };
};

/** JSON-faithful copy; rejects values that cannot be recorded (see canonicalJson). */
export const structuredCloneJson = <T>(value: T): T => JSON.parse(canonicalJson(value)) as T;

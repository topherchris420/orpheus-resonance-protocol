import type { MissionSession } from '@/engine/mission/session';

/**
 * The session seal: the head of the hash-chained command log. Each entry's hash commits to the entry
 * before it, so the head commits to the whole history: change, drop or reorder any recorded input and
 * the head changes. Note the fingerprint (or read it aloud) and a record can later be checked against
 * it. This is integrity, not authentication; anyone can recompute the chain, so it proves a record is
 * unaltered relative to a known head, not who made it.
 */
export interface Seal {
  /** Number of recorded commands. */
  entries: number;
  /** Hash of the last entry, or the genesis hash for an empty log. */
  head: string;
  genesis: string;
}

/** Cheap enough to read on every tick: no hashing, only the stored chain. */
export const sealOf = (session: Pick<MissionSession, 'log' | 'genesis'>): Seal => ({
  entries: session.log.length,
  head: session.log[session.log.length - 1]?.hash ?? session.genesis,
  genesis: session.genesis,
});

/** `9F3C-A1E7-0D4E-B1A8`: the first `groups` × 16 bits of a hex digest, grouped for reading aloud. */
export const fingerprint = (hex: string, groups = 4): string => {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length < groups * 4) throw new RangeError('Not a long enough hex digest.');
  const parts: string[] = [];
  for (let index = 0; index < groups; index += 1) parts.push(hex.slice(index * 4, index * 4 + 4).toUpperCase());
  return parts.join('-');
};

const SEED_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

/** A fresh, human-readable session seed such as `7F3A-91C2`, drawn from the platform CSPRNG. */
export const newSessionSeed = (crypto: Pick<Crypto, 'getRandomValues'> = globalThis.crypto): string => {
  const [word] = crypto.getRandomValues(new Uint32Array(1));
  const hex = word.toString(16).toUpperCase().padStart(8, '0');
  return `${hex.slice(0, 4)}-${hex.slice(4)}`;
};

/** A seed supplied by the operator (e.g. `?seed=` in the address), or null when it is not acceptable. */
export const normalizeSeed = (raw: string | null | undefined): string | null => {
  const trimmed = raw?.trim() ?? '';
  return SEED_PATTERN.test(trimmed) ? trimmed : null;
};

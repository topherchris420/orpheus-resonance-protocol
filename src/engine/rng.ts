import { sha256Hex } from './sha256';

/**
 * Seeded pseudorandom numbers for the simulation (sfc32, "Small Fast Counter" by Chris Doty-Humphrey).
 *
 * - The complete generator state is four unsigned 32-bit integers, so it can be stored inside
 *   simulation state, hashed, snapshotted and restored exactly.
 * - Seeds are strings. A seed is expanded with SHA-256, so "42" and "42 " are different seeds and
 *   every seed maps to a well-mixed initial state.
 * - Named child streams (`deriveSeed`) keep independent subsystems from consuming each other's draws:
 *   adding a random draw to the intel generator does not change the threat tracks.
 *
 * Only integer and IEEE-754 basic arithmetic is used, which ECMAScript specifies exactly, so the same
 * seed produces the same sequence in every compliant JavaScript engine.
 */
export interface RngState {
  a: number;
  b: number;
  c: number;
  d: number;
}

const TWO_POW_32 = 4294967296;
const WARM_UP_DRAWS = 15;

const parseWord = (hex: string, index: number) => parseInt(hex.slice(index * 8, index * 8 + 8), 16) >>> 0;

export const seedState = (seed: string): RngState => {
  const digest = sha256Hex(`orpheus.rng.v1:${seed}`);
  const state: RngState = { a: parseWord(digest, 0), b: parseWord(digest, 1), c: parseWord(digest, 2), d: parseWord(digest, 3) };
  const rng = new Rng(state);
  for (let i = 0; i < WARM_UP_DRAWS; i += 1) rng.nextUint32();
  return rng.snapshot();
};

export const deriveSeed = (seed: string, ...labels: Array<string | number>): string =>
  [seed, ...labels.map(String)].join('/');

export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(state: RngState) {
    this.a = state.a >>> 0;
    this.b = state.b >>> 0;
    this.c = state.c >>> 0;
    this.d = state.d >>> 0;
  }

  static fromSeed(seed: string): Rng {
    return new Rng(seedState(seed));
  }

  snapshot(): RngState {
    return { a: this.a >>> 0, b: this.b >>> 0, c: this.c >>> 0, d: this.d >>> 0 };
  }

  nextUint32(): number {
    let a = this.a | 0;
    let b = this.b | 0;
    let c = this.c | 0;
    let d = this.d | 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    this.a = a >>> 0;
    this.b = b >>> 0;
    this.c = c >>> 0;
    this.d = d >>> 0;
    return t >>> 0;
  }

  /** Uniform in [0, 1). */
  next(): number {
    return this.nextUint32() / TWO_POW_32;
  }

  /** Uniform integer in [min, max], inclusive. Ranges are limited so the arithmetic stays exact. */
  int(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new RangeError(`Invalid integer range ${min}..${max}`);
    }
    const span = max - min + 1;
    if (span > 0x100000) throw new RangeError('Integer range too large for exact sampling');
    return min + Math.floor((this.nextUint32() * span) / TWO_POW_32);
  }

  /** True with probability `permille / 1000`. Integer probabilities keep decisions exact. */
  chancePermille(permille: number): boolean {
    return this.int(0, 999) < permille;
  }

  /** True with probability p, where p is computed with basic arithmetic only. */
  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /** Symmetric noise in [-1, 1). */
  signed(): number {
    return this.next() * 2 - 1;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new RangeError('Cannot pick from an empty list');
    return items[this.int(0, items.length - 1)];
  }

  /** Fisher–Yates shuffle; returns a new array. */
  shuffle<T>(items: readonly T[]): T[] {
    const result = items.slice();
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = this.int(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

/** Run a function with a generator restored from `state`; returns the result and the advanced state. */
export const withRng = <T>(state: RngState, run: (rng: Rng) => T): { value: T; state: RngState } => {
  const rng = new Rng(state);
  const value = run(rng);
  return { value, state: rng.snapshot() };
};

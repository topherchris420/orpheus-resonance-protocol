import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { canonicalJson, CanonicalizationError, hashValue } from './canonical';
import { formatAge, formatSimTime } from './clock';
import { appendEntry, genesisHash, verifyChain, type LogEntry } from './log';
import { quantize } from './numeric';
import { deriveSeed, Rng, seedState, withRng } from './rng';
import { sha256Hex } from './sha256';

const nodeSha = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');

describe('sha256', () => {
  it('matches FIPS 180-4 test vectors', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
  });

  it('agrees with node:crypto across block boundaries and unicode', () => {
    for (const length of [55, 56, 63, 64, 65, 119, 120, 1000]) {
      const value = 'x'.repeat(length);
      expect(sha256Hex(value)).toBe(nodeSha(value));
    }
    const unicode = 'Orpheus · réplica · 证据 · 🛰️';
    expect(sha256Hex(unicode)).toBe(nodeSha(unicode));
  });
});

describe('canonical JSON', () => {
  it('sorts keys, drops undefined fields and normalizes -0', () => {
    expect(canonicalJson({ b: 1, a: { d: [1, 'two'], c: null }, z: undefined, m: -0 })).toBe(
      '{"a":{"c":null,"d":[1,"two"]},"b":1,"m":0}',
    );
    expect(hashValue({ x: 1, y: 2 })).toBe(hashValue({ y: 2, x: 1 }));
  });

  it('rejects values that JSON cannot represent faithfully', () => {
    expect(() => canonicalJson({ value: Number.NaN })).toThrow(CanonicalizationError);
    expect(() => canonicalJson({ value: Number.POSITIVE_INFINITY })).toThrow(/Non-finite/);
    expect(() => canonicalJson([1, undefined])).toThrow(/Undefined array item/);
    expect(() => canonicalJson({ when: new Date(0) })).toThrow(/Unsupported object/);
    expect(() => canonicalJson({ run: () => 1 })).toThrow(/Unsupported function/);
  });
});

describe('seeded RNG', () => {
  it('reproduces identical sequences for identical seeds and differs for different seeds', () => {
    const first = Rng.fromSeed('orpheus');
    const second = Rng.fromSeed('orpheus');
    const third = Rng.fromSeed('orpheus ');
    const a = Array.from({ length: 50 }, () => first.nextUint32());
    const b = Array.from({ length: 50 }, () => second.nextUint32());
    const c = Array.from({ length: 50 }, () => third.nextUint32());
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('matches the reference sfc32 sequence for an explicit state', () => {
    // Values produced by the reference closure implementation of sfc32 for the same four words.
    const rng = new Rng({ a: 0x9e3779b9, b: 0x243f6a88, c: 0xb7e15162, d: 1 });
    expect(Array.from({ length: 6 }, () => rng.nextUint32())).toEqual([
      3262571586, 2602127793, 3691875691, 1400833174, 2246018411, 1634095475,
    ]);
  });

  it('pins the first outputs of a known seed so engine changes cannot silently alter replays', () => {
    const rng = Rng.fromSeed('reference-seed');
    const outputs = Array.from({ length: 4 }, () => rng.nextUint32());
    // Regenerating these values intentionally is a breaking change for recorded sessions.
    expect(outputs).toMatchInlineSnapshot(`
      [
        3700654861,
        1043847913,
        2397006050,
        2882611812,
      ]
    `);
  });

  it('snapshots and restores state exactly', () => {
    const rng = Rng.fromSeed('snapshot');
    rng.nextUint32();
    const snapshot = rng.snapshot();
    const expected = [rng.nextUint32(), rng.nextUint32()];
    const restored = new Rng(snapshot);
    expect([restored.nextUint32(), restored.nextUint32()]).toEqual(expected);
    const { value, state } = withRng(snapshot, (generator) => generator.int(1, 6));
    expect(value).toBeGreaterThanOrEqual(1);
    expect(state).not.toEqual(snapshot);
  });

  it('keeps integer draws in range and roughly uniform', () => {
    const rng = Rng.fromSeed('uniformity');
    const counts = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 60000; i += 1) counts[rng.int(0, 5)] += 1;
    for (const count of counts) expect(count).toBeGreaterThan(9500);
    for (const count of counts) expect(count).toBeLessThan(10500);
    expect(() => rng.int(5, 1)).toThrow(RangeError);
  });

  it('derives independent named streams', () => {
    expect(deriveSeed('base', 'trial', 3)).toBe('base/trial/3');
    expect(seedState(deriveSeed('base', 'a'))).not.toEqual(seedState(deriveSeed('base', 'b')));
  });

  it('shuffles deterministically without losing items', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    const shuffled = Rng.fromSeed('shuffle').shuffle(items);
    expect(Rng.fromSeed('shuffle').shuffle(items)).toEqual(shuffled);
    expect([...shuffled].sort()).toEqual(items);
  });
});

describe('hash-chained log', () => {
  const genesis = genesisHash({ session: 'test' });
  const build = () => {
    let entries: LogEntry<{ type: string; value?: number }>[] = [];
    entries = appendEntry(entries, { type: 'start' }, genesis);
    entries = appendEntry(entries, { type: 'advance', value: 3 }, genesis);
    entries = appendEntry(entries, { type: 'decide', value: 1 }, genesis);
    return entries;
  };

  it('verifies an untouched chain', () => {
    expect(verifyChain(build(), genesis)).toEqual({ ok: true, entries: 3 });
  });

  it('freezes recorded entries', () => {
    const entries = build();
    expect(Object.isFrozen(entries[1])).toBe(true);
    expect(Object.isFrozen(entries[1].command)).toBe(true);
  });

  it('detects edited, reordered and truncated-then-extended records', () => {
    const edited = build().map((entry) => ({ ...entry, command: { ...entry.command } }));
    edited[1].command.value = 4;
    expect(verifyChain(edited, genesis)).toMatchObject({ ok: false, firstInvalidSeq: 1 });

    const reordered = build();
    [reordered[1], reordered[2]] = [reordered[2], reordered[1]];
    expect(verifyChain(reordered, genesis)).toMatchObject({ ok: false, firstInvalidSeq: 1 });

    expect(verifyChain(build(), genesisHash({ session: 'other' }))).toMatchObject({ ok: false, firstInvalidSeq: 0 });
  });
});

describe('numeric and clock helpers', () => {
  it('quantizes without producing negative zero', () => {
    expect(quantize(0.12345)).toBe(0.123);
    expect(Object.is(quantize(-0.0001), 0)).toBe(true);
  });

  it('formats simulated time from ticks only', () => {
    expect(formatSimTime(0)).toBe('00:00');
    expect(formatSimTime(125)).toBe('02:05');
    expect(formatSimTime(3725)).toBe('1:02:05');
    expect(formatAge(540)).toBe('9 min');
    expect(formatAge(45)).toBe('45 s');
  });
});

import { canonicalJson } from '@/engine/canonical';
import { appendEntry, genesisHash, verifyChain, type LogEntry } from '@/engine/log';
import { createSessionRecord } from '@/engine/mission/record';
import { createSession, dispatch, stateHash, verifyReplay, type MissionSession } from '@/engine/mission/session';
import type { MissionCommand } from '@/engine/mission/types';
import { Rng } from '@/engine/rng';
import { sha256Hex } from '@/engine/sha256';
import { BUILDING_47 } from '@/scenarios/building47';

/**
 * Power-on self-tests, in the spirit of the FIPS 140-3 known-answer tests a cryptographic module runs
 * before it is used. Everything the command room's integrity claims rest on is exercised here: the
 * hash function, the seeded generator, canonical serialization, tamper detection in the command log,
 * and the simulation engine itself, which must reproduce a scripted run bit for bit. A browser that
 * computes any of these differently could not verify, or be verified by, another machine's records.
 */

export type SelfTestStatus = 'pass' | 'fail' | 'skip';

export interface SelfTestResult {
  id: string;
  label: string;
  status: SelfTestStatus;
  /** Short evidence printed after the label, e.g. "3/3 vectors". */
  detail: string;
}

/** FIPS 180-2 Appendix B test vectors. */
export const SHA256_VECTORS: ReadonlyArray<{ message: string; digest: string }> = [
  { message: 'abc', digest: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' },
  { message: '', digest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
  {
    message: 'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
    digest: '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
  },
];

/** First outputs of the seeded generator for a fixed seed (sfc32 after SHA-256 seed expansion). */
export const RNG_VECTOR = { seed: 'orpheus.kat.rng', outputs: [957485355, 3240443288, 3446713325, 4078571408] as const };

/** A scripted Building 47 run. Its final state hash is fixed by the engine and the scenario manifest. */
export const PROBE_SEED = 'orpheus.post.v1';
export const PROBE_SCRIPT: readonly MissionCommand[] = [
  { type: 'advance', ticks: 45 },
  { type: 'commitDecision', pointId: 'dp-breach', optionId: 'dp-breach-hold', actor: 'agent' },
  { type: 'advancePhase' },
  { type: 'toggleRedTeam' },
  { type: 'advance', ticks: 40 },
  { type: 'setAutoAdvance', enabled: true },
  { type: 'advance', ticks: 35 },
];
/** Update only when an engine or manifest change is intended; see selftest.test.ts. */
export const PROBE_FINAL_STATE_HASH = '0c71f615e781fc69e5af0f62d8d94f718d66d6571d5a73f2a0193eddde86c1e2';

const pass = (id: string, label: string, detail: string): SelfTestResult => ({ id, label, status: 'pass', detail });
const fail = (id: string, label: string, detail: string): SelfTestResult => ({ id, label, status: 'fail', detail });

const guarded = (id: string, label: string, run: () => SelfTestResult): SelfTestResult => {
  try {
    return run();
  } catch (error) {
    return fail(id, label, error instanceof Error ? error.message : 'threw');
  }
};

export const runProbe = (): MissionSession => {
  let session = createSession(BUILDING_47, PROBE_SEED, 'D');
  for (const command of PROBE_SCRIPT) {
    const result = dispatch(session, command);
    if (!result.accepted) throw new Error(`Probe command rejected: ${result.reason}`);
    session = result.session;
  }
  return session;
};

const sha256Kat = (): SelfTestResult =>
  guarded('sha256-kat', 'SHA-256 known-answer test (FIPS 180-4)', () => {
    const matched = SHA256_VECTORS.filter((vector) => sha256Hex(vector.message) === vector.digest).length;
    const detail = `${matched}/${SHA256_VECTORS.length} vectors`;
    return matched === SHA256_VECTORS.length ? pass('sha256-kat', 'SHA-256 known-answer test (FIPS 180-4)', detail) : fail('sha256-kat', 'SHA-256 known-answer test (FIPS 180-4)', detail);
  });

const rngKat = (): SelfTestResult =>
  guarded('rng-kat', 'sfc32 deterministic stream', () => {
    const rng = Rng.fromSeed(RNG_VECTOR.seed);
    const outputs = RNG_VECTOR.outputs.map(() => rng.nextUint32());
    const matched = outputs.filter((value, index) => value === RNG_VECTOR.outputs[index]).length;
    const detail = `${matched}/${RNG_VECTOR.outputs.length} words`;
    return matched === RNG_VECTOR.outputs.length ? pass('rng-kat', 'sfc32 deterministic stream', detail) : fail('rng-kat', 'sfc32 deterministic stream', detail);
  });

const canonicalKat = (): SelfTestResult =>
  guarded('canonical-kat', 'Canonical JSON (RFC 8785 key order)', () => {
    const encoded = canonicalJson({ b: [3, { d: 1, c: null }], a: 'x', e: -0, f: 1.5e-7 });
    const expected = '{"a":"x","b":[3,{"c":null,"d":1}],"e":0,"f":1.5e-7}';
    return encoded === expected
      ? pass('canonical-kat', 'Canonical JSON (RFC 8785 key order)', '1/1 vectors')
      : fail('canonical-kat', 'Canonical JSON (RFC 8785 key order)', 'encoding differs');
  });

const chainKat = (): SelfTestResult =>
  guarded('chain-kat', 'Hash-chain tamper detection', () => {
    const genesis = genesisHash({ selfTest: true });
    let log: LogEntry<MissionCommand>[] = [];
    for (const command of PROBE_SCRIPT.slice(0, 3)) log = appendEntry(log, command, genesis);
    const intact = verifyChain(log, genesis);
    const tampered = log.map((entry, index) => (index === 1 ? { ...entry, command: { ...entry.command, actor: 'participant' } as MissionCommand } : entry));
    const detected = verifyChain(tampered, genesis);
    const ok = intact.ok && !detected.ok && detected.firstInvalidSeq === 1;
    return ok
      ? pass('chain-kat', 'Hash-chain tamper detection', 'edit at seq 1 detected')
      : fail('chain-kat', 'Hash-chain tamper detection', intact.ok ? 'an edited entry went undetected' : 'an intact chain failed verification');
  });

const determinismKat = (): SelfTestResult[] => {
  const label = 'Engine determinism (Building 47 probe)';
  let session: MissionSession;
  try {
    session = runProbe();
  } catch (error) {
    return [fail('engine-kat', label, error instanceof Error ? error.message : 'threw'), fail('replay-kat', 'Replay verification', 'probe did not run')];
  }
  const hash = stateHash(session.state);
  const engine =
    hash === PROBE_FINAL_STATE_HASH
      ? pass('engine-kat', label, `${session.state.tick} ticks · ${hash.slice(0, 12)}`)
      : fail('engine-kat', label, `state ${hash.slice(0, 12)} ≠ ${PROBE_FINAL_STATE_HASH.slice(0, 12) || 'unset'}`);
  const replay = guarded('replay-kat', 'Replay verification', () => {
    const record = createSessionRecord(session);
    const checkpoints = record.checkpoints.some((checkpoint) => checkpoint.seq === record.final.seq) ? record.checkpoints : [...record.checkpoints, record.final];
    const verification = verifyReplay(BUILDING_47, record.header, record.genesis, record.log, checkpoints);
    const detail = `${verification.checkpointsMatched}/${verification.checkpointsChecked} checkpoints`;
    return verification.verified ? pass('replay-kat', 'Replay verification', detail) : fail('replay-kat', 'Replay verification', verification.error ?? detail);
  });
  return [engine, replay];
};

type CryptoLike = Pick<Crypto, 'getRandomValues'> & { subtle?: Pick<SubtleCrypto, 'digest'> };

const entropyKat = (crypto: CryptoLike | null): SelfTestResult => {
  const label = 'Entropy source (crypto.getRandomValues)';
  if (!crypto?.getRandomValues) return fail('entropy', label, 'unavailable');
  return guarded('entropy', label, () => {
    const words = crypto.getRandomValues(new Uint32Array(8));
    // A stuck generator returns repeated words. Eight equal 32-bit words by chance: p = 2^-224.
    return new Set(words).size > 1 ? pass('entropy', label, '256 bits drawn') : fail('entropy', label, 'repeated output');
  });
};

const platformCrypto = (): CryptoLike | null => (typeof globalThis.crypto === 'undefined' ? null : globalThis.crypto);

/** Synchronous tests, in the order they are printed. Pass `null` to test a platform without crypto. */
export const runSelfTests = (crypto: CryptoLike | null = platformCrypto()): SelfTestResult[] => [
  sha256Kat(),
  rngKat(),
  canonicalKat(),
  chainKat(),
  ...determinismKat(),
  entropyKat(crypto),
];

const toHex = (buffer: ArrayBuffer) => Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');

/**
 * Differential test: the engine's own SHA-256 and the browser's native implementation hash the same
 * random message. Two independent implementations agreeing is strong evidence both are correct.
 * WebCrypto exists only in secure contexts (HTTPS or localhost); elsewhere the test is skipped.
 */
export const runWebCryptoDifferential = async (crypto: CryptoLike | null = platformCrypto(), bytes = 4096): Promise<SelfTestResult> => {
  const label = 'SHA-256 differential vs WebCrypto';
  if (!crypto?.subtle?.digest || !crypto.getRandomValues) return { id: 'sha256-webcrypto', label, status: 'skip', detail: 'needs a secure context' };
  try {
    const message = new Uint8Array(bytes);
    for (let offset = 0; offset < bytes; offset += 65536) crypto.getRandomValues(message.subarray(offset, Math.min(bytes, offset + 65536)));
    const native = toHex(await crypto.subtle.digest('SHA-256', message));
    return native === sha256Hex(message) ? pass('sha256-webcrypto', label, `${bytes} random bytes agree`) : fail('sha256-webcrypto', label, 'digests differ');
  } catch (error) {
    return fail('sha256-webcrypto', label, error instanceof Error ? error.message : 'threw');
  }
};

export const allPassed = (results: readonly SelfTestResult[]) => results.every((result) => result.status !== 'fail');

import { webcrypto } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { stateHash } from '@/engine/mission/session';
import { sha256Hex } from '@/engine/sha256';
import { classifyUrl, EgressMonitor } from './egress';
import { fingerprint, newSessionSeed, normalizeSeed, sealOf } from './seal';
import { allPassed, PROBE_FINAL_STATE_HASH, runProbe, runSelfTests, runWebCryptoDifferential } from './selftest';

describe('power-on self-tests', () => {
  it('pass in a conforming JavaScript engine', () => {
    const results = runSelfTests(webcrypto as unknown as Crypto);
    expect(results.filter((result) => result.status !== 'pass')).toEqual([]);
    expect(allPassed(results)).toBe(true);
    expect(results.map((result) => result.id)).toEqual(['sha256-kat', 'rng-kat', 'canonical-kat', 'chain-kat', 'engine-kat', 'replay-kat', 'entropy']);
  });

  it('pin the engine probe; update PROBE_FINAL_STATE_HASH only for an intended engine or scenario change', () => {
    // If this fails, the simulation no longer computes what it computed before: recorded sessions
    // made with the old build will not replay. Bump the engine version if that is intended.
    expect(stateHash(runProbe().state)).toBe(PROBE_FINAL_STATE_HASH);
  });

  it('hashes the million-character FIPS vector (kept out of the boot path because it is slow)', () => {
    expect(sha256Hex('a'.repeat(1_000_000))).toBe('cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0');
  });

  it('agree with the native SHA-256 on random input of many lengths', async () => {
    for (const bytes of [0, 1, 55, 56, 63, 64, 65, 1000, 70_000]) {
      const result = await runWebCryptoDifferential(webcrypto as unknown as Crypto, bytes);
      expect(result.status, `${bytes} bytes`).toBe('pass');
    }
  });

  it('report missing platform features instead of failing silently', async () => {
    expect((await runWebCryptoDifferential({ getRandomValues: webcrypto.getRandomValues.bind(webcrypto) } as unknown as Crypto)).status).toBe('skip');
    const entropy = runSelfTests(null).find((result) => result.id === 'entropy')!;
    expect(entropy.status).toBe('fail');
    const stuck = runSelfTests({ getRandomValues: <T extends ArrayBufferView | null>(array: T) => array } as unknown as Crypto).find((result) => result.id === 'entropy')!;
    expect(stuck.status).toBe('fail');
  });
});

describe('session seal', () => {
  it('commits to every recorded command', () => {
    const session = runProbe();
    const seal = sealOf(session);
    expect(seal.entries).toBe(session.log.length);
    expect(seal.head).toBe(session.log[session.log.length - 1].hash);
    expect(fingerprint(seal.head)).toMatch(/^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/);
    expect(sealOf({ log: [], genesis: session.genesis }).head).toBe(session.genesis);
  });

  it('formats fingerprints and rejects non-digests', () => {
    expect(fingerprint('9f3ca1e70d4eb1a8ffff')).toBe('9F3C-A1E7-0D4E-B1A8');
    expect(fingerprint('9f3ca1e7', 2)).toBe('9F3C-A1E7');
    expect(() => fingerprint('xyz')).toThrow(RangeError);
  });

  it('draws readable seeds and accepts only safe operator-supplied ones', () => {
    expect(newSessionSeed(webcrypto as unknown as Crypto)).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}$/);
    expect(normalizeSeed(' ALPHA-1 ')).toBe('ALPHA-1');
    expect(normalizeSeed('orientation.v2_b')).toBe('orientation.v2_b');
    expect(normalizeSeed('')).toBeNull();
    expect(normalizeSeed('<script>')).toBeNull();
    expect(normalizeSeed('x'.repeat(65))).toBeNull();
  });
});

describe('EMCON egress monitor', () => {
  const origin = 'https://orpheus.example';

  it('classifies destinations by origin', () => {
    expect(classifyUrl('/assets/index.js', origin)).toBe('self');
    expect(classifyUrl('https://orpheus.example/x.png', origin)).toBe('self');
    expect(classifyUrl('data:image/png;base64,AAAA', origin)).toBe('inline');
    expect(classifyUrl('blob:https://orpheus.example/1234', origin)).toBe('inline');
    expect(classifyUrl('https://cdn.example.net/lib.js', origin)).toBe('external');
    expect(classifyUrl('http://orpheus.example/x', origin)).toBe('external');
  });

  it('reports loads that leave the origin and requests the policy blocked, once each', () => {
    let push: (entries: Array<{ name: string; initiatorType?: string }>) => void = () => undefined;
    let violate: (event: { blockedURI: string; violatedDirective: string }) => void = () => undefined;
    let disconnected = false;
    const monitor = new EgressMonitor({
      origin,
      existing: () => [{ name: `${origin}/assets/index.js` }, { name: `${origin}/assets/index.css` }],
      observe: (onEntries) => {
        push = onEntries;
        return { observe: () => undefined, disconnect: () => (disconnected = true) };
      },
      onViolation: (listener) => {
        violate = listener;
        return () => undefined;
      },
    });
    let notifications = 0;
    monitor.subscribe(() => (notifications += 1));
    monitor.start();
    expect(monitor.getSnapshot()).toEqual({ supported: true, sameOrigin: 2, external: [] });

    push([{ name: `${origin}/assets/index.js` }, { name: 'https://tracker.example/pixel.gif', initiatorType: 'img' }]);
    violate({ blockedURI: 'https://exfil.example/beacon', violatedDirective: 'connect-src' });
    violate({ blockedURI: 'https://exfil.example/beacon', violatedDirective: 'connect-src' });
    violate({ blockedURI: 'inline', violatedDirective: 'script-src' });
    const snapshot = monitor.getSnapshot();
    expect(snapshot.sameOrigin).toBe(2);
    expect(snapshot.external).toEqual([
      { url: 'https://tracker.example/pixel.gif', kind: 'loaded', detail: 'img' },
      { url: 'https://exfil.example/beacon', kind: 'blocked', detail: 'blocked by connect-src' },
    ]);
    expect(notifications).toBe(3);
    monitor.stop();
    expect(disconnected).toBe(true);
  });

  it('says when it cannot observe anything', () => {
    expect(new EgressMonitor({ origin }).start().getSnapshot().supported).toBe(false);
  });
});

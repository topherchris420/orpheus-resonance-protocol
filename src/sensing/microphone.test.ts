import { describe, expect, it, vi } from 'vitest';
import { SIGNALS, INFERRED_SIGNALS_NOTE } from './registry';
import {
  ConsentRequiredError,
  grantMicrophoneConsent,
  limitToneGain,
  LocalMicrophoneEnergySensor,
  MAX_TONE_GAIN,
  type AudioDeps,
  type EnergySample,
} from './microphone';

const fakeAudio = (level = 120) => {
  const track = { stop: vi.fn() };
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  const param = () => ({ value: 0, setValueAtTime: vi.fn(), setTargetAtTime: vi.fn() });
  const gains: Array<{ gain: ReturnType<typeof param> }> = [];
  const oscillators: Array<{ stop: ReturnType<typeof vi.fn> }> = [];
  const context = {
    currentTime: 0,
    sampleRate: 48000,
    destination: {},
    close: vi.fn(async () => undefined),
    createAnalyser: () => ({
      fftSize: 2048,
      frequencyBinCount: 1024,
      getByteFrequencyData: (bins: Uint8Array) => bins.fill(level),
      connect: vi.fn(),
    }),
    createMediaStreamSource: () => ({ connect: vi.fn() }),
    createGain: () => {
      const node = { gain: param(), connect: vi.fn() };
      gains.push(node);
      return node;
    },
    createOscillator: () => {
      const node = { frequency: param(), connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
      oscillators.push(node);
      return node;
    },
    createStereoPanner: () => ({ pan: { value: 0 }, connect: vi.fn() }),
  } as unknown as AudioContext;
  let clock = 0;
  const frames: Array<() => void> = [];
  const deps: AudioDeps = {
    getUserMedia: vi.fn(async () => stream),
    createContext: vi.fn(() => context),
    requestFrame: vi.fn((callback) => {
      frames.push(callback);
      return frames.length;
    }),
    cancelFrame: vi.fn(),
    now: () => clock,
  };
  const runFrames = (count: number) => {
    for (let index = 0; index < count; index += 1) {
      clock += 60;
      frames.shift()?.();
    }
  };
  return { deps, track, context, gains, oscillators, runFrames };
};

describe('microphone sensor', () => {
  it('refuses to start without explicit consent and never touches the device', async () => {
    const { deps } = fakeAudio();
    const sensor = new LocalMicrophoneEnergySensor(deps);
    await expect(sensor.start(null)).rejects.toBeInstanceOf(ConsentRequiredError);
    await expect(sensor.start({ scope: 'microphone-energy', grantedAt: 0, statement: 'yes' })).rejects.toBeInstanceOf(ConsentRequiredError);
    expect(deps.getUserMedia).not.toHaveBeenCalled();
    expect(sensor.state).toBe('idle');
  });

  it('requests audio only and emits a bounded number with a quality flag', async () => {
    const { deps, runFrames } = fakeAudio(120);
    const sensor = new LocalMicrophoneEnergySensor(deps);
    const samples: EnergySample[] = [];
    sensor.onSample((sample) => samples.push(sample));
    await sensor.start(grantMicrophoneConsent(1));
    expect(deps.getUserMedia).toHaveBeenCalledWith({ audio: true, video: false });
    expect(sensor.state).toBe('active');
    runFrames(10);
    expect(samples.length).toBeGreaterThan(5);
    for (const sample of samples) {
      expect(Object.keys(sample).sort()).toEqual(['at', 'energy', 'level', 'quality']);
      expect(sample.energy).toBeGreaterThanOrEqual(0);
      expect(sample.energy).toBeLessThanOrEqual(1);
      expect(sample.quality).toBe('good');
    }
  });

  it('stops immediately: tracks stopped, tones silenced, context closed, no further samples', async () => {
    const { deps, track, context, oscillators, gains, runFrames } = fakeAudio();
    const sensor = new LocalMicrophoneEnergySensor(deps);
    const listener = vi.fn();
    sensor.onSample(listener);
    await sensor.start(grantMicrophoneConsent(1));
    runFrames(3);
    const before = listener.mock.calls.length;
    sensor.stop();
    expect(track.stop).toHaveBeenCalled();
    expect(context.close).toHaveBeenCalled();
    expect(oscillators.every((oscillator) => oscillator.stop.mock.calls.length > 0)).toBe(true);
    expect(gains[0].gain.setValueAtTime).toHaveBeenLastCalledWith(0, 0);
    expect(sensor.state).toBe('stopped');
    runFrames(5);
    expect(listener.mock.calls.length).toBe(before);
    expect(() => sensor.stop()).not.toThrow();
  });

  it('releases the device if stopped while the permission prompt is open', async () => {
    const { deps, track } = fakeAudio();
    let resolve: (stream: MediaStream) => void = () => undefined;
    deps.getUserMedia = vi.fn(() => new Promise<MediaStream>((done) => (resolve = done)));
    const sensor = new LocalMicrophoneEnergySensor(deps);
    const starting = sensor.start(grantMicrophoneConsent(1));
    sensor.stop();
    resolve({ getTracks: () => [track] } as unknown as MediaStream);
    await starting;
    expect(track.stop).toHaveBeenCalled();
    expect(deps.createContext).not.toHaveBeenCalled();
    expect(sensor.state).toBe('stopped');
  });

  it('reports denial without leaving anything running', async () => {
    const { deps } = fakeAudio();
    deps.getUserMedia = vi.fn(async () => {
      throw Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    });
    const sensor = new LocalMicrophoneEnergySensor(deps);
    await sensor.start(grantMicrophoneConsent(1));
    expect(sensor.state).toBe('error');
    expect(sensor.error).toBe('Microphone permission was denied.');
    expect(deps.createContext).not.toHaveBeenCalled();
  });

  it('flags silence and clipping', async () => {
    const silent = fakeAudio(0);
    const quiet = new LocalMicrophoneEnergySensor(silent.deps);
    const qualities: string[] = [];
    quiet.onSample((sample) => qualities.push(sample.quality));
    await quiet.start(grantMicrophoneConsent(1));
    silent.runFrames(45);
    expect(qualities[qualities.length - 1]).toBe('silent');
    const loud = fakeAudio(255);
    const clipping = new LocalMicrophoneEnergySensor(loud.deps);
    const loudQualities: string[] = [];
    clipping.onSample((sample) => loudQualities.push(sample.quality));
    await clipping.start(grantMicrophoneConsent(1));
    loud.runFrames(3);
    expect(loudQualities[0]).toBe('clipping');
  });

  it('starts tones at zero gain and caps them', async () => {
    const { deps, gains } = fakeAudio();
    const sensor = new LocalMicrophoneEnergySensor(deps);
    await sensor.start(grantMicrophoneConsent(1));
    expect(gains[0].gain.setValueAtTime).toHaveBeenCalledWith(0, 0);
    sensor.setTones({ volume: 5, gainMultiplier: 3 });
    const lastTarget = gains[0].gain.setTargetAtTime.mock.calls.at(-1)![0];
    expect(lastTarget).toBe(MAX_TONE_GAIN);
    expect(limitToneGain(Number.NaN)).toBe(0);
    expect(limitToneGain(0.15, 1.6)).toBe(MAX_TONE_GAIN);
  });
});

describe('signal registry', () => {
  it('measures only microphone energy and never presents it as physiology', () => {
    const measured = SIGNALS.filter((descriptor) => descriptor.category === 'measured');
    expect(measured.map((descriptor) => descriptor.id)).toEqual(['mic.audio-energy']);
    expect(measured[0].doesNotIndicate).toMatch(/breathing, heart rate, HRV, stress/i);
    expect(measured[0].consentRequired).toBe(true);
    expect(SIGNALS.filter((descriptor) => descriptor.category === 'inferred')).toEqual([]);
    expect(INFERRED_SIGNALS_NOTE).toMatch(/No inferred signals/);
    for (const descriptor of SIGNALS.filter((candidate) => /hrv|pulse|respiration|stress/.test(candidate.id))) {
      expect(descriptor.category).toBe('simulated');
    }
  });
});

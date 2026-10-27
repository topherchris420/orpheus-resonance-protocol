/**
 * Local microphone energy sensor with generated tones.
 *
 * - Cannot start without a consent token, which only the consent dialog creates.
 * - Requests audio only (never video), analyzes it in memory, and emits a single normalized number
 *   plus a quality flag. No sample buffer is retained or exposed.
 * - `stop()` is synchronous and immediate: it stops every track, cancels analysis, silences and
 *   stops the oscillators, and closes the audio context. It is safe to call at any time, including
 *   while the permission prompt is still open.
 */

export interface MicrophoneConsent {
  readonly scope: 'microphone-energy';
  readonly grantedAt: number;
  readonly statement: string;
}

export const CONSENT_STATEMENT =
  'I allow this tab to analyze microphone audio energy locally. I understand it does not measure breathing, heart rate, stress or any physiological state, that nothing is recorded or sent, and that I can stop it at any time.';

/** Created by the consent dialog after an explicit choice. */
export const grantMicrophoneConsent = (grantedAt: number): MicrophoneConsent => Object.freeze({ scope: 'microphone-energy', grantedAt, statement: CONSENT_STATEMENT });

export class ConsentRequiredError extends Error {
  constructor() {
    super('Microphone analysis requires explicit consent.');
    this.name = 'ConsentRequiredError';
  }
}

export type SampleQuality = 'good' | 'silent' | 'clipping';

export interface EnergySample {
  /** Smoothed low-frequency energy, 0–1. */
  energy: number;
  /** Mean level across all frequency bins, 0–1. Used only for visuals. */
  level: number;
  quality: SampleQuality;
  /** performance.now() of the sample, for gap detection. */
  at: number;
}

export type SensorState = 'idle' | 'requesting' | 'active' | 'stopped' | 'error';

export interface AudioDeps {
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  createContext: () => AudioContext;
  requestFrame: (callback: () => void) => number;
  cancelFrame: (handle: number) => void;
  now: () => number;
}

export const MAX_TONE_GAIN = 0.2;
export const limitToneGain = (volume: number, multiplier = 1): number =>
  Number.isFinite(volume) && Number.isFinite(multiplier) ? Math.min(MAX_TONE_GAIN, Math.max(0, volume * multiplier)) : 0;

const SAMPLE_INTERVAL_MS = 50;
const EMA_ALPHA = 0.08;
const SILENCE_THRESHOLD = 0.01;
const SILENCE_FRAMES = 40;
const CLIPPING_SHARE = 0.3;

export interface ToneSettings {
  carrier: number;
  beat: number;
  volume: number;
  gainMultiplier: number;
}

export class LocalMicrophoneEnergySensor {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private frame: number | null = null;
  private oscillators: OscillatorNode[] = [];
  private gain: GainNode | null = null;
  private listeners = new Set<(sample: EnergySample) => void>();
  private smoothed = 0;
  private quietFrames = 0;
  private lastSampleAt = 0;
  private generation = 0;
  private toneSettings: ToneSettings = { carrier: 220, beat: 8, volume: 0.08, gainMultiplier: 1 };
  state: SensorState = 'idle';
  error: string | null = null;

  constructor(private readonly deps: AudioDeps) {}

  onSample(listener: (sample: EnergySample) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setTones(settings: Partial<ToneSettings>) {
    this.toneSettings = { ...this.toneSettings, ...settings };
    this.applyTones();
  }

  async start(consent: MicrophoneConsent | null | undefined): Promise<void> {
    if (!consent || consent.scope !== 'microphone-energy' || consent.statement !== CONSENT_STATEMENT) throw new ConsentRequiredError();
    if (this.state === 'active' || this.state === 'requesting') return;
    const generation = ++this.generation;
    this.state = 'requesting';
    this.error = null;
    try {
      const stream = await this.deps.getUserMedia({ audio: true, video: false });
      if (generation !== this.generation) {
        // Stopped while the permission prompt was open: release the device immediately.
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
      const context = this.deps.createContext();
      this.context = context;
      const analyser = context.createAnalyser();
      context.createMediaStreamSource(stream).connect(analyser);
      const gain = context.createGain();
      gain.gain.setValueAtTime(0, context.currentTime);
      gain.connect(context.destination);
      this.gain = gain;
      this.oscillators = [-0.8, 0.8].map((pan) => {
        const oscillator = context.createOscillator();
        const panner = context.createStereoPanner();
        panner.pan.value = pan;
        oscillator.connect(panner);
        panner.connect(gain);
        oscillator.start();
        return oscillator;
      });
      this.applyTones();
      this.state = 'active';
      this.loop(analyser, new Uint8Array(analyser.frequencyBinCount), generation);
    } catch (error) {
      if (generation !== this.generation) return;
      this.release();
      this.state = 'error';
      this.error = error instanceof Error && error.name === 'NotAllowedError' ? 'Microphone permission was denied.' : 'Microphone processing could not start.';
    }
  }

  private loop(analyser: AnalyserNode, bins: Uint8Array, generation: number) {
    const tick = () => {
      if (generation !== this.generation || !this.context) return;
      const now = this.deps.now();
      if (now - this.lastSampleAt >= SAMPLE_INTERVAL_MS) {
        this.lastSampleAt = now;
        analyser.getByteFrequencyData(bins);
        const binHz = this.context.sampleRate / analyser.fftSize;
        const lowEnd = Math.min(bins.length, Math.max(1, Math.round(100 / binHz)));
        let low = 0;
        let total = 0;
        let clipped = 0;
        for (let index = 0; index < bins.length; index += 1) {
          const value = bins[index];
          total += value;
          if (index < lowEnd) low += value;
          if (value >= 255) clipped += 1;
        }
        const raw = Math.min(1, Math.max(0, low / (lowEnd * 255)));
        this.smoothed += EMA_ALPHA * (raw - this.smoothed);
        this.quietFrames = raw < SILENCE_THRESHOLD ? this.quietFrames + 1 : 0;
        const quality: SampleQuality = clipped / bins.length > CLIPPING_SHARE ? 'clipping' : this.quietFrames >= SILENCE_FRAMES ? 'silent' : 'good';
        const sample: EnergySample = { energy: this.smoothed, level: total / bins.length / 255, quality, at: now };
        this.listeners.forEach((listener) => listener(sample));
      }
      this.frame = this.deps.requestFrame(tick);
    };
    tick();
  }

  private applyTones() {
    if (!this.context || !this.gain || this.oscillators.length !== 2) return;
    const { carrier, beat, volume, gainMultiplier } = this.toneSettings;
    const at = this.context.currentTime;
    this.oscillators[0].frequency.setTargetAtTime(carrier - beat / 2, at, 0.08);
    this.oscillators[1].frequency.setTargetAtTime(carrier + beat / 2, at, 0.08);
    this.gain.gain.setTargetAtTime(limitToneGain(volume, gainMultiplier), at, 0.12);
  }

  private release() {
    if (this.frame !== null) this.deps.cancelFrame(this.frame);
    this.frame = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    for (const oscillator of this.oscillators) {
      try {
        oscillator.stop();
      } catch {
        // Already stopped.
      }
    }
    this.oscillators = [];
    if (this.gain && this.context) this.gain.gain.setValueAtTime(0, this.context.currentTime);
    this.gain = null;
    if (this.context) void this.context.close();
    this.context = null;
    this.smoothed = 0;
    this.quietFrames = 0;
  }

  stop() {
    this.generation += 1;
    this.release();
    if (this.state !== 'idle') this.state = 'stopped';
  }
}

export const browserAudioDeps = (): AudioDeps | null => {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return null;
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  return {
    getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
    createContext: () => new AudioContextClass(),
    requestFrame: (callback) => window.requestAnimationFrame(callback),
    cancelFrame: (handle) => window.cancelAnimationFrame(handle),
    now: () => performance.now(),
  };
};

import { MutableRefObject, useCallback, useEffect, useRef, useState } from 'react';
import { usePersistentState } from '@/hooks/usePersistentState';
import type { BreathPulseModulationValues } from '@/hooks/useBreathPulseModulation';
import {
  browserAudioDeps,
  limitToneGain,
  LocalMicrophoneEnergySensor,
  MAX_TONE_GAIN,
  type EnergySample,
  type MicrophoneConsent,
  type SampleQuality,
} from '@/sensing/microphone';

export { limitToneGain, MAX_TONE_GAIN };

const AUDIO_VOLUME_STORAGE_KEY = 'orpheus.audio.volume';
const DEFAULT_VOLUME = 0.08;
const UI_UPDATE_MS = 250;
const TONE_UPDATE_MS = 100;

export interface AudioAnalysisResult {
  /** Mean level across all bins (visuals only). */
  audioLevel: number;
  /** Smoothed low-frequency energy (0–1). Measured; not a physiological signal. */
  audioEnvelope: number;
  quality: SampleQuality;
  /** Beat frequency of the generated tones, set by the visual pacing controls. */
  activeFrequency: number;
  microphoneConnected: boolean;
  audioError: string | null;
  volume: number;
  setVolume: (volume: number) => void;
  /** Latest sample without re-rendering, for animation loops. */
  liveSampleRef: MutableRefObject<EnergySample | null>;
}

/**
 * Local microphone energy and generated tones, active only while `consent` is present. React state
 * updates at most four times per second; animation consumers read `liveSampleRef`.
 */
export const useAudioAnalysis = (
  consent: MicrophoneConsent | null,
  modulationRef?: MutableRefObject<BreathPulseModulationValues>,
  onLiveSample?: (sample: EnergySample | null) => void,
): AudioAnalysisResult => {
  const [snapshot, setSnapshot] = useState<{ level: number; energy: number; quality: SampleQuality }>({ level: 0, energy: 0, quality: 'good' });
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFrequency, setActiveFrequency] = useState(8);
  const [storedVolume, setStoredVolume] = usePersistentState(AUDIO_VOLUME_STORAGE_KEY, DEFAULT_VOLUME);
  const volume = limitToneGain(storedVolume);
  const setVolume = useCallback((next: number) => setStoredVolume(limitToneGain(next)), [setStoredVolume]);
  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  const liveSampleRef = useRef<EnergySample | null>(null);
  const onLiveSampleRef = useRef(onLiveSample);
  onLiveSampleRef.current = onLiveSample;
  const modulationSource = useRef(modulationRef);
  modulationSource.current = modulationRef;

  useEffect(() => {
    if (!consent) {
      liveSampleRef.current = null;
      onLiveSampleRef.current?.(null);
      setConnected(false);
      setError(null);
      setSnapshot({ level: 0, energy: 0, quality: 'good' });
      return;
    }
    const deps = browserAudioDeps();
    if (!deps) {
      setError('Microphone input is not supported in this browser.');
      return;
    }
    const sensor = new LocalMicrophoneEnergySensor(deps);
    let lastUiUpdate = 0;
    const unsubscribe = sensor.onSample((sample) => {
      liveSampleRef.current = sample;
      onLiveSampleRef.current?.(sample);
      if (sample.at - lastUiUpdate >= UI_UPDATE_MS) {
        lastUiUpdate = sample.at;
        setSnapshot({ level: sample.level, energy: sample.energy, quality: sample.quality });
      }
    });
    const toneTimer = window.setInterval(() => {
      const modulation = modulationSource.current?.current;
      const beat = modulation?.beatFrequency ?? 8;
      sensor.setTones({ carrier: modulation?.carrierTone ?? 220, beat, volume: volumeRef.current, gainMultiplier: modulation?.gainMultiplier ?? 1 });
      setActiveFrequency((previous) => (Math.abs(previous - beat) >= 0.05 ? Number(beat.toFixed(2)) : previous));
    }, TONE_UPDATE_MS);
    void sensor.start(consent).then(() => {
      setConnected(sensor.state === 'active');
      setError(sensor.error);
    });
    return () => {
      window.clearInterval(toneTimer);
      unsubscribe();
      sensor.stop();
      liveSampleRef.current = null;
      onLiveSampleRef.current?.(null);
      setConnected(false);
    };
  }, [consent]);

  return {
    audioLevel: snapshot.level,
    audioEnvelope: snapshot.energy,
    quality: snapshot.quality,
    activeFrequency,
    microphoneConnected: connected,
    audioError: error,
    volume,
    setVolume,
    liveSampleRef,
  };
};

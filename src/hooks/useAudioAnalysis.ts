import { MutableRefObject, useCallback, useEffect, useRef, useState } from "react";
import { usePersistentState } from "./usePersistentState";
import type { BreathPulseModulationValues } from "./useBreathPulseModulation";

interface AudioAnalysisResult {
  audioLevel: number;
  audioEnvelope: number;
  activeFrequency: number;
  microphoneConnected: boolean;
  audioError: string | null;
  healingTone: number;
  setHealingTone: (tone: number) => void;
  volume: number;
  setVolume: (volume: number) => void;
}

interface AnalysisState {
  audioLevel: number;
  audioEnvelope: number;
  healingTone: number;
}

const DEFAULT_HEALING_TONE = 220;
const DEFAULT_BEAT_FREQUENCY = 8;
const MIN_BEAT_FREQUENCY = 5;
const MAX_BEAT_FREQUENCY = 11;
const AUDIO_ENERGY_MIN = 0.18;
const AUDIO_ENERGY_MAX = 0.78;
const AUDIO_EMA_ALPHA = 0.08;
const BEAT_EMA_ALPHA = 0.2;
const MAX_BEAT_STEP_PER_FRAME = 0.08;
const UI_FREQUENCY_UPDATE_DELTA = 0.03;

const DEFAULT_VOLUME = 0.08;
export const MAX_TONE_GAIN = 0.2;
export const limitToneGain = (volume: number, multiplier = 1): number =>
  Number.isFinite(volume) && Number.isFinite(multiplier)
    ? clamp(volume * multiplier, 0, MAX_TONE_GAIN)
    : 0;
const AUDIO_VOLUME_STORAGE_KEY = "orpheus.audio.volume";

const DEFAULT_ANALYSIS_STATE: AnalysisState = {
  audioLevel: 0,
  audioEnvelope: 0,
  healingTone: DEFAULT_HEALING_TONE,
};

// Helper to sum array range without slicing (avoids GC)
const sumRange = (array: Uint8Array, start: number, end: number): number => {
  let sum = 0;
  const safeEnd = Math.min(end, array.length);
  for (let i = start; i < safeEnd; i += 1) {
    sum += array[i];
  }
  return sum;
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

const mapAudioEnergyToBeatFrequency = (smoothedAudio: number): number => {
  const normalized = clamp(
    (smoothedAudio - AUDIO_ENERGY_MIN) / (AUDIO_ENERGY_MAX - AUDIO_ENERGY_MIN),
    0,
    1,
  );
  return MAX_BEAT_FREQUENCY - normalized * (MAX_BEAT_FREQUENCY - MIN_BEAT_FREQUENCY);
};

export const useAudioAnalysis = (
  enabled: boolean = true,
  modulationRef?: MutableRefObject<BreathPulseModulationValues>,
): AudioAnalysisResult => {
  const modulationSourceRef = useRef(modulationRef);
  modulationSourceRef.current = modulationRef;

  const [analysisState, setAnalysisState] = useState<AnalysisState>(DEFAULT_ANALYSIS_STATE);
  const [activeFrequency, setActiveFrequency] = useState(DEFAULT_BEAT_FREQUENCY);
  const [microphoneConnected, setMicrophoneConnected] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [storedVolume, setStoredVolume] = usePersistentState(AUDIO_VOLUME_STORAGE_KEY, DEFAULT_VOLUME);
  const volume = limitToneGain(storedVolume);
  const setVolume = useCallback((next: number) => setStoredVolume(limitToneGain(next)), [setStoredVolume]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const leftOscillatorRef = useRef<OscillatorNode | null>(null);
  const rightOscillatorRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const lastUpdateRef = useRef(0);
  const smoothedAudioRef = useRef(0.5);
  const sweepFrequencyRef = useRef(DEFAULT_BEAT_FREQUENCY);
  const reportedFrequencyRef = useRef(DEFAULT_BEAT_FREQUENCY);
  const healingToneRef = useRef(DEFAULT_HEALING_TONE);
  const volumeRef = useRef(volume);
  volumeRef.current = volume;


  const cleanupAudio = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (leftOscillatorRef.current) {
      try {
        leftOscillatorRef.current.stop();
      } catch {
        // Ignore repeated stop errors.
      }
      leftOscillatorRef.current = null;
    }

    if (rightOscillatorRef.current) {
      try {
        rightOscillatorRef.current.stop();
      } catch {
        // Ignore repeated stop errors.
      }
      rightOscillatorRef.current = null;
    }

    analyserRef.current = null;
    gainRef.current = null;

    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setMicrophoneConnected(false);
  }, []);

  useEffect(() => {
    if (!enabled) {
      cleanupAudio();
      setAudioError(null);
      setAnalysisState(DEFAULT_ANALYSIS_STATE);
      setActiveFrequency(DEFAULT_BEAT_FREQUENCY);
      smoothedAudioRef.current = 0.5;
      sweepFrequencyRef.current = DEFAULT_BEAT_FREQUENCY;
      reportedFrequencyRef.current = DEFAULT_BEAT_FREQUENCY;
      healingToneRef.current = DEFAULT_HEALING_TONE;
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setAudioError("Microphone input is not supported in this browser.");
      return;
    }

    let cancelled = false;

    const startAnalysis = () => {
      if (!analyserRef.current || !audioContextRef.current) {
        return;
      }

      const analyser = analyserRef.current;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const analyze = () => {
        const now = Date.now();
        if (now - lastUpdateRef.current < 50) {
          animationFrameRef.current = requestAnimationFrame(analyze);
          return;
        }
        lastUpdateRef.current = now;

        analyser.getByteFrequencyData(dataArray);

        const lowFrequencyRange = [0, 100];
        const sampleRate = audioContextRef.current!.sampleRate;
        const fftSize = analyser.fftSize;
        const binSize = sampleRate / fftSize;

        const lowEndIndex = Math.round(lowFrequencyRange[1] / binSize);
        const lowFrequencyEnergy = sumRange(dataArray, 0, lowEndIndex);
        const rawAudioEnergy = lowFrequencyEnergy / (lowFrequencyRange[1] * 2);
        const clampedAudioEnergy = clamp(rawAudioEnergy, 0, 1);
        const smoothedAudioEnergy =
          smoothedAudioRef.current +
          AUDIO_EMA_ALPHA * (clampedAudioEnergy - smoothedAudioRef.current);
        smoothedAudioRef.current = smoothedAudioEnergy;

        const targetBeatFrequency = mapAudioEnergyToBeatFrequency(smoothedAudioEnergy);
        const emaBeatFrequency =
          sweepFrequencyRef.current +
          BEAT_EMA_ALPHA * (targetBeatFrequency - sweepFrequencyRef.current);
        const limitedFrequencyStep = clamp(
          emaBeatFrequency - sweepFrequencyRef.current,
          -MAX_BEAT_STEP_PER_FRAME,
          MAX_BEAT_STEP_PER_FRAME,
        );
        const beatFrequency = clamp(
          sweepFrequencyRef.current + limitedFrequencyStep,
          MIN_BEAT_FREQUENCY,
          MAX_BEAT_FREQUENCY,
        );

        sweepFrequencyRef.current = beatFrequency;

        const modulation = modulationSourceRef.current?.current;
        const effectiveBeatFrequency = modulation
          ? clamp(modulation.beatFrequency + (beatFrequency - DEFAULT_BEAT_FREQUENCY) * 0.25, MIN_BEAT_FREQUENCY, MAX_BEAT_FREQUENCY)
          : beatFrequency;
        const effectiveCarrier = modulation ? modulation.carrierTone : healingToneRef.current;

        if (Math.abs(effectiveBeatFrequency - reportedFrequencyRef.current) >= UI_FREQUENCY_UPDATE_DELTA) {
          const roundedBeatFrequency = Number(effectiveBeatFrequency.toFixed(2));
          reportedFrequencyRef.current = roundedBeatFrequency;
          setActiveFrequency(roundedBeatFrequency);
        }

        if (audioContextRef.current) {
          const nowTime = audioContextRef.current.currentTime;
          const leftFrequency = effectiveCarrier - effectiveBeatFrequency / 2;
          const rightFrequency = effectiveCarrier + effectiveBeatFrequency / 2;
          leftOscillatorRef.current?.frequency.setTargetAtTime(leftFrequency, nowTime, 0.08);
          rightOscillatorRef.current?.frequency.setTargetAtTime(rightFrequency, nowTime, 0.08);

          if (gainRef.current) {
            const targetGain = limitToneGain(volumeRef.current, modulation ? modulation.gainMultiplier : 1);
            gainRef.current.gain.setTargetAtTime(targetGain, nowTime, 0.12);
          }
        }


        let totalSum = 0;
        const len = dataArray.length;
        for (let i = 0; i < len; i += 1) {
          totalSum += dataArray[i];
        }
        const newAudioLevel = totalSum / len / 255;

        const newAudioEnvelope = smoothedAudioEnergy;

        setAnalysisState((prev) => ({
          ...prev,
          audioLevel: newAudioLevel,
          audioEnvelope: newAudioEnvelope,
        }));

        animationFrameRef.current = requestAnimationFrame(analyze);
      };

      analyze();
    };

    const initializeAudio = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const context = new AudioContextClass();
        audioContextRef.current = context;

        const analyser = context.createAnalyser();
        analyserRef.current = analyser;

        const source = context.createMediaStreamSource(stream);
        source.connect(analyser);

        const leftOscillator = context.createOscillator();
        const rightOscillator = context.createOscillator();
        leftOscillatorRef.current = leftOscillator;
        rightOscillatorRef.current = rightOscillator;

        const leftPanner = context.createStereoPanner();
        leftPanner.pan.value = -0.8;

        const rightPanner = context.createStereoPanner();
        rightPanner.pan.value = 0.8;

        const gain = context.createGain();
        gainRef.current = gain;
        // A new GainNode starts at unity. Silence the graph before connecting oscillators.
        gain.gain.setValueAtTime(0, context.currentTime);
        const initialCarrier = modulationSourceRef.current?.current.carrierTone ?? DEFAULT_HEALING_TONE;
        const initialBeat = modulationSourceRef.current?.current.beatFrequency ?? DEFAULT_BEAT_FREQUENCY;
        leftOscillator.frequency.setValueAtTime(initialCarrier - initialBeat / 2, context.currentTime);
        rightOscillator.frequency.setValueAtTime(initialCarrier + initialBeat / 2, context.currentTime);

        leftOscillator.connect(leftPanner);
        rightOscillator.connect(rightPanner);
        leftPanner.connect(gain);
        rightPanner.connect(gain);
        gain.connect(context.destination);
        leftOscillator.start();
        rightOscillator.start();

        setAudioError(null);
        setMicrophoneConnected(true);
        startAnalysis();
      } catch {
        if (!cancelled) {
          cleanupAudio();
          setMicrophoneConnected(false);
          setAudioError("Microphone processing could not start. Check browser permission or stop audio mode.");
        }
      }
    };

    void initializeAudio();

    return () => {
      cancelled = true;
      cleanupAudio();
    };
  }, [cleanupAudio, enabled]);

  useEffect(() => {
    if (gainRef.current && audioContextRef.current) {
      gainRef.current.gain.setTargetAtTime(limitToneGain(volume), audioContextRef.current.currentTime, 0.12);
    }
  }, [volume]);

  const setHealingTone = useCallback((tone: number) => {
    healingToneRef.current = tone;
    setAnalysisState((prev) => ({ ...prev, healingTone: tone }));
  }, []);

  return {
    ...analysisState,
    activeFrequency,
    microphoneConnected,
    audioError,
    setHealingTone,
    volume,
    setVolume,
  };
};

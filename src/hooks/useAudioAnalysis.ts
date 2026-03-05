import { useCallback, useEffect, useRef, useState } from "react";

interface AudioAnalysisResult {
  audioLevel: number;
  breathPattern: number;
  pulseRate: number;
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
  breathPattern: number;
  pulseRate: number;
  healingTone: number;
}

const DEFAULT_HEALING_TONE = 220;
const DEFAULT_BEAT_FREQUENCY = 8;
const MIN_BEAT_FREQUENCY = 5;
const MAX_BEAT_FREQUENCY = 11;
const BREATH_SIGNAL_MIN = 0.18;
const BREATH_SIGNAL_MAX = 0.78;
const BREATH_EMA_ALPHA = 0.08;
const BEAT_EMA_ALPHA = 0.2;
const MAX_BEAT_STEP_PER_FRAME = 0.08;
const UI_FREQUENCY_UPDATE_DELTA = 0.03;

const DEFAULT_ANALYSIS_STATE: AnalysisState = {
  audioLevel: 0,
  breathPattern: 0,
  pulseRate: 72,
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

const mapBreathToBeatFrequency = (smoothedBreath: number): number => {
  const normalized = clamp(
    (smoothedBreath - BREATH_SIGNAL_MIN) / (BREATH_SIGNAL_MAX - BREATH_SIGNAL_MIN),
    0,
    1,
  );
  return MAX_BEAT_FREQUENCY - normalized * (MAX_BEAT_FREQUENCY - MIN_BEAT_FREQUENCY);
};

export const useAudioAnalysis = (enabled: boolean = true): AudioAnalysisResult => {
  const [analysisState, setAnalysisState] = useState<AnalysisState>(DEFAULT_ANALYSIS_STATE);
  const [activeFrequency, setActiveFrequency] = useState(DEFAULT_BEAT_FREQUENCY);
  const [microphoneConnected, setMicrophoneConnected] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.5);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const leftOscillatorRef = useRef<OscillatorNode | null>(null);
  const rightOscillatorRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const lastUpdateRef = useRef(0);
  const smoothedBreathRef = useRef(0.5);
  const sweepFrequencyRef = useRef(DEFAULT_BEAT_FREQUENCY);
  const reportedFrequencyRef = useRef(DEFAULT_BEAT_FREQUENCY);
  const healingToneRef = useRef(DEFAULT_HEALING_TONE);

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
      smoothedBreathRef.current = 0.5;
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

        const breathFrequencyRange = [0, 100];
        const sampleRate = audioContextRef.current!.sampleRate;
        const fftSize = analyser.fftSize;
        const binSize = sampleRate / fftSize;

        const breathEndIndex = Math.round(breathFrequencyRange[1] / binSize);
        const breathEnergy = sumRange(dataArray, 0, breathEndIndex);
        const rawBreathState = breathEnergy / (breathFrequencyRange[1] * 2);
        const clampedBreathState = clamp(rawBreathState, 0, 1);
        const smoothedBreathState =
          smoothedBreathRef.current +
          BREATH_EMA_ALPHA * (clampedBreathState - smoothedBreathRef.current);
        smoothedBreathRef.current = smoothedBreathState;

        const valenceFrequencyRange = [100, 1000];
        const valenceStartIndex = Math.round(valenceFrequencyRange[0] / binSize);
        const valenceEndIndex = Math.round(valenceFrequencyRange[1] / binSize);
        const valenceEnergy = sumRange(dataArray, valenceStartIndex, valenceEndIndex);
        const valenceState = valenceEnergy / (valenceFrequencyRange[1] * 2);

        const targetBeatFrequency = mapBreathToBeatFrequency(smoothedBreathState);
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

        if (Math.abs(beatFrequency - reportedFrequencyRef.current) >= UI_FREQUENCY_UPDATE_DELTA) {
          const roundedBeatFrequency = Number(beatFrequency.toFixed(2));
          reportedFrequencyRef.current = roundedBeatFrequency;
          setActiveFrequency(roundedBeatFrequency);
        }

        if (audioContextRef.current) {
          const nowTime = audioContextRef.current.currentTime;
          const leftFrequency = healingToneRef.current - beatFrequency / 2;
          const rightFrequency = healingToneRef.current + beatFrequency / 2;
          leftOscillatorRef.current?.frequency.setValueAtTime(leftFrequency, nowTime);
          rightOscillatorRef.current?.frequency.setValueAtTime(rightFrequency, nowTime);
        }

        let totalSum = 0;
        const len = dataArray.length;
        for (let i = 0; i < len; i += 1) {
          totalSum += dataArray[i];
        }
        const newAudioLevel = totalSum / len / 255;

        const newBreathPattern = smoothedBreathState;
        const newPulseRate = 60 + valenceState * 40;

        setAnalysisState((prev) => ({
          ...prev,
          audioLevel: newAudioLevel,
          breathPattern: newBreathPattern,
          pulseRate: newPulseRate,
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
          setMicrophoneConnected(false);
          setAudioError("Microphone access was denied. Enable it to use live biofeedback.");
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
    if (!audioContextRef.current) {
      return;
    }

    const nowTime = audioContextRef.current.currentTime;
    leftOscillatorRef.current?.frequency.setValueAtTime(
      analysisState.healingTone - activeFrequency / 2,
      nowTime,
    );
    rightOscillatorRef.current?.frequency.setValueAtTime(
      analysisState.healingTone + activeFrequency / 2,
      nowTime,
    );
  }, [analysisState.healingTone, activeFrequency]);

  useEffect(() => {
    if (gainRef.current && audioContextRef.current) {
      gainRef.current.gain.setValueAtTime(volume, audioContextRef.current.currentTime);
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

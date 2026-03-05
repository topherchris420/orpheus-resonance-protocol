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

interface BinauralTarget {
  carrier: number;
  beatFrequency: number;
}

const THETA_ANXIETY_RELIEF_TARGET: BinauralTarget = {
  carrier: 220,
  beatFrequency: 6,
};

const ALPHA_PEACEFULNESS_TARGET: BinauralTarget = {
  carrier: 220,
  beatFrequency: 10,
};

const RELAXED_BASELINE_TARGET: BinauralTarget = {
  carrier: 220,
  beatFrequency: 8,
};

const DEFAULT_ANALYSIS_STATE: AnalysisState = {
  audioLevel: 0,
  breathPattern: 0,
  pulseRate: 72,
  healingTone: 417,
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

export const useAudioAnalysis = (enabled: boolean = true): AudioAnalysisResult => {
  const [analysisState, setAnalysisState] = useState<AnalysisState>(DEFAULT_ANALYSIS_STATE);
  const [activeFrequency, setActiveFrequency] = useState(432);
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
        const breathState = breathEnergy / (breathFrequencyRange[1] * 2);

        const valenceFrequencyRange = [100, 1000];
        const valenceStartIndex = Math.round(valenceFrequencyRange[0] / binSize);
        const valenceEndIndex = Math.round(valenceFrequencyRange[1] / binSize);
        const valenceEnergy = sumRange(dataArray, valenceStartIndex, valenceEndIndex);
        const valenceState = valenceEnergy / (valenceFrequencyRange[1] * 2);

        let target: BinauralTarget = RELAXED_BASELINE_TARGET;

        if (breathState > 0.62) {
          target = THETA_ANXIETY_RELIEF_TARGET;
        } else if (breathState < 0.28) {
          target = ALPHA_PEACEFULNESS_TARGET;
        }

        const newHealingTone = target.carrier;
        const beatFrequency = target.beatFrequency;

        setActiveFrequency(beatFrequency);

        if (audioContextRef.current) {
          const nowTime = audioContextRef.current.currentTime;
          const leftFrequency = newHealingTone - beatFrequency / 2;
          const rightFrequency = newHealingTone + beatFrequency / 2;
          leftOscillatorRef.current?.frequency.setValueAtTime(leftFrequency, nowTime);
          rightOscillatorRef.current?.frequency.setValueAtTime(rightFrequency, nowTime);
        }

        let totalSum = 0;
        const len = dataArray.length;
        for (let i = 0; i < len; i += 1) {
          totalSum += dataArray[i];
        }
        const newAudioLevel = totalSum / len / 255;

        const newBreathPattern = breathState;
        const newPulseRate = 60 + valenceState * 40;

        setAnalysisState({
          audioLevel: newAudioLevel,
          breathPattern: newBreathPattern,
          pulseRate: newPulseRate,
          healingTone: newHealingTone,
        });

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

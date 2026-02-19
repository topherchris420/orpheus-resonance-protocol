import { useState, useEffect, useRef, useCallback } from 'react';

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

// Helper to sum array range without slicing (avoids GC)
const sumRange = (array: Uint8Array, start: number, end: number): number => {
  let sum = 0;
  const safeEnd = Math.min(end, array.length);
  for (let i = start; i < safeEnd; i++) {
    sum += array[i];
  }
  return sum;
};

export const useAudioAnalysis = (): AudioAnalysisResult => {
  const [analysisState, setAnalysisState] = useState<AnalysisState>({
    audioLevel: 0,
    breathPattern: 0,
    pulseRate: 72,
    healingTone: 417,
  });
  const [activeFrequency, setActiveFrequency] = useState(432);
  const [microphoneConnected, setMicrophoneConnected] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.5);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    const initializeAudio = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        // Fix for 'Unexpected any' lint error
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const context = new AudioContextClass();
        audioContextRef.current = context;

        analyserRef.current = context.createAnalyser();
        const source = context.createMediaStreamSource(stream);
        source.connect(analyserRef.current);

        const oscillator = context.createOscillator();
        oscillatorRef.current = oscillator;
        const gain = context.createGain();
        gainRef.current = gain;

        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start();

        setMicrophoneConnected(true);
        startAnalysis();
      } catch (error) {
        setAudioError("Microphone access denied. Please enable microphone access in your browser settings.");
      }
    };

    const startAnalysis = () => {
      if (!analyserRef.current) return;
      const analyser = analyserRef.current;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const analyze = () => {
        // Throttle updates to ~20fps (every 50ms) to reduce React re-renders
        const now = Date.now();
        if (now - lastUpdateRef.current < 50) {
          animationFrameRef.current = requestAnimationFrame(analyze);
          return;
        }
        lastUpdateRef.current = now;

        analyser.getByteFrequencyData(dataArray);

        // Breath Analysis (simplified)
        const breathFrequencyRange = [0, 100]; // Hz
        // Use non-null assertion for audioContextRef.current as it is initialized in initializeAudio
        const sampleRate = audioContextRef.current!.sampleRate;
        const fftSize = analyser.fftSize;
        const binSize = sampleRate / fftSize;

        const breathEndIndex = Math.round(breathFrequencyRange[1] / binSize);
        const breathEnergy = sumRange(dataArray, 0, breathEndIndex);
        const breathState = breathEnergy / (breathFrequencyRange[1] * 2); // Normalized

        // Emotion Analysis (simplified)
        const valenceFrequencyRange = [100, 1000]; // Hz
        const valenceStartIndex = Math.round(valenceFrequencyRange[0] / binSize);
        const valenceEndIndex = Math.round(valenceFrequencyRange[1] / binSize);
        const valenceEnergy = sumRange(dataArray, valenceStartIndex, valenceEndIndex);
        const valenceState = valenceEnergy / (valenceFrequencyRange[1] * 2); // Normalized

        // Energy Analysis (simplified)
        const energyFrequencyRange = [1000, 5000]; // Hz
        const energyStartIndex = Math.round(energyFrequencyRange[0] / binSize);
        const energyEndIndex = Math.round(energyFrequencyRange[1] / binSize);
        const energyEnergy = sumRange(dataArray, energyStartIndex, energyEndIndex);
        const energyState = energyEnergy / (energyFrequencyRange[1] * 2); // Normalized

        // Determine healing tone
        let newHealingTone = 417;
        if (valenceState > 0.6 && energyState > 0.6) {
          newHealingTone = 174; // Stressed
        } else if (valenceState > 0.6) {
          newHealingTone = 285; // Anxious
        } else if (breathState < 0.2) {
          newHealingTone = 396; // Sad/Depressed
        } else if (breathState > 0.8) {
          newHealingTone = 639; // Peaceful
        } else if (valenceState < 0.2 && energyState < 0.2) {
            newHealingTone = 528; // Calm
        } else {
            newHealingTone = 417; // Neutral
        }

        // Optimized: Calculate average without reduce/slice overhead
        let totalSum = 0;
        const len = dataArray.length;
        for (let i = 0; i < len; i++) {
          totalSum += dataArray[i];
        }
        const newAudioLevel = totalSum / len / 255;

        const newBreathPattern = breathState;
        const newPulseRate = 60 + (valenceState * 40);

        setAnalysisState({
          audioLevel: newAudioLevel,
          breathPattern: newBreathPattern,
          pulseRate: newPulseRate,
          healingTone: newHealingTone
        });

        animationFrameRef.current = requestAnimationFrame(analyze);
      };
      analyze();
    };

    initializeAudio();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (oscillatorRef.current) {
        oscillatorRef.current.stop();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (oscillatorRef.current && audioContextRef.current) {
      oscillatorRef.current.frequency.setValueAtTime(analysisState.healingTone, audioContextRef.current.currentTime);
    }
  }, [analysisState.healingTone]);

  useEffect(() => {
    if (gainRef.current && audioContextRef.current) {
      gainRef.current.gain.setValueAtTime(volume, audioContextRef.current.currentTime);
    }
  }, [volume]);

  const setHealingTone = useCallback((tone: number) => {
    setAnalysisState(prev => ({ ...prev, healingTone: tone }));
  }, []);

  return {
    ...analysisState,
    activeFrequency,
    microphoneConnected,
    audioError,
    setHealingTone,
    volume,
    setVolume
  };
};

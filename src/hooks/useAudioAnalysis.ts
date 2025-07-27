import { useState, useEffect, useRef } from 'react';

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

export const useAudioAnalysis = (): AudioAnalysisResult => {
  const [audioLevel, setAudioLevel] = useState(0);
  const [breathPattern, setBreathPattern] = useState(0);
  const [pulseRate, setPulseRate] = useState(72);
  const [activeFrequency, setActiveFrequency] = useState(432);
  const [microphoneConnected, setMicrophoneConnected] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [healingTone, setHealingTone] = useState(417);
  const [volume, setVolume] = useState(0.5);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  useEffect(() => {
    const initializeAudio = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        const context = new (window.AudioContext || (window as any).webkitAudioContext)();
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
        analyser.getByteFrequencyData(dataArray);

        // ... (rest of the analysis logic remains the same)
        const breathFrequencyRange = [0, 100]; // Hz
        const breathEnergy = dataArray.slice(0, Math.round(breathFrequencyRange[1] / (audioContextRef.current.sampleRate / analyser.fftSize))).reduce((sum, value) => sum + value, 0);
        const breathState = breathEnergy / (breathFrequencyRange[1] * 2); // Normalized

        // Emotion Analysis (simplified)
        const valenceFrequencyRange = [100, 1000]; // Hz
        const valenceEnergy = dataArray.slice(Math.round(valenceFrequencyRange[0] / (audioContextRef.current.sampleRate / analyser.fftSize)), Math.round(valenceFrequencyRange[1] / (audioContextRef.current.sampleRate / analyser.fftSize))).reduce((sum, value) => sum + value, 0);
        const valenceState = valenceEnergy / (valenceFrequencyRange[1] * 2); // Normalized

        // Energy Analysis (simplified)
        const energyFrequencyRange = [1000, 5000]; // Hz
        const energyEnergy = dataArray.slice(Math.round(energyFrequencyRange[0] / (audioContextRef.current.sampleRate / analyser.fftSize)), Math.round(energyFrequencyRange[1] / (audioContextRef.current.sampleRate / analyser.fftSize))).reduce((sum, value) => sum + value, 0);
        const energyState = energyEnergy / (energyFrequencyRange[1] * 2); // Normalized

        // Determine healing tone
        if (valenceState > 0.6 && energyState > 0.6) {
          setHealingTone(174); // Stressed
        } else if (valenceState > 0.6) {
          setHealingTone(285); // Anxious
        } else if (breathState < 0.2) {
          setHealingTone(396); // Sad/Depressed
        } else if (breathState > 0.8) {
          setHealingTone(639); // Peaceful
        } else if (valenceState < 0.2 && energyState < 0.2) {
            setHealingTone(528); // Calm
        } else {
            setHealingTone(417); // Neutral
        }


        setAudioLevel(dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length / 255);
        setBreathPattern(breathState);
        setPulseRate(60 + (valenceState * 40));

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
    if (oscillatorRef.current &&

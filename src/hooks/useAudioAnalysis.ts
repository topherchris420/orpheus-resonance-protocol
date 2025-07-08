
import { useState, useEffect, useRef } from 'react';

interface AudioAnalysisResult {
  audioLevel: number;
  breathPattern: number;
  pulseRate: number;
  activeFrequency: number;
  microphoneConnected: boolean;
  audioError: string | null;
}

export const useAudioAnalysis = (): AudioAnalysisResult => {
  const [audioLevel, setAudioLevel] = useState(0);
  const [breathPattern, setBreathPattern] = useState(0);
  const [pulseRate, setPulseRate] = useState(72);
  const [activeFrequency, setActiveFrequency] = useState(432);
  const [microphoneConnected, setMicrophoneConnected] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const smoothingFactorRef = useRef(0.8);

  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 3;

    const initializeAudio = async () => {
      try {
        console.log('Requesting microphone access...');
        
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 44100
          }
        });

        console.log('Microphone access granted');
        streamRef.current = stream;

        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 44100
        });

        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }

        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 2048;
        analyserRef.current.smoothingTimeConstant = 0.8;
        analyserRef.current.minDecibels = -90;
        analyserRef.current.maxDecibels = -10;

        microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream);
        microphoneRef.current.connect(analyserRef.current);
        
        dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);
        
        setMicrophoneConnected(true);
        setAudioError(null);
        console.log('Audio analysis initialized successfully');
        
        startAudioAnalysis();
      } catch (error) {
        console.error('Microphone initialization failed:', error);
        setAudioError(`Microphone access failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setMicrophoneConnected(false);
        
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`Retrying microphone initialization (${retryCount}/${maxRetries})...`);
          setTimeout(initializeAudio, 2000);
        } else {
          console.log('Falling back to simulated audio data');
          startSimulatedAudio();
        }
      }
    };

    const startAudioAnalysis = () => {
      if (!analyserRef.current || !dataArrayRef.current) return;

      const updateAudioLevel = () => {
        if (analyserRef.current && dataArrayRef.current) {
          analyserRef.current.getByteFrequencyData(dataArrayRef.current);
          
          let sum = 0;
          for (let i = 0; i < dataArrayRef.current.length; i++) {
            sum += dataArrayRef.current[i] * dataArrayRef.current[i];
          }
          const rms = Math.sqrt(sum / dataArrayRef.current.length);
          const normalizedLevel = Math.min(rms / 128, 1);
          
          setAudioLevel(prev => prev * smoothingFactorRef.current + normalizedLevel * (1 - smoothingFactorRef.current));
          
          const lowFreqBins = Math.floor(50 * dataArrayRef.current.length / (audioContextRef.current?.sampleRate || 44100));
          let lowFreqSum = 0;
          for (let i = 0; i < lowFreqBins; i++) {
            lowFreqSum += dataArrayRef.current[i];
          }
          const lowFreqAvg = lowFreqSum / lowFreqBins;
          const breathBase = Math.sin(Date.now() / 4000) * 0.3 + 0.5;
          const breathModulation = (lowFreqAvg / 255) * 0.4;
          setBreathPattern(Math.max(0, Math.min(1, breathBase + breathModulation)));
          
          const midFreqStart = lowFreqBins;
          const midFreqEnd = Math.floor(200 * dataArrayRef.current.length / (audioContextRef.current?.sampleRate || 44100));
          let midFreqSum = 0;
          for (let i = midFreqStart; i < midFreqEnd; i++) {
            midFreqSum += dataArrayRef.current[i];
          }
          const midFreqAvg = midFreqSum / (midFreqEnd - midFreqStart);
          const pulseBase = 72 + Math.sin(Date.now() / 1200) * 6;
          const pulseModulation = (midFreqAvg / 255) * 15;
          setPulseRate(Math.max(45, Math.min(120, pulseBase + pulseModulation)));
          
          let maxValue = 0;
          let maxIndex = 0;
          for (let i = 0; i < dataArrayRef.current.length; i++) {
            if (dataArrayRef.current[i] > maxValue) {
              maxValue = dataArrayRef.current[i];
              maxIndex = i;
            }
          }
          if (maxValue > 50) {
            const frequency = maxIndex * (audioContextRef.current?.sampleRate || 44100) / (2 * dataArrayRef.current.length);
            if (frequency > 80 && frequency < 2000) {
              setActiveFrequency(Math.round(frequency));
            }
          }
        }
        animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
      };
      
      updateAudioLevel();
    };

    const startSimulatedAudio = () => {
      console.log('Starting simulated audio data');
      const simulatedTimer = setInterval(() => {
        const time = Date.now();
        setBreathPattern(Math.sin(time / 3000) * 0.4 + 0.5);
        setPulseRate(72 + Math.sin(time / 1000) * 8 + Math.random() * 4);
        setAudioLevel(Math.sin(time / 500) * 0.3 + 0.4 + Math.random() * 0.2);
        setActiveFrequency(432 + Math.sin(time / 2000) * 50);
      }, 100);
      
      return () => clearInterval(simulatedTimer);
    };

    const handleUserGesture = () => {
      initializeAudio();
      document.removeEventListener('click', handleUserGesture);
      document.removeEventListener('touchstart', handleUserGesture);
    };

    document.addEventListener('click', handleUserGesture);
    document.addEventListener('touchstart', handleUserGesture);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      document.removeEventListener('click', handleUserGesture);
      document.removeEventListener('touchstart', handleUserGesture);
    };
  }, []);

  return {
    audioLevel,
    breathPattern,
    pulseRate,
    activeFrequency,
    microphoneConnected,
    audioError
  };
};


import { useState, useEffect, useRef } from 'react';

interface AudioAnalysisResult {
  audioLevel: number;
  breathPattern: number;
  breathRate: number;
  breathPhase: 'inhale' | 'exhale' | 'hold';
  pulseRate: number;
  activeFrequency: number;
  recommendedFrequency: number;
  microphoneConnected: boolean;
  audioError: string | null;
}

export const useAudioAnalysis = (): AudioAnalysisResult => {
  const [audioLevel, setAudioLevel] = useState(0);
  const [breathPattern, setBreathPattern] = useState(0);
  const [breathRate, setBreathRate] = useState(0.5);
  const [breathPhase, setBreathPhase] = useState<'inhale' | 'exhale' | 'hold'>('inhale');
  const [pulseRate, setPulseRate] = useState(72);
  const [activeFrequency, setActiveFrequency] = useState(432);
  const [recommendedFrequency, setRecommendedFrequency] = useState(432);
  const [microphoneConnected, setMicrophoneConnected] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const smoothingFactorRef = useRef(0.8);
  const breathHistoryRef = useRef<number[]>([]);
  const lastBreathPhaseRef = useRef<'inhale' | 'exhale' | 'hold'>('inhale');
  const breathChangeTimeRef = useRef(Date.now());

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
          
          // Enhanced breathing detection
          const currentBreathSignal = (lowFreqAvg / 255) + (normalizedLevel * 0.3);
          breathHistoryRef.current.push(currentBreathSignal);
          
          // Keep only last 100 samples (about 3-4 seconds at 30fps)
          if (breathHistoryRef.current.length > 100) {
            breathHistoryRef.current.shift();
          }
          
          // Calculate breathing pattern and rate
          if (breathHistoryRef.current.length >= 20) {
            const recentHistory = breathHistoryRef.current.slice(-20);
            const avgRecent = recentHistory.reduce((a, b) => a + b, 0) / recentHistory.length;
            const variance = recentHistory.reduce((acc, val) => acc + Math.pow(val - avgRecent, 2), 0) / recentHistory.length;
            const breathIntensity = Math.sqrt(variance) * 2;
            
            setBreathPattern(Math.max(0, Math.min(1, avgRecent)));
            setBreathRate(Math.max(0, Math.min(1, breathIntensity)));
            
            // Determine breath phase
            const trend = recentHistory.slice(-5).reduce((acc, val, i, arr) => {
              if (i === 0) return 0;
              return acc + (val - arr[i-1]);
            }, 0);
            
            let currentPhase: 'inhale' | 'exhale' | 'hold' = 'hold';
            if (Math.abs(trend) > 0.02) {
              currentPhase = trend > 0 ? 'inhale' : 'exhale';
            }
            
            if (currentPhase !== lastBreathPhaseRef.current) {
              breathChangeTimeRef.current = Date.now();
              lastBreathPhaseRef.current = currentPhase;
            }
            
            setBreathPhase(currentPhase);
            
            // Calculate recommended frequency based on breathing pattern
            let recFreq = 432; // Default healing frequency
            if (breathIntensity < 0.3) {
              // Slow, deep breathing - use calming frequencies
              recFreq = 256 + (avgRecent * 176); // 256-432 Hz range
            } else if (breathIntensity > 0.7) {
              // Fast, shallow breathing - use grounding frequencies
              recFreq = 396 + (avgRecent * 132); // 396-528 Hz range
            } else {
              // Normal breathing - use healing frequencies
              recFreq = 432 + (avgRecent * 96); // 432-528 Hz range
            }
            
            setRecommendedFrequency(Math.round(recFreq));
          }
          
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
        const breathCycle = (time / 4000) % (2 * Math.PI);
        const breathValue = Math.sin(breathCycle) * 0.4 + 0.5;
        const breathSpeed = Math.abs(Math.cos(breathCycle)) * 0.8;
        
        setBreathPattern(breathValue);
        setBreathRate(breathSpeed);
        
        // Determine simulated breath phase
        const cyclePosition = breathCycle % (2 * Math.PI);
        let phase: 'inhale' | 'exhale' | 'hold' = 'hold';
        if (cyclePosition < Math.PI * 0.45 || cyclePosition > Math.PI * 1.55) {
          phase = cyclePosition < Math.PI ? 'inhale' : 'exhale';
        }
        setBreathPhase(phase);
        
        setPulseRate(72 + Math.sin(time / 1000) * 8 + Math.random() * 4);
        setAudioLevel(Math.sin(time / 500) * 0.3 + 0.4 + Math.random() * 0.2);
        setActiveFrequency(432 + Math.sin(time / 2000) * 50);
        
        // Simulate recommended frequency
        const recFreq = breathSpeed < 0.3 ? 256 + (breathValue * 176) : 432 + (breathValue * 96);
        setRecommendedFrequency(Math.round(recFreq));
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
    breathRate,
    breathPhase,
    pulseRate,
    activeFrequency,
    recommendedFrequency,
    microphoneConnected,
    audioError
  };
};

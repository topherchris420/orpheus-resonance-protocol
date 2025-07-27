
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
          
          // Simplified breathing detection focusing on overall audio level changes
          // This is more reliable for microphone breathing detection
          const currentAudioLevel = normalizedLevel;
          
          // Store raw audio levels in history
          breathHistoryRef.current.push(currentAudioLevel);
          
          // Keep only last 90 samples (about 3 seconds at 30fps)
          if (breathHistoryRef.current.length > 90) {
            breathHistoryRef.current.shift();
          }
          
          // Calculate breathing pattern and rate when we have enough data
          if (breathHistoryRef.current.length >= 15) {
            const history = breathHistoryRef.current;
            const recentHistory = history.slice(-15); // Last 0.5 seconds
            const longerHistory = history.slice(-45); // Last 1.5 seconds
            
            // Current breath depth - use smoothed recent average with amplification
            const recentAvg = recentHistory.reduce((a, b) => a + b, 0) / recentHistory.length;
            const amplifiedBreathDepth = Math.min(1, recentAvg * 2); // Amplify for better visibility
            setBreathPattern(amplifiedBreathDepth);
            
            // Breath rate calculation - measure variance over longer period
            if (longerHistory.length >= 30) {
              const longerAvg = longerHistory.reduce((a, b) => a + b, 0) / longerHistory.length;
              const variance = longerHistory.reduce((acc, val) => acc + Math.pow(val - longerAvg, 2), 0) / longerHistory.length;
              const breathIntensity = Math.min(1, Math.sqrt(variance) * 8); // Amplify variance
              setBreathRate(breathIntensity);
              
              // Determine breath phase using simple derivative
              const trend = recentHistory.slice(-5).reduce((acc, val, i, arr) => {
                if (i === 0) return 0;
                return acc + (val - arr[i-1]);
              }, 0);
              
              let currentPhase: 'inhale' | 'exhale' | 'hold' = 'hold';
              const trendThreshold = 0.005; // Lower threshold for more sensitivity
              
              if (Math.abs(trend) > trendThreshold) {
                currentPhase = trend > 0 ? 'inhale' : 'exhale';
              }
              
              // Update phase with some stability filtering
              if (currentPhase !== lastBreathPhaseRef.current) {
                if (Date.now() - breathChangeTimeRef.current > 300) { // 300ms minimum
                  breathChangeTimeRef.current = Date.now();
                  lastBreathPhaseRef.current = currentPhase;
                  setBreathPhase(currentPhase);
                }
              } else {
                setBreathPhase(currentPhase);
              }
              
              // Calculate recommended frequency
              let recFreq = 432;
              if (breathIntensity < 0.3) {
                recFreq = 256 + (amplifiedBreathDepth * 120); // 256-376 Hz
              } else if (breathIntensity < 0.7) {
                recFreq = 396 + (amplifiedBreathDepth * 136); // 396-532 Hz
              } else {
                recFreq = 528 + (amplifiedBreathDepth * 100); // 528-628 Hz
              }
              
              setRecommendedFrequency(Math.round(recFreq));
              
              // Debug logging
              if (Math.random() < 0.02) {
                console.log('Breath Debug:', {
                  audioLevel: currentAudioLevel.toFixed(3),
                  breathDepth: amplifiedBreathDepth.toFixed(3),
                  breathRate: breathIntensity.toFixed(3),
                  phase: currentPhase,
                  trend: trend.toFixed(4)
                });
              }
            }
          } else {
            // Not enough data yet, show current audio level as breath pattern
            setBreathPattern(Math.min(1, currentAudioLevel * 2));
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

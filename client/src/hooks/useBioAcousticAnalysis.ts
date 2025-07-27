import { useState, useEffect, useRef, useCallback } from 'react';

interface BreathingMetrics {
  rate: number; // breaths per minute
  depth: number; // 0-1 amplitude
  regularity: number; // 0-1 consistency score
  coherence: number; // heart rate variability coherence
  stressLevel: number; // 0-1 stress indicator
}

interface FrequencyRecommendation {
  frequency: number;
  name: string;
  purpose: string;
  duration: number;
  intensity: number;
}

interface BioAcousticResult {
  metrics: BreathingMetrics;
  recommendation: FrequencyRecommendation;
  isAnalyzing: boolean;
  confidence: number;
}

const THERAPEUTIC_FREQUENCIES = {
  174: { name: "Pain Relief", purpose: "Physical healing and pain relief", stress: [0.8, 1.0] },
  285: { name: "Tissue Healing", purpose: "Cellular regeneration and healing", stress: [0.7, 0.9] },
  396: { name: "Fear Release", purpose: "Releasing fear and guilt", stress: [0.6, 0.8] },
  417: { name: "Change Facilitation", purpose: "Facilitating positive change", stress: [0.5, 0.7] },
  432: { name: "Nature Harmony", purpose: "Natural healing and balance", stress: [0.4, 0.6] },
  528: { name: "DNA Repair", purpose: "Transformation and nervous system calming", stress: [0.3, 0.5] },
  639: { name: "Heart Connection", purpose: "Relationships and emotional healing", stress: [0.2, 0.4] },
  741: { name: "Expression", purpose: "Creative expression and problem solving", stress: [0.1, 0.3] },
  852: { name: "Intuition", purpose: "Spiritual awakening and intuition", stress: [0.0, 0.2] }
};

export const useBioAcousticAnalysis = (): BioAcousticResult => {
  const [metrics, setMetrics] = useState<BreathingMetrics>({
    rate: 12,
    depth: 0,
    regularity: 0,
    coherence: 0,
    stressLevel: 0.5
  });
  
  const [recommendation, setRecommendation] = useState<FrequencyRecommendation>({
    frequency: 432,
    name: "Nature Harmony",
    purpose: "Natural healing and balance",
    duration: 3000,
    intensity: 0.3
  });
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [confidence, setConfidence] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  
  // Breathing analysis state
  const breathHistoryRef = useRef<number[]>([]);
  const breathTimestampsRef = useRef<number[]>([]);
  const lastPeakTimeRef = useRef<number>(0);
  const breathCyclesRef = useRef<number[]>([]);

  const analyzeBreathingPattern = useCallback((audioLevel: number, timestamp: number) => {
    breathHistoryRef.current.push(audioLevel);
    breathTimestampsRef.current.push(timestamp);
    
    // Keep last 10 seconds of data
    const cutoffTime = timestamp - 10000;
    while (breathTimestampsRef.current.length > 0 && breathTimestampsRef.current[0] < cutoffTime) {
      breathHistoryRef.current.shift();
      breathTimestampsRef.current.shift();
    }
    
    if (breathHistoryRef.current.length < 30) return;
    
    // Detect breathing peaks and calculate rate
    const recentData = breathHistoryRef.current.slice(-30);
    const recentTimes = breathTimestampsRef.current.slice(-30);
    const threshold = Math.max(...recentData) * 0.6;
    
    // Find peaks
    let peaks: number[] = [];
    for (let i = 1; i < recentData.length - 1; i++) {
      if (recentData[i] > recentData[i-1] && 
          recentData[i] > recentData[i+1] && 
          recentData[i] > threshold) {
        peaks.push(recentTimes[i]);
      }
    }
    
    // Calculate breathing rate (breaths per minute)
    if (peaks.length >= 2) {
      const intervals = [];
      for (let i = 1; i < peaks.length; i++) {
        intervals.push(peaks[i] - peaks[i-1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const breathsPerMinute = 60000 / avgInterval;
      
      // Calculate depth (amplitude variation)
      const maxLevel = Math.max(...recentData);
      const minLevel = Math.min(...recentData);
      const depth = maxLevel - minLevel;
      
      // Calculate regularity (consistency of intervals)
      const intervalVariance = intervals.reduce((acc, val) => {
        const diff = val - avgInterval;
        return acc + diff * diff;
      }, 0) / intervals.length;
      const regularity = Math.max(0, 1 - (Math.sqrt(intervalVariance) / avgInterval));
      
      // Calculate coherence (smoothness of signal)
      let coherence = 0;
      for (let i = 1; i < recentData.length; i++) {
        coherence += Math.abs(recentData[i] - recentData[i-1]);
      }
      coherence = Math.max(0, 1 - (coherence / recentData.length / maxLevel));
      
      // Calculate stress level based on multiple factors
      let stressLevel = 0;
      
      // Fast breathing increases stress
      if (breathsPerMinute > 20) stressLevel += 0.3;
      else if (breathsPerMinute > 16) stressLevel += 0.1;
      
      // Shallow breathing increases stress
      if (depth < 0.1) stressLevel += 0.3;
      else if (depth < 0.2) stressLevel += 0.1;
      
      // Irregular breathing increases stress
      if (regularity < 0.3) stressLevel += 0.3;
      else if (regularity < 0.6) stressLevel += 0.1;
      
      // Low coherence increases stress
      if (coherence < 0.3) stressLevel += 0.2;
      
      stressLevel = Math.min(1, stressLevel);
      
      setMetrics({
        rate: Math.round(breathsPerMinute),
        depth: Math.min(1, depth * 2), // Amplify for visibility
        regularity,
        coherence,
        stressLevel
      });
      
      setConfidence(Math.min(1, peaks.length / 5)); // Confidence based on data quality
    }
  }, []);

  const selectTherapeuticFrequency = useCallback((stressLevel: number, metrics: BreathingMetrics) => {
    // Find the best frequency for current stress level
    let bestFreq = 432;
    let bestMatch = Infinity;
    
    for (const [freq, info] of Object.entries(THERAPEUTIC_FREQUENCIES)) {
      const frequency = parseInt(freq);
      const [minStress, maxStress] = info.stress;
      
      if (stressLevel >= minStress && stressLevel <= maxStress) {
        const centerStress = (minStress + maxStress) / 2;
        const distance = Math.abs(stressLevel - centerStress);
        
        if (distance < bestMatch) {
          bestMatch = distance;
          bestFreq = frequency;
        }
      }
    }
    
    const freqInfo = THERAPEUTIC_FREQUENCIES[bestFreq as keyof typeof THERAPEUTIC_FREQUENCIES];
    
    // Calculate duration based on stress level (higher stress = longer exposure)
    const baseDuration = 3000;
    const stressDuration = stressLevel * 4000;
    const duration = baseDuration + stressDuration;
    
    // Calculate intensity based on breathing depth and regularity
    const baseIntensity = 0.2;
    const adaptiveIntensity = Math.min(0.5, baseIntensity + (1 - metrics.depth) * 0.3);
    
    setRecommendation({
      frequency: bestFreq,
      name: freqInfo.name,
      purpose: freqInfo.purpose,
      duration: Math.round(duration),
      intensity: adaptiveIntensity
    });
  }, []);

  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 3;

    const initializeAudio = async () => {
      try {
        setIsAnalyzing(true);
        
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: false, // Keep natural breathing sounds
            noiseSuppression: false,
            autoGainControl: true,
            sampleRate: 44100
          }
        });

        streamRef.current = stream;

        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 44100
        });

        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }

        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 2048;
        analyserRef.current.smoothingTimeConstant = 0.3; // Less smoothing for breath detection
        analyserRef.current.minDecibels = -90;
        analyserRef.current.maxDecibels = -10;

        microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream);
        microphoneRef.current.connect(analyserRef.current);
        
        dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);
        
        console.log('Bio-acoustic analysis initialized successfully');
        startRealTimeAnalysis();
        
      } catch (error) {
        console.error('Microphone initialization failed:', error);
        setIsAnalyzing(false);
        
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`Retrying bio-acoustic initialization (${retryCount}/${maxRetries})...`);
          setTimeout(initializeAudio, 2000);
        }
      }
    };

    const startRealTimeAnalysis = () => {
      if (!analyserRef.current || !dataArrayRef.current) return;

      const analyze = () => {
        if (analyserRef.current && dataArrayRef.current) {
          analyserRef.current.getByteFrequencyData(dataArrayRef.current);
          
          // Calculate RMS for breathing detection
          let sum = 0;
          for (let i = 0; i < dataArrayRef.current.length; i++) {
            sum += dataArrayRef.current[i] * dataArrayRef.current[i];
          }
          const rms = Math.sqrt(sum / dataArrayRef.current.length);
          const normalizedLevel = Math.min(rms / 128, 1);
          
          // Focus on low frequency range for breathing (0-50 Hz)
          const breathingBins = Math.floor(50 * dataArrayRef.current.length / (audioContextRef.current?.sampleRate || 44100));
          let breathingSum = 0;
          for (let i = 0; i < breathingBins; i++) {
            breathingSum += dataArrayRef.current[i];
          }
          const breathingLevel = (breathingSum / breathingBins / 255) * 0.3 + normalizedLevel * 0.7;
          
          analyzeBreathingPattern(breathingLevel, Date.now());
        }
        
        animationFrameRef.current = requestAnimationFrame(analyze);
      };
      
      analyze();
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
  }, [analyzeBreathingPattern]);

  // Update frequency recommendation when metrics change
  useEffect(() => {
    if (confidence > 0.3) {
      selectTherapeuticFrequency(metrics.stressLevel, metrics);
    }
  }, [metrics, confidence, selectTherapeuticFrequency]);

  return {
    metrics,
    recommendation,
    isAnalyzing,
    confidence
  };
};
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
    
    // Keep last 15 seconds of data for accurate analysis
    const cutoffTime = timestamp - 15000;
    while (breathTimestampsRef.current.length > 0 && breathTimestampsRef.current[0] < cutoffTime) {
      breathHistoryRef.current.shift();
      breathTimestampsRef.current.shift();
    }
    
    if (breathHistoryRef.current.length < 50) return; // Need more data for accurate analysis
    
    // Advanced peak detection using moving average and thresholds
    const windowSize = 5;
    const smoothedData: number[] = [];
    const smoothedTimes: number[] = [];
    
    for (let i = windowSize; i < breathHistoryRef.current.length - windowSize; i++) {
      let sum = 0;
      for (let j = i - windowSize; j <= i + windowSize; j++) {
        sum += breathHistoryRef.current[j];
      }
      smoothedData.push(sum / (windowSize * 2 + 1));
      smoothedTimes.push(breathTimestampsRef.current[i]);
    }
    
    // Adaptive threshold based on signal characteristics
    const mean = smoothedData.reduce((a, b) => a + b, 0) / smoothedData.length;
    const variance = smoothedData.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / smoothedData.length;
    const stdDev = Math.sqrt(variance);
    const threshold = mean + stdDev * 0.5; // Dynamic threshold
    
    // Find authentic breathing peaks with minimum distance
    const peaks: number[] = [];
    const minPeakDistance = 1500; // Minimum 1.5 seconds between breaths
    
    for (let i = 2; i < smoothedData.length - 2; i++) {
      if (smoothedData[i] > smoothedData[i-1] && 
          smoothedData[i] > smoothedData[i+1] && 
          smoothedData[i] > threshold &&
          smoothedData[i] > smoothedData[i-2] &&
          smoothedData[i] > smoothedData[i+2]) {
        
        // Check minimum distance from last peak
        if (peaks.length === 0 || smoothedTimes[i] - peaks[peaks.length - 1] > minPeakDistance) {
          peaks.push(smoothedTimes[i]);
        }
      }
    }
    
    // Calculate authentic breathing metrics
    if (peaks.length >= 3) {
      // Breathing rate calculation with outlier removal
      const intervals = [];
      for (let i = 1; i < peaks.length; i++) {
        intervals.push(peaks[i] - peaks[i-1]);
      }
      
      // Remove outliers (intervals too short or too long)
      const validIntervals = intervals.filter(interval => interval >= 2000 && interval <= 10000);
      
      if (validIntervals.length >= 2) {
        const avgInterval = validIntervals.reduce((a, b) => a + b, 0) / validIntervals.length;
        const breathsPerMinute = Math.min(30, Math.max(6, 60000 / avgInterval)); // Realistic range
        
        // Depth calculation using percentile analysis
        const sortedData = [...smoothedData].sort((a, b) => a - b);
        const p90 = sortedData[Math.floor(sortedData.length * 0.9)];
        const p10 = sortedData[Math.floor(sortedData.length * 0.1)];
        const depth = Math.min(1, (p90 - p10) * 3); // Authentic depth measure
        
        // Regularity based on coefficient of variation
        const intervalMean = validIntervals.reduce((a, b) => a + b, 0) / validIntervals.length;
        const intervalVariance = validIntervals.reduce((acc, val) => acc + Math.pow(val - intervalMean, 2), 0) / validIntervals.length;
        const coefficientOfVariation = Math.sqrt(intervalVariance) / intervalMean;
        const regularity = Math.max(0, 1 - coefficientOfVariation * 2);
        
        // Heart Rate Variability-inspired coherence
        let hrv = 0;
        for (let i = 1; i < validIntervals.length; i++) {
          hrv += Math.pow(validIntervals[i] - validIntervals[i-1], 2);
        }
        hrv = Math.sqrt(hrv / Math.max(1, validIntervals.length - 1));
        const coherence = Math.max(0, 1 - (hrv / 2000)); // Normalize HRV-like measure
        
        // Physiological stress assessment
        let stressLevel = 0;
        
        // Respiratory rate stress indicators (clinical ranges)
        if (breathsPerMinute > 24) stressLevel += 0.4; // Tachypnea
        else if (breathsPerMinute > 20) stressLevel += 0.25;
        else if (breathsPerMinute > 16) stressLevel += 0.1;
        else if (breathsPerMinute < 8) stressLevel += 0.15; // Bradypnea can indicate stress
        
        // Depth-related stress (shallow breathing)
        if (depth < 0.15) stressLevel += 0.35; // Very shallow
        else if (depth < 0.3) stressLevel += 0.2;
        else if (depth < 0.5) stressLevel += 0.05;
        
        // Irregularity stress indicators
        if (regularity < 0.4) stressLevel += 0.3; // Highly irregular
        else if (regularity < 0.6) stressLevel += 0.15;
        
        // Coherence stress indicators
        if (coherence < 0.3) stressLevel += 0.25; // Poor coherence
        else if (coherence < 0.5) stressLevel += 0.1;
        
        stressLevel = Math.min(1, stressLevel);
        
        setMetrics({
          rate: Math.round(breathsPerMinute),
          depth,
          regularity,
          coherence,
          stressLevel
        });
        
        // Higher confidence with more peaks and consistent intervals
        const confidenceScore = Math.min(1, (peaks.length - 2) / 8 * (regularity * 0.5 + 0.5));
        setConfidence(confidenceScore);
        
        // Store breath cycles for additional analysis
        breathCyclesRef.current = validIntervals;
        
        // Debug authentic analysis
        if (Math.random() < 0.05) {
          console.log('Authentic Bio-Acoustic Analysis:', {
            peaks: peaks.length,
            breathsPerMinute: breathsPerMinute.toFixed(1),
            depth: depth.toFixed(3),
            regularity: regularity.toFixed(3),
            coherence: coherence.toFixed(3),
            stressLevel: stressLevel.toFixed(3),
            confidence: confidenceScore.toFixed(3)
          });
        }
      }
    }
  }, []);

  const selectTherapeuticFrequency = useCallback((stressLevel: number, metrics: BreathingMetrics) => {
    // Advanced frequency selection based on physiological state
    let selectedFreq = 432;
    let therapyReason = "baseline";
    
    // Multi-factor frequency selection algorithm
    const breathingRate = metrics.rate;
    const breathingDepth = metrics.depth;
    const coherenceLevel = metrics.coherence;
    const regularityLevel = metrics.regularity;
    
    // Primary selection based on stress level and breathing patterns
    if (stressLevel > 0.8 || breathingRate > 22) {
      // High stress: Pain relief and deep calming
      selectedFreq = 174;
      therapyReason = "acute stress and rapid breathing detected";
    } else if (stressLevel > 0.6 || (breathingRate > 18 && breathingDepth < 0.3)) {
      // Moderate-high stress: Fear and anxiety release
      selectedFreq = 396;
      therapyReason = "anxiety patterns and shallow breathing";
    } else if (stressLevel > 0.4 || regularityLevel < 0.4) {
      // Moderate stress: Facilitating positive change
      selectedFreq = 417;
      therapyReason = "irregular breathing patterns indicating tension";
    } else if (coherenceLevel < 0.5 || (breathingRate > 14 && breathingDepth < 0.5)) {
      // Mild stress: Heart coherence and nervous system calming
      selectedFreq = 528;
      therapyReason = "low coherence requiring nervous system regulation";
    } else if (stressLevel > 0.2 || breathingRate < 10) {
      // Low stress: Emotional healing and connection
      selectedFreq = 639;
      therapyReason = "emotional regulation and heart-centered healing";
    } else if (coherenceLevel > 0.7 && regularityLevel > 0.7) {
      // Optimal state: Higher consciousness and intuition
      selectedFreq = 852;
      therapyReason = "high coherence supporting spiritual awareness";
    } else {
      // Balanced state: Natural harmony
      selectedFreq = 432;
      therapyReason = "balanced state maintaining natural harmony";
    }
    
    // Fine-tune frequency based on breathing cycle analysis
    if (breathCyclesRef.current.length >= 3) {
      const avgCycle = breathCyclesRef.current.reduce((a, b) => a + b, 0) / breathCyclesRef.current.length;
      const cycleHz = 1000 / avgCycle; // Convert to Hz
      
      // Entrainment frequency adjustment (resonance with breathing)
      const entrainmentMultiplier = Math.round(selectedFreq / cycleHz / 10) * 10;
      if (entrainmentMultiplier > 0 && Math.abs(entrainmentMultiplier * cycleHz - selectedFreq) < 50) {
        selectedFreq = Math.round(entrainmentMultiplier * cycleHz);
        therapyReason += " (entrained to breathing rhythm)";
      }
    }
    
    const freqInfo = THERAPEUTIC_FREQUENCIES[selectedFreq as keyof typeof THERAPEUTIC_FREQUENCIES] || 
                     THERAPEUTIC_FREQUENCIES[432];
    
    // Adaptive duration based on physiological needs
    let duration = 4000; // Base duration
    
    // Longer duration for higher stress
    duration += stressLevel * 6000;
    
    // Adjust for breathing patterns
    if (breathingRate > 20) duration += 2000; // Fast breathing needs longer calming
    if (breathingDepth < 0.3) duration += 1500; // Shallow breathing needs more time
    if (regularityLevel < 0.5) duration += 1000; // Irregular breathing needs stabilization
    
    // Adaptive intensity based on receptivity
    let intensity = 0.25; // Base intensity
    
    // Higher intensity for lower coherence (less receptive state)
    intensity += (1 - coherenceLevel) * 0.15;
    
    // Lower intensity for higher stress (gentler approach)
    intensity -= stressLevel * 0.1;
    
    // Adjust for breathing depth (deeper breathing = higher receptivity)
    intensity += breathingDepth * 0.1;
    
    intensity = Math.max(0.15, Math.min(0.5, intensity));
    
    setRecommendation({
      frequency: selectedFreq,
      name: freqInfo.name,
      purpose: `${freqInfo.purpose} - ${therapyReason}`,
      duration: Math.round(duration),
      intensity
    });
    
    // Log therapeutic decision
    if (Math.random() < 0.1) {
      console.log('Therapeutic Frequency Selection:', {
        frequency: selectedFreq,
        reason: therapyReason,
        stressLevel: stressLevel.toFixed(3),
        breathingRate,
        duration: Math.round(duration),
        intensity: intensity.toFixed(3)
      });
    }
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
          
          // Multi-band analysis for authentic breathing detection
          const nyquist = (audioContextRef.current?.sampleRate || 44100) / 2;
          const binSize = nyquist / dataArrayRef.current.length;
          
          // Calculate RMS for overall audio level
          let rmsSum = 0;
          for (let i = 0; i < dataArrayRef.current.length; i++) {
            rmsSum += dataArrayRef.current[i] * dataArrayRef.current[i];
          }
          const rms = Math.sqrt(rmsSum / dataArrayRef.current.length);
          const normalizedRMS = Math.min(rms / 128, 1);
          
          // Focus on breathing frequency bands (0.1-2 Hz converted to bins)
          const breathingStartBin = Math.floor(0.1 / binSize);
          const breathingEndBin = Math.floor(2 / binSize);
          
          let breathingEnergy = 0;
          for (let i = breathingStartBin; i < Math.min(breathingEndBin, dataArrayRef.current.length); i++) {
            breathingEnergy += dataArrayRef.current[i];
          }
          const breathingSignal = breathingEnergy / (breathingEndBin - breathingStartBin) / 255;
          
          // Voice/speech band detection (300-3000 Hz) for filtering out speech
          const voiceStartBin = Math.floor(300 / binSize);
          const voiceEndBin = Math.floor(3000 / binSize);
          
          let voiceEnergy = 0;
          for (let i = voiceStartBin; i < Math.min(voiceEndBin, dataArrayRef.current.length); i++) {
            voiceEnergy += dataArrayRef.current[i];
          }
          const voiceLevel = voiceEnergy / (voiceEndBin - voiceStartBin) / 255;
          
          // Combine signals with voice suppression
          const voiceSuppressionFactor = Math.max(0.1, 1 - voiceLevel * 2);
          const breathingLevel = (breathingSignal * 0.4 + normalizedRMS * 0.6) * voiceSuppressionFactor;
          
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
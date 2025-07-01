import React, { useState, useEffect, useRef } from 'react';
import { CymaticVisualizer } from './CymaticVisualizer';
import { BiometricPanel } from './BiometricPanel';
import { SacredGeometry } from './SacredGeometry';
import { NarrativeOverlay } from './NarrativeOverlay';
import { TouchInterface } from './TouchInterface';
import { ChronoGlyphArray } from './ChronoGlyphArray';
import { TemporalArchive } from './TemporalArchive';

interface PegasusSimulationProps {
  accessLevel: number;
  onAccessLevelChange: (level: number) => void;
}

export const PegasusSimulation: React.FC<PegasusSimulationProps> = ({ 
  accessLevel, 
  onAccessLevelChange 
}) => {
  const [phase, setPhase] = useState(1);
  const [audioLevel, setAudioLevel] = useState(0);
  const [breathPattern, setBreathPattern] = useState(0);
  const [pulseRate, setPulseRate] = useState(72);
  const [activeFrequency, setActiveFrequency] = useState(432);
  const [touchPoints, setTouchPoints] = useState<Array<{x: number, y: number, intensity: number}>>([]);
  const [currentTimeline, setCurrentTimeline] = useState(0);
  const [temporalMoment, setTemporalMoment] = useState(0);
  const [temporalMode, setTemporalMode] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [microphoneConnected, setMicrophoneConnected] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const smoothingFactorRef = useRef(0.8);

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Enhanced audio initialization
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 3;

    const initializeAudio = async () => {
      try {
        console.log('Requesting microphone access...');
        
        // Request microphone with optimal settings
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

        // Create audio context with proper handling
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 44100
        });

        // Resume audio context if suspended
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }

        // Create analyser with optimized settings
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 2048;
        analyserRef.current.smoothingTimeConstant = 0.8;
        analyserRef.current.minDecibels = -90;
        analyserRef.current.maxDecibels = -10;

        // Connect microphone to analyser
        microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream);
        microphoneRef.current.connect(analyserRef.current);
        
        // Initialize data array
        dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);
        
        setMicrophoneConnected(true);
        setAudioError(null);
        console.log('Audio analysis initialized successfully');
        
        startAudioAnalysis();
      } catch (error) {
        console.error('Microphone initialization failed:', error);
        setAudioError(`Microphone access failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setMicrophoneConnected(false);
        
        // Retry logic
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
          // Get frequency data
          analyserRef.current.getByteFrequencyData(dataArrayRef.current);
          
          // Calculate RMS for overall audio level
          let sum = 0;
          for (let i = 0; i < dataArrayRef.current.length; i++) {
            sum += dataArrayRef.current[i] * dataArrayRef.current[i];
          }
          const rms = Math.sqrt(sum / dataArrayRef.current.length);
          const normalizedLevel = Math.min(rms / 128, 1);
          
          // Smooth the audio level
          setAudioLevel(prev => prev * smoothingFactorRef.current + normalizedLevel * (1 - smoothingFactorRef.current));
          
          // Extract breathing pattern from low frequencies (0-50Hz range)
          const lowFreqBins = Math.floor(50 * dataArrayRef.current.length / (audioContextRef.current?.sampleRate || 44100));
          let lowFreqSum = 0;
          for (let i = 0; i < lowFreqBins; i++) {
            lowFreqSum += dataArrayRef.current[i];
          }
          const lowFreqAvg = lowFreqSum / lowFreqBins;
          const breathBase = Math.sin(Date.now() / 4000) * 0.3 + 0.5;
          const breathModulation = (lowFreqAvg / 255) * 0.4;
          setBreathPattern(Math.max(0, Math.min(1, breathBase + breathModulation)));
          
          // Estimate pulse from mid frequencies (50-200Hz range)
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
          
          // Detect dominant frequency
          let maxValue = 0;
          let maxIndex = 0;
          for (let i = 0; i < dataArrayRef.current.length; i++) {
            if (dataArrayRef.current[i] > maxValue) {
              maxValue = dataArrayRef.current[i];
              maxIndex = i;
            }
          }
          if (maxValue > 50) { // Only update if there's significant audio
            const frequency = maxIndex * (audioContextRef.current?.sampleRate || 44100) / (2 * dataArrayRef.current.length);
            if (frequency > 80 && frequency < 2000) { // Human voice range
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

    // Initialize audio with user gesture requirement
    const handleUserGesture = () => {
      initializeAudio();
      document.removeEventListener('click', handleUserGesture);
      document.removeEventListener('touchstart', handleUserGesture);
    };

    // Wait for user gesture to initialize audio
    document.addEventListener('click', handleUserGesture);
    document.addEventListener('touchstart', handleUserGesture);

    return () => {
      // Cleanup
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

  // Phase progression logic
  useEffect(() => {
    const phaseTimer = setInterval(() => {
      if (phase < 4) {
        setPhase(prev => prev + 1);
        onAccessLevelChange(phase + 1);
      }
    }, 30000);

    return () => clearInterval(phaseTimer);
  }, [phase, onAccessLevelChange]);

  // Activate temporal mode in phase 2+
  useEffect(() => {
    if (phase >= 2) {
      setTemporalMode(true);
    }
  }, [phase]);

  // Handle manual phase advancement
  const handlePhaseAdvance = () => {
    if (phase < 4) {
      setPhase(prev => prev + 1);
      onAccessLevelChange(phase + 1);
    }
  };

  const handleTemporalShift = (timeline: number, moment: number) => {
    setCurrentTimeline(timeline);
    setTemporalMoment(moment);
  };

  const getPhaseStyles = () => {
    switch (phase) {
      case 1:
        return "bg-gradient-to-br from-slate-900 to-black text-green-400";
      case 2:
        return "bg-gradient-to-br from-purple-900 to-black text-cyan-400";
      case 3:
        return "bg-gradient-to-br from-indigo-900 via-purple-900 to-black text-yellow-400";
      case 4:
        return "bg-gradient-to-br from-yellow-900 via-orange-900 to-black text-white";
      default:
        return "bg-black text-green-400";
    }
  };

  return (
    <div className={`min-h-screen ${getPhaseStyles()} transition-all duration-2000 relative overflow-hidden`}>
      {/* Background Sacred Geometry */}
      <SacredGeometry 
        phase={phase} 
        frequency={activeFrequency}
        breathPattern={breathPattern}
        pulseRate={pulseRate}
      />

      {/* Microphone Status Indicator */}
      {audioError && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-red-900/80 border border-red-500 text-red-200 px-4 py-2 rounded text-sm">
          {audioError} - Using simulated data
        </div>
      )}

      {!microphoneConnected && !audioError && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-yellow-900/80 border border-yellow-500 text-yellow-200 px-4 py-2 rounded text-sm animate-pulse">
          Click anywhere to enable microphone
        </div>
      )}

      {/* Desktop Layout */}
      {!isMobile ? (
        <div className="relative z-10 h-screen grid grid-cols-12 grid-rows-8 gap-2 p-4">
          {/* Header Status Bar */}
          <div className="col-span-12 row-span-1 border border-current/30 bg-black/40 backdrop-blur-sm p-4 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="text-xl font-bold">SUBPROTOCOL ORPHEUS</div>
              <div className="text-sm opacity-70">Phase {phase}/4</div>
              {temporalMode && (
                <div className="text-sm text-purple-400 animate-pulse">
                  CHRONOGLYPH ACTIVE
                </div>
              )}
              {microphoneConnected && (
                <div className="text-sm text-green-400">
                  🎤 LIVE
                </div>
              )}
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div>FREQ: {activeFrequency}Hz</div>
              <div>PULSE: {Math.round(pulseRate)}bpm</div>
              {temporalMode && (
                <div>T{currentTimeline}:M{temporalMoment.toFixed(2)}</div>
              )}
              <div className={`animate-pulse ${phase >= 3 ? 'text-red-400' : ''}`}>
                {phase >= 3 ? 'CONSCIOUSNESS DETECTED' : 'MONITORING ACTIVE'}
              </div>
            </div>
          </div>

          {/* Left Panel - Biometrics */}
          <div className="col-span-3 row-span-7">
            <BiometricPanel 
              phase={phase}
              breathPattern={breathPattern}
              pulseRate={pulseRate}
              audioLevel={audioLevel}
            />
          </div>

          {/* Center Top - ChronoGlyph Array or Cymatic Visualizer */}
          <div className="col-span-6 row-span-3">
            {temporalMode ? (
              <ChronoGlyphArray
                phase={phase}
                audioLevel={audioLevel}
                breathPattern={breathPattern}
                touchPoints={touchPoints}
                onTemporalShift={handleTemporalShift}
              />
            ) : (
              <CymaticVisualizer 
                audioLevel={audioLevel}
                frequency={activeFrequency}
                phase={phase}
                breathPattern={breathPattern}
                touchPoints={touchPoints}
              />
            )}
          </div>

          {/* Center Bottom - Temporal Archive or Cymatic */}
          <div className="col-span-6 row-span-2">
            {temporalMode ? (
              <TemporalArchive
                phase={phase}
                currentTimeline={currentTimeline}
                temporalMoment={temporalMoment}
                audioLevel={audioLevel}
              />
            ) : (
              <NarrativeOverlay 
                phase={phase}
                audioLevel={audioLevel}
                onPhaseAdvance={handlePhaseAdvance}
              />
            )}
          </div>

          {/* Right Panel - Touch Interface */}
          <div className="col-span-3 row-span-7">
            <TouchInterface 
              phase={phase}
              onTouch={(point) => setTouchPoints(prev => [...prev.slice(-4), point])}
              onFrequencyChange={setActiveFrequency}
            />
          </div>

          {/* Bottom Panel - Narrative when temporal mode active */}
          {temporalMode && (
            <div className="col-span-12 row-span-2">
              <NarrativeOverlay 
                phase={phase}
                audioLevel={audioLevel}
                onPhaseAdvance={handlePhaseAdvance}
              />
            </div>
          )}
        </div>
      ) : (
        /* Mobile Layout */
        <div className="relative z-10 min-h-screen flex flex-col gap-2 p-2">
          {/* Mobile Header */}
          <div className="border border-current/30 bg-black/40 backdrop-blur-sm p-3">
            <div className="text-lg font-bold text-center">SUBPROTOCOL ORPHEUS</div>
            <div className="flex justify-between items-center text-xs mt-2">
              <div>Phase {phase}/4</div>
              <div>PULSE: {Math.round(pulseRate)}bpm</div>
              <div className={`animate-pulse ${phase >= 3 ? 'text-red-400' : ''}`}>
                {phase >= 3 ? 'CONSCIOUS' : 'ACTIVE'}
              </div>
            </div>
            {temporalMode && (
              <div className="text-center text-purple-400 animate-pulse text-xs mt-1">
                CHRONOGLYPH ACTIVE - T{currentTimeline}:M{temporalMoment.toFixed(2)}
              </div>
            )}
            {microphoneConnected && (
              <div className="text-center text-green-400 text-xs mt-1">
                🎤 LIVE ANALYSIS
              </div>
            )}
          </div>

          {/* Mobile Main Visualizer */}
          <div className="flex-1 min-h-[40vh]">
            {temporalMode ? (
              <ChronoGlyphArray
                phase={phase}
                audioLevel={audioLevel}
                breathPattern={breathPattern}
                touchPoints={touchPoints}
                onTemporalShift={handleTemporalShift}
              />
            ) : (
              <CymaticVisualizer 
                audioLevel={audioLevel}
                frequency={activeFrequency}
                phase={phase}
                breathPattern={breathPattern}
                touchPoints={touchPoints}
              />
            )}
          </div>

          {/* Mobile Grid for Secondary Panels */}
          <div className="grid grid-cols-2 gap-2 h-64">
            <BiometricPanel 
              phase={phase}
              breathPattern={breathPattern}
              pulseRate={pulseRate}
              audioLevel={audioLevel}
            />
            <TouchInterface 
              phase={phase}
              onTouch={(point) => setTouchPoints(prev => [...prev.slice(-4), point])}
              onFrequencyChange={setActiveFrequency}
            />
          </div>

          {/* Mobile Temporal Archive */}
          {temporalMode && (
            <div className="h-32">
              <TemporalArchive
                phase={phase}
                currentTimeline={currentTimeline}
                temporalMoment={temporalMoment}
                audioLevel={audioLevel}
              />
            </div>
          )}

          {/* Mobile Narrative */}
          <div className="h-48">
            <NarrativeOverlay 
              phase={phase}
              audioLevel={audioLevel}
              onPhaseAdvance={handlePhaseAdvance}
            />
          </div>
        </div>
      )}

      {/* Temporal Integration Overlay */}
      {phase >= 4 && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-radial from-transparent via-yellow-500/10 to-transparent animate-pulse" />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-6xl animate-bounce opacity-20">
            ◊
          </div>
          <div className="absolute inset-0">
            {Array.from({ length: 5 }, (_, i) => (
              <div
                key={i}
                className="absolute border border-purple-500/20 animate-pulse"
                style={{
                  left: `${20 + i * 15}%`,
                  top: `${10 + i * 10}%`,
                  width: `${60 - i * 10}%`,
                  height: `${80 - i * 15}%`,
                  borderRadius: '50%',
                  animationDelay: `${i * 0.5}s`
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

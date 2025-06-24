
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

  // Phase progression logic
  useEffect(() => {
    const phaseTimer = setInterval(() => {
      if (phase < 4) {
        setPhase(prev => prev + 1);
        onAccessLevelChange(phase + 1);
      }
    }, 30000); // Progress every 30 seconds

    return () => clearInterval(phaseTimer);
  }, [phase, onAccessLevelChange]);

  // Simulate biometric data
  useEffect(() => {
    const biometricTimer = setInterval(() => {
      setBreathPattern(Math.sin(Date.now() / 3000) * 0.5 + 0.5);
      setPulseRate(72 + Math.sin(Date.now() / 1000) * 8);
      setAudioLevel(Math.random() * 0.7 + 0.3);
    }, 100);

    return () => clearInterval(biometricTimer);
  }, []);

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

      {/* Main Interface Grid */}
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

        {/* Center Bottom - Temporal Archive or Cymatic (when temporal active) */}
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

      {/* Temporal Integration Overlay */}
      {phase >= 4 && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-radial from-transparent via-yellow-500/10 to-transparent animate-pulse" />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-6xl animate-bounce opacity-20">
            ◊
          </div>
          {/* Temporal field lines */}
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

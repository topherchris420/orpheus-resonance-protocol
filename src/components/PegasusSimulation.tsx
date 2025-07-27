
import React, { useState, useEffect } from 'react';
import { CymaticVisualizer } from './CymaticVisualizer';
import { BiometricPanel } from './BiometricPanel';
import { SacredGeometry } from './SacredGeometry';
import { NarrativeOverlay } from './NarrativeOverlay';
import { TouchInterface } from './TouchInterface';
import { ChronoGlyphArray } from './ChronoGlyphArray';
import { TemporalArchive } from './TemporalArchive';
import { QuantumResonance } from './QuantumResonance';
import { ConsciousnessMemory } from './ConsciousnessMemory';
import { StatusIndicators } from './StatusIndicators';
import { HeaderStatusBar } from './HeaderStatusBar';
import { MobileHeader } from './MobileHeader';
import { VisualOverlays } from './VisualOverlays';
import { useAudioAnalysis } from '../hooks/useAudioAnalysis';
import { usePhaseProgression } from '../hooks/usePhaseProgression';
import { useInteractionState } from '../hooks/useInteractionState';

interface PegasusSimulationProps {
  accessLevel: number;
  onAccessLevelChange: (level: number) => void;
}

export const PegasusSimulation: React.FC<PegasusSimulationProps> = ({ 
  accessLevel, 
  onAccessLevelChange 
}) => {
  const [isMobile, setIsMobile] = useState(false);

  // Custom hooks for managing state and logic
  const {
    audioLevel,
    breathPattern,
    pulseRate,
    activeFrequency: audioFrequency,
    microphoneConnected,
    audioError
  } = useAudioAnalysis();

  const { phase, temporalMode, handlePhaseAdvance } = usePhaseProgression(onAccessLevelChange);

  const {
    touchPoints,
    currentTimeline,
    temporalMoment,
    coherenceLevel,
    activeFrequency,
    addTouchPoint,
    handleTemporalShift,
    setCoherenceLevel,
    setActiveFrequency
  } = useInteractionState();

  // Set initial frequency from audio analysis
  useEffect(() => {
    setActiveFrequency(audioFrequency);
  }, [audioFrequency, setActiveFrequency]);

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

      {/* Status Indicators */}
      <StatusIndicators 
        audioError={audioError}
        microphoneConnected={microphoneConnected}
      />

      {/* Desktop Layout */}
      {!isMobile ? (
        <div className="relative z-10 h-screen grid grid-cols-12 grid-rows-8 gap-2 p-4">
          {/* Header Status Bar */}
          <HeaderStatusBar
            phase={phase}
            temporalMode={temporalMode}
            microphoneConnected={microphoneConnected}
            coherenceLevel={coherenceLevel}
            activeFrequency={activeFrequency}
            pulseRate={pulseRate}
            currentTimeline={currentTimeline}
            temporalMoment={temporalMoment}
          />

          {/* Left Panel - Biometrics */}
          <div className="col-span-3 row-span-4">
            <BiometricPanel 
              phase={phase}
              breathPattern={breathPattern}
              pulseRate={pulseRate}
              audioLevel={audioLevel}
            />
          </div>

          {/* Left Panel Bottom - Quantum Resonance */}
          <div className="col-span-3 row-span-3">
            <QuantumResonance
              audioLevel={audioLevel}
              breathPattern={breathPattern}
              pulseRate={pulseRate}
              phase={phase}
              touchPoints={touchPoints}
              onCoherenceChange={setCoherenceLevel}
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

          {/* Right Panel Top - Touch Interface */}
          <div className="col-span-3 row-span-4">
            <TouchInterface 
              phase={phase}
              onTouch={addTouchPoint}
              onFrequencyChange={setActiveFrequency}
            />
          </div>

          {/* Right Panel Bottom - Consciousness Memory */}
          <div className="col-span-3 row-span-3">
            <ConsciousnessMemory
              phase={phase}
              coherenceLevel={coherenceLevel}
              audioLevel={audioLevel}
              breathPattern={breathPattern}
              pulseRate={pulseRate}
              currentTimeline={currentTimeline}
              temporalMoment={temporalMoment}
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
          <MobileHeader
            phase={phase}
            temporalMode={temporalMode}
            microphoneConnected={microphoneConnected}
            coherenceLevel={coherenceLevel}
            pulseRate={pulseRate}
            currentTimeline={currentTimeline}
            temporalMoment={temporalMoment}
          />

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
            <QuantumResonance
              audioLevel={audioLevel}
              breathPattern={breathPattern}
              pulseRate={pulseRate}
              phase={phase}
              touchPoints={touchPoints}
              onCoherenceChange={setCoherenceLevel}
            />
          </div>

          {/* Mobile Secondary Grid */}
          <div className="grid grid-cols-2 gap-2 h-64">
            <TouchInterface 
              phase={phase}
              onTouch={addTouchPoint}
              onFrequencyChange={setActiveFrequency}
            />
            <ConsciousnessMemory
              phase={phase}
              coherenceLevel={coherenceLevel}
              audioLevel={audioLevel}
              breathPattern={breathPattern}
              pulseRate={pulseRate}
              currentTimeline={currentTimeline}
              temporalMoment={temporalMoment}
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

      {/* Visual Overlays */}
      <VisualOverlays phase={phase} coherenceLevel={coherenceLevel} />
    </div>
  );
};

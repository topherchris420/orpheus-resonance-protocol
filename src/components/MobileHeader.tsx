
import React from 'react';

interface MobileHeaderProps {
  phase: number;
  temporalMode: boolean;
  microphoneConnected: boolean;
  coherenceLevel: number;
  pulseRate: number;
  currentTimeline: number;
  temporalMoment: number;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  phase,
  temporalMode,
  microphoneConnected,
  coherenceLevel,
  pulseRate,
  currentTimeline,
  temporalMoment
}) => {
  return (
    <div className="border border-current/30 bg-black/40 backdrop-blur-sm p-3">
      <div className="text-lg font-bold text-center">SUBPROTOCOL ORPHEUS</div>
      <div className="flex justify-between items-center text-xs mt-2">
        <div>Phase {phase}/4</div>
        <div>PULSE: {Math.round(pulseRate)}bpm</div>
        <div>COH: {(coherenceLevel * 100).toFixed(0)}%</div>
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
      {coherenceLevel > 0.8 && (
        <div className="text-center text-cyan-400 animate-pulse text-xs mt-1">
          CONSCIOUSNESS RESONANT
        </div>
      )}
    </div>
  );
};

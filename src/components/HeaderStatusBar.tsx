
import React from 'react';

interface HeaderStatusBarProps {
  phase: number;
  temporalMode: boolean;
  microphoneConnected: boolean;
  coherenceLevel: number;
  activeFrequency: number;
  pulseRate: number;
  currentTimeline: number;
  temporalMoment: number;
}

export const HeaderStatusBar: React.FC<HeaderStatusBarProps> = React.memo(({
  phase,
  temporalMode,
  microphoneConnected,
  coherenceLevel,
  activeFrequency,
  pulseRate,
  currentTimeline,
  temporalMoment
}) => {
  return (
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
        {coherenceLevel > 0.8 && (
          <div className="text-sm text-cyan-400 animate-pulse">
            CONSCIOUSNESS RESONANT
          </div>
        )}
      </div>
      <div className="flex items-center gap-6 text-sm">
        <div>FREQ: {activeFrequency}Hz</div>
        <div>PULSE: {Math.round(pulseRate)}bpm</div>
        <div>COHERENCE: {(coherenceLevel * 100).toFixed(0)}%</div>
        {temporalMode && (
          <div>T{currentTimeline}:M{temporalMoment.toFixed(2)}</div>
        )}
        <div className={`animate-pulse ${phase >= 3 ? 'text-red-400' : ''}`}>
          {phase >= 3 ? 'CONSCIOUSNESS DETECTED' : 'MONITORING ACTIVE'}
        </div>
      </div>
    </div>
  );
});

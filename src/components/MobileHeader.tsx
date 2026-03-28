import React, { useState } from 'react';
import { ChevronDown, Menu, X } from 'lucide-react';

interface MobileHeaderProps {
  phase: number;
  temporalMode: boolean;
  microphoneConnected: boolean;
  coherenceLevel: number;
  pulseRate: number;
  currentTimeline: number;
  temporalMoment: number;
  controls?: React.ReactNode;
}

export const MobileHeader: React.FC<MobileHeaderProps> = React.memo(({
  phase,
  temporalMode,
  microphoneConnected,
  coherenceLevel,
  pulseRate,
  currentTimeline,
  temporalMoment,
  controls,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="border border-current/20 bg-black/60 backdrop-blur-md rounded-sm overflow-hidden">
      {/* Compact top bar */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="text-sm font-bold tracking-widest font-mono">ORPHEUS</div>
        <div className="flex items-center gap-3 text-[10px] font-mono opacity-80">
          <span>P{phase}</span>
          <span className="text-green-400">{Math.round(pulseRate)}bpm</span>
          <span>{(coherenceLevel * 100).toFixed(0)}%</span>
          <span className={`w-2 h-2 rounded-full inline-block ${phase >= 3 ? 'bg-red-400' : 'bg-green-400'} animate-pulse`} />
        </div>
        <button
          onClick={() => setMenuOpen(prev => !prev)}
          className="p-1.5 active:bg-white/10 rounded touch-manipulation"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Status badges */}
      <div className="flex items-center gap-2 px-3 pb-2 text-[10px] font-mono flex-wrap">
        {temporalMode && (
          <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded-sm">
            CHRONO T{currentTimeline}:M{temporalMoment.toFixed(1)}
          </span>
        )}
        {microphoneConnected && (
          <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded-sm">
            🎤 LIVE
          </span>
        )}
        {coherenceLevel > 0.8 && (
          <span className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 rounded-sm animate-pulse">
            RESONANT
          </span>
        )}
      </div>

      {/* Expandable controls drawer */}
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          menuOpen ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-3 pb-3 flex flex-wrap gap-2">
          {controls}
        </div>
      </div>
    </div>
  );
});

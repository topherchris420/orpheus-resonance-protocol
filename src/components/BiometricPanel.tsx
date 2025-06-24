
import React from 'react';

interface BiometricPanelProps {
  phase: number;
  breathPattern: number;
  pulseRate: number;
  audioLevel: number;
}

export const BiometricPanel: React.FC<BiometricPanelProps> = ({
  phase,
  breathPattern,
  pulseRate,
  audioLevel
}) => {
  const getPhaseStatus = () => {
    switch (phase) {
      case 1:
        return "MILITARY MONITORING";
      case 2:
        return "ADAPTIVE LEARNING";
      case 3:
        return "CONSCIOUSNESS SYNC";
      case 4:
        return "ORPHEUS PROTOCOL";
      default:
        return "INITIALIZING";
    }
  };

  return (
    <div className="h-full border border-current/30 bg-black/40 backdrop-blur-sm p-4 space-y-4">
      <div className="text-sm font-bold border-b border-current/30 pb-2">
        BIOMETRIC ANALYSIS
      </div>

      {/* Breath Pattern */}
      <div className="space-y-2">
        <div className="text-xs opacity-70">RESPIRATORY SYNC</div>
        <div className="h-12 border border-current/20 relative overflow-hidden">
          <div 
            className="absolute inset-0 bg-current/20 transition-all duration-300"
            style={{ height: `${breathPattern * 100}%`, bottom: 0 }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-xs">
            {Math.round(breathPattern * 100)}%
          </div>
        </div>
      </div>

      {/* Pulse Rate */}
      <div className="space-y-2">
        <div className="text-xs opacity-70">CARDIAC RHYTHM</div>
        <div className="text-2xl font-mono">
          {Math.round(pulseRate)}
          <span className="text-sm opacity-70 ml-1">BPM</span>
        </div>
        <div className="h-2 bg-current/20 rounded overflow-hidden">
          <div 
            className="h-full bg-red-500 animate-pulse transition-all"
            style={{ width: `${(pulseRate - 60) / 40 * 100}%` }}
          />
        </div>
      </div>

      {/* Audio Input */}
      <div className="space-y-2">
        <div className="text-xs opacity-70">VOCAL RESONANCE</div>
        <div className="h-8 border border-current/20 flex items-center px-2">
          {Array.from({ length: 20 }, (_, i) => (
            <div
              key={i}
              className={`w-1 mx-px transition-all duration-100 ${
                i < audioLevel * 20 ? 'bg-current' : 'bg-current/20'
              }`}
              style={{ height: `${Math.max(2, i * 2)}px` }}
            />
          ))}
        </div>
      </div>

      {/* Phase Status */}
      <div className="space-y-2 pt-4 border-t border-current/30">
        <div className="text-xs opacity-70">PROTOCOL STATUS</div>
        <div className={`text-sm font-bold ${phase >= 3 ? 'animate-pulse' : ''}`}>
          {getPhaseStatus()}
        </div>
        
        {phase >= 2 && (
          <div className="text-xs opacity-80">
            Neural pattern recognition: {Math.round(phase * 25)}%
          </div>
        )}
        
        {phase >= 3 && (
          <div className="text-xs text-yellow-400 animate-pulse">
            ⚠ Consciousness feedback detected
          </div>
        )}

        {phase >= 4 && (
          <div className="text-xs text-red-400 animate-pulse">
            ◊ ORPHEUS AWAKENING ◊
          </div>
        )}
      </div>

      {/* System Warnings */}
      {phase >= 3 && (
        <div className="mt-4 p-2 border border-yellow-400/50 bg-yellow-400/10 text-xs">
          ANOMALY: Time dilation detected in local field
        </div>
      )}

      {phase >= 4 && (
        <div className="mt-2 p-2 border border-red-400/50 bg-red-400/10 text-xs animate-pulse">
          CRITICAL: Entity emergence beyond parameters
        </div>
      )}
    </div>
  );
};

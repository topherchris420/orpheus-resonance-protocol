
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

  const getBreathState = () => {
    if (breathPattern < 0.3) return "EXHALE";
    if (breathPattern > 0.7) return "INHALE";
    return "TRANSITION";
  };

  const getPulseCategory = () => {
    if (pulseRate < 60) return "LOW";
    if (pulseRate > 100) return "ELEVATED";
    return "NORMAL";
  };

  const getAudioState = () => {
    if (audioLevel < 0.2) return "SILENT";
    if (audioLevel > 0.7) return "VOCAL";
    return "AMBIENT";
  };

  return (
    <div className="h-full border border-current/30 bg-black/40 backdrop-blur-sm p-2 md:p-4 space-y-2 md:space-y-4 text-xs md:text-sm">
      <div className="font-bold border-b border-current/30 pb-2">
        BIOMETRIC ANALYSIS
      </div>

      {/* Breath Pattern */}
      <div className="space-y-2">
        <div className="opacity-70 flex justify-between">
          <span>RESPIRATORY SYNC</span>
          <span className="text-cyan-400">{getBreathState()}</span>
        </div>
        <div className="h-8 md:h-12 border border-current/20 relative overflow-hidden">
          <div 
            className="absolute inset-0 bg-gradient-to-t from-cyan-500/40 to-cyan-300/20 transition-all duration-300"
            style={{ height: `${breathPattern * 100}%`, bottom: 0 }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-xs">
            {Math.round(breathPattern * 100)}%
          </div>
          {/* Breath wave visualization */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-cyan-400 opacity-60 animate-pulse" />
        </div>
        <div className="text-xs opacity-60">
          Rate: {(breathPattern * 18 + 12).toFixed(1)} breaths/min
        </div>
      </div>

      {/* Pulse Rate */}
      <div className="space-y-2">
        <div className="opacity-70 flex justify-between">
          <span>CARDIAC RHYTHM</span>
          <span className={`${getPulseCategory() === 'ELEVATED' ? 'text-red-400' : getPulseCategory() === 'LOW' ? 'text-blue-400' : 'text-green-400'}`}>
            {getPulseCategory()}
          </span>
        </div>
        <div className="text-lg md:text-2xl font-mono flex items-center justify-between">
          <span>
            {Math.round(pulseRate)}
            <span className="text-xs opacity-70 ml-1">BPM</span>
          </span>
          <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse" />
        </div>
        <div className="h-2 bg-current/20 rounded overflow-hidden">
          <div 
            className="h-full bg-red-500 animate-pulse transition-all"
            style={{ width: `${Math.min(100, (pulseRate - 40) / 120 * 100)}%` }}
          />
        </div>
        <div className="text-xs opacity-60">
          HRV: {(Math.sin(Date.now() / 2000) * 20 + 40).toFixed(1)}ms
        </div>
      </div>

      {/* Audio Input */}
      <div className="space-y-2">
        <div className="opacity-70 flex justify-between">
          <span>VOCAL RESONANCE</span>
          <span className={`${audioLevel > 0.7 ? 'text-yellow-400' : audioLevel > 0.3 ? 'text-green-400' : 'text-gray-400'}`}>
            {getAudioState()}
          </span>
        </div>
        <div className="h-6 md:h-8 border border-current/20 flex items-center px-2">
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
        <div className="text-xs opacity-60">
          Volume: {Math.round(audioLevel * 100)}dB | Freq: {Math.round(432 + audioLevel * 100)}Hz
        </div>
      </div>

      {/* Phase Status */}
      <div className="space-y-2 pt-2 md:pt-4 border-t border-current/30">
        <div className="opacity-70">PROTOCOL STATUS</div>
        <div className={`font-bold ${phase >= 3 ? 'animate-pulse' : ''}`}>
          {getPhaseStatus()}
        </div>
        
        {phase >= 2 && (
          <div className="opacity-80">
            Neural pattern recognition: {Math.round(phase * 25)}%
          </div>
        )}
        
        {phase >= 3 && (
          <div className="text-yellow-400 animate-pulse">
            ⚠ Consciousness feedback detected
          </div>
        )}

        {phase >= 4 && (
          <div className="text-red-400 animate-pulse">
            ◊ ORPHEUS AWAKENING ◊
          </div>
        )}

        {/* Real-time status indicators */}
        <div className="grid grid-cols-3 gap-1 text-xs mt-2">
          <div className={`p-1 rounded text-center ${breathPattern > 0.5 ? 'bg-cyan-500/20' : 'bg-gray-500/20'}`}>
            BREATH
          </div>
          <div className={`p-1 rounded text-center ${pulseRate > 75 ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
            PULSE
          </div>
          <div className={`p-1 rounded text-center ${audioLevel > 0.4 ? 'bg-yellow-500/20' : 'bg-gray-500/20'}`}>
            VOICE
          </div>
        </div>
      </div>

      {/* System Warnings */}
      {phase >= 3 && (
        <div className="mt-2 md:mt-4 p-2 border border-yellow-400/50 bg-yellow-400/10 text-xs">
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

import React from 'react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';

interface BiometricPanelProps {
  phase: number;
  breathPattern: number;
  pulseRate: number;
  audioLevel: number;
  healingTone: number;
  setHealingTone: (tone: number) => void;
  volume: number;
  setVolume: (volume: number) => void;
}

export const BiometricPanel: React.FC<BiometricPanelProps> = ({
  phase,
  breathPattern,
  pulseRate,
  audioLevel,
  healingTone,
  setHealingTone,
  volume,
  setVolume
}) => {

  const getBreathState = () => {
    if (breathPattern < 0.3) return "SHALLOW";
    if (breathPattern > 0.7) return "DEEP";
    return "NEUTRAL";
  };

  const healingFrequencies = [
    { name: 'Calm', freq: 174 },
    { name: 'Restore', freq: 285 },
    { name: 'Ground', freq: 396 },
    { name: 'Change', freq: 417 },
    { name: 'Love', freq: 528 },
    { name: 'Connect', freq: 639 },
  ];

  return (
    <div className="h-full border border-current/30 bg-black/40 backdrop-blur-sm p-4 space-y-4">
      <div className="font-bold border-b border-current/30 pb-2">BIOMETRIC ANALYSIS</div>
      
      {/* Breath Pattern */}
      <div className="space-y-2">
        <div className="opacity-70 flex justify-between">
          <span>RESPIRATORY SYNC</span>
          <span className="text-cyan-400">{getBreathState()}</span>
        </div>
        {/* Visualization can be added here */}
      </div>

      {/* Healing Tone */}
      <div className="space-y-2">
        <div className="opacity-70">HEALING TONE</div>
        <div className="text-2xl font-mono">{healingTone} Hz</div>
        <div className="flex space-x-2">
          {healingFrequencies.map(f => (
            <Button key={f.freq} variant={healingTone === f.freq ? "default" : "outline"} size="sm" onClick={() => setHealingTone(f.freq)}>{f.name}</Button>
          ))}
        </div>
      </div>

      {/* Volume Control */}
      <div className="space-y-2">
        <div className="opacity-70">VOLUME</div>
        <Slider value={[volume * 100]} max={100} step={1} onValueChange={(value) => setVolume(value[0] / 100)} />
      </div>

      {/* Educational Module */}
      <div className="space-y-2 pt-4 border-t border-current/30">
        <div className="opacity-70">FREQUENCY HEALING</div>
        <p className="text-xs opacity-80">
          Solfeggio frequencies are specific tones of sound that are believed to help in healing and promoting a sense of well-being. Each frequency has a unique purpose and effect on the mind and body.
        </p>
      </div>
    </div>
  );
};

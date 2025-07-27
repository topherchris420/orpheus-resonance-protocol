import React from 'react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';

interface OperatorVitalsCognitiveLoadMonitorProps {
  hrv: number;
  respiratoryRate: number;
  cognitiveStressIndex: number;
  bioResonanceSupportFrequency: number;
  setBioResonanceSupportFrequency: (frequency: number) => void;
  volume: number;
  setVolume: (volume: number) => void;
}

export const OperatorVitalsCognitiveLoadMonitor: React.FC<OperatorVitalsCognitiveLoadMonitorProps> = ({
  hrv,
  respiratoryRate,
  cognitiveStressIndex,
  bioResonanceSupportFrequency,
  setBioResonanceSupportFrequency,
  volume,
  setVolume
}) => {

  const getCognitiveStressLabel = () => {
    if (cognitiveStressIndex > 0.8) return "CRITICAL";
    if (cognitiveStressIndex > 0.6) return "HIGH";
    if (cognitiveStressIndex > 0.4) return "MODERATE";
    return "NOMINAL";
  };

  const bioHarmonicFrequencies = [
    { name: 'Focus', freq: 40 },
    { name: 'Calm', freq: 10 },
    { name: 'Alertness', freq: 15 },
    { name: 'Stress Inoculation', freq: 4 },
  ];

  return (
    <div className="h-full border border-current/30 bg-black/40 backdrop-blur-sm p-4 space-y-4">
      <div className="font-bold border-b border-current/30 pb-2">OPERATOR VITALS & COGNITIVE LOAD MONITOR</div>

      <div className="space-y-2">
        <div className="opacity-70 flex justify-between">
          <span>HEART RATE VARIABILITY (HRV)</span>
          <span className="text-cyan-400">{hrv.toFixed(2)} ms</span>
        </div>
        <div className="opacity-70 flex justify-between">
          <span>RESPIRATORY RATE</span>
          <span className="text-cyan-400">{respiratoryRate.toFixed(1)} bpm</span>
        </div>
        <div className="opacity-70 flex justify-between">
          <span>COGNITIVE STRESS INDEX</span>
          <span className="text-cyan-400">{getCognitiveStressLabel()}</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="opacity-70">BIO-RESONANCE SUPPORT</div>
        <div className="text-2xl font-mono">{bioResonanceSupportFrequency} Hz</div>
        <div className="flex space-x-2 flex-wrap">
          {bioHarmonicFrequencies.map(f => (
            <Button key={f.freq} variant={bioResonanceSupportFrequency === f.freq ? "default" : "outline"} size="sm" onClick={() => setBioResonanceSupportFrequency(f.freq)}>{f.name}</Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="opacity-70">VOLUME</div>
        <Slider value={[volume * 100]} max={100} step={1} onValueChange={(value) => setVolume(value[0] / 100)} />
      </div>

      <div className="space-y-2 pt-4 border-t border-current/30">
        <div className="opacity-70">BIO-HARMONIC FREQUENCIES</div>
        <p className="text-xs opacity-80">
          Targeted frequencies designed to aid in stress recovery or heighten focus. Each frequency has a specific neuro-enhancement purpose.
        </p>
      </div>
    </div>
  );
};

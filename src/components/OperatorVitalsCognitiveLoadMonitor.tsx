import React from 'react';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { getTelemetryAssessment, MissionSeverity, TelemetryTrend } from '@/lib/missionUx';

interface OperatorVitalsCognitiveLoadMonitorProps {
  hrv: number;
  respiratoryRate: number;
  cognitiveStressIndex: number;
  previousCognitiveStressIndex?: number;
  bioResonanceSupportFrequency: number;
  setBioResonanceSupportFrequency: (frequency: number) => void;
  volume: number;
  setVolume: (volume: number) => void;
}

const severityClass: Record<MissionSeverity, string> = {
  nominal: 'border-emerald-400/35 bg-emerald-500/10 text-emerald-200',
  watch: 'border-amber-400/45 bg-amber-500/10 text-amber-200',
  critical: 'border-red-400/55 bg-red-500/15 text-red-200',
};

const trendIcon: Record<TelemetryTrend, React.ReactNode> = {
  down: <TrendingDown className="h-4 w-4" />,
  flat: <Minus className="h-4 w-4" />,
  up: <TrendingUp className="h-4 w-4" />,
};

export const OperatorVitalsCognitiveLoadMonitor: React.FC<OperatorVitalsCognitiveLoadMonitorProps> = React.memo(({
  hrv,
  respiratoryRate,
  cognitiveStressIndex,
  previousCognitiveStressIndex,
  bioResonanceSupportFrequency,
  setBioResonanceSupportFrequency,
  volume,
  setVolume,
}) => {
  const assessment = getTelemetryAssessment({
    hrv,
    respiratoryRate,
    cognitiveStressIndex,
    previousCognitiveStressIndex,
  });

  const bioHarmonicFrequencies = [
    { name: 'Focus', freq: 40 },
    { name: 'Calm', freq: 10 },
    { name: 'Alertness', freq: 15 },
    { name: 'Stress Inoculation', freq: 4 },
  ];

  return (
    <div className="h-full border border-current/25 bg-black/45 backdrop-blur-sm p-4 space-y-4">
      <div className="flex items-start justify-between gap-3 border-b border-current/25 pb-2">
        <div className="font-bold uppercase leading-tight">Operator Vitals</div>
        <div className={`flex items-center gap-1 border px-2 py-1 text-[10px] uppercase ${severityClass[assessment.severity]}`}>
          {trendIcon[assessment.trend]}
          {assessment.stressLabel}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="border border-current/15 bg-white/[0.03] p-2">
          <div className="text-current/50">HRV</div>
          <div className="text-sm text-cyan-200">{hrv.toFixed(1)} ms</div>
          <div className="text-[10px] text-current/55">{assessment.hrvStatus}</div>
        </div>
        <div className="border border-current/15 bg-white/[0.03] p-2">
          <div className="text-current/50">Respiration</div>
          <div className="text-sm text-cyan-200">{respiratoryRate.toFixed(1)} bpm</div>
          <div className="text-[10px] text-current/55">{assessment.respiratoryStatus}</div>
        </div>
        <div className="border border-current/15 bg-white/[0.03] p-2">
          <div className="text-current/50">Stress</div>
          <div className="text-sm text-cyan-200">{(cognitiveStressIndex * 100).toFixed(0)}%</div>
          <div className="text-[10px] text-current/55">Trend {assessment.trend}</div>
        </div>
      </div>

      <div className={`border px-3 py-2 text-xs ${severityClass[assessment.severity]}`}>
        <div className="font-semibold uppercase">Recommended Response</div>
        <div className="mt-1 text-current/75">{assessment.recommendation}</div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs uppercase text-current/60">
          <span>Bio-resonance Support</span>
          <span className="text-cyan-200">{bioResonanceSupportFrequency} Hz</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {bioHarmonicFrequencies.map((frequency) => (
            <Button
              key={frequency.freq}
              variant={bioResonanceSupportFrequency === frequency.freq ? 'default' : 'outline'}
              size="sm"
              onClick={() => setBioResonanceSupportFrequency(frequency.freq)}
              className="h-auto min-h-8 whitespace-normal px-2 py-1 text-[11px]"
            >
              {frequency.name}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs uppercase text-current/60">
          <span>Tone Volume</span>
          <span>{Math.round(volume * 100)}%</span>
        </div>
        <Slider value={[volume * 100]} max={100} step={1} onValueChange={(value) => setVolume(value[0] / 100)} />
      </div>
    </div>
  );
});
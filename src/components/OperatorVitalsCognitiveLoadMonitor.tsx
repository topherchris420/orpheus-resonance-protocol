import React from 'react';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { SignalBadge } from '@/components/common/ProvenanceBadge';
import { getTelemetryAssessment, MissionSeverity, TelemetryTrend } from '@/lib/missionUx';

interface OperatorVitalsCognitiveLoadMonitorProps {
  hrv: number;
  respiratoryRate: number;
  cognitiveStressIndex: number;
  previousCognitiveStressIndex?: number;
  displayMarker: number;
  setDisplayMarker: (frequency: number) => void;
  volume: number;
  setVolume: (volume: number) => void;
}

const severityClass: Record<MissionSeverity, string> = {
  nominal: 'border-o-teal/50 text-o-teal-strong',
  watch: 'border-o-amber/60 text-o-amber',
  critical: 'border-o-red/60 text-o-red',
};

const trendIcon: Record<TelemetryTrend, React.ReactNode> = {
  down: <TrendingDown aria-hidden="true" className="h-4 w-4" />,
  flat: <Minus aria-hidden="true" className="h-4 w-4" />,
  up: <TrendingUp aria-hidden="true" className="h-4 w-4" />,
};

const MARKERS = [4, 10, 15, 40];

/** Generated vitals of the fictional operator character. Nothing here measures the person using Orpheus. */
export const OperatorVitalsCognitiveLoadMonitor: React.FC<OperatorVitalsCognitiveLoadMonitorProps> = React.memo(
  ({ hrv, respiratoryRate, cognitiveStressIndex, previousCognitiveStressIndex, displayMarker, setDisplayMarker, volume, setVolume }) => {
    const assessment = getTelemetryAssessment({ hrv, respiratoryRate, cognitiveStressIndex, previousCognitiveStressIndex });
    return (
      <section aria-label="Simulated operator vitals" className="h-full space-y-4 rounded-xl border border-o-line bg-o-s1 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-o-line pb-2">
          <h3 className="text-sm font-semibold text-o-text">Fictional operator vitals</h3>
          <div className="flex items-center gap-2">
            <SignalBadge category="simulated" />
            <span className={`o-chip ${severityClass[assessment.severity]}`}>
              {trendIcon[assessment.trend]}
              {assessment.stressLabel}
              <span className="sr-only">, trend {assessment.trend}</span>
            </span>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-lg border border-o-line bg-o-s2 p-2">
            <dt className="text-o-text3">HRV</dt>
            <dd className="font-mono text-sm text-o-text">{hrv.toFixed(1)} ms</dd>
            <dd className="text-o-text3">{assessment.hrvStatus}</dd>
          </div>
          <div className="rounded-lg border border-o-line bg-o-s2 p-2">
            <dt className="text-o-text3">Respiration</dt>
            <dd className="font-mono text-sm text-o-text">{respiratoryRate.toFixed(1)} /min</dd>
            <dd className="text-o-text3">{assessment.respiratoryStatus}</dd>
          </div>
          <div className="rounded-lg border border-o-line bg-o-s2 p-2">
            <dt className="text-o-text3">Modeled stress</dt>
            <dd className="font-mono text-sm text-o-text">{Math.round(cognitiveStressIndex * 100)}%</dd>
            <dd className="text-o-text3">Trend {assessment.trend}</dd>
          </div>
        </dl>
        <p className={`rounded-lg border px-3 py-2 text-xs ${severityClass[assessment.severity]}`}>{assessment.recommendation}</p>
        <div className="space-y-2">
          <p className="flex justify-between text-xs text-o-text3">
            <span>Display marker</span>
            <span className="font-mono text-o-text">{displayMarker} Hz</span>
          </p>
          <div role="group" aria-label="Display marker presets" className="grid grid-cols-4 gap-1.5">
            {MARKERS.map((marker) => (
              <button key={marker} type="button" className="o-button min-h-9 px-2 text-xs" aria-pressed={displayMarker === marker} onClick={() => setDisplayMarker(marker)}>
                {marker} Hz
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <p className="flex justify-between text-xs text-o-text3">
            <span>Tone volume (only while audio is on)</span>
            <span className="font-mono text-o-text">{Math.round(volume * 100)}%</span>
          </p>
          <Slider label="Tone volume" valueText={(value) => `${value} percent`} value={[volume * 100]} max={20} step={1} onValueChange={(value) => setVolume(value[0] / 100)} />
        </div>
      </section>
    );
  },
);

OperatorVitalsCognitiveLoadMonitor.displayName = 'OperatorVitalsCognitiveLoadMonitor';

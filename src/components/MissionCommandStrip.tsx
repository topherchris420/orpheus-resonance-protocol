import React from 'react';
import { Activity, AlertOctagon, AlertTriangle, ArrowRight, CheckCircle2, RadioTower } from 'lucide-react';
import { MissionSeverity, MissionUxState } from '@/lib/missionUx';

interface MissionCommandStripProps {
  mission: MissionUxState;
  pulseRate: number;
  coherenceLevel: number;
  activeFrequency: number;
}

const SEVERITY: Record<MissionSeverity, { className: string; label: string; icon: typeof Activity }> = {
  nominal: { className: 'border-o-teal/50 text-o-teal-strong', label: 'Nominal', icon: CheckCircle2 },
  watch: { className: 'border-o-amber/60 text-o-amber', label: 'Watch', icon: AlertTriangle },
  critical: { className: 'border-o-red/60 text-o-red', label: 'Attention', icon: AlertOctagon },
};

export const MissionCommandStrip: React.FC<MissionCommandStripProps> = React.memo(({ mission, pulseRate, coherenceLevel, activeFrequency }) => {
  const severity = SEVERITY[mission.threatLevel];
  const Icon = severity.icon;
  return (
    <section aria-label="Mission status" className="rounded-xl border border-o-line bg-o-s1 px-4 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-o-text3">
            <span>{mission.phaseLabel}</span>
            <span aria-hidden="true">/</span>
            <span>{mission.modeLabel}</span>
            <span className={`o-chip ${severity.className}`}>
              <Icon aria-hidden="true" className="h-3.5 w-3.5" />
              {severity.label}
            </span>
            <span className="o-chip border-dashed border-o-text3/70 text-o-text2">Simulated · microphone audio only</span>
          </div>
          <p className="mt-1 flex items-center gap-2 text-sm font-medium text-o-text">
            <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-o-teal" />
            {mission.nextAction}
          </p>
        </div>
        <dl className="grid shrink-0 grid-cols-3 gap-2 text-xs text-o-text3 lg:w-[30rem]">
          <div className="rounded-lg border border-o-line bg-o-s2 px-2 py-1.5">
            <dt className="flex items-center gap-1">
              <Activity aria-hidden="true" className="h-3.5 w-3.5" /> Simulated pulse
            </dt>
            <dd className="font-mono text-sm text-o-text">{Math.round(pulseRate)} bpm</dd>
          </div>
          <div className="rounded-lg border border-o-line bg-o-s2 px-2 py-1.5">
            <dt>Modeled cohesion</dt>
            <dd className="font-mono text-sm text-o-text">{Math.round(coherenceLevel * 100)}%</dd>
          </div>
          <div className="rounded-lg border border-o-line bg-o-s2 px-2 py-1.5">
            <dt className="flex items-center gap-1">
              <RadioTower aria-hidden="true" className="h-3.5 w-3.5" /> Display marker
            </dt>
            <dd className="font-mono text-sm text-o-text">{activeFrequency.toFixed(1)} Hz</dd>
          </div>
        </dl>
      </div>
    </section>
  );
});

MissionCommandStrip.displayName = 'MissionCommandStrip';

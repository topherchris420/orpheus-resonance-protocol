import React from 'react';
import { Activity, ArrowRight, RadioTower, ShieldAlert } from 'lucide-react';
import { MissionSeverity, MissionUxState } from '@/lib/missionUx';

interface MissionCommandStripProps {
  mission: MissionUxState;
  pulseRate: number;
  coherenceLevel: number;
  activeFrequency: number;
}

const severityStyles: Record<MissionSeverity, string> = {
  nominal: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
  watch: 'border-amber-400/50 bg-amber-500/10 text-amber-100',
  critical: 'border-red-400/60 bg-red-500/15 text-red-100',
};

const severityLabel: Record<MissionSeverity, string> = {
  nominal: 'Nominal',
  watch: 'Watch',
  critical: 'Action',
};

export const MissionCommandStrip: React.FC<MissionCommandStripProps> = React.memo(({
  mission,
  pulseRate,
  coherenceLevel,
  activeFrequency,
}) => {
  return (
    <section className="col-span-12 row-span-1 border border-current/20 bg-black/65 backdrop-blur-md px-4 py-3">
      <div className="flex h-full min-h-0 flex-col justify-center gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center border ${severityStyles[mission.threatLevel]}`}>
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-current/70">
              <span>{mission.phaseLabel}</span>
              <span className="opacity-40">/</span>
              <span>{mission.modeLabel}</span>
              <span className={`border px-1.5 py-0.5 ${severityStyles[mission.threatLevel]}`}>
                {severityLabel[mission.threatLevel]}
              </span>
            </div>
            <div className="mt-1 flex min-w-0 items-center gap-2 text-sm font-semibold text-white">
              <ArrowRight className="h-4 w-4 shrink-0 text-cyan-300" />
              <span className="truncate">{mission.nextAction}</span>
            </div>
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-3 gap-2 text-[11px] uppercase text-current/75 lg:w-[460px]">
          <div className="border border-current/15 bg-white/[0.03] px-2 py-1.5">
            <div className="flex items-center gap-1 text-current/50">
              <Activity className="h-3.5 w-3.5" />
              Pulse
            </div>
            <div className="text-sm text-cyan-200">{Math.round(pulseRate)} bpm</div>
          </div>
          <div className="border border-current/15 bg-white/[0.03] px-2 py-1.5">
            <div className="text-current/50">Cohesion</div>
            <div className="text-sm text-cyan-200">{(coherenceLevel * 100).toFixed(0)}%</div>
          </div>
          <div className="border border-current/15 bg-white/[0.03] px-2 py-1.5">
            <div className="flex items-center gap-1 text-current/50">
              <RadioTower className="h-3.5 w-3.5" />
              Support
            </div>
            <div className="text-sm text-cyan-200">{activeFrequency.toFixed(1)} Hz</div>
          </div>
        </div>
      </div>
    </section>
  );
});

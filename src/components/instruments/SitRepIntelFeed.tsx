import React from 'react';
import { AlertOctagon, AlertTriangle, Info, Radio } from 'lucide-react';
import { formatSimTime } from '@/engine/clock';
import type { IntelItem } from '@/engine/mission/types';

interface SitRepIntelFeedProps {
  intel: IntelItem[];
  currentClearance: number;
  tickSeconds?: number;
}

const PRIORITY = {
  CRITICAL: { icon: AlertOctagon, className: 'border-o-red/60 text-o-red', label: 'Critical' },
  HIGH: { icon: AlertTriangle, className: 'border-o-amber/60 text-o-amber', label: 'High' },
  MEDIUM: { icon: Info, className: 'border-o-sky/50 text-o-sky', label: 'Medium' },
  LOW: { icon: Info, className: 'border-o-line-strong text-o-text3', label: 'Low' },
} as const;

const ORIGIN_LABEL: Record<IntelItem['origin'], string> = {
  generated: 'Generated report',
  command: 'Your recorded course',
  'red-team': 'Red-team injection',
};

/** The generated report feed. Reports are fiction; red-team injections are labeled as such. */
export const SitRepIntelFeed: React.FC<SitRepIntelFeedProps> = React.memo(({ intel, currentClearance, tickSeconds = 1 }) => {
  const visible = intel.filter((item) => item.clearance <= currentClearance).slice().reverse();
  return (
    <section aria-label="Latest reports" className="flex h-full min-h-0 flex-col rounded-xl border border-o-line bg-o-s1 p-4">
      <div className="flex items-center gap-2 border-b border-o-line pb-2">
        <Radio aria-hidden="true" className="h-4 w-4 text-o-teal" />
        <h3 className="text-sm font-semibold text-o-text">Latest reports</h3>
        <span className="ml-auto text-xs text-o-text3">Simulated feed</span>
      </div>
      <ol className="mt-3 min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
        {visible.length === 0 && <li className="text-sm text-o-text3">No reports yet. Let simulated time run to receive fictional reports.</li>}
        {visible.map((item) => {
          const { icon: Icon, className, label } = PRIORITY[item.priority];
          return (
            <li key={item.id} className="rounded-lg border border-o-line bg-o-s2 p-2.5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-o-text3">
                <span className={`o-chip ${className}`}>
                  <Icon aria-hidden="true" className="h-3 w-3" />
                  {label}
                </span>
                <span>{item.source}</span>
                <span>· {ORIGIN_LABEL[item.origin]}</span>
                <span className="ml-auto font-mono">{formatSimTime(item.tick, tickSeconds)}</span>
              </div>
              <p className="mt-1.5 text-sm text-o-text2">{item.message}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
});

SitRepIntelFeed.displayName = 'SitRepIntelFeed';

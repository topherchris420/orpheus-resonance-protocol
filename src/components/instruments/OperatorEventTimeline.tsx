import React from 'react';
import { AlertOctagon, AlertTriangle, Clock3, Info } from 'lucide-react';
import { formatSimTime } from '@/engine/clock';
import type { TimelineEvent } from '@/engine/mission/types';

interface OperatorEventTimelineProps {
  events: TimelineEvent[];
  tickSeconds?: number;
}

const SEVERITY = {
  nominal: { icon: Info, className: 'border-o-teal/50 text-o-teal-strong', label: 'Nominal' },
  watch: { icon: AlertTriangle, className: 'border-o-amber/60 text-o-amber', label: 'Watch' },
  critical: { icon: AlertOctagon, className: 'border-o-red/60 text-o-red', label: 'Critical' },
} as const;

/** The session's recorded event log, newest first, in simulated time. */
export const OperatorEventTimeline: React.FC<OperatorEventTimelineProps> = React.memo(({ events, tickSeconds = 1 }) => (
  <section aria-label="Event timeline" className="flex h-full min-h-0 flex-col rounded-xl border border-o-line bg-o-s1 p-4">
    <div className="mb-3 flex items-center justify-between border-b border-o-line pb-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-o-text">
        <Clock3 aria-hidden="true" className="h-4 w-4 text-o-teal" />
        Event timeline
      </h3>
      <span className="text-xs text-o-text3">{events.length} events</span>
    </div>
    <ol className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
      {events.length === 0 && <li className="text-xs text-o-text3">No events yet.</li>}
      {events
        .slice()
        .reverse()
        .map((event) => {
          const { icon: Icon, className, label } = SEVERITY[event.severity];
          return (
            <li key={event.id} className="rounded-lg border border-o-line bg-o-s2 px-3 py-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className={`inline-flex items-center gap-1.5 font-semibold ${className.split(' ').slice(1).join(' ')}`}>
                  <Icon aria-hidden="true" className="h-3.5 w-3.5" />
                  <span className="sr-only">{label}: </span>
                  {event.label}
                </span>
                <span className="shrink-0 font-mono text-o-text3">{formatSimTime(event.tick, tickSeconds)}</span>
              </div>
              <p className="mt-1 text-o-text2">{event.detail}</p>
            </li>
          );
        })}
    </ol>
  </section>
));

OperatorEventTimeline.displayName = 'OperatorEventTimeline';

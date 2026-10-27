import React from 'react';
import { Clock3 } from 'lucide-react';
import { MissionSeverity, OperatorEvent } from '@/lib/missionUx';

interface OperatorEventTimelineProps {
  events: OperatorEvent[];
}

const severityClass: Record<MissionSeverity, string> = {
  nominal: 'border-emerald-400/30 text-emerald-200',
  watch: 'border-amber-400/40 text-amber-200',
  critical: 'border-red-400/50 text-red-200',
};

const formatTime = (timestamp: number): string => {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(timestamp);
};

export const OperatorEventTimeline: React.FC<OperatorEventTimelineProps> = React.memo(({ events }) => {
  return (
    <div className="h-full border border-current/25 bg-black/45 p-4 backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between border-b border-current/20 pb-2">
        <div className="flex items-center gap-2 text-sm font-bold uppercase">
          <Clock3 className="h-4 w-4" />
          Operator Event Timeline
        </div>
        <span className="text-[10px] uppercase text-current/50">{events.length} events</span>
      </div>

      <div className="max-h-[calc(100%-2.25rem)] space-y-2 overflow-y-auto pr-1">
        {events.length === 0 ? (
          <div className="border border-current/15 bg-white/[0.03] p-3 text-xs text-current/60">
            Event stream is waiting for operator activity.
          </div>
        ) : (
          events.map((event) => (
            <div key={event.id} className={`border-l-2 bg-white/[0.03] px-3 py-2 text-xs ${severityClass[event.severity]}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold uppercase tracking-wide">{event.label}</span>
                <span className="shrink-0 text-current/45">{formatTime(event.timestamp)}</span>
              </div>
              <div className="mt-1 text-current/70">{event.detail}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
});

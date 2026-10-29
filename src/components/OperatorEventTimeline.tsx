import React from 'react';
import { Clock3, Link2 } from 'lucide-react';
import type { TimelineEvent } from '@/engine/mission/types';
import type { MissionSeverity } from '@/lib/missionUx';
import { formatElapsed } from '@/tradecraft/dtg';

interface OperatorEventTimelineProps {
  events: TimelineEvent[];
  tickSeconds: number;
  /** Hash-chain seal of the command log: entries and fingerprint of the head. */
  chain: { entries: number; fingerprint: string };
  onInspectChain?: () => void;
}

const severityClass: Record<MissionSeverity, string> = {
  nominal: 'border-emerald-400/30 text-emerald-200',
  watch: 'border-amber-400/40 text-amber-200',
  critical: 'border-red-400/50 text-red-200',
};

/** The session's recorded events, newest first, in mission elapsed time. */
export const OperatorEventTimeline: React.FC<OperatorEventTimelineProps> = React.memo(({ events, tickSeconds, chain, onInspectChain }) => (
  <section aria-labelledby="timeline-heading" className="flex h-full min-h-0 flex-col border border-current/25 bg-black/45 px-3 py-2 2xl:p-4">
    <div className="mb-2 flex items-center justify-between gap-2 border-b border-current/20 pb-1.5">
      <h2 id="timeline-heading" className="flex min-w-0 items-center gap-2 text-xs font-bold uppercase 2xl:text-sm">
        <Clock3 className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="truncate">Operator Event Timeline</span>
        <span className="shrink-0 font-normal text-current/75">· {events.length}</span>
      </h2>
      <button
        type="button"
        onClick={onInspectChain}
        className="flex shrink-0 items-center gap-1 text-[10px] uppercase tracking-wider text-current/80 hover:text-current"
        title="Each recorded command is SHA-256 chained to the one before it. Click to inspect the seal."
        aria-label={`Hash chain: ${chain.entries} entries, head ${chain.fingerprint}. Inspect the seal.`}
      >
        <Link2 className="h-3 w-3" aria-hidden="true" />#{String(chain.entries).padStart(4, '0')}
        <span className="hidden 2xl:inline">{chain.fingerprint}</span>
      </button>
    </div>
    <ol aria-label="Recorded events, newest first" tabIndex={0} className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
      {events.length === 0 ? (
        <li className="border border-current/15 bg-white/[0.03] p-3 text-xs text-current/75">Event stream is waiting for operator activity.</li>
      ) : (
        events
          .slice()
          .reverse()
          .map((event) => (
            <li key={event.id} className={`border-l-2 bg-white/[0.03] px-3 py-2 text-xs ${severityClass[event.severity]}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold uppercase tracking-wide">{event.label}</span>
                <span className="shrink-0 text-current/75">{formatElapsed(event.tick, tickSeconds)}</span>
              </div>
              <div className="mt-1 text-current/85">{event.detail}</div>
            </li>
          ))
      )}
    </ol>
  </section>
));

OperatorEventTimeline.displayName = 'OperatorEventTimeline';

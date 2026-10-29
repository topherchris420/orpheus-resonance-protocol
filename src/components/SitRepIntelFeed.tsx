import React from 'react';
import type { FeedLine } from '@/command-room/model';
import { CREDIBILITY_LABEL, RELIABILITY_LABEL } from '@/tradecraft/admiralty';

interface SitRepIntelFeedProps {
  feed: FeedLine[];
  /** Rendered in the panel header, e.g. tabs that share this slot. */
  header?: React.ReactNode;
}

const PRIORITY_TEXT = {
  CRITICAL: 'text-red-400',
  HIGH: 'text-yellow-400',
  MEDIUM: 'text-blue-300',
  LOW: 'text-green-400',
} as const;

const PRIORITY_BORDER = {
  CRITICAL: 'border-red-500/70',
  HIGH: 'border-yellow-500/70',
  MEDIUM: 'border-current/30',
  LOW: 'border-current/30',
} as const;

const gradeTitle = (entry: FeedLine) =>
  entry.grade.kind === 'own'
    ? entry.grade.basis
    : `${entry.code}: ${RELIABILITY_LABEL[entry.grade.reliability]} source, ${CREDIBILITY_LABEL[entry.grade.credibility].toLowerCase()}. ${entry.grade.basis}`;

/** SITREP/INTEL feed, newest first. Precedence, Admiralty grade and clearance are printed on every report. */
export const SitRepIntelFeed: React.FC<SitRepIntelFeedProps> = React.memo(({ feed, header }) => (
  <section aria-label="SITREP/Intel feed" className="flex h-full min-h-0 flex-col border border-current/30 bg-black/40 p-4">
    <div className="mb-4 flex items-center justify-between gap-2 border-b border-current/30 pb-2">
      {header ?? <h2 className="font-bold">SITREP/INTEL FEED</h2>}
      <span className="shrink-0 text-[10px] uppercase text-current/75">{feed.length} {feed.length === 1 ? 'report' : 'reports'}</span>
    </div>
    <div role="region" aria-label="Reports, newest first" tabIndex={0} className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
      {feed.length === 0 && <p className="text-xs text-current/75">Awaiting traffic. First reports arrive within seconds.</p>}
      {feed.map((entry) => (
        <article key={entry.item.id} className={`border bg-black/30 p-2 ${entry.item.origin === 'red-team' ? 'border-red-500/70' : PRIORITY_BORDER[entry.item.priority]}`}>
          <div className="flex flex-wrap justify-between gap-x-2 text-xs text-current/80">
            <span>
              {entry.dtg} · {entry.elapsed}
            </span>
            <div className="flex flex-wrap gap-2">
              <span className={PRIORITY_TEXT[entry.item.priority]} title={entry.precedence.handling}>
                [{entry.precedence.label}]
              </span>
              <span title={gradeTitle(entry)}>{entry.code}</span>
              <span>CLR {entry.item.clearance}</span>
              <span>({entry.item.source})</span>
            </div>
          </div>
          <p className="mt-1 text-sm">{entry.item.message}</p>
        </article>
      ))}
    </div>
  </section>
));

SitRepIntelFeed.displayName = 'SitRepIntelFeed';

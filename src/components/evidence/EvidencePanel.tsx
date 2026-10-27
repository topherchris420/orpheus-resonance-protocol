import { AlertTriangle, Clock3, Copy, FileWarning, Megaphone, ShieldQuestion, Split } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { InfoTip } from '@/components/common/InfoTip';
import { ProvenanceBadge } from '@/components/common/ProvenanceBadge';
import { formatAge } from '@/engine/clock';
import { payloadDigest, RELIABILITY_LABEL } from '@/evidence/sources';
import type { EvidenceContext, EvidenceItem, EvidenceReport, ItemAssessment } from '@/evidence/types';

interface Flag {
  key: string;
  icon: typeof AlertTriangle;
  text: string;
  tone: 'warn' | 'info';
}

/** Facts about an item's data quality, phrased as observations rather than conclusions. */
const flagsFor = (item: EvidenceItem, assessment: ItemAssessment | undefined, context: EvidenceContext, byId: Map<string, EvidenceItem>): Flag[] => {
  const flags: Flag[] = [];
  const source = item.sourceId ? context.sources.find((candidate) => candidate.id === item.sourceId) : undefined;
  if (item.kind !== 'assumption' && item.kind !== 'derived' && payloadDigest(item.payload) !== item.digest) {
    flags.push({ key: 'integrity', icon: FileWarning, text: 'Integrity check failed: contents changed after sending.', tone: 'warn' });
  }
  if (item.relayOf) {
    const original = byId.get(item.relayOf);
    flags.push({ key: 'relay', icon: Copy, text: `Relayed copy${original ? ` of “${original.title}”` : ''}: same origin, not independent.`, tone: 'warn' });
  }
  if (item.claim !== undefined && (!source || source.reliability === 'F')) {
    flags.push({ key: 'unverifiable', icon: ShieldQuestion, text: 'Source has no reliability record.', tone: 'warn' });
  }
  const shift = source ? context.shifts.find((candidate) => candidate.sourceId === source.id && item.observedAtTick >= candidate.fromTick) : undefined;
  if (shift) flags.push({ key: 'shift', icon: ShieldQuestion, text: `Source record no longer applies: ${shift.note}`, tone: 'warn' });
  if (item.selfReportedConfidence === 'high' && source && !['A', 'B'].includes(source.reliability)) {
    flags.push({ key: 'confidence', icon: Megaphone, text: `Claims high confidence; source is graded ${source.reliability}.`, tone: 'warn' });
  }
  if (assessment?.exclusion === 'expired') flags.push({ key: 'expired', icon: Clock3, text: 'Too old to describe the present.', tone: 'warn' });
  else if (assessment?.flags.includes('stale')) flags.push({ key: 'stale', icon: Clock3, text: 'Aging: the situation may have changed since.', tone: 'warn' });
  if (assessment?.flags.includes('conflicting')) flags.push({ key: 'conflict', icon: Split, text: 'Disagrees with another report.', tone: 'info' });
  return flags;
};

export interface EvidencePanelProps {
  context: EvidenceContext;
  report: EvidenceReport;
  showQualityFlags: boolean;
  onInspect?: (evidenceId: string) => void;
  highlightIds?: string[];
  headingLevel?: 'h2' | 'h3';
  footer?: ReactNode;
}

export const EvidencePanel = ({ context, report, showQualityFlags, onInspect, highlightIds = [], headingLevel = 'h3', footer }: EvidencePanelProps) => {
  const byId = useMemo(() => new Map(context.items.map((item) => [item.id, item])), [context.items]);
  const assessments = useMemo(() => new Map(report.items.map((assessment) => [assessment.id, assessment])), [report.items]);
  const hypothesis = (id: string) => context.hypotheses.find((candidate) => candidate.id === id);
  const claimBearing = context.items.filter((item) => item.claim !== undefined && item.kind !== 'ai-statement');
  const contextItems = context.items.filter((item) => item.claim === undefined || item.kind === 'derived' || item.kind === 'assumption');
  const Heading = headingLevel;

  const renderItem = (item: EvidenceItem) => {
    const source = item.sourceId ? context.sources.find((candidate) => candidate.id === item.sourceId) : undefined;
    const assessment = assessments.get(item.id);
    const flags = showQualityFlags ? flagsFor(item, assessment, context, byId) : [];
    const age = Math.max(0, context.nowTick - item.observedAtTick);
    const claim = item.claim ? hypothesis(item.claim) : undefined;
    const titleId = `evidence-${item.id.replace(/[^a-zA-Z0-9-]/g, '-')}`;
    return (
      <li key={item.id}>
        <article
          aria-labelledby={titleId}
          className={`rounded-lg border bg-o-s2 p-3.5 ${highlightIds.includes(item.id) ? 'o-highlight border-o-teal/60' : 'border-o-line'}`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <ProvenanceBadge kind={item.kind} />
            {source && (
              <span className="text-xs text-o-text3">
                {source.label} · Grade {source.reliability} ({RELIABILITY_LABEL[source.reliability].toLowerCase()})
              </span>
            )}
            <span className="ml-auto text-xs text-o-text3">{item.kind === 'assumption' ? 'Premise' : `${formatAge(age, context.tickSeconds)} ago`}</span>
          </div>
          <h4 id={titleId} className="mt-2 text-sm font-semibold text-o-text">
            {item.title}
          </h4>
          <p className="mt-1 text-sm leading-relaxed text-o-text2">{item.text}</p>
          {claim && (
            <p className="mt-2 text-xs text-o-text3">
              Asserts: <span className="font-medium text-o-text">{claim.short}</span>
            </p>
          )}
          {item.parents && item.parents.length > 0 && (
            <p className="mt-2 text-xs text-o-text3">Computed from: {item.parents.map((parent) => byId.get(parent)?.title ?? parent).join(', ')}</p>
          )}
          {flags.length > 0 && (
            <ul className="mt-2 space-y-1" aria-label="Data-quality notes">
              {flags.map(({ key, icon: Icon, text, tone }) => (
                <li key={key} className={`flex items-start gap-1.5 text-xs ${tone === 'warn' ? 'text-o-amber' : 'text-o-text2'}`}>
                  <Icon aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          )}
          <details
            className="mt-2 text-xs text-o-text3"
            onToggle={(event) => {
              if ((event.currentTarget as HTMLDetailsElement).open) onInspect?.(item.id);
            }}
          >
            <summary className="cursor-pointer select-none text-o-text3 hover:text-o-text2">Inspect provenance</summary>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <dt>Kind</dt>
              <dd>{item.kind}</dd>
              <dt>Observed</dt>
              <dd>{formatAge(age, context.tickSeconds)} ago (tick {item.observedAtTick})</dd>
              <dt>Received</dt>
              <dd>{formatAge(Math.max(0, item.receivedAtTick - item.observedAtTick), context.tickSeconds)} after observation</dd>
              <dt>Origin</dt>
              <dd className="break-all font-mono">{item.originId}</dd>
              <dt>Digest</dt>
              <dd className="break-all font-mono">
                {item.digest} {payloadDigest(item.payload) === item.digest ? '(matches contents)' : '(does not match contents)'}
              </dd>
              {Object.entries(item.payload).map(([key, value]) => (
                <div key={key} className="contents">
                  <dt>{key}</dt>
                  <dd className="font-mono">{String(value)}</dd>
                </div>
              ))}
            </dl>
          </details>
        </article>
      </li>
    );
  };

  return (
    <section aria-label="Evidence" className="space-y-4">
      <div>
        <div className="flex items-center gap-1">
          <Heading className="text-sm font-semibold text-o-text">Reports and observations</Heading>
          <InfoTip term="reliability" />
        </div>
        <ul className="mt-2 space-y-2.5">{claimBearing.map(renderItem)}</ul>
        {claimBearing.length === 0 && <p className="mt-2 text-sm text-o-text3">No report bears on the question.</p>}
      </div>
      {report.missing.length > 0 && (
        <div>
          <div className="flex items-center gap-1">
            <Heading className="text-sm font-semibold text-o-text">Expected but missing</Heading>
            <InfoTip term="missing" />
          </div>
          <ul className="mt-2 space-y-2">
            {report.missing.map((expected) => (
              <li key={expected.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-o-line-strong p-3 text-sm text-o-text2">
                <ProvenanceBadge kind="missing" />
                {expected.label} — due {formatAge(Math.max(0, context.nowTick - expected.dueTick), context.tickSeconds)} ago, not received.
              </li>
            ))}
          </ul>
        </div>
      )}
      {contextItems.length > 0 && (
        <div>
          <Heading className="text-sm font-semibold text-o-text">Context, estimates and assumptions</Heading>
          <ul className="mt-2 space-y-2.5">{contextItems.map(renderItem)}</ul>
        </div>
      )}
      {footer}
    </section>
  );
};

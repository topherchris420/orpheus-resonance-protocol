import { Bot, CircleDashed, Eye, GitMerge, Lightbulb, MessageSquareText, type LucideIcon } from 'lucide-react';
import type { EvidenceKind } from '@/evidence/types';
import { cn } from '@/lib/utils';

type Provenance = EvidenceKind | 'missing';

/** Each provenance has its own icon, label and border style, so it never depends on color alone. */
const STYLE: Record<Provenance, { label: string; icon: LucideIcon; className: string }> = {
  observation: { label: 'Observed', icon: Eye, className: 'border-o-teal/60 text-o-teal-strong' },
  report: { label: 'Reported', icon: MessageSquareText, className: 'border-o-sky/60 text-o-sky' },
  derived: { label: 'Derived', icon: GitMerge, className: 'border-o-violet/60 text-o-violet' },
  assumption: { label: 'Assumption', icon: Lightbulb, className: 'border-dashed border-o-text3/70 text-o-text2' },
  'ai-statement': { label: 'AI statement', icon: Bot, className: 'border-o-amber/70 text-o-amber' },
  missing: { label: 'Missing', icon: CircleDashed, className: 'border-dashed border-o-text3/70 text-o-text3' },
};

export const ProvenanceBadge = ({ kind, className }: { kind: Provenance; className?: string }) => {
  const { label, icon: Icon, className: tone } = STYLE[kind];
  return (
    <span className={cn('o-chip bg-o-bg/60', tone, className)}>
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {label}
    </span>
  );
};

/** Category of a displayed signal: measured from the device, simulated, or inferred by a model. */
export const SignalBadge = ({ category }: { category: 'measured' | 'simulated' | 'inferred' }) => (
  <span
    className={cn(
      'o-chip bg-o-bg/60',
      category === 'measured' ? 'border-o-teal/60 text-o-teal-strong' : category === 'simulated' ? 'border-dashed border-o-text3/70 text-o-text2' : 'border-o-violet/60 text-o-violet',
    )}
  >
    {category === 'measured' ? 'Measured' : category === 'simulated' ? 'Simulated' : 'Inferred'}
  </span>
);

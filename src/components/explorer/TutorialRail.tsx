import { GraduationCap } from 'lucide-react';
import type { TourStep } from './tour';

export const TutorialRail = ({
  step,
  index,
  total,
  onSkip,
  onAction,
  actionLabel,
}: {
  step: TourStep;
  index: number;
  total: number;
  onSkip: () => void;
  onAction?: () => void;
  actionLabel?: string;
}) => (
  <section aria-label="Guided tour" className="border-b border-o-teal/30 bg-o-teal-dim/25">
    <div className="mx-auto flex max-w-[1680px] flex-wrap items-start gap-4 px-4 py-3 sm:px-6">
      <GraduationCap aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-o-teal" />
      <div className="min-w-0 flex-1" aria-live="polite">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-o-teal">
          Guided tour · step {index + 1} of {total}
        </p>
        <p className="mt-0.5 font-semibold text-o-text">{step.title}</p>
        <p className="mt-0.5 max-w-4xl text-sm text-o-text2">{step.body}</p>
      </div>
      <div className="flex gap-2">
        {onAction && actionLabel && (
          <button type="button" className="o-button-primary min-h-10" onClick={onAction}>
            {actionLabel}
          </button>
        )}
        <button type="button" className="o-button-quiet min-h-10" onClick={onSkip}>
          Skip tour
        </button>
      </div>
    </div>
  </section>
);

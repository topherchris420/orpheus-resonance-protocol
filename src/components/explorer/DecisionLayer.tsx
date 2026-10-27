import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Slider } from '@/components/ui/slider';
import { specFor } from '@/engine/mission/selectors';
import type { DecisionRuntime, ResolvedDecision } from '@/engine/mission/types';
import type { DecisionOption, DecisionSpec } from '@/scenarios/types';
import { useMission, type MissionStore } from '@/state/missionStore';

const points = (value: number) => {
  const scaled = Math.round(value * 100);
  return `${scaled > 0 ? '+' : ''}${scaled}`;
};

export const stanceDescription = (option: DecisionOption, spec: DecisionSpec, runtime: DecisionRuntime | undefined): string => {
  const label = (id: string) => spec.hypotheses.find((hypothesis) => hypothesis.id === id)?.short ?? id;
  switch (option.stance.kind) {
    case 'commit':
      return `Relies on: ${label(option.stance.hypothesisId)}.`;
    case 'commit-claim': {
      const evidenceId = `${spec.id}:${option.stance.evidenceId}`;
      const item = runtime?.evidence?.items.find((candidate) => candidate.id === evidenceId);
      return item?.claim ? `Relies on what “${item.title}” says (currently: ${label(item.claim)}).` : 'Relies on a specific report.';
    }
    case 'verify':
      return 'Gathers more evidence before relying on any interpretation.';
    default:
      return 'Does not depend on the open question.';
  }
};

const RISK_LABEL = { LOW: 'Low risk', MODERATE: 'Moderate risk', HIGH: 'High risk' } as const;

export const EffectsPreview = ({ option, spec }: { option: DecisionOption; spec: DecisionSpec }) => (
  <div className="mt-2 text-xs text-o-text3">
    <p>
      Modeled effects (percentage points): stress {points(option.effects.stress)}, cohesion {points(option.effects.cohesion)}, hostile pressure{' '}
      {points(option.effects.hostilePressure)}, objective {points(option.effects.objectiveProgress)}.
    </p>
    {(option.stance.kind === 'commit' || option.stance.kind === 'commit-claim') && (
      <p className="mt-0.5">
        If what it relies on is false: stress {points(spec.ifAssumptionWrong.effects.stress)}, cohesion {points(spec.ifAssumptionWrong.effects.cohesion)}, objective{' '}
        {points(spec.ifAssumptionWrong.effects.objectiveProgress)} more.
      </p>
    )}
  </div>
);

interface DecisionLayerProps {
  store: MissionStore;
  openIds: string[];
  selectedId: string | null;
  onSelect: (pointId: string) => void;
  onCommitted: (record: ResolvedDecision) => void;
}

export const DecisionLayer = ({ store, openIds, selectedId, onSelect, onCommitted }: DecisionLayerProps) => {
  const manifest = store.manifest;
  const runtime = useMission(store, (state) => state.decisions.find((decision) => decision.id === selectedId));
  const resolvedCount = useMission(store, (state) => state.resolved.length);
  const spec = selectedId ? specFor(manifest, selectedId) : undefined;
  const [optionId, setOptionId] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(70);
  const [changes, setChanges] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const startedAt = useRef(performance.now());
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setOptionId(null);
    setChanges(0);
    setConfidence(70);
    startedAt.current = performance.now();
  }, [selectedId]);

  const option = useMemo(() => spec?.options.find((candidate) => candidate.id === optionId), [optionId, spec]);

  const commit = () => {
    if (!spec || !option) return;
    const result = store.dispatch({
      type: 'commitDecision',
      pointId: spec.id,
      optionId: option.id,
      actor: 'participant',
      confidence,
      latencyMs: Math.round(performance.now() - startedAt.current),
      selectionChanges: changes,
    });
    if (!result.accepted) {
      toast.error('This decision could not be recorded', { description: result.reason });
      return;
    }
    const resolved = store.getState().resolved;
    onCommitted(resolved[resolved.length - 1]);
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="o-eyebrow">Decisions open now</p>
        {openIds.length === 0 ? (
          <p className="mt-2 text-sm text-o-text3">
            {resolvedCount > 0 ? 'No decision is open. Advance the phase for more, or open the after-action review.' : 'No decision is open yet.'}
          </p>
        ) : (
          <div role="group" aria-label="Open decisions" className="mt-2 flex flex-col gap-1.5">
            {openIds.map((id) => (
              <button key={id} type="button" className="o-button justify-start text-left" aria-pressed={selectedId === id} onClick={() => onSelect(id)}>
                {specFor(manifest, id)?.title}
              </button>
            ))}
          </div>
        )}
      </div>

      {spec && runtime?.status === 'open' && (
        <div>
          <h3 className="text-base font-semibold text-o-text">{spec.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-o-text2">{spec.situation}</p>
          <fieldset className="mt-4">
            <legend className="o-eyebrow">Courses of action</legend>
            <div className="mt-2 space-y-2">
              {spec.options.map((candidate) => (
                <label
                  key={candidate.id}
                  className={`block cursor-pointer rounded-lg border p-3 transition-colors ${optionId === candidate.id ? 'border-o-teal bg-o-teal-dim/40' : 'border-o-line bg-o-s2 hover:border-o-line-strong'}`}
                >
                  <span className="flex items-start gap-3">
                    <input
                      type="radio"
                      name={`course-${spec.id}`}
                      value={candidate.id}
                      checked={optionId === candidate.id}
                      onChange={() => {
                        if (optionId !== null && optionId !== candidate.id) setChanges((count) => count + 1);
                        setOptionId(candidate.id);
                      }}
                      className="mt-1 h-4 w-4 accent-[hsl(var(--o-teal))]"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-o-text">{candidate.title}</span>
                      <span className="mt-0.5 block text-sm text-o-text2">{candidate.consequences}</span>
                      <span className="mt-1.5 block text-xs font-medium text-o-teal-strong">{stanceDescription(candidate, spec, runtime)}</span>
                      <span className="mt-0.5 block text-xs text-o-text3">{RISK_LABEL[candidate.risk]} in the story.</span>
                      <EffectsPreview option={candidate} spec={spec} />
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-4">
            <p id={`confidence-${spec.id}`} className="text-sm text-o-text2">
              How confident are you in this decision? <span className="font-semibold text-o-text">{confidence}%</span>
            </p>
            <Slider
              aria-labelledby={`confidence-${spec.id}`}
              label="Confidence"
              valueText={(value) => `${value} percent`}
              value={[confidence]}
              min={0}
              max={100}
              step={5}
              onValueChange={([value]) => setConfidence(value)}
            />
          </div>
          <button
            type="button"
            ref={triggerRef}
            className="o-button-primary mt-3 w-full"
            disabled={!option}
            onClick={() => setConfirming(true)}
          >
            Review course →
          </button>
          {!option && <p className="mt-2 text-xs text-o-text3">Choose a course to review it.</p>}
        </div>
      )}

      <AlertDialog open={confirming && Boolean(option)} onOpenChange={setConfirming}>
        <AlertDialogContent
          className="max-h-[85vh] overflow-y-auto border-o-line-strong bg-o-s1 text-o-text"
          onCloseAutoFocus={(event) => {
            if (triggerRef.current?.isConnected) {
              event.preventDefault();
              triggerRef.current.focus({ preventScroll: true });
            }
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Commit this course?</AlertDialogTitle>
            <AlertDialogDescription className="text-o-text2">
              {spec?.title}. This records one choice for this event. Its alternatives close for the rest of this session.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {option && spec && (
            <div className="rounded-lg border border-o-line bg-o-s2 p-4">
              <h3 className="font-semibold">{option.title}</h3>
              <p className="mt-1 text-sm text-o-text2">{option.consequences}</p>
              <p className="mt-2 text-sm font-medium text-o-teal-strong">{stanceDescription(option, spec, runtime)}</p>
              <EffectsPreview option={option} spec={spec} />
              <p className="mt-2 text-xs text-o-text3">Your stated confidence: {confidence}%.</p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Keep comparing</AlertDialogCancel>
            <AlertDialogAction onClick={commit}>Confirm choice</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

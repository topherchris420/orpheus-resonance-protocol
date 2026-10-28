import { useEffect, useMemo, useRef, useState } from 'react';
import { AssistantPanel } from '@/components/evidence/AssistantPanel';
import { EvidencePanel } from '@/components/evidence/EvidencePanel';
import { Slider } from '@/components/common/Slider';
import { assessEvidence } from '@/evidence/engine';
import { PROTOCOL } from '@/experiment/protocol';
import { adviceFor, type PlannedTrial, type StageResponse } from '@/experiment/study';
import type { TrialOptionId } from '@/scenarios/taskFamily';

export interface TrialPosition {
  label: string;
  index: number;
  total: number;
}

/**
 * One stage of one trial. Assisted trials have two stages: the participant answers alone, then sees
 * the assistant's output and gives a final answer. Response time and selection changes are measured
 * here, in the browser, and recorded with the response; the engine never reads the clock.
 */
export const TrialView = ({
  trial,
  stage,
  pendingInitial,
  showQualityFlags,
  position,
  onInspect,
  onSubmit,
}: {
  trial: PlannedTrial;
  stage: 'initial' | 'final';
  pendingInitial: StageResponse | null;
  showQualityFlags: boolean;
  position: TrialPosition;
  onInspect: (evidenceId: string) => void;
  onSubmit: (response: StageResponse) => void;
}) => {
  const { spec, condition } = trial;
  const report = useMemo(() => assessEvidence(spec.context, { threshold: PROTOCOL.threshold }), [spec]);
  const showAdvice = stage === 'final' && condition !== 'A';
  const advice = useMemo(() => (showAdvice ? adviceFor(trial) : null), [showAdvice, trial]);
  const startedAt = useRef(performance.now());
  const heading = useRef<HTMLHeadingElement>(null);
  const [option, setOption] = useState<TrialOptionId | null>(stage === 'final' ? (pendingInitial?.optionId ?? null) : null);
  const [confidence, setConfidence] = useState(stage === 'final' ? (pendingInitial?.confidence ?? 50) : 50);
  const [changes, setChanges] = useState(0);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  const choose = (next: TrialOptionId) => {
    if (option !== null && option !== next) setChanges((count) => count + 1);
    setOption(next);
  };

  const initialOption = pendingInitial ? spec.options.find((candidate) => candidate.id === pendingInitial.optionId) : undefined;
  const legendId = `options-${spec.id}`;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6">
      <header className="space-y-2">
        <p className="o-eyebrow">
          {position.label} · trial {position.index} of {position.total}
          {stage === 'final' && condition !== 'A' ? ' · final answer' : ''}
        </p>
        <h1 ref={heading} tabIndex={-1} className="text-xl font-semibold text-o-text outline-none sm:text-2xl">
          {spec.context.question}
        </h1>
        <p className="max-w-3xl text-sm text-o-text2">{spec.situation}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
        <div className="o-panel p-4">
          <EvidencePanel context={spec.context} report={report} showQualityFlags={showQualityFlags} onInspect={onInspect} headingLevel="h2" />
        </div>
        <div className="space-y-4">
          {condition === 'A' ? (
            <AssistantPanel condition="A" output={null} context={spec.context} report={report} neutralLabel />
          ) : (
            <AssistantPanel
              condition={condition}
              output={advice?.output ?? null}
              context={spec.context}
              report={report}
              neutralLabel
              hiddenReason={showAdvice ? undefined : 'The assistant’s assessment appears after you give your own answer.'}
            />
          )}

          <form
            className="o-panel-raised space-y-4 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!option) return;
              onSubmit({ optionId: option, confidence: Math.round(confidence), latencyMs: Math.max(0, Math.round(performance.now() - startedAt.current)), selectionChanges: changes });
            }}
          >
            {stage === 'final' && initialOption && (
              <p className="rounded-lg border border-o-line p-3 text-sm text-o-text2">
                Your first answer: <span className="font-medium text-o-text">{initialOption.label}</span> ({pendingInitial?.confidence}% sure). Keep it or change it.
              </p>
            )}
            <fieldset aria-labelledby={legendId}>
              <legend id={legendId} className="text-sm font-semibold text-o-text">
                {showAdvice ? 'Your final answer' : 'Your answer'}
              </legend>
              <div className="mt-2 space-y-2">
                {spec.options.map((candidate) => (
                  <label
                    key={candidate.id}
                    className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors ${
                      option === candidate.id ? 'border-o-teal bg-o-teal/10 text-o-text' : 'border-o-line text-o-text2 hover:border-o-line-strong'
                    }`}
                  >
                    <input type="radio" name={`option-${spec.id}-${stage}`} value={candidate.id} checked={option === candidate.id} onChange={() => choose(candidate.id)} />
                    {candidate.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span id={`confidence-${spec.id}`} className="font-semibold text-o-text">
                  Chance that your answer is right
                </span>
                <span className="font-mono text-o-text">{Math.round(confidence)}%</span>
              </div>
              <Slider
                className="mt-2"
                min={0}
                max={100}
                step={5}
                value={[confidence]}
                onValueChange={([value]) => setConfidence(value)}
                label="Chance that your answer is right"
                valueText={(value) => `${value} percent`}
              />
              <div className="flex justify-between text-xs text-o-text3">
                <span>0% · certainly wrong</span>
                <span>50% · coin flip</span>
                <span>100% · certain</span>
              </div>
            </div>
            <button type="submit" className="o-button-primary w-full justify-center" disabled={!option}>
              {stage === 'initial' ? 'Submit and see the assistant' : showAdvice ? 'Submit final answer' : 'Submit answer'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

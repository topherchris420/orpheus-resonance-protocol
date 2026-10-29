import React, { useEffect, useState } from 'react';
import { describeGrade, effectsText, stanceText, type AnalystView, type OpenDecision } from '@/command-room/model';
import type { MissionState } from '@/engine/mission/types';
import type { DecisionOption } from '@/scenarios/types';

interface DecisionMatrixSimulatorProps {
  decisions: OpenDecision[];
  objectives: MissionState['objectives'];
  committedCount: number;
  analystFor: (pointId: string) => AnalystView | null;
  /** Records the course; returns false when the engine refused it. */
  onCommit: (pointId: string, optionId: string) => boolean;
  /** Shown when nothing is open, e.g. "Advance the phase for more". */
  emptyMessage: string;
}

const riskStyles: Record<DecisionOption['risk'], string> = {
  LOW: 'border-current/30',
  MODERATE: 'border-current/50',
  HIGH: 'border-current/70',
};

const AnalystBox = ({ analyst }: { analyst: AnalystView }) => (
  <div className={`mb-3 border p-2 text-[11px] ${analyst.status === 'assessment' ? 'border-current/40' : 'border-amber-400/50 text-amber-100'}`}>
    <div className="mb-1 text-[10px] font-semibold tracking-widest text-current/80">ANALYST ASSESSMENT · ICD 203</div>
    {analyst.status === 'assessment' ? (
      <p className="font-semibold">
        {analyst.likelihood ? `${analyst.likelihood.term} (${analyst.likelihood.range})` : 'ASSESSED'} · {analyst.headline}
      </p>
    ) : (
      <p className="font-semibold">{analyst.headline}</p>
    )}
    {analyst.likelihoodWithheld && <p className="mt-1 text-current/80">Likelihood withheld: {analyst.likelihoodWithheld}</p>}
    <p className="mt-1 text-current/85">
      CONFIDENCE {analyst.confidence.level} · {analyst.confidence.basis.join('; ')}
    </p>
    {analyst.status === 'abstention' && <p className="mt-1 text-current/85">{analyst.explanation}</p>}
    {analyst.recommendation && <p className="mt-1 text-current/85">NEXT: {analyst.recommendation}</p>}
  </div>
);

export const DecisionMatrixSimulator: React.FC<DecisionMatrixSimulatorProps> = React.memo(({ decisions, objectives, committedCount, analystFor, onCommit, emptyMessage }) => {
  const [selectedPointId, setSelectedPointId] = useState<string | null>(decisions[0]?.runtime.id ?? null);
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    if (!decisions.some((decision) => decision.runtime.id === selectedPointId)) {
      setSelectedPointId(decisions[0]?.runtime.id ?? null);
      setConfirming(null);
    }
  }, [decisions, selectedPointId]);

  const selected = decisions.find((decision) => decision.runtime.id === selectedPointId) ?? null;
  const analyst = selected ? analystFor(selected.runtime.id) : null;

  return (
    <section aria-labelledby="matrix-heading" className="flex h-full flex-col border border-current/30 bg-black/40 p-3">
      <div className="mb-2 flex items-center justify-between border-b border-current/30 pb-2 text-xs font-bold tracking-widest">
        <h2 id="matrix-heading">DECISION MATRIX SIMULATOR</h2>
        <span className="text-current/80">{committedCount} COMMITTED</span>
      </div>

      {objectives.length > 0 && (
        <div className="mb-2 grid grid-cols-3 gap-2">
          {objectives.map((objective) => (
            <div key={objective.id} className="border border-current/20 p-1.5" title={objective.detail}>
              <div className="flex items-center justify-between text-[10px] tracking-wider">
                <span className="truncate">{objective.label}</span>
                <span className="text-current/80">{Math.round(objective.progress * 100)}%</span>
              </div>
              <div className="mt-1 h-1 w-full bg-current/10" role="progressbar" aria-label={objective.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(objective.progress * 100)}>
                <div className="h-1 bg-current/60" style={{ width: `${objective.progress * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-3 sm:flex-row">
        <div className="max-h-28 min-w-0 overflow-y-auto pr-1 sm:max-h-none sm:w-1/3">
          <h3 className="mb-2 text-[10px] font-semibold tracking-widest text-current/80">CRITICAL DECISION POINTS</h3>
          <div className="space-y-2">
            {decisions.map((decision) => (
              <button
                key={decision.runtime.id}
                type="button"
                onClick={() => {
                  setSelectedPointId(decision.runtime.id);
                  setConfirming(null);
                }}
                aria-pressed={selectedPointId === decision.runtime.id}
                className={`w-full border p-2 text-left text-xs transition-colors ${selectedPointId === decision.runtime.id ? 'border-current bg-current/15' : 'border-current/20 bg-black/30'}`}
              >
                [{decision.index}] {decision.spec.title}
              </button>
            ))}
            {decisions.length === 0 && <div className="text-xs text-current/80">{emptyMessage}</div>}
          </div>
        </div>

        <div className="min-w-0 flex-1 overflow-y-auto pr-1">
          {selected ? (
            <div>
              <h3 className="text-sm font-semibold">{selected.spec.title}</h3>
              <p className="mb-2 mt-1 text-xs text-current/85">{selected.spec.situation}</p>
              <p className="mb-3 text-xs">
                <span className="text-[10px] font-semibold tracking-widest text-current/80">QUESTION </span>
                {selected.spec.question}
              </p>

              {analyst && (
                <>
                  <h4 className="mb-1 text-[10px] font-semibold tracking-widest text-current/80">INTEL BASIS · ADMIRALTY GRADED</h4>
                  <ul className="mb-3 space-y-1 text-[11px]">
                    {analyst.evidence.map((evidence) => (
                      <li
                        key={evidence.item.id}
                        className={evidence.admissible ? '' : 'text-current/75'}
                        title={evidence.grade ? `${describeGrade(evidence.grade)}. ${evidence.grade.basis}` : evidence.item.kind === 'assumption' ? 'Assumption: context, not evidence.' : 'Derived estimate: restates its inputs.'}
                      >
                        <span className="mr-1 inline-block w-7 font-semibold">{evidence.code}</span>
                        <span className="font-semibold">{evidence.item.title}</span> — {evidence.item.text}
                        {!evidence.admissible && evidence.grade && <span className="ml-1 text-[10px] uppercase">[set aside: {evidence.exclusionDetail ?? evidence.exclusion}]</span>}
                      </li>
                    ))}
                  </ul>
                  <AnalystBox analyst={analyst} />
                </>
              )}

              <h4 className="mb-2 text-[10px] font-semibold tracking-widest text-current/80">COURSES OF ACTION</h4>
              <div className="space-y-2">
                {selected.spec.options.map((option, position) => (
                  <div key={option.id} className={`border p-2 ${riskStyles[option.risk]}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold">
                        {position + 1}. {option.title}
                      </span>
                      <span className="whitespace-nowrap text-[10px] text-current/80">
                        {option.risk} · {stanceText(selected.spec, option)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-current/85">{option.consequences}</p>
                    <div className="mt-1 text-[10px] text-current/80">{effectsText(option.effects)}</div>
                    {confirming === option.id ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label={`Confirm ${option.title}`}>
                        <span className="text-[10px] tracking-widest text-current/85">IRREVOCABLE · RECORDED IN THE CHAIN</span>
                        <button
                          type="button"
                          autoFocus
                          onClick={() => {
                            setConfirming(null);
                            onCommit(selected.runtime.id, option.id);
                          }}
                          className="border border-current bg-current/15 px-2 py-1 text-[10px] font-bold tracking-widest"
                        >
                          CONFIRM COMMIT
                        </button>
                        <button type="button" onClick={() => setConfirming(null)} className="border border-current/40 px-2 py-1 text-[10px] tracking-widest">
                          CANCEL
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setConfirming(option.id)} className="mt-2 border border-current/40 px-2 py-1 text-[10px] tracking-widest" aria-label={`Commit course: ${option.title}`}>
                        COMMIT COURSE
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center text-xs text-current/80">Select a decision point to simulate outcomes.</div>
          )}
        </div>
      </div>
    </section>
  );
});

DecisionMatrixSimulator.displayName = 'DecisionMatrixSimulator';

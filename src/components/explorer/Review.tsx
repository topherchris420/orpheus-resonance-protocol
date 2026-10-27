import { CheckCircle2, CircleDot, XCircle } from 'lucide-react';
import { useMemo } from 'react';
import { CONDITION_LABEL } from '@/assistant/schema';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InfoTip } from '@/components/common/InfoTip';
import { compareAssistance } from '@/engine/mission/compare';
import { specFor } from '@/engine/mission/selectors';
import type { ResolvedDecision } from '@/engine/mission/types';
import type { ScenarioManifest } from '@/scenarios/types';
import { useMission, type MissionStore } from '@/state/missionStore';

const points = (value: number) => `${value > 0 ? '+' : ''}${Math.round(value * 100)}`;

const ResultLine = ({ decision }: { decision: ResolvedDecision }) =>
  decision.correctness === 'correct' ? (
    <span className="inline-flex items-center gap-1.5 text-o-teal-strong">
      <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> Correct conclusion · +1
    </span>
  ) : decision.correctness === 'wrong' ? (
    <span className="inline-flex items-center gap-1.5 text-o-red">
      <XCircle aria-hidden="true" className="h-4 w-4" /> Relied on something false · −4
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-o-text2">
      <CircleDot aria-hidden="true" className="h-4 w-4" /> Did not rely on an interpretation · 0
    </span>
  );

const label = (manifest: ScenarioManifest, decision: ResolvedDecision, id: string | null) => {
  if (id === null) return null;
  return specFor(manifest, decision.pointId)?.hypotheses.find((hypothesis) => hypothesis.id === id)?.label ?? id;
};

export const DecisionOutcome = ({ decision, manifest }: { decision: ResolvedDecision; manifest: ScenarioManifest }) => {
  const reliedOn = label(manifest, decision, decision.reliedOn);
  const assistant = decision.assistant;
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <div className="rounded-lg border border-o-line bg-o-s2 p-3">
        <dt className="o-eyebrow">What you chose</dt>
        <dd className="mt-1 text-o-text">{decision.optionTitle}</dd>
      </div>
      <div className="rounded-lg border border-o-line bg-o-s2 p-3">
        <dt className="o-eyebrow">What it relied on</dt>
        <dd className="mt-1 text-o-text">
          {reliedOn ?? (decision.stance.kind === 'verify' ? 'Nothing yet — it gathers more evidence first.' : 'Nothing — it does not depend on the question.')}
        </dd>
      </div>
      <div className="rounded-lg border border-o-line bg-o-s2 p-3">
        <dt className="o-eyebrow">What was true</dt>
        <dd className="mt-1 text-o-text">{label(manifest, decision, decision.truth)}</dd>
        <dd className="mt-1">
          <ResultLine decision={decision} />
        </dd>
      </div>
      <div className="rounded-lg border border-o-line bg-o-s2 p-3">
        <dt className="o-eyebrow">What was known</dt>
        <dd className="mt-1 text-o-text2">
          {decision.evidenceSufficient
            ? 'The admissible evidence was strong enough to conclude.'
            : 'The admissible evidence was not strong enough to conclude; verification was the safer course.'}
        </dd>
      </div>
      <div className="rounded-lg border border-o-line bg-o-s2 p-3 sm:col-span-2">
        <dt className="o-eyebrow">What the assistant said · {CONDITION_LABEL[decision.condition]}</dt>
        <dd className="mt-1 text-o-text2">
          {!assistant
            ? 'No assistant was active.'
            : assistant.status === 'abstention'
              ? `Declined to conclude: ${assistant.abstention?.explanation}`
              : assistant.assessment?.statement}
        </dd>
        {assistant?.uncertainty?.unknowns.length ? (
          <dd className="mt-2 text-xs text-o-text3">What remained unknown: {assistant.uncertainty.unknowns.join(' ')}</dd>
        ) : null}
      </div>
      <div className="rounded-lg border border-o-line bg-o-s2 p-3 sm:col-span-2">
        <dt className="o-eyebrow">Consequences in the story</dt>
        <dd className="mt-1 text-o-text2">{decision.narrative}</dd>
        <dd className="mt-1 text-xs text-o-text3">
          Applied (percentage points): stress {points(decision.appliedEffects.stress)}, cohesion {points(decision.appliedEffects.cohesion)}, hostile pressure{' '}
          {points(decision.appliedEffects.hostilePressure)}, objective {points(decision.appliedEffects.objectiveProgress)}
          {decision.appliedEffects.assumptionWrong ? ', including the penalty for relying on something false' : ''}.
        </dd>
      </div>
    </dl>
  );
};

export const OutcomeDialog = ({
  decision,
  manifest,
  onClose,
  onReview,
}: {
  decision: ResolvedDecision | null;
  manifest: ScenarioManifest;
  onClose: () => void;
  onReview: () => void;
}) => (
  <Dialog open={decision !== null} onOpenChange={(open) => !open && onClose()}>
    <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto border-o-line-strong bg-o-s1 text-o-text">
      <DialogHeader>
        <DialogTitle>Recorded: {decision?.optionTitle}</DialogTitle>
        <DialogDescription className="text-o-text2">{decision?.pointTitle}. Here is what happened, what was true, and what was uncertain.</DialogDescription>
      </DialogHeader>
      {decision && <DecisionOutcome decision={decision} manifest={manifest} />}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="o-button" onClick={onReview}>
          Open after-action review
        </button>
        <button type="button" className="o-button-primary" onClick={onClose}>
          Continue
        </button>
      </div>
    </DialogContent>
  </Dialog>
);

interface ReviewProps {
  store: MissionStore;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: () => void;
  onExportSummary: () => void;
  onReplay: () => void;
  onPlayAgain: (condition: 'A' | 'B' | 'C' | 'D') => void;
}

export const SessionReview = ({ store, open, onOpenChange, onExport, onExportSummary, onReplay, onPlayAgain }: ReviewProps) => {
  const state = useMission(store, (current) => current);
  const comparison = useMemo(() => (open ? compareAssistance(state, store.manifest) : null), [open, state, store.manifest]);
  const total = state.resolved.reduce((sum, decision) => sum + decision.utility, 0);
  const counts = {
    correct: state.resolved.filter((decision) => decision.correctness === 'correct').length,
    wrong: state.resolved.filter((decision) => decision.correctness === 'wrong').length,
    deferred: state.resolved.filter((decision) => decision.correctness === 'deferred').length,
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto border-o-line-strong bg-o-s1 text-o-text">
        <DialogHeader>
          <DialogTitle>After-action review</DialogTitle>
          <DialogDescription className="text-o-text2">
            Your choices, what they relied on, what was true, and how other assistants would have advised. The simulated world keeps running while you read. These values do not
            measure you.
          </DialogDescription>
        </DialogHeader>

        <section aria-label="Overview" className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-o-line bg-o-s2 p-3">
            <div className="flex items-center gap-1">
              <p className="o-eyebrow">Decision quality</p>
              <InfoTip term="utility" />
            </div>
            <p className="mt-1 text-2xl font-semibold">{total > 0 ? `+${total}` : total}</p>
            <p className="text-xs text-o-text3">over {state.resolved.length} decision(s)</p>
          </div>
          <div className="rounded-lg border border-o-line bg-o-s2 p-3">
            <p className="o-eyebrow">Correct conclusions</p>
            <p className="mt-1 text-2xl font-semibold">{counts.correct}</p>
          </div>
          <div className="rounded-lg border border-o-line bg-o-s2 p-3">
            <p className="o-eyebrow">Relied on something false</p>
            <p className="mt-1 text-2xl font-semibold">{counts.wrong}</p>
          </div>
          <div className="rounded-lg border border-o-line bg-o-s2 p-3">
            <p className="o-eyebrow">Verified or hedged</p>
            <p className="mt-1 text-2xl font-semibold">{counts.deferred}</p>
          </div>
        </section>

        <section aria-label="Objectives" className="grid gap-2 sm:grid-cols-3">
          {state.objectives.map((objective) => (
            <div key={objective.id} className="rounded-lg border border-o-line p-3">
              <p className="text-xs text-o-text3">{objective.label}</p>
              <p className="mt-1 text-lg font-semibold">{Math.round(objective.progress * 100)}%</p>
              <p className="text-xs text-o-text3">{objective.detail}</p>
            </div>
          ))}
        </section>

        {state.resolved.length === 0 ? (
          <p className="py-4 text-sm text-o-text2">No courses committed yet. Open a decision, inspect the evidence, and confirm one course. Your review will appear here.</p>
        ) : (
          <ol className="space-y-4">
            {state.resolved.map((decision, index) => (
              <li key={decision.pointId} className="rounded-xl border border-o-line p-4">
                <p className="text-xs text-o-text3">
                  {index + 1} · Phase {decision.phase} · simulated {decision.tick} s
                </p>
                <h3 className="mt-1 font-semibold">{decision.pointTitle}</h3>
                <div className="mt-3">
                  <DecisionOutcome decision={decision} manifest={store.manifest} />
                </div>
              </li>
            ))}
          </ol>
        )}

        {comparison && comparison.rows.length > 0 && (
          <section aria-labelledby="comparison-heading" className="rounded-xl border border-o-line p-4">
            <h3 id="comparison-heading" className="font-semibold">
              Compare assistance conditions
            </h3>
            <p className="mt-1 text-sm text-o-text2">What each assistant would have shown on the same evidence, and the payoff of simply following it.</p>
            <div className="mt-3 overflow-x-auto">
              <table className="o-table min-w-[44rem]">
                <caption className="sr-only">Counterfactual advice by assistance condition</caption>
                <thead>
                  <tr>
                    <th scope="col">Decision</th>
                    <th scope="col">What was true</th>
                    <th scope="col">You</th>
                    <th scope="col">Conventional</th>
                    <th scope="col">Explainable</th>
                    <th scope="col">Uncertainty-aware</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.rows.map((row) => (
                    <tr key={row.pointId}>
                      <td className="text-o-text">{row.question}</td>
                      <td>{row.truth}</td>
                      <td>
                        {row.yourCourse} ({row.yourUtility > 0 ? '+' : ''}
                        {row.yourUtility})
                      </td>
                      {row.cells.map((cell) => (
                        <td key={cell.condition}>
                          {cell.summary} ({cell.followUtility > 0 ? '+' : ''}
                          {cell.followUtility})
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">Total</th>
                    <td />
                    <td className="font-semibold text-o-text">{comparison.totals.yours}</td>
                    <td className="font-semibold text-o-text">{comparison.totals.B}</td>
                    <td className="font-semibold text-o-text">{comparison.totals.C}</td>
                    <td className="font-semibold text-o-text">{comparison.totals.D}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="mt-2 text-xs text-o-text3">One fictional run. An illustration of the mechanism, not evidence about how people decide.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(['A', 'B', 'C', 'D'] as const).map((condition) => (
                <button key={condition} type="button" className="o-button" onClick={() => onPlayAgain(condition)}>
                  Play this scenario again · {CONDITION_LABEL[condition]}
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="flex flex-wrap gap-2">
          <button type="button" className="o-button-primary" onClick={onExport}>
            Download session record (JSON)
          </button>
          <button type="button" className="o-button" onClick={onExportSummary}>
            Download readable summary
          </button>
          <button type="button" className="o-button" onClick={onReplay}>
            Replay this session
          </button>
        </div>
        <p className="text-xs text-o-text3">
          One course per event per session. The record contains the seed and every input, so the session can be replayed exactly; it contains no audio and no personal information.
        </p>
      </DialogContent>
    </Dialog>
  );
};

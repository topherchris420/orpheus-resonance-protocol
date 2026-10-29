import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import type { MissionState, ResolvedDecision } from '@/engine/mission/types';
import type { ScenarioManifest } from '@/scenarios/types';
import { formatDtg, formatElapsed, tickInstant } from '@/tradecraft/dtg';
import { ABSTENTION_LABEL } from '@/command-room/model';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  manifest: ScenarioManifest;
  decisions: ResolvedDecision[];
  objectives: MissionState['objectives'];
  epochMs: number;
  seal: { entries: number; fingerprint: string };
  onExport: () => void;
  onReplay: () => void;
  onNewSession: () => void;
}

const delta = (value: number) => `${value >= 0 ? '+' : ''}${Math.round(value * 100)}`;

const OUTCOME: Record<ResolvedDecision['correctness'], { label: string; className: string }> = {
  correct: { label: 'ASSUMPTION HELD', className: 'text-green-300' },
  wrong: { label: 'ASSUMPTION FAILED', className: 'text-red-400' },
  deferred: { label: 'NO ASSUMPTION MADE', className: 'text-cyan-300' },
};

const hypothesisLabel = (manifest: ScenarioManifest, pointId: string, id: string | null) =>
  id === null ? null : (manifest.decisions.find((spec) => spec.id === pointId)?.hypotheses.find((hypothesis) => hypothesis.id === id)?.short ?? id);

const analystAtCommit = (decision: ResolvedDecision) => {
  const output = decision.assistant;
  if (!output) return 'none';
  if (output.status === 'abstention') return `withheld — ${ABSTENTION_LABEL[output.abstention?.reason ?? 'insufficient-confidence'].toLowerCase()}`;
  return output.assessment?.statement ?? 'assessed';
};

/** After-action review: each committed course, what it assumed, what was true, and what it changed. */
export const SessionReview = ({ open, onOpenChange, manifest, decisions, objectives, epochMs, seal, onExport, onReplay, onNewSession }: Props) => {
  const [confirmingNew, setConfirmingNew] = useState(false);
  return (
  <Dialog
    open={open}
    onOpenChange={(next) => {
      setConfirmingNew(false);
      onOpenChange(next);
    }}
  >
    <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto border-green-400/50 bg-black font-mono text-green-300">
      <DialogHeader>
        <DialogTitle className="tracking-widest text-green-300">AFTER-ACTION REVIEW</DialogTitle>
        <DialogDescription className="text-green-300/80">
          Each committed course, what it assumed, and what was actually true. The live world continues while you review; these values do not measure human performance.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-2 sm:grid-cols-3">
        {objectives.map((objective) => (
          <div key={objective.id} className="border border-green-400/30 p-3">
            <p className="text-xs">{objective.label}</p>
            <p className="mt-1 text-2xl">{Math.round(objective.progress * 100)}%</p>
            <p className="mt-1 text-xs text-green-300/80">{objective.detail}</p>
          </div>
        ))}
      </div>
      {decisions.length === 0 ? (
        <p className="py-6 text-sm text-green-300/85">No courses committed yet. Open Decisions, read the intel basis, and commit one course per decision point. Your review will appear here.</p>
      ) : (
        <ol className="space-y-3">
          {decisions.map((decision, index) => {
            const outcome = OUTCOME[decision.correctness];
            const reliedOn = hypothesisLabel(manifest, decision.pointId, decision.reliedOn);
            return (
              <li key={decision.pointId} className="border border-green-400/30 p-4">
                <p className="text-xs text-green-300/80">
                  {index + 1} · PHASE {decision.phase} · {formatDtg(tickInstant(epochMs, decision.tick, manifest.tickSeconds))} · {formatElapsed(decision.tick, manifest.tickSeconds)}
                </p>
                <h3 className="mt-1 font-semibold">{decision.pointTitle}</h3>
                <p className="mt-2 text-sm">{decision.optionTitle}</p>
                <p className="mt-3 text-xs">
                  Applied: STRESS {delta(decision.appliedEffects.stress)} · COHESION {delta(decision.appliedEffects.cohesion)} · PRESSURE {delta(decision.appliedEffects.hostilePressure)} · OBJECTIVE {delta(decision.appliedEffects.objectiveProgress)}
                </p>
                <dl className="mt-3 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-[max-content_1fr]">
                  <dt className="text-green-300/80">Relied on</dt>
                  <dd>{reliedOn ?? 'nothing — the course verified first or held either way'}</dd>
                  <dt className="text-green-300/80">Ground truth</dt>
                  <dd>{hypothesisLabel(manifest, decision.pointId, decision.truth)}</dd>
                  <dt className="text-green-300/80">Analyst at commit</dt>
                  <dd>{analystAtCommit(decision)}</dd>
                </dl>
                <p className={`mt-3 text-xs font-semibold tracking-widest ${outcome.className}`}>
                  {outcome.label}
                  {decision.polarityError ? ` · ${decision.polarityError === 'false-alarm' ? 'FALSE ALARM' : 'MISS'}` : ''}
                </p>
                <p className="mt-1 text-xs text-green-300/85">{decision.narrative}</p>
              </li>
            );
          })}
        </ol>
      )}
      <p className="text-xs text-green-300/80">
        Seal {seal.fingerprint} · {seal.entries} recorded entries. The record holds the seed and every input, so it replays exactly; it contains no audio and no personal data.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onExport} className="border border-green-400/60 px-4 py-3 text-sm">
          DOWNLOAD SESSION RECORD
        </button>
        <button type="button" onClick={onReplay} className="border border-green-400/60 px-4 py-3 text-sm">
          VERIFY IN REPLAY
        </button>
        {confirmingNew ? (
          <>
            <button type="button" autoFocus onClick={onNewSession} className="border border-red-400/70 px-4 py-3 text-sm text-red-300">
              CONFIRM: DISCARD UNSAVED RECORD
            </button>
            <button type="button" onClick={() => setConfirmingNew(false)} className="border border-green-400/30 px-4 py-3 text-sm">
              CANCEL
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirmingNew(true)} className="border border-green-400/30 px-4 py-3 text-sm text-green-300/90">
            NEW SESSION
          </button>
        )}
      </div>
    </DialogContent>
  </Dialog>
  );
};

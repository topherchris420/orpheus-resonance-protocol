import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import type { ResolvedDecision } from '../lib/missionSession';
import type { MissionObjective } from '../data/decisionScenarios';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  decisions: ResolvedDecision[];
  objectives: MissionObjective[];
  onExport: () => void;
}
const delta = (value: number) => `${value >= 0 ? '+' : ''}${Math.round(value * 100)}`;

export const SessionReview = ({ open, onOpenChange, decisions, objectives, onExport }: Props) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto border-emerald-300/30 bg-neutral-950 text-emerald-100">
      <DialogHeader>
        <DialogTitle>After-action review</DialogTitle>
        <DialogDescription className="text-emerald-100/60">Your choices and their authored simulation effects. The live world continues while you review. These values do not measure human performance.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-2 sm:grid-cols-3">
        {objectives.map((objective) => <div key={objective.id} className="border border-current/20 p-3">
          <p className="text-xs">{objective.label}</p><p className="mt-1 text-2xl">{Math.round(objective.progress * 100)}%</p>
          <p className="mt-1 text-xs opacity-60">{objective.detail}</p>
        </div>)}
      </div>
      {decisions.length === 0 ? <p className="py-6 text-sm opacity-70">No courses committed yet. Open Decisions, inspect the tradeoffs, and choose one course per event. Your review will appear here.</p> :
        <ol className="space-y-3">{decisions.map((decision, index) => <li key={decision.pointId} className="border border-current/20 p-4">
          <p className="text-xs opacity-60">{index + 1} · Phase {decision.phase} · {new Date(decision.timestamp).toLocaleTimeString()}</p>
          <h3 className="mt-1 font-semibold">{decision.pointTitle}</h3>
          <p className="mt-2 text-sm">{decision.outcome.title}</p>
          <p className="mt-1 text-xs opacity-70">{decision.outcome.consequences}</p>
          <p className="mt-3 text-xs">Stress {delta(decision.outcome.effects.stress)} · Cohesion {delta(decision.outcome.effects.cohesion)} · Pressure {delta(decision.outcome.effects.hostilePressure)} percentage points requested (bounded by the model).</p>
        </li>)}</ol>}
      <p className="text-xs opacity-60">One course per event per visit. Refresh starts a new session; export first to keep your record. Authored weights are scenario metadata, not calibrated probabilities; effects apply deterministically.</p>
      <button type="button" onClick={onExport} className="border border-emerald-300/40 px-4 py-3 text-sm">Download session JSON</button>
    </DialogContent>
  </Dialog>
);

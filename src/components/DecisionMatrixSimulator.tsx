import React, { useEffect, useRef, useState } from 'react';
import { MissionObjective, ScenarioOutcome } from '../data/decisionScenarios';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

export interface DecisionPoint {
  id: string;
  title: string;
  description: string;
  outcomes: ScenarioOutcome[];
}

interface DecisionMatrixSimulatorProps {
  decisionPoints: DecisionPoint[];
  expanded?: boolean;
  objectives?: MissionObjective[];
  committedCount?: number;
  onOutcomeSelect: (pointId: string, outcome: ScenarioOutcome) => void;
}

const riskStyles: Record<ScenarioOutcome['risk'], string> = {
  LOW: 'border-current/30 opacity-90',
  MODERATE: 'border-current/50',
  HIGH: 'border-current/70',
};

export const DecisionMatrixSimulator: React.FC<DecisionMatrixSimulatorProps> = React.memo(
  ({ decisionPoints, expanded = false, objectives = [], committedCount = 0, onOutcomeSelect }) => {
    const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
    const headingRef = useRef<HTMLDivElement | null>(null);
    const [pendingChoice, setPendingChoice] = useState<{ pointId: string; outcomeId: string } | null>(null);
    const [selectedPointId, setSelectedPointId] = useState<string | null>(decisionPoints[0]?.id ?? null);

    useEffect(() => {
      if (!decisionPoints.some((point) => point.id === selectedPointId)) {
        setSelectedPointId(decisionPoints[0]?.id ?? null);
      }
    }, [decisionPoints, selectedPointId]);

    const selectedPoint = decisionPoints.find((point) => point.id === selectedPointId) ?? null;

    const pendingPoint = decisionPoints.find((point) => point.id === pendingChoice?.pointId);
    const pendingOutcome = pendingPoint?.outcomes.find((outcome) => outcome.id === pendingChoice?.outcomeId);

    return (
      <div
        className={`flex flex-col rounded-xl border border-current/20 bg-black/30 p-4 sm:p-5 ${expanded ? 'min-h-[560px]' : 'h-full'}`}
      >
        <div
          ref={headingRef}
          tabIndex={-1}
          className="mb-2 flex items-center justify-between border-b border-current/30 pb-2 text-xs font-bold tracking-widest"
        >
          <span>DECISIONS</span>
          <span className="opacity-70">{committedCount} COMMITTED</span>
        </div>

        {objectives.length > 0 && (
          <div className="mb-4 grid gap-2 sm:grid-cols-3">
            {objectives.map((objective) => (
              <div key={objective.id} className="border border-current/20 p-1.5">
                <div className="flex items-center justify-between text-[10px] tracking-wider">
                  <span className="truncate">{objective.label}</span>
                  <span className="opacity-70">{Math.round(objective.progress * 100)}%</span>
                </div>
                <div className="mt-1 h-1 w-full bg-current/10">
                  <div className="h-1 bg-current/60" style={{ width: `${objective.progress * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className={`flex min-h-0 flex-1 flex-col gap-4 ${expanded ? 'lg:flex-row' : 'sm:flex-row'}`}>
          <div
            className={
              expanded ? 'min-w-0 lg:w-1/3' : 'max-h-28 min-w-0 overflow-y-auto pr-1 sm:max-h-none sm:w-1/3'
            }
          >
            <h3 className="mb-2 text-[10px] font-semibold tracking-widest opacity-70">AVAILABLE EVENTS</h3>
            <div className="space-y-2">
              {decisionPoints.map((point) => (
                <button
                  key={point.id}
                  type="button"
                  onClick={() => setSelectedPointId(point.id)}
                  aria-pressed={selectedPointId === point.id}
                  className={`w-full border p-2 text-left text-xs transition-colors ${
                    selectedPointId === point.id
                      ? 'border-current bg-current/15'
                      : 'border-current/20 bg-black/30'
                  }`}
                >
                  {point.title}
                </button>
              ))}
              {decisionPoints.length === 0 && (
                <div className="text-xs opacity-60">
                  All available decisions reviewed. Advance the phase for more, or open the after-action
                  review.
                </div>
              )}
            </div>
          </div>

          <div className={`min-w-0 flex-1 pr-1 ${expanded ? '' : 'overflow-y-auto'}`}>
            {selectedPoint ? (
              <div>
                <h3 className="text-sm font-semibold">{selectedPoint.title}</h3>
                <p className="mb-4 mt-2 text-sm leading-relaxed opacity-80">{selectedPoint.description}</p>
                <h4 className="mb-2 text-[10px] font-semibold tracking-widest opacity-70">
                  COURSES OF ACTION
                </h4>
                <div className="space-y-2">
                  {selectedPoint.outcomes.map((outcome) => {
                    return (
                      <div key={outcome.id} className={`rounded-lg border p-4 ${riskStyles[outcome.risk]}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-bold">{outcome.title}</span>
                          <span className="whitespace-nowrap text-[10px] opacity-70">
                            {outcome.risk} · Authored weight {(outcome.probability * 100).toFixed(0)}%
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed opacity-80">{outcome.consequences}</p>
                        <div className="mt-1 flex flex-wrap gap-2 text-[10px] opacity-70">
                          <span>
                            STRESS {outcome.effects.stress >= 0 ? '+' : ''}
                            {(outcome.effects.stress * 100).toFixed(0)}
                          </span>
                          <span>
                            COHESION {outcome.effects.cohesion >= 0 ? '+' : ''}
                            {(outcome.effects.cohesion * 100).toFixed(0)}
                          </span>
                          <span>
                            PRESSURE {outcome.effects.hostilePressure >= 0 ? '+' : ''}
                            {(outcome.effects.hostilePressure * 100).toFixed(0)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(event) => {
                            lastTriggerRef.current = event.currentTarget;
                            setPendingChoice({ pointId: selectedPoint.id, outcomeId: outcome.id });
                          }}
                          className="session-button mt-3"
                          aria-label={`Review course: ${outcome.title}`}
                        >
                          Review course →
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center text-xs opacity-70">
                No pending decisions in this phase. Continue with the session controls above or review your
                choices.
              </div>
            )}
          </div>
        </div>
        <p className="mt-4 text-xs leading-relaxed opacity-60">
          Effects are authored changes in percentage points. Weights are scenario metadata, not success
          predictions.
        </p>
        <AlertDialog
          open={Boolean(pendingOutcome)}
          onOpenChange={(open) => {
            if (!open) setPendingChoice(null);
          }}
        >
          <AlertDialogContent
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              const target = lastTriggerRef.current?.isConnected
                ? lastTriggerRef.current
                : headingRef.current;
              target?.focus({ preventScroll: true });
            }}
            className="dark max-h-[85vh] overflow-y-auto bg-slate-950 text-slate-100"
          >
            <AlertDialogHeader>
              <AlertDialogTitle>Commit this course?</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-400">
                {pendingPoint?.title}. This records one choice for this event. Its alternatives will close for
                the rest of this session.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="rounded-lg border border-white/15 p-4">
              <h3 className="font-medium">{pendingOutcome?.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">{pendingOutcome?.consequences}</p>
              <p className="mt-3 text-xs text-slate-400">
                You can inspect the effects in After-action or start a new session to explore another course.
              </p>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep comparing</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (pendingPoint && pendingOutcome) onOutcomeSelect(pendingPoint.id, pendingOutcome);
                  setPendingChoice(null);
                }}
              >
                Confirm choice
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  },
);

DecisionMatrixSimulator.displayName = 'DecisionMatrixSimulator';

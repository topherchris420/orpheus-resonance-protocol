import React, { useEffect, useState } from 'react';
import { MissionObjective, ScenarioOutcome } from '../data/decisionScenarios';

export interface DecisionPoint {
  id: string;
  title: string;
  description: string;
  outcomes: ScenarioOutcome[];
}

interface DecisionMatrixSimulatorProps {
  decisionPoints: DecisionPoint[];
  objectives?: MissionObjective[];
  committedCount?: number;
  onOutcomeSelect: (pointId: string, outcome: ScenarioOutcome) => void;
}

const riskStyles: Record<ScenarioOutcome['risk'], string> = {
  LOW: 'border-current/30 opacity-90',
  MODERATE: 'border-current/50',
  HIGH: 'border-current/70',
};

export const DecisionMatrixSimulator: React.FC<DecisionMatrixSimulatorProps> = React.memo(({
  decisionPoints,
  objectives = [],
  committedCount = 0,
  onOutcomeSelect,
}) => {
  const [selectedPointId, setSelectedPointId] = useState<string | null>(decisionPoints[0]?.id ?? null);

  useEffect(() => {
    if (!decisionPoints.some((point) => point.id === selectedPointId)) {
      setSelectedPointId(decisionPoints[0]?.id ?? null);
    }
  }, [decisionPoints, selectedPointId]);

  const selectedPoint = decisionPoints.find((point) => point.id === selectedPointId) ?? null;

  const handleCommit = (outcome: ScenarioOutcome) => {
    if (!selectedPoint) {
      return;
    }
    onOutcomeSelect(selectedPoint.id, outcome);
  };

  return (
    <div className="flex h-full flex-col border border-current/30 bg-black/40 p-3 backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-between border-b border-current/30 pb-2 text-xs font-bold tracking-widest">
        <span>DECISION MATRIX SIMULATOR</span>
        <span className="opacity-70">{committedCount} COMMITTED</span>
      </div>

      {objectives.length > 0 && (
        <div className="mb-2 grid grid-cols-3 gap-2">
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

      <div className="flex min-h-0 flex-1 flex-col gap-3 sm:flex-row">
        <div className="max-h-28 min-w-0 overflow-y-auto pr-1 sm:max-h-none sm:w-1/3">
          <h3 className="mb-2 text-[10px] font-semibold tracking-widest opacity-70">CRITICAL DECISION POINTS</h3>
          <div className="space-y-2">
            {decisionPoints.map((point) => (
              <button
                key={point.id}
                type="button"
                onClick={() => setSelectedPointId(point.id)}
                className={`w-full border p-2 text-left text-xs transition-colors ${
                  selectedPointId === point.id ? 'border-current bg-current/15' : 'border-current/20 bg-black/30'
                }`}
              >
                {point.title}
              </button>
            ))}
            {decisionPoints.length === 0 && (
              <div className="text-xs opacity-60">All available decisions reviewed. Advance the phase for more, or open the after-action review.</div>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1 overflow-y-auto pr-1">
          {selectedPoint ? (
            <div>
              <h3 className="text-sm font-semibold">{selectedPoint.title}</h3>
              <p className="mb-3 mt-1 text-xs opacity-80">{selectedPoint.description}</p>
              <h4 className="mb-2 text-[10px] font-semibold tracking-widest opacity-70">COURSES OF ACTION</h4>
              <div className="space-y-2">
                {selectedPoint.outcomes.map((outcome) => {
                  return (
                    <div key={outcome.id} className={`border p-2 ${riskStyles[outcome.risk]}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold">{outcome.title}</span>
                        <span className="whitespace-nowrap text-[10px] opacity-70">
                          {outcome.risk} · Authored weight {(outcome.probability * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] opacity-80">{outcome.consequences}</p>
                      <div className="mt-1 flex flex-wrap gap-2 text-[10px] opacity-70">
                        <span>STRESS {outcome.effects.stress >= 0 ? '+' : ''}{(outcome.effects.stress * 100).toFixed(0)}</span>
                        <span>COHESION {outcome.effects.cohesion >= 0 ? '+' : ''}{(outcome.effects.cohesion * 100).toFixed(0)}</span>
                        <span>PRESSURE {outcome.effects.hostilePressure >= 0 ? '+' : ''}{(outcome.effects.hostilePressure * 100).toFixed(0)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCommit(outcome)}
                        className="mt-2 border border-current/40 px-2 py-1 text-[10px] tracking-widest disabled:opacity-50"
                      >
                        COMMIT COURSE
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center text-xs opacity-70">Select a decision point to simulate outcomes.</div>
          )}
        </div>
      </div>
    </div>
  );
});

DecisionMatrixSimulator.displayName = 'DecisionMatrixSimulator';

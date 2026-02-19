import React, { useState } from 'react';

export interface DecisionPoint {
  id: string;
  title: string;
  description: string;
  outcomes: Array<{
    id: string;
    title: string;
    probability: number;
    consequences: string;
  }>;
}

interface DecisionMatrixSimulatorProps {
  decisionPoints: DecisionPoint[];
  onOutcomeSelect: (outcomeId: string) => void;
}

export const DecisionMatrixSimulator: React.FC<DecisionMatrixSimulatorProps> = React.memo(({
  decisionPoints,
  onOutcomeSelect,
}) => {
  const [selectedPoint, setSelectedPoint] = useState<DecisionPoint | null>(decisionPoints[0] || null);
  const [exploredOutcomes, setExploredOutcomes] = useState<string[]>([]);

  const handleSelectOutcome = (outcomeId: string) => {
    setExploredOutcomes(prev => [...prev, outcomeId]);
    onOutcomeSelect(outcomeId);
  };

  return (
    <div className="h-full border border-current/30 bg-black/40 backdrop-blur-sm p-4">
      <div className="font-bold border-b border-current/30 pb-2 mb-4">DECISION MATRIX SIMULATOR</div>
      <div className="flex space-x-4">
        <div className="w-1/3">
          <h3 className="font-semibold mb-2">CRITICAL DECISION POINTS</h3>
          <div className="space-y-2">
            {decisionPoints.map(point => (
              <div
                key={point.id}
                onClick={() => setSelectedPoint(point)}
                className={`p-2 border rounded-md cursor-pointer ${
                  selectedPoint?.id === point.id ? 'bg-cyan-400 text-black' : 'bg-black/30'
                }`}
              >
                {point.title}
              </div>
            ))}
          </div>
        </div>
        <div className="w-2/3">
          {selectedPoint ? (
            <div>
              <h3 className="font-semibold mb-2">{selectedPoint.title}</h3>
              <p className="text-sm opacity-80 mb-4">{selectedPoint.description}</p>
              <h4 className="font-semibold mb-2">POTENTIAL OUTCOMES</h4>
              <div className="space-y-2">
                {selectedPoint.outcomes.map(outcome => (
                  <div key={outcome.id} className="p-2 border border-current/20 rounded-md">
                    <div className="flex justify-between items-center">
                      <span className="font-bold">{outcome.title}</span>
                      <span className="text-xs opacity-70">PROB: {(outcome.probability * 100).toFixed(0)}%</span>
                    </div>
                    <p className="text-xs opacity-80 mt-1">{outcome.consequences}</p>
                    <button
                      onClick={() => handleSelectOutcome(outcome.id)}
                      className="text-xs mt-2 text-cyan-400 hover:underline"
                      disabled={exploredOutcomes.includes(outcome.id)}
                    >
                      {exploredOutcomes.includes(outcome.id) ? 'Explore Phantom Echo' : 'Explore Timeline'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center opacity-70">Select a decision point to simulate outcomes.</div>
          )}
        </div>
      </div>
    </div>
  );
});

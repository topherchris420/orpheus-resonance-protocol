import { useCallback, useMemo, useState } from 'react';
import {
  buildDecisionPoints,
  INITIAL_OBJECTIVES,
  MissionObjective,
  objectiveForOutcome,
  ScenarioContext,
  ScenarioDecisionPoint,
  ScenarioOutcome,
} from '../data/decisionScenarios';

export interface ResolvedDecision {
  pointId: string;
  outcome: ScenarioOutcome;
  timestamp: number;
}

interface MissionScenarioResult {
  decisionPoints: ScenarioDecisionPoint[];
  objectives: MissionObjective[];
  resolvedDecisions: ResolvedDecision[];
  hostilePressure: number;
  stressModifier: number;
  cohesionModifier: number;
  resolveOutcome: (pointId: string, outcome: ScenarioOutcome) => void;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const useMissionScenario = (context: ScenarioContext): MissionScenarioResult => {
  const [objectives, setObjectives] = useState<MissionObjective[]>(INITIAL_OBJECTIVES);
  const [resolvedDecisions, setResolvedDecisions] = useState<ResolvedDecision[]>([]);
  const [hostilePressure, setHostilePressure] = useState(0.3);
  const [stressModifier, setStressModifier] = useState(0);
  const [cohesionModifier, setCohesionModifier] = useState(0);

  const { phase, hostileThreatCount, cohesionScore, cognitiveStressIndex, redTeamActive } = context;

  const decisionPoints = useMemo(
    () => buildDecisionPoints({ phase, hostileThreatCount, cohesionScore, cognitiveStressIndex, redTeamActive }),
    [phase, hostileThreatCount, cohesionScore, cognitiveStressIndex, redTeamActive],
  );

  const resolveOutcome = useCallback((pointId: string, outcome: ScenarioOutcome) => {
    const { effects } = outcome;

    setResolvedDecisions((previous) => [...previous.slice(-9), { pointId, outcome, timestamp: Date.now() }]);
    setHostilePressure((previous) => clamp(previous + effects.hostilePressure, 0, 1));
    setStressModifier((previous) => clamp(previous + effects.stress, -0.5, 0.6));
    setCohesionModifier((previous) => clamp(previous + effects.cohesion, -0.4, 0.4));

    const objectiveId = objectiveForOutcome(outcome);
    setObjectives((previous) =>
      previous.map((objective) =>
        objective.id === objectiveId
          ? { ...objective, progress: clamp(objective.progress + effects.objectiveProgress, 0, 1) }
          : objective,
      ),
    );
  }, []);

  return {
    decisionPoints,
    objectives,
    resolvedDecisions,
    hostilePressure,
    stressModifier,
    cohesionModifier,
    resolveOutcome,
  };
};

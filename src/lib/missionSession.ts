import { buildDecisionPoints, INITIAL_OBJECTIVES, objectiveForOutcome, type MissionObjective, type ScenarioContext, type ScenarioOutcome } from '../data/decisionScenarios';

export interface ResolvedDecision {
  pointId: string;
  pointTitle: string;
  outcome: ScenarioOutcome;
  timestamp: number;
  phase: number;
}

export interface MissionSession {
  objectives: MissionObjective[];
  resolvedDecisions: ResolvedDecision[];
  hostilePressure: number;
  stressModifier: number;
  cohesionModifier: number;
}

export const createMissionSession = (): MissionSession => ({
  objectives: INITIAL_OBJECTIVES.map((objective) => ({ ...objective })),
  resolvedDecisions: [], hostilePressure: 0.3, stressModifier: 0, cohesionModifier: 0,
});

export const pendingDecisionPoints = (context: ScenarioContext, session: MissionSession) =>
  buildDecisionPoints(context, Number.MAX_SAFE_INTEGER)
    .filter((point) => !session.resolvedDecisions.some((decision) => decision.pointId === point.id))
    .slice(0, 3);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Resolve IDs against the currently available catalog. Caller-supplied effects are never trusted. */
export const commitDecision = (
  session: MissionSession, context: ScenarioContext, pointId: string, outcomeId: string, timestamp: number,
): MissionSession => {
  const point = pendingDecisionPoints(context, session).find((candidate) => candidate.id === pointId);
  const outcome = point?.outcomes.find((candidate) => candidate.id === outcomeId);
  if (!point || !outcome || !Number.isFinite(timestamp)) return session;
  const { effects } = outcome;
  return {
    resolvedDecisions: [...session.resolvedDecisions, { pointId, pointTitle: point.title, outcome, timestamp, phase: context.phase }],
    hostilePressure: clamp(session.hostilePressure + effects.hostilePressure, 0, 1),
    stressModifier: clamp(session.stressModifier + effects.stress, -0.5, 0.6),
    cohesionModifier: clamp(session.cohesionModifier + effects.cohesion, -0.4, 0.4),
    objectives: session.objectives.map((objective) => objective.id === objectiveForOutcome(outcome)
      ? { ...objective, progress: clamp(objective.progress + effects.objectiveProgress, 0, 1) }
      : objective),
  };
};

import { buildDecisionPoints } from '../data/decisionScenarios';

export const sessionDecisionCount = buildDecisionPoints(
  { phase: 4, hostileThreatCount: 0, cohesionScore: 0, cognitiveStressIndex: 0, redTeamActive: false },
  Number.MAX_SAFE_INTEGER,
).length;

export const getSessionGuidance = (phase: number, pending: number, committed: number) => {
  if (committed >= sessionDecisionCount)
    return {
      title: 'Your decision trail is complete.',
      detail: 'Open the after-action review to reflect on your choices and save your session.',
      action: 'review' as const,
      label: 'Review session',
    };
  if (pending > 0)
    return {
      title: committed ? 'Your next decision is ready.' : 'Start by reading the situation.',
      detail: 'Compare the available courses, inspect their modeled effects, then confirm one choice.',
      action: 'decisions' as const,
      label: 'Explore decisions',
    };
  if (phase < 4)
    return {
      title: 'You have explored this phase.',
      detail: 'Advance when you are ready to reveal the next set of decisions.',
      action: 'advance' as const,
      label: 'Continue to next phase',
    };
  return {
    title: 'Review your session.',
    detail: 'Inspect the record of your choices and download it before starting again.',
    action: 'review' as const,
    label: 'Review session',
  };
};

/** Model state must not depend on whether its visualization is mounted. */
export const calculateSquadCohesion = (stressValues: number[], communicationEfficiency: number) => {
  const averageStress = stressValues.length
    ? stressValues.reduce((sum, stress) => sum + stress, 0) / stressValues.length
    : 0;
  return Math.min(1, Math.max(0, (1 - averageStress + communicationEfficiency) / 2));
};

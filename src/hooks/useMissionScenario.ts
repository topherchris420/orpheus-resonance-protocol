import { useCallback, useRef, useState } from 'react';
import type { ScenarioContext, ScenarioOutcome } from '../data/decisionScenarios';
import { commitDecision, createMissionSession, pendingDecisionPoints } from '../lib/missionSession';
export type { ResolvedDecision } from '../lib/missionSession';

export const useMissionScenario = (context: ScenarioContext) => {
  const [session, setSession] = useState(createMissionSession);
  // The synchronous guard also covers two commits arriving before React renders.
  const sessionRef = useRef(session);
  const resolveOutcome = useCallback((pointId: string, outcome: ScenarioOutcome) => {
    const previous = sessionRef.current;
    const next = commitDecision(previous, context, pointId, outcome.id, Date.now());
    if (next === previous) return false;
    sessionRef.current = next;
    setSession(next);
    return true;
  }, [context]);
  return { ...session, decisionPoints: pendingDecisionPoints(context, session), resolveOutcome };
};

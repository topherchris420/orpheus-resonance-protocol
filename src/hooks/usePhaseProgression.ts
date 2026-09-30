import { useState, useEffect, useCallback } from 'react';

export const usePhaseProgression = (onAccessLevelChange: (level: number) => void) => {
  const [acclimatizationLevel, setAcclimatizationLevel] = useState(1);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const handleAcclimatizationAdvance = useCallback(() => {
    setAcclimatizationLevel((previous) => Math.min(4, previous + 1));
  }, []);

  useEffect(() => { onAccessLevelChange(acclimatizationLevel); }, [acclimatizationLevel, onAccessLevelChange]);
  useEffect(() => {
    if (!autoAdvance || acclimatizationLevel >= 4) return;
    const timer = window.setTimeout(handleAcclimatizationAdvance, 30000);
    return () => window.clearTimeout(timer);
  }, [autoAdvance, acclimatizationLevel, handleAcclimatizationAdvance]);

  return { acclimatizationLevel, simulationMode: acclimatizationLevel >= 2,
    handleAcclimatizationAdvance, autoAdvance, setAutoAdvance };
};

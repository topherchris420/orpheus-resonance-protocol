import { useState, useEffect } from 'react';

interface AcclimatizationProgressionResult {
  acclimatizationLevel: number;
  simulationMode: boolean;
  handleAcclimatizationAdvance: () => void;
}

export const usePhaseProgression = (onAccessLevelChange: (level: number) => void): AcclimatizationProgressionResult => {
  const [acclimatizationLevel, setAcclimatizationLevel] = useState(1);
  const [simulationMode, setSimulationMode] = useState(false);

  // Acclimatization progression logic
  useEffect(() => {
    const acclimatizationTimer = setInterval(() => {
      if (acclimatizationLevel < 4) {
        setAcclimatizationLevel(prev => prev + 1);
        onAccessLevelChange(acclimatizationLevel + 1);
      }
    }, 30000);

    return () => clearInterval(acclimatizationTimer);
  }, [acclimatizationLevel, onAccessLevelChange]);

  // Activate simulation mode in acclimatization level 2+
  useEffect(() => {
    if (acclimatizationLevel >= 2) {
      setSimulationMode(true);
    }
  }, [acclimatizationLevel]);

  const handleAcclimatizationAdvance = () => {
    if (acclimatizationLevel < 4) {
      setAcclimatizationLevel(prev => prev + 1);
      onAccessLevelChange(acclimatizationLevel + 1);
    }
  };

  return {
    acclimatizationLevel,
    simulationMode,
    handleAcclimatizationAdvance
  };
};

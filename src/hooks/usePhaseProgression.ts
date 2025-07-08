
import { useState, useEffect } from 'react';

interface PhaseProgressionResult {
  phase: number;
  temporalMode: boolean;
  handlePhaseAdvance: () => void;
}

export const usePhaseProgression = (onAccessLevelChange: (level: number) => void): PhaseProgressionResult => {
  const [phase, setPhase] = useState(1);
  const [temporalMode, setTemporalMode] = useState(false);

  // Phase progression logic
  useEffect(() => {
    const phaseTimer = setInterval(() => {
      if (phase < 4) {
        setPhase(prev => prev + 1);
        onAccessLevelChange(phase + 1);
      }
    }, 30000);

    return () => clearInterval(phaseTimer);
  }, [phase, onAccessLevelChange]);

  // Activate temporal mode in phase 2+
  useEffect(() => {
    if (phase >= 2) {
      setTemporalMode(true);
    }
  }, [phase]);

  const handlePhaseAdvance = () => {
    if (phase < 4) {
      setPhase(prev => prev + 1);
      onAccessLevelChange(phase + 1);
    }
  };

  return {
    phase,
    temporalMode,
    handlePhaseAdvance
  };
};

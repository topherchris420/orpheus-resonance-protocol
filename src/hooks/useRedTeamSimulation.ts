import { useState, useEffect } from 'react';

interface RedTeamSimulationResult {
  isRedTeamModeActive: boolean;
  redTeamIntensity: number;
  conflictingIntel: string | null;
  toggleRedTeamMode: () => void;
}

export const useRedTeamSimulation = (isSimulationMode: boolean): RedTeamSimulationResult => {
  const [isRedTeamModeActive, setIsRedTeamModeActive] = useState(false);
  const [redTeamIntensity, setRedTeamIntensity] = useState(0);
  const [conflictingIntel, setConflictingIntel] = useState<string | null>(null);

  const toggleRedTeamMode = () => {
    setIsRedTeamModeActive(prev => !prev);
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRedTeamModeActive && isSimulationMode) {
      interval = setInterval(() => {
        setRedTeamIntensity(Math.random());
        if (Math.random() > 0.7) {
          setConflictingIntel("Conflicting intel report: Hostile forces detected at your location.");
        } else {
          setConflictingIntel(null);
        }
      }, 5000);
    } else {
      setRedTeamIntensity(0);
      setConflictingIntel(null);
    }
    return () => clearInterval(interval);
  }, [isRedTeamModeActive, isSimulationMode]);

  return {
    isRedTeamModeActive,
    redTeamIntensity,
    conflictingIntel,
    toggleRedTeamMode,
  };
};

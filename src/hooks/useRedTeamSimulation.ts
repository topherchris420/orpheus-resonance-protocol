import { useState, useEffect, useCallback } from 'react';

interface RedTeamSimulationResult {
  isRedTeamModeActive: boolean;
  redTeamIntensity: number;
  conflictingIntel: string | null;
  toggleRedTeamMode: () => void;
}

const DECEPTION_LINES = [
  'Conflicting intel report: hostile forces detected at your location.',
  'Spoofed squad beacon detected — Delta-4 position may be fabricated.',
  'Injected traffic claims friendly convoy on Route Viper; SIGINT disagrees.',
  'Replayed radio chatter matches a transmission logged 40 minutes ago.',
  'GPS drift observed — reported grid differs from inertial track by 180m.',
  'Unverified MEDEVAC cancellation received on the command net.',
];

export const useRedTeamSimulation = (isSimulationMode: boolean): RedTeamSimulationResult => {
  const [isRedTeamModeActive, setIsRedTeamModeActive] = useState(false);
  const [redTeamIntensity, setRedTeamIntensity] = useState(0);
  const [conflictingIntel, setConflictingIntel] = useState<string | null>(null);

  const toggleRedTeamMode = useCallback(() => {
    setIsRedTeamModeActive((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!isRedTeamModeActive || !isSimulationMode) {
      setRedTeamIntensity(0);
      setConflictingIntel(null);
      return;
    }

    const interval = setInterval(() => {
      // Escalating pressure with a random walk instead of a pure random value.
      setRedTeamIntensity((previous) => {
        const drift = 0.08 + Math.random() * 0.14;
        const next = previous + drift - (Math.random() > 0.75 ? 0.25 : 0);
        return Math.min(1, Math.max(0.05, next));
      });

      setConflictingIntel((previous) => {
        if (Math.random() > 0.55) {
          const candidates = DECEPTION_LINES.filter((line) => line !== previous);
          return candidates[Math.floor(Math.random() * candidates.length)];
        }
        return null;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [isRedTeamModeActive, isSimulationMode]);

  return {
    isRedTeamModeActive,
    redTeamIntensity,
    conflictingIntel,
    toggleRedTeamMode,
  };
};

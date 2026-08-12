import { useEffect, useRef, useState } from 'react';

export interface MetricSample {
  timestamp: number;
  stress: number;
  cohesion: number;
  hostilePressure: number;
  intelAccuracy: number;
}

export interface MetricsHistoryInput {
  stress: number;
  cohesion: number;
  hostilePressure: number;
  intelAccuracy: number;
}

const SAMPLE_INTERVAL_MS = 2500;
const MAX_SAMPLES = 48;

/** Samples live mission metrics on a fixed throttle so charts stay smooth. */
export const useMetricsHistory = (input: MetricsHistoryInput): MetricSample[] => {
  const latest = useRef(input);
  latest.current = input;

  const [history, setHistory] = useState<MetricSample[]>(() => [{ timestamp: Date.now(), ...input }]);

  useEffect(() => {
    const interval = setInterval(() => {
      setHistory((previous) => [
        ...previous.slice(-(MAX_SAMPLES - 1)),
        { timestamp: Date.now(), ...latest.current },
      ]);
    }, SAMPLE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  return history;
};

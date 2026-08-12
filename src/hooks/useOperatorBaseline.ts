import { useCallback, useEffect, useRef, useState } from 'react';
import { usePersistentState } from './usePersistentState';

export interface OperatorBaseline {
  /** Resting stress level captured during calibration (0-1). */
  stress: number;
  /** Typical squad cohesion captured during calibration (0-1). */
  cohesion: number;
  /** Natural variability of each signal, used as the scaling window. */
  stressSpread: number;
  cohesionSpread: number;
  capturedAt: number;
  samples: number;
}

export const BASELINE_STORAGE_KEY = 'orpheus.calibration.baseline';
export const CALIBRATION_DURATION_MS = 20000;
const SAMPLE_INTERVAL_MS = 500;
const MIN_SPREAD = 0.05;

export interface BaselineSignals {
  stress: number;
  cohesion: number;
}

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);

const spreadOf = (values: number[]) => {
  if (values.length < 2) return MIN_SPREAD;
  const average = mean(values);
  const variance = mean(values.map((value) => (value - average) ** 2));
  return Math.max(MIN_SPREAD, Math.sqrt(variance) * 2);
};

/** Applies a personal baseline so a metric reads as deviation from the operator's normal. */
export const applyBaseline = (value: number, baseline: number, spread: number): number =>
  Math.min(1, Math.max(0, 0.5 + (value - baseline) / (2 * Math.max(MIN_SPREAD, spread))));

interface UseOperatorBaselineResult {
  baseline: OperatorBaseline | null;
  isCalibrating: boolean;
  progress: number;
  startCalibration: () => void;
  cancelCalibration: () => void;
  clearBaseline: () => void;
  adjustBaseline: (patch: Partial<OperatorBaseline>) => void;
}

/** Captures personal resting baselines for stress and cohesion, persisted between sessions. */
export const useOperatorBaseline = (signals: BaselineSignals): UseOperatorBaselineResult => {
  const [baseline, setBaseline] = usePersistentState<OperatorBaseline | null>(BASELINE_STORAGE_KEY, null);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [progress, setProgress] = useState(0);

  const signalsRef = useRef(signals);
  signalsRef.current = signals;

  const stressSamples = useRef<number[]>([]);
  const cohesionSamples = useRef<number[]>([]);

  useEffect(() => {
    if (!isCalibrating) return;

    stressSamples.current = [];
    cohesionSamples.current = [];
    const startedAt = Date.now();

    const interval = setInterval(() => {
      stressSamples.current.push(signalsRef.current.stress);
      cohesionSamples.current.push(signalsRef.current.cohesion);

      const elapsed = Date.now() - startedAt;
      setProgress(Math.min(1, elapsed / CALIBRATION_DURATION_MS));

      if (elapsed >= CALIBRATION_DURATION_MS) {
        setBaseline({
          stress: mean(stressSamples.current),
          cohesion: mean(cohesionSamples.current),
          stressSpread: spreadOf(stressSamples.current),
          cohesionSpread: spreadOf(cohesionSamples.current),
          capturedAt: Date.now(),
          samples: stressSamples.current.length,
        });
        setIsCalibrating(false);
        setProgress(1);
      }
    }, SAMPLE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isCalibrating, setBaseline]);

  const startCalibration = useCallback(() => {
    setProgress(0);
    setIsCalibrating(true);
  }, []);

  const cancelCalibration = useCallback(() => {
    setIsCalibrating(false);
    setProgress(0);
  }, []);

  const clearBaseline = useCallback(() => {
    setBaseline(null);
    setProgress(0);
  }, [setBaseline]);

  const adjustBaseline = useCallback((patch: Partial<OperatorBaseline>) => {
    setBaseline((previous) => {
      const base: OperatorBaseline = previous ?? {
        stress: 0.5,
        cohesion: 0.5,
        stressSpread: 0.2,
        cohesionSpread: 0.2,
        capturedAt: Date.now(),
        samples: 0,
      };
      return { ...base, ...patch, capturedAt: Date.now() };
    });
  }, [setBaseline]);

  return { baseline, isCalibrating, progress, startCalibration, cancelCalibration, clearBaseline, adjustBaseline };
};

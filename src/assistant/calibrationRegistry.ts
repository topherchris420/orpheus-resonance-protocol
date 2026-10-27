import { ENGINE_VERSION } from '@/engine/version';
import type { ReliabilityBin } from '@/evidence/calibration';
import record from './calibration.record.json';

/**
 * Registry of probability methods that have been implemented *and* evaluated. The assistant may show a
 * probability only when its method appears here with a record produced by the current engine version
 * (`npm run evaluate` regenerates the record; a test fails when it is stale).
 */
export interface CalibrationRecord {
  method: string;
  engineVersion: string;
  evaluatedOn: string;
  seed: string;
  trials: number;
  ece: number;
  brier: number;
  selectiveAccuracy: number;
  coverage: number;
  threshold: number;
  bins: ReliabilityBin[];
  generatedBy: string;
}

export interface CalibrationRegistry {
  lookup(method: string): CalibrationRecord | undefined;
  records(): CalibrationRecord[];
}

/** Maximum expected calibration error at which a method's probabilities may be displayed. */
export const MAX_DISPLAY_ECE = 0.05;

export const createRegistry = (records: readonly CalibrationRecord[]): CalibrationRegistry => ({
  lookup: (method) =>
    records.find((candidate) => candidate.method === method && candidate.engineVersion === ENGINE_VERSION && candidate.ece <= MAX_DISPLAY_ECE),
  records: () => [...records],
});

export const calibrationRef = (calibration: CalibrationRecord) =>
  `${calibration.method}@${calibration.engineVersion}:${calibration.trials}-trials:${calibration.seed}`;

export const committedCalibrationRecord = record as CalibrationRecord;

export const defaultRegistry = createRegistry([committedCalibrationRecord]);

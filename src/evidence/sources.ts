import { hashValue } from '@/engine/canonical';
import type { PayloadValue, ReliabilityClass } from './types';

/**
 * Declared accuracy for each reliability class: the probability that an admissible, current report
 * from such a source asserts the true hypothesis. These numbers define the public model. The trial
 * generator samples honest sources from exactly this model, which is what makes calibration of the
 * assistant testable; adversarial conditions deliberately violate it.
 */
export const CLASS_ACCURACY: Record<Exclude<ReliabilityClass, 'F'>, number> = {
  A: 0.95,
  B: 0.85,
  C: 0.75,
  D: 0.65,
  E: 0.55,
};

export const RELIABILITY_LABEL: Record<ReliabilityClass, string> = {
  A: 'Completely reliable',
  B: 'Usually reliable',
  C: 'Fairly reliable',
  D: 'Not usually reliable',
  E: 'Unreliable',
  F: 'Reliability cannot be judged',
};

/** The conventional model's face-value assumption for sources without a record. */
export const NAIVE_UNKNOWN_ACCURACY = CLASS_ACCURACY.C;

export const declaredAccuracy = (reliability: ReliabilityClass): number | null =>
  reliability === 'F' ? null : CLASS_ACCURACY[reliability];

/** Digest transmitted with a payload. Truncated SHA-256 of the canonical payload. */
export const payloadDigest = (payload: Record<string, PayloadValue>): string => hashValue(payload).slice(0, 16);

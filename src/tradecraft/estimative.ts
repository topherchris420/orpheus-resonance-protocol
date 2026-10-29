import type { EvidenceReport } from '@/evidence/types';

/**
 * Estimative language from Intelligence Community Directive 203 (Analytic Standards): seven terms,
 * each bound to a probability range, so "likely" always means 55–80%. ICD 203 also requires analytic
 * confidence to be stated separately from likelihood; `analyticConfidence` derives it from the
 * quality of the evidence base rather than from the probability itself.
 */

export interface EstimativeTerm {
  term: string;
  /** The published range, as printed. */
  range: string;
  /** Lower bound, inclusive. */
  from: number;
}

export const ESTIMATIVE_SCALE: readonly EstimativeTerm[] = [
  { term: 'ALMOST NO CHANCE', range: '01–05%', from: 0 },
  { term: 'VERY UNLIKELY', range: '05–20%', from: 0.05 },
  { term: 'UNLIKELY', range: '20–45%', from: 0.2 },
  { term: 'ROUGHLY EVEN CHANCE', range: '45–55%', from: 0.45 },
  { term: 'LIKELY', range: '55–80%', from: 0.55 },
  { term: 'VERY LIKELY', range: '80–95%', from: 0.8 },
  { term: 'ALMOST CERTAIN', range: '95–99%', from: 0.95 },
];

/** The ICD 203 term for a probability. Ranges are half-open, so 0.80 reads "very likely". */
export const estimativeFor = (probability: number): EstimativeTerm => {
  if (!Number.isFinite(probability)) throw new RangeError('Probability must be finite.');
  let match = ESTIMATIVE_SCALE[0];
  for (const entry of ESTIMATIVE_SCALE) if (probability >= entry.from) match = entry;
  return match;
};

export type ConfidenceLevel = 'HIGH' | 'MODERATE' | 'LOW';

export interface AnalyticConfidence {
  level: ConfidenceLevel;
  /** The facts behind the level, each a short clause. */
  basis: string[];
}

/**
 * - LOW: the evidence does not establish any interpretation (the engine's sufficiency check fails).
 * - HIGH: it does, with at least two independent origins behind the leading interpretation and no
 *   conflict, model misfit, missing scheduled observation or aging item weakening it.
 * - MODERATE: established, but with at least one of those weaknesses.
 */
export const analyticConfidence = (report: EvidenceReport): AnalyticConfidence => {
  const origins = report.support[report.leading] ?? 0;
  const aging = report.items.filter((item) => item.admissible && item.flags.includes('stale')).length;
  // Context (assumptions, derived estimates, items without a claim) is not evidence that was set aside.
  const excluded = report.items.filter((item) => !item.admissible && !['assumption', 'derived', 'no-claim', 'ai-statement'].includes(item.exclusion ?? '')).length;
  const basis = [`${origins} independent origin${origins === 1 ? '' : 's'} behind the leading interpretation`];
  if (report.conflicts.length > 0) basis.push(`${report.conflicts.length} unresolved conflict${report.conflicts.length === 1 ? '' : 's'}`);
  if (report.misfit.detected) basis.push('evidence pattern does not fit the source model');
  if (report.missing.length > 0) basis.push(`${report.missing.length} scheduled observation${report.missing.length === 1 ? '' : 's'} missing`);
  if (aging > 0) basis.push(`${aging} aging item${aging === 1 ? '' : 's'} at reduced weight`);
  if (excluded > 0) basis.push(`${excluded} item${excluded === 1 ? '' : 's'} set aside by data-quality rules`);

  if (!report.sufficiency.sufficient) return { level: 'LOW', basis };
  const weakened = report.conflicts.length > 0 || report.misfit.detected || report.missing.length > 0 || aging > 0;
  return { level: origins >= 2 && !weakened ? 'HIGH' : 'MODERATE', basis };
};

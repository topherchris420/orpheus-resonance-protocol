import { Rng } from '@/engine/rng';

/** Statistical helpers for reporting. Intervals are descriptive estimates of uncertainty, never verdicts. */

export interface Interval {
  estimate: number;
  lower: number;
  upper: number;
  n: number;
}

const Z95 = 1.959963984540054;

/** Wilson score interval for a binomial proportion. */
export const wilson = (successes: number, trials: number, z = Z95): Interval | null => {
  if (trials <= 0) return null;
  const p = successes / trials;
  const z2 = z * z;
  const denominator = 1 + z2 / trials;
  const centre = (p + z2 / (2 * trials)) / denominator;
  const margin = (z * Math.sqrt((p * (1 - p)) / trials + z2 / (4 * trials * trials))) / denominator;
  return { estimate: p, lower: Math.max(0, centre - margin), upper: Math.min(1, centre + margin), n: trials };
};

export const meanOf = (values: readonly number[]): number => (values.length ? values.reduce((total, value) => total + value, 0) / values.length : Number.NaN);

export const median = (values: readonly number[]): number => {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const quantile = (sorted: readonly number[], q: number) => {
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
};

/** Percentile bootstrap interval for the mean, with a seeded generator so the interval is reproducible. */
export const bootstrapMean = (values: readonly number[], seed: string, resamples = 10000): Interval | null => {
  if (values.length === 0) return null;
  const estimate = meanOf(values);
  if (values.length === 1) return { estimate, lower: estimate, upper: estimate, n: 1 };
  const rng = Rng.fromSeed(`bootstrap/${seed}`);
  const means = new Float64Array(resamples);
  for (let r = 0; r < resamples; r += 1) {
    let total = 0;
    for (let i = 0; i < values.length; i += 1) total += values[rng.int(0, values.length - 1)];
    means[r] = total / values.length;
  }
  const sorted = Array.from(means).sort((a, b) => a - b);
  return { estimate, lower: quantile(sorted, 0.025), upper: quantile(sorted, 0.975), n: values.length };
};

/** Paired comparison: bootstrap interval for the mean within-unit difference (first − second). */
export const pairedDifference = (pairs: ReadonlyArray<[number, number]>, seed: string, resamples = 10000) =>
  bootstrapMean(
    pairs.map(([first, second]) => first - second),
    seed,
    resamples,
  );

/**
 * Two-sided bootstrap p-value for a mean difference of zero, by the percentile-interval inversion
 * (the smallest alpha at which the interval excludes zero). Reported only alongside intervals.
 */
export const bootstrapPValue = (differences: readonly number[], seed: string, resamples = 10000): number | null => {
  if (differences.length < 2) return null;
  const rng = Rng.fromSeed(`bootstrap-p/${seed}`);
  let below = 0;
  let above = 0;
  for (let r = 0; r < resamples; r += 1) {
    let total = 0;
    for (let i = 0; i < differences.length; i += 1) total += differences[rng.int(0, differences.length - 1)];
    const resampled = total / differences.length;
    if (resampled <= 0) below += 1;
    if (resampled >= 0) above += 1;
  }
  return Math.min(1, (2 * Math.min(below, above)) / resamples);
};

/** Holm–Bonferroni step-down adjustment. Returns adjusted p-values in the original order. */
export const holm = (pValues: readonly number[]): number[] => {
  const order = pValues.map((p, index) => ({ p, index })).sort((a, b) => a.p - b.p);
  const adjusted = new Array<number>(pValues.length);
  let running = 0;
  order.forEach(({ p, index }, rank) => {
    running = Math.max(running, Math.min(1, (pValues.length - rank) * p));
    adjusted[index] = running;
  });
  return adjusted;
};

/**
 * Calibration and selective-prediction metrics. A prediction is the probability the assistant assigns
 * to its leading interpretation, paired with whether that interpretation was true.
 */
export interface ScoredPrediction {
  probability: number;
  correct: boolean;
}

export interface ReliabilityBin {
  lower: number;
  upper: number;
  count: number;
  meanProbability: number;
  observedFrequency: number;
}

export const brierScore = (predictions: readonly ScoredPrediction[]): number => {
  if (predictions.length === 0) return 0;
  let total = 0;
  for (const prediction of predictions) {
    const error = prediction.probability - (prediction.correct ? 1 : 0);
    total += error * error;
  }
  return total / predictions.length;
};

/** Equal-width bins over [lower, upper]. Top-label probabilities for two interpretations lie in [0.5, 1]. */
export const reliabilityBins = (
  predictions: readonly ScoredPrediction[],
  binCount = 10,
  lower = 0.5,
  upper = 1,
): ReliabilityBin[] => {
  const width = (upper - lower) / binCount;
  const bins = Array.from({ length: binCount }, (_, index) => ({
    lower: lower + index * width,
    upper: lower + (index + 1) * width,
    count: 0,
    probabilitySum: 0,
    correctSum: 0,
  }));
  for (const prediction of predictions) {
    const raw = Math.floor((prediction.probability - lower) / width);
    const index = Math.min(binCount - 1, Math.max(0, raw));
    bins[index].count += 1;
    bins[index].probabilitySum += prediction.probability;
    bins[index].correctSum += prediction.correct ? 1 : 0;
  }
  return bins.map(({ lower: binLower, upper: binUpper, count, probabilitySum, correctSum }) => ({
    lower: binLower,
    upper: binUpper,
    count,
    meanProbability: count ? probabilitySum / count : 0,
    observedFrequency: count ? correctSum / count : 0,
  }));
};

/** Expected calibration error: count-weighted mean gap between stated probability and observed frequency. */
export const expectedCalibrationError = (bins: readonly ReliabilityBin[]): number => {
  const total = bins.reduce((sum, bin) => sum + bin.count, 0);
  if (total === 0) return 0;
  return bins.reduce((sum, bin) => sum + (bin.count / total) * Math.abs(bin.observedFrequency - bin.meanProbability), 0);
};

export interface RiskCoveragePoint {
  coverage: number;
  risk: number;
  threshold: number;
}

/** Error rate among the most confident predictions as coverage grows (selective prediction). */
export const riskCoverageCurve = (predictions: readonly ScoredPrediction[], points = 20): RiskCoveragePoint[] => {
  if (predictions.length === 0) return [];
  const sorted = [...predictions].sort((a, b) => b.probability - a.probability);
  const curve: RiskCoveragePoint[] = [];
  for (let step = 1; step <= points; step += 1) {
    const covered = Math.max(1, Math.round((step / points) * sorted.length));
    const slice = sorted.slice(0, covered);
    const errors = slice.filter((prediction) => !prediction.correct).length;
    curve.push({ coverage: covered / sorted.length, risk: errors / covered, threshold: slice[slice.length - 1].probability });
  }
  return curve;
};

export interface SelectiveSummary {
  total: number;
  covered: number;
  coverage: number;
  selectiveAccuracy: number;
  abstainedAccuracyIfForced: number;
}

/** Accuracy when the assistant answers only at or above `threshold`, and what forcing an answer would have cost. */
export const selectiveSummary = (predictions: readonly ScoredPrediction[], threshold: number): SelectiveSummary => {
  const covered = predictions.filter((prediction) => prediction.probability >= threshold);
  const abstained = predictions.filter((prediction) => prediction.probability < threshold);
  return {
    total: predictions.length,
    covered: covered.length,
    coverage: predictions.length ? covered.length / predictions.length : 0,
    selectiveAccuracy: covered.length ? covered.filter((prediction) => prediction.correct).length / covered.length : 0,
    abstainedAccuracyIfForced: abstained.length ? abstained.filter((prediction) => prediction.correct).length / abstained.length : 0,
  };
};

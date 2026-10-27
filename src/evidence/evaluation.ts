import { Rng } from '@/engine/rng';
import { ENGINE_VERSION } from '@/engine/version';
import { buildItem, corruptItem } from './build';
import {
  brierScore,
  expectedCalibrationError,
  reliabilityBins,
  selectiveSummary,
  type ReliabilityBin,
  type ScoredPrediction,
} from './calibration';
import { assessEvidence, assessNaive, DEFAULT_THRESHOLD, freshnessWeight } from './engine';
import { CLASS_ACCURACY } from './sources';
import type { EvidenceContext, EvidenceItem, ReliabilityClass, SourceProfile } from './types';

/**
 * Calibration evaluation over the method's declared domain: two interpretations with equal priors,
 * one to six reports from sources graded A–E, ages up to 1.5× the freshness window, occasional relays
 * and occasional corruption in transit. The sampler follows the declared model exactly — honest
 * sources are right with their class accuracy, and the world changes with the probability implied by
 * the freshness schedule — so a correct implementation must come out calibrated. This validates the
 * computation; it does not show that real sources behave this way.
 */
const CLASSES: Exclude<ReliabilityClass, 'F'>[] = ['A', 'B', 'C', 'D', 'E'];
const FRESHNESS = 300;

export const DOMAIN_SOURCES: SourceProfile[] = CLASSES.map((reliability) => ({
  id: `domain-${reliability}`,
  label: `Class ${reliability} source`,
  medium: 'human',
  reliability,
  freshnessTicks: FRESHNESS,
}));

export interface DomainTrial {
  context: EvidenceContext;
  truth: string;
}

const other = (hypothesis: string) => (hypothesis === 'h1' ? 'h2' : 'h1');

export const sampleDomainTrial = (rng: Rng, index: number): DomainTrial => {
  const nowTick = 1000;
  const truth = rng.chance(0.5) ? 'h1' : 'h2';
  const items: EvidenceItem[] = [];
  const reportCount = rng.int(1, 6);
  for (let r = 0; r < reportCount; r += 1) {
    const reliability = rng.pick(CLASSES);
    const age = rng.int(0, FRESHNESS + FRESHNESS / 2);
    // The world may have changed since an old observation, at the rate the freshness schedule implies.
    const changeProbability = (1 - freshnessWeight(age, FRESHNESS)) / 2;
    const stateThen = rng.chance(changeProbability) ? other(truth) : truth;
    const claim = rng.chance(CLASS_ACCURACY[reliability]) ? stateThen : other(stateThen);
    let item = buildItem({
      id: `t${index}-r${r}`,
      kind: 'report',
      title: `Report ${r + 1}`,
      text: `Report ${r + 1}`,
      sourceId: `domain-${reliability}`,
      claim,
      observedAtTick: nowTick - age,
      originId: `t${index}-o${r}`,
    });
    if (rng.chance(0.12)) item = corruptItem(item, { claim: other(claim) });
    items.push(item);
    if (rng.chance(0.15)) {
      items.push({ ...item, id: `${item.id}-relay`, title: `${item.title} (relayed)`, relayOf: item.id, receivedAtTick: nowTick });
    }
  }
  return {
    truth,
    context: {
      decisionId: `domain-${index}`,
      question: 'Which interpretation is true?',
      hypotheses: [
        { id: 'h1', label: 'Interpretation 1', short: 'H1', polarity: 'alarm' },
        { id: 'h2', label: 'Interpretation 2', short: 'H2', polarity: 'benign' },
      ],
      prior: { h1: 0.5, h2: 0.5 },
      sources: DOMAIN_SOURCES,
      items,
      expected: [],
      shifts: [],
      nowTick,
      tickSeconds: 1,
    },
  };
};

export interface MethodEvaluation {
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

const round = (value: number, decimals = 4) => {
  let scale = 1;
  for (let i = 0; i < decimals; i += 1) scale *= 10;
  return Math.round(value * scale) / scale;
};

const summarize = (method: string, seed: string, predictions: ScoredPrediction[], threshold: number): MethodEvaluation => {
  const bins = reliabilityBins(predictions);
  const selective = selectiveSummary(predictions, threshold);
  return {
    method,
    engineVersion: ENGINE_VERSION,
    evaluatedOn:
      'Declared-model domain sampler: 2 interpretations, equal priors, 1–6 reports graded A–E, ages up to 1.5× freshness, 12% corrupted in transit, 15% relayed.',
    seed,
    trials: predictions.length,
    ece: round(expectedCalibrationError(bins)),
    brier: round(brierScore(predictions)),
    selectiveAccuracy: round(selective.selectiveAccuracy),
    coverage: round(selective.coverage),
    threshold,
    bins: bins.map((bin) => ({
      lower: round(bin.lower),
      upper: round(bin.upper),
      count: bin.count,
      meanProbability: round(bin.meanProbability),
      observedFrequency: round(bin.observedFrequency),
    })),
    generatedBy: 'npm run evaluate (src/evidence/evaluation.ts)',
  };
};

/** Evaluates the uncertainty-aware method and the conventional baseline on identical sampled trials. */
export const evaluateDomainCalibration = (seed: string, trials: number, threshold = DEFAULT_THRESHOLD) => {
  const rng = Rng.fromSeed(seed);
  const aware: ScoredPrediction[] = [];
  const naive: ScoredPrediction[] = [];
  for (let index = 0; index < trials; index += 1) {
    const { context, truth } = sampleDomainTrial(rng, index);
    const awareReport = assessEvidence(context, { threshold });
    aware.push({ probability: awareReport.leadingProbability, correct: awareReport.leading === truth });
    const naiveReport = assessNaive(context);
    naive.push({ probability: naiveReport.leadingProbability, correct: naiveReport.leading === truth });
  }
  return {
    aware: summarize('aware-bayes-v1', seed, aware, threshold),
    naive: summarize('naive-bayes-v1', seed, naive, threshold),
  };
};

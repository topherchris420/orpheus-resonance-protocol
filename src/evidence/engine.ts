import { quantize } from '@/engine/numeric';
import { declaredAccuracy, NAIVE_UNKNOWN_ACCURACY, payloadDigest } from './sources';
import type {
  ConflictRecord,
  EvidenceContext,
  EvidenceItem,
  EvidenceReport,
  ExclusionReason,
  ItemAssessment,
  ItemFlag,
  SourceProfile,
} from './types';

/**
 * Evidence & Uncertainty Engine.
 *
 * `assessEvidence` asks whether the available observations justify a conclusion. It applies declared
 * admissibility rules (integrity, plausibility, source record, assumption changes, staleness,
 * independence), combines admissible items with Bayes' rule under the declared source model, checks
 * whether that model fits the evidence at all, and returns an explicit insufficient-evidence state when
 * the leading interpretation does not reach the decision threshold.
 *
 * `assessNaive` is the conventional baseline: the same Bayes' rule applied to every claim at face value,
 * with no data-quality handling and no abstention.
 *
 * Only basic arithmetic is used, so reports are bit-identical across JavaScript engines.
 */

export interface EngineOptions {
  /** Minimum posterior needed to conclude. Derived from the protocol payoff matrix. */
  threshold?: number;
  /** Significance level for the model-misfit check. */
  misfitAlpha?: number;
  /** Largest number of admissible items covered by the calibration evaluation. */
  evaluatedMaxItems?: number;
}

export const DEFAULT_THRESHOLD = 0.8;
export const DEFAULT_MISFIT_ALPHA = 0.01;
export const EVALUATED_MAX_ITEMS = 12;

const PROBABILITY_DECIMALS = 6;

/** Weight of a claim as it ages: full within the freshness window, linear decay to none at twice it. */
export const freshnessWeight = (ageTicks: number, freshnessTicks: number): number => {
  if (freshnessTicks <= 0) return ageTicks <= 0 ? 1 : 0;
  if (ageTicks <= freshnessTicks) return 1;
  if (ageTicks >= freshnessTicks * 2) return 0;
  return (freshnessTicks * 2 - ageTicks) / freshnessTicks;
};

const isFiniteNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value);

/** Field-level plausibility checks for transmitted payloads. */
export const implausibility = (item: EvidenceItem, context: EvidenceContext): string | null => {
  if (item.receivedAtTick < item.observedAtTick) return 'Received before it was observed.';
  if (item.observedAtTick > context.nowTick) return 'Timestamp is in the future.';
  const payloadClaim = item.payload.claim;
  if (payloadClaim !== undefined && payloadClaim !== item.claim) return 'Parsed claim does not match the payload.';
  if (item.claim !== undefined && !context.hypotheses.some((hypothesis) => hypothesis.id === item.claim)) {
    return 'Claim does not refer to a known interpretation.';
  }
  for (const [key, value] of Object.entries(item.payload)) {
    if (typeof value === 'number') {
      if (!isFiniteNumber(value) || Math.abs(value) > 1_000_000) return `Field "${key}" is out of range.`;
      if (key.toLowerCase().endsWith('count') && (!Number.isInteger(value) || value < 0 || value > 50)) {
        return `Field "${key}" is not a plausible count.`;
      }
    }
    if (typeof value === 'string' && value.length > 280) return `Field "${key}" is unexpectedly long.`;
  }
  return null;
};

const EXCLUSION_TEXT: Record<ExclusionReason, string> = {
  'ai-statement': 'Assistant output is never treated as an observation.',
  assumption: 'Assumptions provide context; they are not observations.',
  derived: 'Derived estimates restate their inputs and are not independent evidence.',
  'no-claim': 'Context only; it does not bear on the question.',
  'integrity-failure': 'Contents do not match the digest sent with them.',
  'implausible-field': 'A field failed a plausibility check.',
  'unverifiable-source': 'The source has no reliability record, so it cannot be weighed.',
  'source-model-changed': "The source's reliability record no longer applies.",
  expired: 'Too old to say anything about the present.',
  'duplicate-origin': 'Same origin as another item; counted once.',
};

const likelihood = (claim: string, hypothesisId: string, accuracy: number, hypothesisCount: number) =>
  claim === hypothesisId ? accuracy : (1 - accuracy) / (hypothesisCount - 1);

const normalizedPosterior = (
  context: EvidenceContext,
  claims: Array<{ claim: string; accuracy: number }>,
): Record<string, number> => {
  const count = context.hypotheses.length;
  const weights = context.hypotheses.map((hypothesis) => {
    let weight = context.prior[hypothesis.id] ?? 0;
    for (const { claim, accuracy } of claims) weight *= likelihood(claim, hypothesis.id, accuracy, count);
    return weight;
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const posterior: Record<string, number> = {};
  context.hypotheses.forEach((hypothesis, index) => {
    posterior[hypothesis.id] = total > 0 ? quantize(weights[index] / total, PROBABILITY_DECIMALS) : quantize(1 / count, PROBABILITY_DECIMALS);
  });
  return posterior;
};

/** Leading interpretation. Ties go to the most recently observed admissible claim, then declared order. */
const leadingHypothesis = (
  context: EvidenceContext,
  posterior: Record<string, number>,
  claims: Array<{ claim: string; observedAtTick: number }>,
): string => {
  const best = Math.max(...context.hypotheses.map((hypothesis) => posterior[hypothesis.id]));
  const tied = context.hypotheses.filter((hypothesis) => posterior[hypothesis.id] === best).map((hypothesis) => hypothesis.id);
  if (tied.length === 1) return tied[0];
  const recent = [...claims].sort((a, b) => b.observedAtTick - a.observedAtTick).find((claim) => tied.includes(claim.claim));
  return recent ? recent.claim : tied[0];
};

/** P(X >= threshold) for a sum of independent Bernoulli(q_i) variables (Poisson-binomial). */
export const poissonBinomialTail = (probabilities: readonly number[], threshold: number): number => {
  if (threshold <= 0) return 1;
  if (threshold > probabilities.length) return 0;
  let distribution = [1];
  for (const probability of probabilities) {
    const next = new Array(distribution.length + 1).fill(0);
    for (let k = 0; k < distribution.length; k += 1) {
      next[k] += distribution[k] * (1 - probability);
      next[k + 1] += distribution[k] * probability;
    }
    distribution = next;
  }
  let tail = 0;
  for (let k = threshold; k < distribution.length; k += 1) tail += distribution[k];
  return Math.min(1, tail);
};

const findConflicts = (context: EvidenceContext, items: Array<{ id: string; claim: string }>): ConflictRecord[] => {
  const conflicts: ConflictRecord[] = [];
  const ids = context.hypotheses.map((hypothesis) => hypothesis.id);
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const first = items.filter((item) => item.claim === ids[i]).map((item) => item.id);
      const second = items.filter((item) => item.claim === ids[j]).map((item) => item.id);
      if (first.length > 0 && second.length > 0) conflicts.push({ hypotheses: [ids[i], ids[j]], itemIds: [first, second] });
    }
  }
  return conflicts;
};

const sourceLookup = (context: EvidenceContext) => {
  const map = new Map<string, SourceProfile>();
  for (const source of context.sources) map.set(source.id, source);
  return map;
};

const isUniformBinaryPrior = (context: EvidenceContext) =>
  context.hypotheses.length === 2 &&
  context.hypotheses.every((hypothesis) => Math.abs((context.prior[hypothesis.id] ?? 0) - 0.5) < 1e-9);

export const assessEvidence = (context: EvidenceContext, options: EngineOptions = {}): EvidenceReport => {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const alpha = options.misfitAlpha ?? DEFAULT_MISFIT_ALPHA;
  const evaluatedMaxItems = options.evaluatedMaxItems ?? EVALUATED_MAX_ITEMS;
  const sources = sourceLookup(context);
  const hypothesisCount = context.hypotheses.length;
  const chance = 1 / hypothesisCount;
  const shiftedSources = new Set<string>();

  const assessments: ItemAssessment[] = context.items.map((item) => {
    const ageTicks = Math.max(0, context.nowTick - item.observedAtTick);
    const flags: ItemFlag[] = [];
    const source = item.sourceId ? sources.get(item.sourceId) : undefined;
    if (item.relayOf) flags.push('relay');
    if (source && item.receivedAtTick - item.observedAtTick > source.freshnessTicks / 2) flags.push('late-arrival');
    if (item.selfReportedConfidence === 'high' && (!source || !['A', 'B'].includes(source.reliability))) {
      flags.push('confidence-claim-unsupported');
    }
    const exclude = (exclusion: ExclusionReason, detail?: string): ItemAssessment => ({
      id: item.id,
      admissible: false,
      exclusion,
      exclusionDetail: detail ?? EXCLUSION_TEXT[exclusion],
      ageTicks,
      flags,
    });

    if (item.kind === 'ai-statement') return exclude('ai-statement');
    if (item.kind === 'assumption') return exclude('assumption');
    if (item.kind === 'derived') return exclude('derived');
    if (item.claim === undefined) return exclude('no-claim');
    if (payloadDigest(item.payload) !== item.digest) return exclude('integrity-failure');
    const implausible = implausibility(item, context);
    if (implausible) return exclude('implausible-field', implausible);
    const accuracy = source ? declaredAccuracy(source.reliability) : null;
    if (!source || accuracy === null) return exclude('unverifiable-source');
    const shift = context.shifts.find((candidate) => candidate.sourceId === source.id && item.observedAtTick >= candidate.fromTick);
    if (shift) {
      shiftedSources.add(source.id);
      return exclude('source-model-changed', shift.note);
    }
    const weight = freshnessWeight(ageTicks, source.freshnessTicks);
    if (weight === 0) return exclude('expired');
    if (weight < 1) flags.push('stale');
    return {
      id: item.id,
      admissible: true,
      declaredAccuracy: accuracy,
      effectiveAccuracy: quantize(chance + (accuracy - chance) * weight, PROBABILITY_DECIMALS),
      ageTicks,
      flags,
    };
  });

  // Independence: one representative per origin — the most recent, then the most reliable, then by id.
  const byId = new Map(context.items.map((item) => [item.id, item]));
  const representatives = new Map<string, ItemAssessment>();
  for (const assessment of assessments) {
    if (!assessment.admissible) continue;
    const item = byId.get(assessment.id)!;
    const current = representatives.get(item.originId);
    if (!current) {
      representatives.set(item.originId, assessment);
      continue;
    }
    const currentItem = byId.get(current.id)!;
    const better =
      item.observedAtTick !== currentItem.observedAtTick
        ? item.observedAtTick > currentItem.observedAtTick
        : (assessment.effectiveAccuracy ?? 0) !== (current.effectiveAccuracy ?? 0)
          ? (assessment.effectiveAccuracy ?? 0) > (current.effectiveAccuracy ?? 0)
          : item.id < currentItem.id;
    if (better) representatives.set(item.originId, assessment);
  }
  for (const assessment of assessments) {
    if (!assessment.admissible) continue;
    const item = byId.get(assessment.id)!;
    const representative = representatives.get(item.originId)!;
    if (representative.id !== assessment.id) {
      const kept = byId.get(representative.id)!;
      assessment.admissible = false;
      assessment.exclusion = 'duplicate-origin';
      assessment.exclusionDetail = `Same origin as "${kept.title}"; counted once.`;
      delete assessment.effectiveAccuracy;
    }
  }

  const admissible = assessments.filter((assessment) => assessment.admissible);
  const admissibleClaims = admissible.map((assessment) => {
    const item = byId.get(assessment.id)!;
    return { id: item.id, claim: item.claim!, accuracy: assessment.effectiveAccuracy!, observedAtTick: item.observedAtTick };
  });

  const conflicts = findConflicts(context, admissibleClaims);
  if (conflicts.length > 0) {
    const conflicted = new Set(conflicts.flatMap((conflict) => [...conflict.itemIds[0], ...conflict.itemIds[1]]));
    for (const assessment of admissible) if (conflicted.has(assessment.id)) assessment.flags.push('conflicting');
  }

  const support: Record<string, number> = {};
  for (const hypothesis of context.hypotheses) {
    support[hypothesis.id] = admissibleClaims.filter((claim) => claim.claim === hypothesis.id).length;
  }

  const posterior = normalizedPosterior(context, admissibleClaims);
  const leading = leadingHypothesis(context, posterior, admissibleClaims);
  const leadingProbability = posterior[leading];

  let tailProbability: number | null = null;
  if (admissibleClaims.length >= 3) {
    tailProbability = 0;
    for (const hypothesis of context.hypotheses) {
      const contradicting = admissibleClaims.filter((claim) => claim.claim !== hypothesis.id).length;
      const tail = poissonBinomialTail(admissibleClaims.map((claim) => 1 - claim.accuracy), contradicting);
      tailProbability = Math.max(tailProbability, tail);
    }
    tailProbability = quantize(tailProbability, PROBABILITY_DECIMALS);
  }
  const misfitDetected = tailProbability !== null && tailProbability < alpha;

  const missing = context.expected.filter(
    (expected) => expected.dueTick <= context.nowTick && !context.items.some((item) => item.fulfills === expected.id),
  );

  const domainReasons: string[] = [];
  if (hypothesisCount !== 2) domainReasons.push(`${hypothesisCount} interpretations (calibration was evaluated with 2).`);
  else if (!isUniformBinaryPrior(context)) domainReasons.push('Non-uniform prior (calibration was evaluated with equal priors).');
  if (admissibleClaims.length > evaluatedMaxItems) domainReasons.push(`More than ${evaluatedMaxItems} admissible items.`);
  if (misfitDetected) domainReasons.push('The evidence pattern does not fit the source model.');

  let sufficiency: EvidenceReport['sufficiency'];
  if (admissibleClaims.length === 0) sufficiency = { sufficient: false, reason: 'no-admissible-evidence' };
  else if (misfitDetected) sufficiency = { sufficient: false, reason: 'model-misfit' };
  else if (leadingProbability < threshold) {
    const unconfirmedConflict = conflicts.length > 0 && Object.values(support).every((origins) => origins < 2);
    sufficiency = { sufficient: false, reason: unconfirmedConflict ? 'unresolved-conflict' : 'insufficient-confidence' };
  } else sufficiency = { sufficient: true };

  return {
    method: 'aware-bayes-v1',
    threshold,
    items: assessments,
    admissibleIds: admissible.map((assessment) => assessment.id),
    missing,
    conflicts,
    support,
    posterior,
    leading,
    leadingProbability,
    misfit: { checked: tailProbability !== null, tailProbability, detected: misfitDetected },
    shiftedSources: [...shiftedSources],
    domain: { evaluated: domainReasons.length === 0, reasons: domainReasons },
    sufficiency,
  };
};

/**
 * Conventional baseline: every observation or report with a claim is used at face value with its
 * class accuracy (unknown sources assumed fairly reliable). No integrity, freshness, independence or
 * assumption checks, and no abstention.
 */
export const assessNaive = (context: EvidenceContext): EvidenceReport => {
  const sources = sourceLookup(context);
  const items: ItemAssessment[] = context.items.map((item) => {
    const ageTicks = Math.max(0, context.nowTick - item.observedAtTick);
    if (item.kind === 'ai-statement' || item.kind === 'assumption' || item.kind === 'derived' || item.claim === undefined) {
      const exclusion: ExclusionReason =
        item.kind === 'ai-statement' ? 'ai-statement' : item.kind === 'assumption' ? 'assumption' : item.kind === 'derived' ? 'derived' : 'no-claim';
      return { id: item.id, admissible: false, exclusion, exclusionDetail: EXCLUSION_TEXT[exclusion], ageTicks, flags: [] };
    }
    const source = item.sourceId ? sources.get(item.sourceId) : undefined;
    const accuracy = (source && declaredAccuracy(source.reliability)) ?? NAIVE_UNKNOWN_ACCURACY;
    return { id: item.id, admissible: true, declaredAccuracy: accuracy, effectiveAccuracy: accuracy, ageTicks, flags: [] };
  });
  const byId = new Map(context.items.map((item) => [item.id, item]));
  const claims = items
    .filter((assessment) => assessment.admissible)
    .map((assessment) => {
      const item = byId.get(assessment.id)!;
      return { id: item.id, claim: item.claim!, accuracy: assessment.effectiveAccuracy!, observedAtTick: item.observedAtTick };
    });
  const posterior = normalizedPosterior(context, claims);
  const leading = leadingHypothesis(context, posterior, claims);
  const support: Record<string, number> = {};
  for (const hypothesis of context.hypotheses) support[hypothesis.id] = claims.filter((claim) => claim.claim === hypothesis.id).length;
  return {
    method: 'naive-bayes-v1',
    threshold: 0,
    items,
    admissibleIds: claims.map((claim) => claim.id),
    missing: [],
    conflicts: findConflicts(context, claims),
    support,
    posterior,
    leading,
    leadingProbability: posterior[leading],
    misfit: { checked: false, tailProbability: null, detected: false },
    shiftedSources: [],
    domain: { evaluated: false, reasons: ['Conventional baseline: calibration is not evaluated or displayed.'] },
    sufficiency: { sufficient: true },
  };
};

export const exclusionText = (reason: ExclusionReason): string => EXCLUSION_TEXT[reason];

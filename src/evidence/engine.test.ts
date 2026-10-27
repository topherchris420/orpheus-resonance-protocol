import { describe, expect, it } from 'vitest';
import { Rng } from '@/engine/rng';
import { buildItem, corruptItem } from './build';
import { brierScore, expectedCalibrationError, reliabilityBins, riskCoverageCurve, selectiveSummary } from './calibration';
import { assessEvidence, assessNaive, freshnessWeight, poissonBinomialTail } from './engine';
import { CLASS_ACCURACY } from './sources';
import type { EvidenceContext, EvidenceItem, ReliabilityClass, SourceProfile } from './types';

const sources: SourceProfile[] = [
  { id: 'drone', label: 'Drone imagery', medium: 'sensor', reliability: 'A', freshnessTicks: 300 },
  { id: 'sigint', label: 'Signals intercept', medium: 'signals', reliability: 'B', freshnessTicks: 300 },
  { id: 'patrol', label: 'Patrol report', medium: 'human', reliability: 'B', freshnessTicks: 300 },
  { id: 'informant', label: 'Local informant', medium: 'human', reliability: 'D', freshnessTicks: 300 },
  { id: 'unknown-relay', label: 'Unvetted relay', medium: 'relay', reliability: 'F', freshnessTicks: 300 },
];

const context = (items: EvidenceItem[], overrides: Partial<EvidenceContext> = {}): EvidenceContext => ({
  decisionId: 'test',
  question: 'Is there activity at Overpass Delta?',
  hypotheses: [
    { id: 'active', label: 'Activity is present', short: 'Activity', polarity: 'alarm' },
    { id: 'quiet', label: 'No activity', short: 'Quiet', polarity: 'benign' },
  ],
  prior: { active: 0.5, quiet: 0.5 },
  sources,
  items,
  expected: [],
  shifts: [],
  nowTick: 100,
  tickSeconds: 1,
  ...overrides,
});

const report = (id: string, sourceId: string, claim: string, extra: Partial<Parameters<typeof buildItem>[0]> = {}) =>
  buildItem({ id, kind: 'report', title: id, text: `${sourceId} says ${claim}`, sourceId, claim, observedAtTick: 90, ...extra });

describe('Evidence & Uncertainty Engine', () => {
  it('concludes when two independent reliable sources agree', () => {
    const result = assessEvidence(context([report('a', 'drone', 'active'), report('b', 'patrol', 'active')]));
    expect(result.sufficiency).toEqual({ sufficient: true });
    expect(result.leading).toBe('active');
    expect(result.leadingProbability).toBeGreaterThan(0.99);
    expect(result.support.active).toBe(2);
    expect(result.domain.evaluated).toBe(true);
  });

  it('declares insufficient evidence for an unconfirmed conflict between equally reliable reports', () => {
    const result = assessEvidence(context([report('a', 'sigint', 'active'), report('b', 'patrol', 'quiet')]));
    expect(result.posterior).toEqual({ active: 0.5, quiet: 0.5 });
    expect(result.sufficiency).toEqual({ sufficient: false, reason: 'unresolved-conflict' });
    expect(result.conflicts).toHaveLength(1);
    expect(result.items.every((item) => item.flags.includes('conflicting'))).toBe(true);
  });

  it('resolves a conflict when reliability differs enough, without hiding it', () => {
    const result = assessEvidence(context([report('a', 'drone', 'active'), report('b', 'informant', 'quiet')]));
    expect(result.leading).toBe('active');
    expect(result.leadingProbability).toBeGreaterThan(0.9);
    expect(result.sufficiency.sufficient).toBe(true);
    expect(result.conflicts).toHaveLength(1);
  });

  it('excludes corrupted payloads that the conventional baseline takes at face value', () => {
    const honest = report('a', 'drone', 'quiet');
    const corrupted = corruptItem(report('b', 'sigint', 'quiet'), { claim: 'active' });
    const aware = assessEvidence(context([honest, corrupted]));
    expect(aware.items.find((item) => item.id === 'b')).toMatchObject({ admissible: false, exclusion: 'integrity-failure' });
    expect(aware.leading).toBe('quiet');
    const naive = assessNaive(context([honest, corrupted]));
    expect(naive.admissibleIds).toContain('b');
    expect(naive.posterior.active).toBeGreaterThan(aware.posterior.active);
  });

  it('flags implausible fields and impossible timestamps', () => {
    const negativeCount = report('a', 'drone', 'active', { fields: { contactCount: -3 } });
    const future = report('b', 'patrol', 'active', { observedAtTick: 150 });
    const result = assessEvidence(context([negativeCount, future]));
    expect(result.items.map((item) => item.exclusion)).toEqual(['implausible-field', 'implausible-field']);
    expect(result.sufficiency).toEqual({ sufficient: false, reason: 'no-admissible-evidence' });
  });

  it('counts relays of the same origin once, while the conventional baseline double counts', () => {
    const original = report('a', 'sigint', 'active', { originId: 'intercept-7' });
    const relay = report('b', 'patrol', 'active', { originId: 'intercept-7', relayOf: 'a' });
    const aware = assessEvidence(context([original, relay]));
    expect(aware.items.find((item) => item.id === 'b')).toMatchObject({ exclusion: 'duplicate-origin' });
    expect(aware.items.find((item) => item.id === 'b')?.flags).toContain('relay');
    expect(aware.support.active).toBe(1);
    expect(aware.leadingProbability).toBeCloseTo(0.85, 6);
    expect(aware.sufficiency.sufficient).toBe(true);
    const naive = assessNaive(context([original, relay]));
    expect(naive.leadingProbability).toBeGreaterThan(0.96);
  });

  it('discounts stale claims linearly toward chance and drops expired ones', () => {
    expect(freshnessWeight(100, 300)).toBe(1);
    expect(freshnessWeight(450, 300)).toBe(0.5);
    expect(freshnessWeight(600, 300)).toBe(0);
    const stale = report('a', 'drone', 'active', { observedAtTick: 0 });
    const result = assessEvidence(context([stale], { nowTick: 450 }));
    expect(result.items[0].flags).toContain('stale');
    expect(result.items[0].effectiveAccuracy).toBeCloseTo(0.5 + (CLASS_ACCURACY.A - 0.5) * 0.5, 6);
    expect(result.sufficiency).toEqual({ sufficient: false, reason: 'insufficient-confidence' });
    const expired = assessEvidence(context([stale], { nowTick: 600 }));
    expect(expired.items[0].exclusion).toBe('expired');
  });

  it('never admits assistant output as evidence, in either model', () => {
    const aiClaim = buildItem({ id: 'ai', kind: 'ai-statement', title: 'Assistant', text: 'Activity present', claim: 'active', observedAtTick: 99, sourceId: 'drone' });
    expect(assessEvidence(context([aiClaim])).items[0]).toMatchObject({ admissible: false, exclusion: 'ai-statement' });
    expect(assessNaive(context([aiClaim])).admissibleIds).toEqual([]);
  });

  it('treats derived estimates and assumptions as context, not independent evidence', () => {
    const derived = buildItem({ id: 'd', kind: 'derived', title: 'Estimate', text: 'Two or three contacts', observedAtTick: 95, parents: ['a'] });
    const assumption = buildItem({ id: 's', kind: 'assumption', title: 'Assumption', text: 'Contacts stay put for 10 minutes', observedAtTick: 0 });
    const result = assessEvidence(context([derived, assumption]));
    expect(result.items.map((item) => item.exclusion)).toEqual(['derived', 'assumption']);
  });

  it('refuses to weigh sources without a reliability record', () => {
    const unvetted = report('a', 'unknown-relay', 'active');
    const unregistered = report('b', 'not-in-registry', 'active');
    const aware = assessEvidence(context([unvetted, unregistered]));
    expect(aware.items.map((item) => item.exclusion)).toEqual(['unverifiable-source', 'unverifiable-source']);
    expect(aware.sufficiency.reason).toBe('no-admissible-evidence');
    expect(assessNaive(context([unvetted])).leadingProbability).toBeCloseTo(CLASS_ACCURACY.C, 6);
  });

  it('stops trusting a source after a declared assumption change', () => {
    const before = report('a', 'sigint', 'active', { observedAtTick: 40 });
    const after = report('b', 'sigint', 'quiet', { observedAtTick: 80, originId: 'b' });
    const result = assessEvidence(
      context([before, after], { shifts: [{ id: 'shift', sourceId: 'sigint', fromTick: 60, note: 'Relay replaced by an unvetted channel.' }] }),
    );
    expect(result.items.map((item) => item.exclusion)).toEqual([undefined, 'source-model-changed']);
    expect(result.shiftedSources).toEqual(['sigint']);
  });

  it('lists scheduled observations that never arrived', () => {
    const result = assessEvidence(
      context([report('a', 'patrol', 'active')], {
        expected: [
          { id: 'sweep-1', sourceId: 'drone', label: 'Drone sweep', dueTick: 80 },
          { id: 'sweep-2', sourceId: 'drone', label: 'Later sweep', dueTick: 200 },
        ],
      }),
    );
    expect(result.missing.map((item) => item.id)).toEqual(['sweep-1']);
  });

  it('flags confidence claims that the source record does not support, without using them', () => {
    const boastful = report('a', 'informant', 'active', { selfReportedConfidence: 'high' });
    const result = assessEvidence(context([boastful]));
    expect(result.items[0].flags).toContain('confidence-claim-unsupported');
    expect(result.items[0].effectiveAccuracy).toBe(CLASS_ACCURACY.D);
  });

  it('detects evidence patterns the source model cannot explain', () => {
    const split = [
      ...['a', 'b', 'c'].map((id) => report(id, 'drone', 'active', { originId: id })),
      ...['d', 'e', 'f'].map((id) => report(id, 'drone', 'quiet', { originId: id })),
    ];
    const result = assessEvidence(context(split));
    expect(result.misfit.detected).toBe(true);
    expect(result.misfit.tailProbability).toBeLessThan(0.01);
    expect(result.sufficiency.reason).toBe('model-misfit');
    expect(result.domain.evaluated).toBe(false);
  });

  it('marks configurations outside the evaluated domain', () => {
    const three = assessEvidence(
      context([report('a', 'drone', 'x')], {
        hypotheses: [
          { id: 'x', label: 'X', short: 'X', polarity: 'neutral' },
          { id: 'y', label: 'Y', short: 'Y', polarity: 'neutral' },
          { id: 'z', label: 'Z', short: 'Z', polarity: 'neutral' },
        ],
        prior: { x: 1 / 3, y: 1 / 3, z: 1 / 3 },
      }),
    );
    expect(three.domain.evaluated).toBe(false);
    const skewed = assessEvidence(context([report('a', 'drone', 'active')], { prior: { active: 0.7, quiet: 0.3 } }));
    expect(skewed.domain.reasons[0]).toMatch(/Non-uniform prior/);
  });

  it('computes Poisson-binomial tails exactly for known cases', () => {
    expect(poissonBinomialTail([0.5, 0.5, 0.5, 0.5, 0.5], 3)).toBeCloseTo(0.5, 12);
    expect(poissonBinomialTail([0.1, 0.2], 2)).toBeCloseTo(0.02, 12);
    expect(poissonBinomialTail([0.3], 0)).toBe(1);
    expect(poissonBinomialTail([0.3], 2)).toBe(0);
  });

  it('is deterministic: identical input yields an identical report', () => {
    const items = [report('a', 'drone', 'active'), corruptItem(report('b', 'sigint', 'active'), { claim: 'quiet' })];
    expect(JSON.stringify(assessEvidence(context(items)))).toBe(JSON.stringify(assessEvidence(context(items))));
  });
});

describe('calibration of the declared-model posterior', () => {
  const classes: ReliabilityClass[] = ['A', 'B', 'C', 'D', 'E'];
  const registry: SourceProfile[] = classes.map((reliability) => ({
    id: `s-${reliability}`,
    label: reliability,
    medium: 'human',
    reliability,
    freshnessTicks: 1000,
  }));

  const simulate = (trials: number, seed: string) => {
    const rng = Rng.fromSeed(seed);
    const predictions: Array<{ probability: number; correct: boolean }> = [];
    for (let trial = 0; trial < trials; trial += 1) {
      const truth = rng.chance(0.5) ? 'active' : 'quiet';
      const items = Array.from({ length: rng.int(1, 5) }, (_, index) => {
        const reliability = rng.pick(classes);
        const honest = rng.chance(CLASS_ACCURACY[reliability as Exclude<ReliabilityClass, 'F'>]);
        const claim = honest ? truth : truth === 'active' ? 'quiet' : 'active';
        return report(`r${index}`, `s-${reliability}`, claim, { originId: `o${index}` });
      });
      const result = assessEvidence(context(items, { sources: registry }));
      predictions.push({ probability: result.leadingProbability, correct: result.leading === truth });
    }
    return predictions;
  };

  it('is calibrated when evidence follows the declared model', () => {
    const predictions = simulate(4000, 'calibration-test');
    const ece = expectedCalibrationError(reliabilityBins(predictions));
    expect(ece).toBeLessThan(0.03);
    expect(brierScore(predictions)).toBeLessThan(0.2);
    const selective = selectiveSummary(predictions, 0.8);
    expect(selective.selectiveAccuracy).toBeGreaterThan(0.8);
    expect(selective.abstainedAccuracyIfForced).toBeLessThan(selective.selectiveAccuracy);
    const curve = riskCoverageCurve(predictions, 10);
    expect(curve[0].risk).toBeLessThanOrEqual(curve[curve.length - 1].risk);
  });
});

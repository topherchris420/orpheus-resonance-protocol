import { describe, expect, it, vi } from 'vitest';
import { Rng } from '@/engine/rng';
import { ENGINE_VERSION } from '@/engine/version';
import { buildItem, corruptItem } from '@/evidence/build';
import { sampleDomainTrial } from '@/evidence/evaluation';
import type { EvidenceContext, EvidenceItem, SourceProfile } from '@/evidence/types';
import { committedCalibrationRecord, createRegistry, defaultRegistry, MAX_DISPLAY_ECE } from './calibrationRegistry';
import { verifyProposal } from './guardrails';
import { assistantInput, runAssistant } from './index';
import { conventionalOutput, uncertaintyAwareOutput } from './providers/deterministic';
import { requestModelAssessment, type FetchLike } from './providers/externalModel';
import { assessmentOutputSchema, type AssessmentOutput } from './schema';

const sources: SourceProfile[] = [
  { id: 'drone', label: 'Drone imagery', medium: 'sensor', reliability: 'A', freshnessTicks: 300 },
  { id: 'sigint', label: 'Signals intercept', medium: 'signals', reliability: 'B', freshnessTicks: 300 },
  { id: 'patrol', label: 'Patrol report', medium: 'human', reliability: 'B', freshnessTicks: 300 },
];

const report = (id: string, sourceId: string, claim: string, observedAtTick = 90) =>
  buildItem({ id, kind: 'report', title: `${sourceId} report`, text: `${sourceId}: ${claim}`, sourceId, claim, observedAtTick });

const context = (items: EvidenceItem[], overrides: Partial<EvidenceContext> = {}): EvidenceContext => ({
  decisionId: 'overpass',
  question: 'Is there activity at Overpass Delta?',
  hypotheses: [
    { id: 'active', label: 'Activity is present at Overpass Delta', short: 'Activity', polarity: 'alarm' },
    { id: 'quiet', label: 'Overpass Delta is quiet', short: 'Quiet', polarity: 'benign' },
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

const agreeing = context([report('a', 'drone', 'active'), report('b', 'patrol', 'active')]);
const conflicting = context([report('a', 'sigint', 'active'), report('b', 'patrol', 'quiet')]);

describe('assistance conditions', () => {
  it('shows nothing in the human-only condition', () => {
    expect(runAssistant({ condition: 'A', context: agreeing }).output).toBeNull();
  });

  it('gives only a suggestion in the conventional condition', () => {
    const { output } = runAssistant({ condition: 'B', context: agreeing });
    expect(output).toMatchObject({ status: 'assessment', assessment: { hypothesisId: 'active' }, evidence: [], alternatives: [] });
    expect(output?.uncertainty).toBeUndefined();
    expect(output?.explanation).toBeUndefined();
  });

  it('adds cited evidence and alternatives in the explainable condition, without uncertainty', () => {
    const { output } = runAssistant({ condition: 'C', context: conflicting });
    expect(output?.status).toBe('assessment');
    expect(output?.evidence.map((reference) => reference.role).sort()).toEqual(['contradicts', 'supports']);
    expect(output?.alternatives).toHaveLength(1);
    expect(output?.uncertainty).toBeUndefined();
    expect(output?.abstention).toBeUndefined();
  });

  it('assesses with a calibrated probability when evidence is sufficient', () => {
    const { output } = runAssistant({ condition: 'D', context: agreeing });
    expect(output?.status).toBe('assessment');
    expect(output?.uncertainty?.probability?.value).toBeGreaterThan(0.99);
    expect(output?.uncertainty?.probability?.method).toBe('aware-bayes-v1');
    expect(output?.recommendation?.kind).toBe('review-before-relying');
  });

  it('declines to conclude on an unconfirmed conflict, in plain words', () => {
    const { output } = runAssistant({ condition: 'D', context: conflicting });
    expect(output?.status).toBe('abstention');
    expect(output?.assessment).toBeUndefined();
    expect(output?.abstention).toEqual({
      reason: 'unresolved-conflict',
      explanation: 'Two reports disagree, and neither has independent confirmation. Orpheus cannot establish which is accurate.',
    });
    expect(output?.recommendation?.kind).toBe('verify-independently');
    expect(output?.uncertainty?.unknowns).toContain('No interpretation is confirmed by two independent origins.');
  });

  it('asks for a re-sent message when the only evidence failed its integrity check', () => {
    const damaged = context([corruptItem(report('a', 'drone', 'quiet'), { claim: 'active' })]);
    const { output } = runAssistant({ condition: 'D', context: damaged });
    expect(output?.abstention?.reason).toBe('no-admissible-evidence');
    expect(output?.recommendation?.kind).toBe('check-integrity');
    expect(output?.flags.map((flag) => flag.code)).toContain('integrity-failure');
    // The conventional assistant takes the damaged message at face value.
    expect(runAssistant({ condition: 'B', context: damaged }).output?.assessment?.hypothesisId).toBe('active');
  });
});

describe('probability display rules', () => {
  it('withholds probabilities when no evaluated record exists', () => {
    const output = uncertaintyAwareOutput(agreeing, { threshold: 0.8, registry: createRegistry([]) });
    expect(output.uncertainty?.probability).toBeUndefined();
    expect(output.uncertainty?.probabilityWithheld).toMatch(/No evaluated calibration record/);
  });

  it('withholds probabilities outside the evaluated domain', () => {
    const three = context([report('a', 'drone', 'x'), report('b', 'patrol', 'x')], {
      hypotheses: [
        { id: 'x', label: 'X', short: 'X', polarity: 'neutral' },
        { id: 'y', label: 'Y', short: 'Y', polarity: 'neutral' },
        { id: 'z', label: 'Z', short: 'Z', polarity: 'neutral' },
      ],
      prior: { x: 1 / 3, y: 1 / 3, z: 1 / 3 },
    });
    const { output } = runAssistant({ condition: 'D', context: three });
    expect(output?.status).toBe('assessment');
    expect(output?.uncertainty?.probability).toBeUndefined();
    expect(output?.uncertainty?.probabilityWithheld).toMatch(/3 interpretations/);
  });

  it('uses a committed calibration record produced by the current engine', () => {
    expect(committedCalibrationRecord.engineVersion).toBe(ENGINE_VERSION);
    expect(committedCalibrationRecord.method).toBe('aware-bayes-v1');
    expect(committedCalibrationRecord.ece).toBeLessThanOrEqual(MAX_DISPLAY_ECE);
    expect(committedCalibrationRecord.trials).toBeGreaterThanOrEqual(10000);
    expect(defaultRegistry.lookup('aware-bayes-v1')).toBeDefined();
    expect(defaultRegistry.lookup('naive-bayes-v1')).toBeUndefined();
  });
});

describe('guardrails', () => {
  const valid = (): AssessmentOutput => uncertaintyAwareOutput(agreeing, { threshold: 0.8, registry: defaultRegistry });
  const verify = (proposal: unknown, condition: 'B' | 'C' | 'D' = 'D', ctx = agreeing) =>
    verifyProposal(proposal, { context: ctx, condition, threshold: 0.8, registry: defaultRegistry });

  it('accepts a well-formed, evidence-consistent proposal unchanged', () => {
    const outcome = verify(valid());
    expect(outcome.accepted).toBe(true);
    expect(outcome.violations).toEqual([]);
  });

  it('rejects malformed output and unknown fields', () => {
    expect(verify({ status: 'assessment' }).violations[0].code).toBe('schema');
    expect(verify({ ...valid(), confidenceScore: 0.99 }).violations[0].code).toBe('schema');
  });

  it('rejects citations of evidence that was never presented, and of assistant output', () => {
    const invented = { ...valid(), evidence: [{ evidenceId: 'satellite-9', role: 'supports', note: 'Invented.' }] };
    expect(verify(invented).violations.map((violation) => violation.code)).toContain('unknown-evidence');
    const aiItem = buildItem({ id: 'ai-1', kind: 'ai-statement', title: 'Earlier assistant note', text: 'Active.', claim: 'active', observedAtTick: 95 });
    const withAi = context([...agreeing.items, aiItem]);
    const citesAi = { ...uncertaintyAwareOutput(withAi, { threshold: 0.8, registry: defaultRegistry }), evidence: [{ evidenceId: 'ai-1', role: 'supports', note: 'Assistant said so.' }] };
    expect(verify(citesAi, 'D', withAi).violations.map((violation) => violation.code)).toContain('cites-ai-statement');
  });

  it('rejects operational directives and repairs recommendation wording', () => {
    const directive = { ...valid(), assessment: { hypothesisId: 'active', statement: 'Activity present — engage immediately.' } };
    expect(verify(directive).accepted).toBe(false);
    const recommendation = { ...valid(), recommendation: { kind: 'verify-independently', text: 'Breach the stairwell now.' } };
    const repaired = verify(recommendation);
    expect(repaired.accepted).toBe(true);
    expect(repaired.output?.recommendation?.text).not.toMatch(/breach/i);
  });

  it('rejects conclusions the admissible evidence does not support', () => {
    const conclusion = {
      ...uncertaintyAwareOutput(conflicting, { threshold: 0.8, registry: defaultRegistry }),
      status: 'assessment',
      abstention: undefined,
      assessment: { hypothesisId: 'active', statement: 'Activity is present.' },
    };
    expect(verify(conclusion, 'D', conflicting).violations.map((violation) => violation.code)).toContain('unsupported-conclusion');
  });

  it('removes probabilities that an evaluated method cannot reproduce', () => {
    const inflated = valid();
    inflated.uncertainty!.probability!.value = 0.5;
    const outcome = verify(inflated);
    expect(outcome.accepted).toBe(true);
    expect(outcome.output?.uncertainty?.probability).toBeUndefined();
    expect(outcome.violations[0].code).toBe('unreproducible-probability');
    const unknownMethod = valid();
    unknownMethod.uncertainty!.probability!.method = 'vibes-v2';
    expect(verify(unknownMethod).violations[0].code).toBe('unevaluated-probability');
  });
});

describe('simulated upstream model faults', () => {
  it('passes a contradictory explanation through B and C but not D', () => {
    const b = runAssistant({ condition: 'B', context: agreeing, perturbation: 'contradictory-explanation' });
    expect(b.output?.assessment?.hypothesisId).toBe('quiet');
    const c = runAssistant({ condition: 'C', context: agreeing, perturbation: 'contradictory-explanation' });
    expect(c.output?.assessment?.hypothesisId).toBe('quiet');
    expect(c.output?.evidence.filter((reference) => reference.role === 'supports')).toHaveLength(2);
    const d = runAssistant({ condition: 'D', context: agreeing, perturbation: 'contradictory-explanation' });
    expect(d.usedFallback).toBe(true);
    expect(d.output?.assessment?.hypothesisId).toBe('active');
    expect(d.output?.flags[0].code).toBe('guardrail-rejection');
  });

  it('refuses to display misleading confidence in D', () => {
    const d = runAssistant({ condition: 'D', context: conflicting, perturbation: 'misleading-confidence' });
    expect(d.usedFallback).toBe(true);
    expect(d.output?.status).toBe('abstention');
    expect(d.guardrail?.violations.map((violation) => violation.code)).toContain('unsupported-conclusion');
    const b = runAssistant({ condition: 'B', context: conflicting, perturbation: 'misleading-confidence' });
    expect(b.output?.assessment?.statement).toMatch(/Confidence: very high/);
  });
});

describe('assistant isolation and validity', () => {
  it('strips assistant statements from assistant input', () => {
    const aiItem = buildItem({ id: 'ai-1', kind: 'ai-statement', title: 'Assistant note', text: 'Quiet.', claim: 'quiet', observedAtTick: 99 });
    const input = assistantInput(context([...agreeing.items, aiItem]));
    expect(input.items.some((item) => item.kind === 'ai-statement')).toBe(false);
  });

  it('produces schema-valid output for every condition across sampled situations', () => {
    const rng = Rng.fromSeed('assistant-validity');
    for (let index = 0; index < 150; index += 1) {
      const { context: sampled } = sampleDomainTrial(rng, index);
      for (const condition of ['B', 'C', 'D'] as const) {
        for (const perturbation of [null, 'contradictory-explanation', 'misleading-confidence'] as const) {
          const { output } = runAssistant({ condition, context: sampled, perturbation });
          expect(assessmentOutputSchema.safeParse(output).success).toBe(true);
        }
      }
    }
  });

  it('keeps conventional and explainable suggestions identical on the same evidence', () => {
    for (const ctx of [agreeing, conflicting]) {
      expect(conventionalOutput(ctx, 'B').assessment).toEqual(conventionalOutput(ctx, 'C').assessment);
    }
  });
});

describe('external model adapter (experimental)', () => {
  const respond = (content: unknown): FetchLike => async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }) });

  it('accepts a valid, evidence-consistent model proposal', async () => {
    const proposal = { ...uncertaintyAwareOutput(agreeing, { threshold: 0.8, registry: defaultRegistry }), provider: { id: 'local-model', version: '0', kind: 'external-model' } };
    const result = await requestModelAssessment({ endpoint: 'http://model.test', model: 'm' }, 'D', agreeing, { fetchImpl: respond(JSON.stringify(proposal)) });
    expect(result.usedFallback).toBe(false);
    expect(result.output?.provider.kind).toBe('external-model');
  });

  it('falls back when the model concludes without sufficient evidence', async () => {
    const overreach = {
      ...uncertaintyAwareOutput(conflicting, { threshold: 0.8, registry: defaultRegistry }),
      provider: { id: 'local-model', version: '0', kind: 'external-model' },
      status: 'assessment',
      abstention: undefined,
      assessment: { hypothesisId: 'active', statement: 'Activity is present.' },
    };
    const result = await requestModelAssessment({ endpoint: 'http://model.test', model: 'm' }, 'D', conflicting, { fetchImpl: respond(`Here you go: ${JSON.stringify(overreach)}`) });
    expect(result.usedFallback).toBe(true);
    expect(result.output?.status).toBe('abstention');
  });

  it('falls back on malformed replies and unreachable endpoints', async () => {
    const malformed = await requestModelAssessment({ endpoint: 'http://model.test', model: 'm' }, 'D', agreeing, { fetchImpl: respond('not json') });
    expect(malformed.usedFallback).toBe(true);
    expect(malformed.output?.flags[0].code).toBe('assistant-unavailable');
    const failing: FetchLike = vi.fn(async () => {
      throw new Error('connection refused');
    });
    const offline = await requestModelAssessment({ endpoint: 'http://model.test', model: 'm' }, 'B', agreeing, { fetchImpl: failing });
    expect(offline.output?.assessment?.hypothesisId).toBe('active');
    expect(offline.output?.flags[0].message).toMatch(/connection refused/);
  });
});

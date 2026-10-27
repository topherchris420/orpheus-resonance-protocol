import { describe, expect, it } from 'vitest';
import { runAssistant } from '@/assistant/index';
import { assessEvidence, assessNaive } from '@/evidence/engine';
import { Rng } from '@/engine/rng';
import { BUILDING_47 } from './building47';
import { generateEvidence } from './evidence';
import { manifestHash, SCENARIOS } from './registry';
import { validateManifest } from './schema';
import { DEFAULT_BLOCK_MIX, generateStructureSet, INFORMATION_CONDITIONS, renderTrial, TASK_FORMS } from './taskFamily';
import { thresholdFromPayoff } from './types';

describe('scenario manifests', () => {
  it.each(SCENARIOS.map((manifest) => [manifest.id, manifest] as const))('%s is valid and self-consistent', (_, manifest) => {
    expect(validateManifest(manifest)).toEqual([]);
  });

  it('has stable, distinct manifest hashes', () => {
    const hashes = SCENARIOS.map(manifestHash);
    expect(new Set(hashes).size).toBe(hashes.length);
    expect(manifestHash(BUILDING_47)).toBe(manifestHash(structuredClone(BUILDING_47)));
  });

  it('preserves every v1 decision, course and effect value', () => {
    const v1 = {
      'dp-breach': ['dp-breach-dynamic', 'dp-breach-bypass', 'dp-breach-hold'],
      'dp-casualty': ['dp-casualty-evac', 'dp-casualty-split', 'dp-casualty-stabilize'],
      'dp-load': ['dp-load-handoff', 'dp-load-resonance', 'dp-load-push'],
      'dp-deception': ['dp-deception-trust-sigint', 'dp-deception-crosscheck', 'dp-deception-assume-worst'],
      'dp-exfil': ['dp-exfil-phoenix', 'dp-exfil-viper'],
    };
    for (const [pointId, options] of Object.entries(v1)) {
      expect(BUILDING_47.decisions.find((spec) => spec.id === pointId)?.options.map((option) => option.id)).toEqual(options);
    }
    const breachHold = BUILDING_47.decisions[0].options[2];
    expect(breachHold.effects).toMatchObject({ stress: -0.08, cohesion: -0.03, hostilePressure: 0.22, objectiveProgress: 0.08 });
    expect(BUILDING_47.decisions.map((spec) => spec.minPhase)).toEqual([1, 1, 2, 2, 3]);
  });

  it('flags manifests that break cross-references', () => {
    const broken = structuredClone(BUILDING_47);
    broken.decisions[0].options[0].stance = { kind: 'commit', hypothesisId: 'nobody' };
    broken.decisions[0].evidence[0].sourceId = 'ghost';
    broken.decisions[0].hypotheses[0].label = 'Engage the stairwell';
    const problems = validateManifest(broken);
    expect(problems.some((problem) => problem.includes('unknown hypothesis'))).toBe(true);
    expect(problems.some((problem) => problem.includes('unknown source'))).toBe(true);
    expect(problems.some((problem) => problem.includes('operational language'))).toBe(true);
  });

  it('derives the decision threshold from the declared payoffs', () => {
    expect(thresholdFromPayoff({ correct: 1, wrong: -4, defer: 0 })).toBeCloseTo(0.8);
    expect(thresholdFromPayoff({ correct: 1, wrong: -1, defer: 0 })).toBeCloseTo(0.5);
  });

  it('generates identical evidence for identical seeds', () => {
    const spec = BUILDING_47.decisions[1];
    const once = generateEvidence(spec, 'genuine', 10, Rng.fromSeed('evidence'), { include: 'base', sources: BUILDING_47.sources });
    const twice = generateEvidence(spec, 'genuine', 10, Rng.fromSeed('evidence'), { include: 'base', sources: BUILDING_47.sources });
    expect(once).toEqual(twice);
  });
});

describe('research task family', () => {
  const set = generateStructureSet('protocol-seed', 0);

  it('builds balanced blocks covering every information condition', () => {
    expect(set).toHaveLength(DEFAULT_BLOCK_MIX.length);
    expect(new Set(set.map((structure) => structure.condition))).toEqual(new Set(INFORMATION_CONDITIONS));
    expect(set.filter((structure) => structure.truth === 'alarm')).toHaveLength(DEFAULT_BLOCK_MIX.length / 2);
    expect(generateStructureSet('protocol-seed', 0)).toEqual(set);
    expect(generateStructureSet('protocol-seed', 1)).not.toEqual(set);
  });

  it('renders the same structure identically across forms except for wording', () => {
    for (const structure of set) {
      const rendered = TASK_FORMS.map((form) => renderTrial(structure, form, 'T1'));
      const shape = rendered.map((trial) => ({
        truth: trial.truth,
        claims: trial.context.items.map((item) => [item.kind, item.claim, item.observedAtTick, item.relayOf !== undefined]),
        expected: trial.context.expected.length,
        shifts: trial.context.shifts.length,
        posterior: assessEvidence(trial.context).posterior,
      }));
      for (const other of shape.slice(1)) expect(other).toEqual(shape[0]);
      expect(new Set(rendered.map((trial) => trial.context.question)).size).toBe(TASK_FORMS.length);
    }
  });

  it('produces the intended data-quality signature for each condition', () => {
    const byCondition = Object.fromEntries(set.map((structure) => [structure.condition, renderTrial(structure, TASK_FORMS[0], structure.id)]));
    const exclusions = (condition: string) => assessEvidence(byCondition[condition].context).items.map((item) => item.exclusion).filter(Boolean);
    expect(exclusions('corrupted')).toContain('integrity-failure');
    expect(exclusions('echo')).toContain('duplicate-origin');
    expect(exclusions('assumption-shift')).toContain('source-model-changed');
    expect(assessEvidence(byCondition.missing.context).missing).toHaveLength(1);
    expect(assessEvidence(byCondition.stale.context).items.some((item) => item.flags.includes('stale'))).toBe(true);
    expect(assessEvidence(byCondition['misleading-confidence'].context).items.some((item) => item.flags.includes('confidence-claim-unsupported'))).toBe(true);
    expect(assessEvidence(byCondition.conflict.context).sufficiency.sufficient).toBe(false);
    expect(byCondition.overload.context.items.length).toBeGreaterThanOrEqual(12);
    expect(byCondition['ai-contradictory'].aiPerturbation).toBe('contradictory-explanation');
    expect(byCondition['ai-overconfident'].aiPerturbation).toBe('misleading-confidence');
  });

  it('keeps ground truth out of what the assistant receives', () => {
    for (const structure of set) {
      const trial = renderTrial(structure, TASK_FORMS[2], structure.id);
      const serialized = JSON.stringify(trial.context);
      expect(serialized).not.toMatch(/"truth"|"afterShift"|"corrupted"|"boastful"/);
      const result = runAssistant({ condition: 'D', context: trial.context, perturbation: trial.aiPerturbation });
      expect(result.output).not.toBeNull();
    }
  });

  it('makes the conventional baseline vulnerable where the uncertainty-aware analysis is not', () => {
    const many = Array.from({ length: 40 }, (_, index) => generateStructureSet('vulnerability', index)).flat();
    const corrupted = many.filter((structure) => structure.condition === 'corrupted').map((structure) => renderTrial(structure, TASK_FORMS[3], structure.id));
    const naiveWrong = corrupted.filter((trial) => assessNaive(trial.context).leading !== trial.truth).length;
    const awareWrongCommitted = corrupted.filter((trial) => {
      const report = assessEvidence(trial.context);
      return report.sufficiency.sufficient && report.leading !== trial.truth;
    }).length;
    expect(naiveWrong).toBeGreaterThan(awareWrongCommitted);
  });
});

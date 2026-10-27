import type { Rng } from '@/engine/rng';
import { buildItem, corruptItem } from '@/evidence/build';
import { freshnessWeight } from '@/evidence/engine';
import { declaredAccuracy } from '@/evidence/sources';
import type { AssumptionShift, EvidenceContext, EvidenceItem, ExpectedObservation, PayloadValue, SourceProfile } from '@/evidence/types';
import type { DecisionSpec, EvidenceRecipe, ScenarioManifest } from './types';

export interface GeneratedEvidence {
  items: EvidenceItem[];
  expected: ExpectedObservation[];
  shifts: AssumptionShift[];
}

const otherHypothesis = (spec: Pick<DecisionSpec, 'hypotheses'>, id: string, rng?: Rng) => {
  const others = spec.hypotheses.filter((hypothesis) => hypothesis.id !== id);
  return rng && others.length > 1 ? rng.pick(others).id : others[0].id;
};

const textFor = (recipe: EvidenceRecipe, claim: string | undefined) =>
  typeof recipe.text === 'string' ? recipe.text : claim !== undefined ? (recipe.text[claim] ?? '') : Object.values(recipe.text)[0] ?? '';

const fieldsFor = (recipe: EvidenceRecipe, claim: string | undefined): Record<string, PayloadValue> => ({
  ...(recipe.fields ?? {}),
  ...(claim !== undefined ? (recipe.claimFields?.[claim] ?? {}) : {}),
});

export const scopedId = (decisionId: string, localId: string) => `${decisionId}:${localId}`;

/**
 * Generates a decision's evidence: the base items when it opens, or the red-team items when the
 * red-team simulation is (or becomes) active while it is open. Honest ("truthful") items follow the declared model:
 * the world may have changed since an old observation at the rate the freshness schedule implies, and
 * the source asserts the state it observed with its class accuracy. Adversarial items assert the
 * opposite. All draws come from the decision's own named RNG stream.
 */
export const generateEvidence = (
  spec: DecisionSpec,
  truth: string,
  unlockTick: number,
  rng: Rng,
  options: { include: 'base' | 'red-team'; sources: SourceProfile[]; existing?: readonly EvidenceItem[] },
): GeneratedEvidence => {
  const sources = new Map(options.sources.map((source) => [source.id, source]));
  const claims = new Map<string, string | undefined>();
  for (const item of options.existing ?? []) claims.set(item.id.slice(spec.id.length + 1), item.claim);
  const items: EvidenceItem[] = [];

  for (const recipe of spec.evidence) {
    if (Boolean(recipe.onlyWhenRedTeam) !== (options.include === 'red-team')) continue;
    const observedAtTick = unlockTick + recipe.observedOffset;
    let claim: string | undefined;
    switch (recipe.claim.mode) {
      case 'truthful': {
        const source = recipe.sourceId ? sources.get(recipe.sourceId) : undefined;
        const accuracy = (source && declaredAccuracy(source.reliability)) ?? 0.5;
        const age = Math.max(0, unlockTick - observedAtTick);
        const changeProbability = source ? (1 - freshnessWeight(age, source.freshnessTicks)) / 2 : 0;
        const stateThen = rng.chance(changeProbability) ? otherHypothesis(spec, truth, rng) : truth;
        claim = rng.chance(accuracy) ? stateThen : otherHypothesis(spec, stateThen, rng);
        break;
      }
      case 'opposite':
        claim = otherHypothesis(spec, truth, rng);
        break;
      case 'contradicts': {
        const reference = claims.get(recipe.claim.evidenceId);
        claim = reference === undefined ? otherHypothesis(spec, truth, rng) : otherHypothesis(spec, reference, rng);
        break;
      }
      case 'fixed':
        claim = recipe.claim.hypothesisId;
        break;
      default:
        claim = undefined;
    }
    claims.set(recipe.id, claim);

    let item = buildItem({
      id: scopedId(spec.id, recipe.id),
      kind: recipe.kind,
      title: recipe.title,
      text: textFor(recipe, claim),
      sourceId: recipe.sourceId,
      claim,
      observedAtTick,
      receivedAtTick: observedAtTick + (recipe.delay ?? 0),
      originId: scopedId(spec.id, recipe.originId ?? recipe.id),
      relayOf: recipe.relayOf ? scopedId(spec.id, recipe.relayOf) : undefined,
      fulfills: recipe.fulfills ? scopedId(spec.id, recipe.fulfills) : undefined,
      fields: fieldsFor(recipe, claim),
      selfReportedConfidence: recipe.selfReportedConfidence,
      parents: recipe.parents?.map((parent) => scopedId(spec.id, parent)),
    });
    if (recipe.corrupt && claim !== undefined) {
      const received = otherHypothesis(spec, claim, rng);
      item = corruptItem(item, { claim: received, fields: fieldsFor(recipe, received), text: textFor(recipe, received) });
    }
    items.push(item);
  }

  if (options.include === 'red-team') return { items, expected: [], shifts: [] };
  return {
    items,
    expected: (spec.expected ?? []).map((expected) => ({
      id: scopedId(spec.id, expected.id),
      sourceId: expected.sourceId,
      label: expected.label,
      dueTick: unlockTick + expected.dueOffset,
    })),
    shifts: (spec.shifts ?? []).map((shift) => ({
      id: scopedId(spec.id, shift.id),
      sourceId: shift.sourceId,
      fromTick: unlockTick + shift.fromOffset,
      note: shift.note,
    })),
  };
};

export const decisionEvidenceContext = (
  manifest: Pick<ScenarioManifest, 'sources' | 'tickSeconds'>,
  spec: DecisionSpec,
  generated: GeneratedEvidence,
  nowTick: number,
): EvidenceContext => ({
  decisionId: spec.id,
  question: spec.question,
  hypotheses: spec.hypotheses,
  prior: spec.prior,
  sources: manifest.sources,
  items: generated.items,
  expected: generated.expected,
  shifts: generated.shifts,
  nowTick,
  tickSeconds: manifest.tickSeconds,
});

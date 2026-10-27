import { z } from 'zod';
import { OPERATIONAL_LANGUAGE } from '@/assistant/guardrails';
import type { ScenarioManifest } from './types';

const reliability = z.enum(['A', 'B', 'C', 'D', 'E', 'F']);
const payloadValue = z.union([z.string(), z.number(), z.boolean()]);
const effects = z
  .object({
    stress: z.number().min(-1).max(1),
    cohesion: z.number().min(-1).max(1),
    hostilePressure: z.number().min(-1).max(1),
    intel: z.string().min(1),
    severity: z.enum(['nominal', 'watch', 'critical']),
    objectiveProgress: z.number().min(-1).max(1),
  })
  .strict();

const claimMode = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('truthful') }).strict(),
  z.object({ mode: z.literal('opposite') }).strict(),
  z.object({ mode: z.literal('contradicts'), evidenceId: z.string() }).strict(),
  z.object({ mode: z.literal('fixed'), hypothesisId: z.string() }).strict(),
  z.object({ mode: z.literal('none') }).strict(),
]);

const recipe = z
  .object({
    id: z.string().min(1),
    kind: z.enum(['observation', 'report', 'derived', 'assumption', 'ai-statement']),
    title: z.string().min(1),
    text: z.union([z.string().min(1), z.record(z.string().min(1))]),
    sourceId: z.string().optional(),
    claim: claimMode,
    observedOffset: z.number().int(),
    delay: z.number().int().min(0).optional(),
    originId: z.string().optional(),
    relayOf: z.string().optional(),
    fulfills: z.string().optional(),
    fields: z.record(payloadValue).optional(),
    claimFields: z.record(z.record(payloadValue)).optional(),
    selfReportedConfidence: z.enum(['low', 'moderate', 'high']).optional(),
    parents: z.array(z.string()).optional(),
    corrupt: z.boolean().optional(),
    onlyWhenRedTeam: z.boolean().optional(),
  })
  .strict();

const stance = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('commit'), hypothesisId: z.string() }).strict(),
  z.object({ kind: z.literal('commit-claim'), evidenceId: z.string() }).strict(),
  z.object({ kind: z.literal('verify') }).strict(),
  z.object({ kind: z.literal('hedge') }).strict(),
]);

const decision = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    situation: z.string().min(1),
    question: z.string().min(1),
    tag: z.enum(['hostile', 'cohesion', 'stress', 'redteam', 'baseline', 'orientation']),
    objectiveId: z.string(),
    minPhase: z.number().int().min(1),
    after: z.string().optional(),
    hypotheses: z
      .array(z.object({ id: z.string().min(1), label: z.string().min(1), short: z.string().min(1), polarity: z.enum(['alarm', 'benign', 'neutral']) }).strict())
      .min(2)
      .max(3),
    prior: z.record(z.number().min(0).max(1)),
    truth: z.union([z.object({ mode: z.literal('sampled') }).strict(), z.object({ mode: z.literal('fixed'), hypothesisId: z.string() }).strict()]),
    evidence: z.array(recipe).min(1),
    expected: z.array(z.object({ id: z.string(), sourceId: z.string(), label: z.string(), dueOffset: z.number().int() }).strict()).optional(),
    shifts: z.array(z.object({ id: z.string(), sourceId: z.string(), fromOffset: z.number().int(), note: z.string() }).strict()).optional(),
    options: z
      .array(
        z
          .object({
            id: z.string().min(1),
            title: z.string().min(1),
            consequences: z.string().min(1),
            risk: z.enum(['LOW', 'MODERATE', 'HIGH']),
            authoredWeight: z.number().min(0).max(1),
            effects,
            stance,
          })
          .strict(),
      )
      .min(2),
    ifAssumptionWrong: z
      .object({
        effects: z
          .object({ stress: z.number(), cohesion: z.number(), hostilePressure: z.number(), objectiveProgress: z.number() })
          .strict(),
        narrative: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const manifestSchema = z
  .object({
    schema: z.literal('orpheus.scenario-manifest.v1'),
    id: z.string().regex(/^[a-z0-9-]+$/),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    title: z.string().min(1),
    summary: z.string().min(1),
    fictionNotice: z.string().min(1),
    tickSeconds: z.number().positive(),
    phases: z.array(z.object({ index: z.number().int().min(1), label: z.string(), description: z.string() }).strict()).min(1),
    autoAdvanceTicks: z.number().int().positive(),
    shortlistSize: z.number().int().min(1),
    sources: z
      .array(
        z
          .object({
            id: z.string().min(1),
            label: z.string().min(1),
            medium: z.enum(['sensor', 'telemetry', 'signals', 'human', 'relay', 'open']),
            reliability,
            freshnessTicks: z.number().int().positive(),
            description: z.string().optional(),
          })
          .strict(),
      )
      .min(1),
    objectives: z.array(z.object({ id: z.string(), label: z.string(), detail: z.string(), initialProgress: z.number().min(0).max(1) }).strict()).min(1),
    decisions: z.array(decision).min(1),
    world: z.object({ squad: z.array(z.string()).min(1), initialTracks: z.number().int().min(0), redTeamAvailable: z.boolean(), intel: z.boolean() }).strict(),
    payoff: z.object({ correct: z.number(), wrong: z.number(), defer: z.number() }).strict(),
  })
  .strict();

/** Structural validation plus the cross-references a schema cannot express. Returns problems found. */
export const validateManifest = (manifest: ScenarioManifest): string[] => {
  const parsed = manifestSchema.safeParse(manifest);
  if (!parsed.success) return parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
  const problems: string[] = [];
  const sources = new Set(manifest.sources.map((source) => source.id));
  const objectives = new Set(manifest.objectives.map((objective) => objective.id));
  const decisionIds = new Set(manifest.decisions.map((spec) => spec.id));
  const maxPhase = Math.max(...manifest.phases.map((phase) => phase.index));
  if (decisionIds.size !== manifest.decisions.length) problems.push('Decision ids must be unique.');
  if (manifest.payoff.correct <= manifest.payoff.defer || manifest.payoff.defer <= manifest.payoff.wrong) {
    problems.push('Payoffs must satisfy correct > defer > wrong.');
  }
  for (const spec of manifest.decisions) {
    const where = `decision ${spec.id}`;
    const hypotheses = new Set(spec.hypotheses.map((hypothesis) => hypothesis.id));
    const evidenceIds = new Set(spec.evidence.map((item) => item.id));
    if (hypotheses.size !== spec.hypotheses.length) problems.push(`${where}: hypothesis ids must be unique.`);
    const priorTotal = spec.hypotheses.reduce((total, hypothesis) => total + (spec.prior[hypothesis.id] ?? 0), 0);
    if (Math.abs(priorTotal - 1) > 1e-9) problems.push(`${where}: prior must sum to 1.`);
    if (!objectives.has(spec.objectiveId)) problems.push(`${where}: unknown objective ${spec.objectiveId}.`);
    if (spec.minPhase > maxPhase) problems.push(`${where}: minPhase beyond the last phase.`);
    if (spec.after && !decisionIds.has(spec.after)) problems.push(`${where}: "after" refers to an unknown decision.`);
    if (spec.truth.mode === 'fixed' && !hypotheses.has(spec.truth.hypothesisId)) problems.push(`${where}: fixed truth is not a hypothesis.`);
    for (const hypothesis of spec.hypotheses) {
      if (OPERATIONAL_LANGUAGE.test(hypothesis.label)) problems.push(`${where}: hypothesis "${hypothesis.id}" uses operational language.`);
    }
    if (OPERATIONAL_LANGUAGE.test(spec.question)) problems.push(`${where}: question uses operational language.`);
    for (const item of spec.evidence) {
      const at = `${where} evidence ${item.id}`;
      if (item.sourceId && !sources.has(item.sourceId)) problems.push(`${at}: unknown source ${item.sourceId}.`);
      if ((item.kind === 'observation' || item.kind === 'report') && item.claim.mode !== 'none' && !item.sourceId) {
        problems.push(`${at}: claim-bearing items need a source.`);
      }
      if (item.claim.mode !== 'none') {
        if (typeof item.text === 'string') problems.push(`${at}: claim-bearing items need text for each hypothesis.`);
        else for (const hypothesis of hypotheses) if (!item.text[hypothesis]) problems.push(`${at}: missing text for "${hypothesis}".`);
      }
      if (item.claim.mode === 'fixed' && !hypotheses.has(item.claim.hypothesisId)) problems.push(`${at}: fixed claim is not a hypothesis.`);
      if (item.claim.mode === 'contradicts' && !evidenceIds.has(item.claim.evidenceId)) problems.push(`${at}: contradicts an unknown item.`);
      if (item.relayOf && !evidenceIds.has(item.relayOf)) problems.push(`${at}: relays an unknown item.`);
      for (const parent of item.parents ?? []) if (!evidenceIds.has(parent)) problems.push(`${at}: unknown parent ${parent}.`);
      if (item.kind === 'ai-statement') problems.push(`${at}: scenarios may not author assistant statements as evidence.`);
    }
    for (const expected of spec.expected ?? []) if (!sources.has(expected.sourceId)) problems.push(`${where}: expected observation has unknown source.`);
    for (const shift of spec.shifts ?? []) if (!sources.has(shift.sourceId)) problems.push(`${where}: shift has unknown source.`);
    for (const option of spec.options) {
      if (option.stance.kind === 'commit' && !hypotheses.has(option.stance.hypothesisId)) problems.push(`${where} option ${option.id}: unknown hypothesis.`);
      if (option.stance.kind === 'commit-claim' && !evidenceIds.has(option.stance.evidenceId)) problems.push(`${where} option ${option.id}: unknown evidence.`);
    }
    if (new Set(spec.options.map((option) => option.id)).size !== spec.options.length) problems.push(`${where}: option ids must be unique.`);
  }
  return problems;
};

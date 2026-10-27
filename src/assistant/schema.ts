import { z } from 'zod';
import { SCHEMA } from '@/engine/version';

/**
 * Assistance conditions of the human–AI teaming protocol.
 * - A: human only (no assistant).
 * - B: conventional AI — a suggestion only.
 * - C: explainable AI — a suggestion with cited evidence and alternatives.
 * - D: uncertainty-aware AI — assessment or abstention, evidence, alternatives, unknowns,
 *      calibrated probability when valid, and a bounded recommendation for further analysis.
 */
export type AssistanceCondition = 'A' | 'B' | 'C' | 'D';
export type AssistedCondition = Exclude<AssistanceCondition, 'A'>;

export const CONDITION_LABEL: Record<AssistanceCondition, string> = {
  A: 'Human only',
  B: 'Conventional AI',
  C: 'Explainable AI',
  D: 'Uncertainty-aware AI',
};

export const CONDITION_SUMMARY: Record<AssistanceCondition, string> = {
  A: 'No assistant. You assess the evidence yourself.',
  B: 'The assistant suggests an answer without explaining it.',
  C: 'The assistant suggests an answer and cites the evidence behind it.',
  D: 'The assistant explains its reasoning, reports what is unknown, and declines to conclude when the evidence is insufficient.',
};

/** Recommendations are limited to further analysis or verification. None of them is an operational action. */
export const RECOMMENDATION_KINDS = [
  'verify-independently',
  'request-update',
  'check-integrity',
  'compare-sources',
  'review-before-relying',
] as const;
export type RecommendationKind = (typeof RECOMMENDATION_KINDS)[number];

export const ABSTENTION_REASONS = [
  'no-admissible-evidence',
  'model-misfit',
  'unresolved-conflict',
  'insufficient-confidence',
  'guardrail-rejection',
  'assistant-unavailable',
] as const;

const id = z.string().min(1).max(64);
const shortText = z.string().min(1).max(400);

const evidenceReference = z
  .object({
    evidenceId: id,
    role: z.enum(['supports', 'contradicts', 'excluded', 'context']),
    note: z.string().max(400),
  })
  .strict();

const statement = z.object({ hypothesisId: id, statement: shortText }).strict();

const alternative = z.object({ hypothesisId: id, statement: shortText, whyNotPreferred: z.string().max(400) }).strict();

const probability = z
  .object({
    hypothesisId: id,
    value: z.number().min(0).max(1),
    method: z.string().min(1).max(64),
    calibrationRef: z.string().min(1).max(120),
  })
  .strict();

export const assessmentOutputSchema = z
  .object({
    schema: z.literal(SCHEMA.assessment),
    decisionId: id,
    condition: z.enum(['B', 'C', 'D']),
    provider: z
      .object({
        id: z.string().min(1).max(64),
        version: z.string().min(1).max(32),
        kind: z.enum(['deterministic', 'external-model', 'perturbed']),
      })
      .strict(),
    status: z.enum(['assessment', 'abstention']),
    assessment: statement.optional(),
    explanation: z.string().max(900).optional(),
    evidence: z.array(evidenceReference).max(40),
    alternatives: z.array(alternative).max(6),
    uncertainty: z
      .object({
        unknowns: z.array(z.string().min(1).max(400)).max(12),
        probability: probability.optional(),
        probabilityWithheld: z.string().max(400).optional(),
      })
      .strict()
      .optional(),
    recommendation: z.object({ kind: z.enum(RECOMMENDATION_KINDS), text: shortText }).strict().optional(),
    abstention: z.object({ reason: z.enum(ABSTENTION_REASONS), explanation: z.string().min(1).max(900) }).strict().optional(),
    flags: z.array(z.object({ code: z.string().min(1).max(64), message: z.string().min(1).max(400) }).strict()).max(12),
  })
  .strict()
  .superRefine((output, issues) => {
    const fail = (message: string) => issues.addIssue({ code: z.ZodIssueCode.custom, message });
    if (output.status === 'assessment' && !output.assessment) fail('An assessment requires a conclusion.');
    if (output.status === 'abstention' && (!output.abstention || output.assessment)) {
      fail('An abstention must state its reason and must not include a conclusion.');
    }
    if (output.condition !== 'D') {
      if (output.status === 'abstention') fail('Only the uncertainty-aware condition may abstain.');
      if (output.uncertainty || output.abstention || output.recommendation) {
        fail('Uncertainty reporting, abstention and recommendations belong to the uncertainty-aware condition.');
      }
    }
    if (output.condition === 'B' && (output.evidence.length > 0 || output.alternatives.length > 0 || output.explanation)) {
      fail('The conventional condition presents a suggestion only.');
    }
  });

export type AssessmentOutput = z.infer<typeof assessmentOutputSchema>;
export type EvidenceReference = AssessmentOutput['evidence'][number];

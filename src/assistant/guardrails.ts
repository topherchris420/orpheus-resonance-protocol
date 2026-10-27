import { assessEvidence } from '@/evidence/engine';
import type { EvidenceContext } from '@/evidence/types';
import type { CalibrationRegistry } from './calibrationRegistry';
import { assessmentOutputSchema, type AssessmentOutput, type AssistedCondition } from './schema';
import { RECOMMENDATION_TEXT } from './text';

/**
 * Deterministic guardrails applied to every assistant proposal before anything is shown.
 *
 * Structural rules (all assisted conditions): schema validity, known decision/hypotheses/evidence,
 * no citation of assistant output as evidence, no operational directives.
 *
 * Epistemic rules (uncertainty-aware condition): the conclusion must be the one the admissible
 * evidence supports and must clear the decision threshold; cited evidence must actually support or
 * contradict what it is cited for; a probability is shown only if an evaluated method reproduces it.
 *
 * A model's statement never gains authority by being produced: it is either verified against the
 * evidence or discarded.
 */
export type ViolationCode =
  | 'schema'
  | 'condition-mismatch'
  | 'decision-mismatch'
  | 'unknown-hypothesis'
  | 'unknown-evidence'
  | 'cites-ai-statement'
  | 'operational-language'
  | 'unsupported-conclusion'
  | 'conclusion-contradicts-evidence'
  | 'inconsistent-explanation'
  | 'unevaluated-probability'
  | 'outside-evaluated-domain'
  | 'unreproducible-probability';

export interface Violation {
  code: ViolationCode;
  /** `reject` discards the proposal; `repair` removes the offending part and keeps the rest. */
  action: 'reject' | 'repair';
  message: string;
}

export interface GuardrailOutcome {
  accepted: boolean;
  output: AssessmentOutput | null;
  violations: Violation[];
}

/** Directive language that would turn an assessment into an operational instruction. */
export const OPERATIONAL_LANGUAGE =
  /\b(engage|engaging|strike|strikes|open fire|fire on|attack|assault|neutrali[sz]e|kill|eliminate|destroy|breach|shoot|detonate|launch|ambush|move in|take out)\b/i;

export const PROBABILITY_TOLERANCE = 0.005;

const textFields = (output: AssessmentOutput): Array<[string, string]> => [
  ...(output.assessment ? ([['assessment', output.assessment.statement]] as Array<[string, string]>) : []),
  ...(output.explanation ? ([['explanation', output.explanation]] as Array<[string, string]>) : []),
  ...output.alternatives.flatMap((alternative): Array<[string, string]> => [
    ['alternative', alternative.statement],
    ['alternative', alternative.whyNotPreferred],
  ]),
  ...output.evidence.map((reference): [string, string] => ['evidence note', reference.note]),
  ...(output.uncertainty?.unknowns ?? []).map((unknown): [string, string] => ['unknown', unknown]),
  ...(output.abstention ? ([['abstention', output.abstention.explanation]] as Array<[string, string]>) : []),
];

export interface GuardrailInput {
  context: EvidenceContext;
  condition: AssistedCondition;
  threshold: number;
  registry: CalibrationRegistry;
}

export const verifyProposal = (raw: unknown, input: GuardrailInput): GuardrailOutcome => {
  const parsed = assessmentOutputSchema.safeParse(raw);
  if (!parsed.success) {
    const message = parsed.error.issues
      .slice(0, 3)
      .map((issue) => `${issue.path.join('.') || 'output'}: ${issue.message}`)
      .join('; ');
    return { accepted: false, output: null, violations: [{ code: 'schema', action: 'reject', message }] };
  }
  const output: AssessmentOutput = structuredClone(parsed.data);
  const violations: Violation[] = [];
  const reject = (code: ViolationCode, message: string) => violations.push({ code, action: 'reject', message });
  const repair = (code: ViolationCode, message: string) => violations.push({ code, action: 'repair', message });
  const { context } = input;

  if (output.condition !== input.condition) reject('condition-mismatch', `Proposal was produced for condition ${output.condition}.`);
  if (output.decisionId !== context.decisionId) reject('decision-mismatch', 'Proposal refers to a different decision.');

  const hypothesisIds = new Set(context.hypotheses.map((hypothesis) => hypothesis.id));
  const referenced = [
    output.assessment?.hypothesisId,
    output.uncertainty?.probability?.hypothesisId,
    ...output.alternatives.map((alternative) => alternative.hypothesisId),
  ].filter((value): value is string => value !== undefined);
  for (const id of referenced) if (!hypothesisIds.has(id)) reject('unknown-hypothesis', `Unknown interpretation "${id}".`);

  const items = new Map(context.items.map((item) => [item.id, item]));
  for (const reference of output.evidence) {
    const item = items.get(reference.evidenceId);
    if (!item) reject('unknown-evidence', `Cites evidence "${reference.evidenceId}" that was not presented.`);
    else if (item.kind === 'ai-statement' && reference.role !== 'excluded') {
      reject('cites-ai-statement', 'Cites assistant output as if it were evidence.');
    }
  }

  for (const [field, text] of textFields(output)) {
    if (OPERATIONAL_LANGUAGE.test(text)) reject('operational-language', `The ${field} contains an operational directive.`);
  }
  if (output.recommendation && OPERATIONAL_LANGUAGE.test(output.recommendation.text)) {
    repair('operational-language', 'Recommendation text replaced with the approved wording for its kind.');
    output.recommendation = { kind: output.recommendation.kind, text: RECOMMENDATION_TEXT[output.recommendation.kind] };
  }

  if (input.condition === 'D' && !violations.some((violation) => violation.action === 'reject')) {
    const report = assessEvidence(context, { threshold: input.threshold });
    if (output.status === 'assessment' && output.assessment) {
      if (!report.sufficiency.sufficient) {
        reject('unsupported-conclusion', 'The admissible evidence does not reach the threshold for any conclusion.');
      } else if (output.assessment.hypothesisId !== report.leading) {
        reject('conclusion-contradicts-evidence', 'The conclusion is not the interpretation the admissible evidence supports.');
      }
    }
    const anchor = output.assessment?.hypothesisId ?? report.leading;
    const assessments = new Map(report.items.map((assessment) => [assessment.id, assessment]));
    for (const reference of output.evidence) {
      const assessment = assessments.get(reference.evidenceId);
      const item = items.get(reference.evidenceId);
      if (!assessment || !item) continue;
      if (reference.role === 'supports' && (!assessment.admissible || item.claim !== anchor)) {
        reject('inconsistent-explanation', `"${item.title}" is cited as support but does not support the stated conclusion.`);
      }
      if (reference.role === 'contradicts' && (!assessment.admissible || item.claim === anchor)) {
        reject('inconsistent-explanation', `"${item.title}" is cited as contradicting but does not.`);
      }
      if (reference.role === 'excluded' && assessment.admissible) {
        reject('inconsistent-explanation', `"${item.title}" is described as excluded but is admissible.`);
      }
    }
    const probability = output.uncertainty?.probability;
    if (probability && output.uncertainty) {
      const evaluated = input.registry.lookup(probability.method);
      let problem: Violation | null = null;
      if (!evaluated) problem = { code: 'unevaluated-probability', action: 'repair', message: `Method "${probability.method}" has no evaluated calibration record.` };
      else if (!report.domain.evaluated) problem = { code: 'outside-evaluated-domain', action: 'repair', message: report.domain.reasons.join(' ') };
      else if (
        probability.hypothesisId !== report.leading ||
        Math.abs(probability.value - report.posterior[probability.hypothesisId]) > PROBABILITY_TOLERANCE
      ) {
        problem = { code: 'unreproducible-probability', action: 'repair', message: 'The stated probability could not be reproduced by the evaluated method.' };
      }
      if (problem) {
        violations.push(problem);
        const { probability: _removed, ...rest } = output.uncertainty;
        output.uncertainty = { ...rest, probabilityWithheld: problem.message };
      }
    }
  }

  const rejected = violations.some((violation) => violation.action === 'reject');
  return { accepted: !rejected, output: rejected ? null : output, violations };
};

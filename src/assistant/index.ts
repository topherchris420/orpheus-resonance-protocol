import { DEFAULT_THRESHOLD } from '@/evidence/engine';
import type { EvidenceContext } from '@/evidence/types';
import { defaultRegistry, type CalibrationRegistry } from './calibrationRegistry';
import { verifyProposal, type GuardrailOutcome, type Violation } from './guardrails';
import { conventionalOutput, uncertaintyAwareOutput } from './providers/deterministic';
import { perturbProposal, type AssistantPerturbation } from './providers/perturbed';
import type { AssessmentOutput, AssistanceCondition, AssistedCondition } from './schema';

export type { AssessmentOutput, AssistanceCondition } from './schema';
export type { AssistantPerturbation } from './providers/perturbed';

export interface AssistantRequest {
  condition: AssistanceCondition;
  context: EvidenceContext;
  threshold?: number;
  perturbation?: AssistantPerturbation | null;
  registry?: CalibrationRegistry;
}

export interface AssistantResult {
  condition: AssistanceCondition;
  /** What the participant is shown. `null` in the human-only condition. */
  output: AssessmentOutput | null;
  /** What the provider proposed before guardrails ran (for the research record). */
  proposal: unknown;
  guardrail: GuardrailOutcome | null;
  usedFallback: boolean;
}

/** Assistant input never contains assistant output: earlier AI statements cannot feed back as evidence. */
export const assistantInput = (context: EvidenceContext): EvidenceContext => ({
  ...context,
  items: context.items.filter((item) => item.kind !== 'ai-statement'),
});

export const deterministicOutput = (
  condition: AssistedCondition,
  context: EvidenceContext,
  threshold: number,
  registry: CalibrationRegistry,
): AssessmentOutput =>
  condition === 'D' ? uncertaintyAwareOutput(context, { threshold, registry }) : conventionalOutput(context, condition);

const withGuardrailNotice = (output: AssessmentOutput, violations: Violation[]): AssessmentOutput => {
  const first = violations.find((violation) => violation.action === 'reject') ?? violations[0];
  if (!first) return output;
  return {
    ...output,
    flags: [
      { code: 'guardrail-rejection', message: `A proposed assessment was discarded: ${first.message}` },
      ...output.flags,
    ].slice(0, 12),
  };
};

/** Resolve a raw proposal through the guardrails, falling back to the deterministic assessment. */
export const resolveProposal = (
  condition: AssistedCondition,
  proposal: unknown,
  context: EvidenceContext,
  threshold: number,
  registry: CalibrationRegistry,
): Omit<AssistantResult, 'condition'> => {
  const guardrail = verifyProposal(proposal, { context, condition, threshold, registry });
  if (guardrail.accepted && guardrail.output) {
    const repaired = guardrail.violations.length > 0;
    return { output: repaired ? withGuardrailNotice(guardrail.output, guardrail.violations) : guardrail.output, proposal, guardrail, usedFallback: false };
  }
  // In the uncertainty-aware condition a rejected proposal is replaced by the verified deterministic
  // assessment. The other conditions model assistants without epistemic checks, so only structurally
  // invalid proposals reach this point and they are likewise replaced.
  const fallback = deterministicOutput(condition, context, threshold, registry);
  return { output: withGuardrailNotice(fallback, guardrail.violations), proposal, guardrail, usedFallback: true };
};

export const runAssistant = (request: AssistantRequest): AssistantResult => {
  if (request.condition === 'A') return { condition: 'A', output: null, proposal: null, guardrail: null, usedFallback: false };
  const threshold = request.threshold ?? DEFAULT_THRESHOLD;
  const registry = request.registry ?? defaultRegistry;
  const context = assistantInput(request.context);
  const clean = deterministicOutput(request.condition, context, threshold, registry);
  const proposal = request.perturbation ? perturbProposal(clean, context, request.perturbation) : clean;
  return { condition: request.condition, ...resolveProposal(request.condition, proposal, context, threshold, registry) };
};

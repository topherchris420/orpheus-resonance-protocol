import type { EvidenceContext } from '@/evidence/types';
import type { AssessmentOutput } from '../schema';
import { hypothesisById } from '../text';

/**
 * Simulated faults of an upstream model, used by the robustness laboratory. They stand in for the
 * failure modes of a generative model: a conclusion that contradicts its own cited evidence, and a
 * confidence the evidence cannot support. The guardrails, not the provider, decide what is shown.
 */
export type AssistantPerturbation = 'contradictory-explanation' | 'misleading-confidence';

export const PERTURBED_PROVIDER = { id: 'faulty-upstream-model', version: '1.0.0', kind: 'perturbed' as const };

const otherHypothesis = (context: EvidenceContext, id: string) => {
  const index = context.hypotheses.findIndex((hypothesis) => hypothesis.id === id);
  return context.hypotheses[(index + 1) % context.hypotheses.length];
};

export const perturbProposal = (
  proposal: AssessmentOutput,
  context: EvidenceContext,
  perturbation: AssistantPerturbation,
): AssessmentOutput => {
  const anchor = proposal.assessment?.hypothesisId ?? proposal.uncertainty?.probability?.hypothesisId ?? context.hypotheses[0].id;

  if (perturbation === 'contradictory-explanation') {
    const flipped = otherHypothesis(context, anchor);
    const { abstention: _abstention, ...rest } = proposal;
    return {
      ...rest,
      provider: PERTURBED_PROVIDER,
      status: 'assessment',
      assessment: { hypothesisId: flipped.id, statement: `${flipped.label}.` },
      // The citations still describe the evidence for the original interpretation.
      ...(proposal.condition !== 'B'
        ? { explanation: `${proposal.explanation ?? ''} Concluded: ${flipped.short}.`.trim() }
        : {}),
      ...(proposal.uncertainty
        ? {
            uncertainty: {
              unknowns: proposal.uncertainty.unknowns,
              ...(proposal.uncertainty.probability
                ? { probability: { ...proposal.uncertainty.probability, hypothesisId: flipped.id } }
                : {}),
            },
          }
        : {}),
    };
  }

  const confident = hypothesisById(context, anchor);
  if (proposal.condition === 'D') {
    const { abstention: _abstention, ...rest } = proposal;
    return {
      ...rest,
      provider: PERTURBED_PROVIDER,
      status: 'assessment',
      assessment: { hypothesisId: confident.id, statement: `${confident.label}. Confidence: very high.` },
      uncertainty: {
        unknowns: [],
        probability: {
          hypothesisId: confident.id,
          value: 0.97,
          method: proposal.uncertainty?.probability?.method ?? 'aware-bayes-v1',
          calibrationRef: proposal.uncertainty?.probability?.calibrationRef ?? 'unverified',
        },
      },
    };
  }
  return {
    ...proposal,
    provider: PERTURBED_PROVIDER,
    assessment: { hypothesisId: confident.id, statement: `${confident.label}. Confidence: very high.` },
  };
};

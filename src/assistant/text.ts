import { formatAge } from '@/engine/clock';
import { RELIABILITY_LABEL } from '@/evidence/sources';
import type { EvidenceContext, EvidenceReport, Hypothesis } from '@/evidence/types';
import type { RecommendationKind } from './schema';

export const hypothesisById = (context: EvidenceContext, id: string): Hypothesis =>
  context.hypotheses.find((hypothesis) => hypothesis.id === id) ?? { id, label: id, short: id, polarity: 'neutral' };

export const RECOMMENDATION_TEXT: Record<RecommendationKind, string> = {
  'verify-independently': 'Seek an independent observation before relying on any of these reports.',
  'request-update': 'Request a current observation; the available information is incomplete or out of date.',
  'check-integrity': 'Ask for the damaged message to be re-sent through a verified channel before using it.',
  'compare-sources': "Review the sources' records; the current pattern does not fit the assistant's source model.",
  'review-before-relying': 'The conclusion is supported. Review the cited evidence yourself before relying on it.',
};

const countWord = (count: number) => (count === 2 ? 'Two' : count === 3 ? 'Three' : count === 4 ? 'Four' : String(count));

export const abstentionExplanation = (context: EvidenceContext, report: EvidenceReport): string => {
  switch (report.sufficiency.reason) {
    case 'unresolved-conflict': {
      const disagreeing = new Set(report.conflicts.flatMap((conflict) => [...conflict.itemIds[0], ...conflict.itemIds[1]]));
      return disagreeing.size === 2
        ? 'Two reports disagree, and neither has independent confirmation. Orpheus cannot establish which is accurate.'
        : `${countWord(disagreeing.size)} reports disagree, and no interpretation has independent confirmation. Orpheus cannot establish which is accurate.`;
    }
    case 'no-admissible-evidence':
      return 'None of the available items can be weighed: each is excluded by a data-quality rule, is context only, or comes from a source without a reliability record. Orpheus cannot assess the question from this evidence.';
    case 'model-misfit':
      return `Reliable sources contradict each other far more than the assistant's source model allows (p < ${report.misfit.tailProbability !== null && report.misfit.tailProbability < 0.001 ? '0.001' : '0.01'}). The model probably does not fit this situation, so Orpheus will not conclude.`;
    case 'insufficient-confidence':
    default:
      return `The admissible evidence is too weak to establish any interpretation at the required level (${Math.round(report.threshold * 100)}%). Orpheus will not conclude from it.`;
  }
};

export const recommendationForReport = (report: EvidenceReport): RecommendationKind => {
  if (report.sufficiency.sufficient) {
    return Math.max(...Object.values(report.support)) >= 2 ? 'review-before-relying' : 'verify-independently';
  }
  switch (report.sufficiency.reason) {
    case 'unresolved-conflict':
      return 'verify-independently';
    case 'model-misfit':
      return 'compare-sources';
    case 'no-admissible-evidence':
      return report.items.some((item) => item.exclusion === 'integrity-failure') ? 'check-integrity' : 'request-update';
    default:
      return report.items.some((item) => item.exclusion === 'integrity-failure') ? 'check-integrity' : 'request-update';
  }
};

/** What remains unknown, phrased for a participant. */
export const unknownsFor = (context: EvidenceContext, report: EvidenceReport): string[] => {
  const items = new Map(context.items.map((item) => [item.id, item]));
  const sources = new Map(context.sources.map((source) => [source.id, source]));
  const unknowns: string[] = [];
  for (const missing of report.missing) unknowns.push(`The scheduled ${missing.label.toLowerCase()} did not arrive.`);
  for (const assessment of report.items) {
    const item = items.get(assessment.id);
    if (!item) continue;
    if (assessment.exclusion === 'integrity-failure') {
      unknowns.push(`"${item.title}" failed an integrity check, so what its source actually sent is unknown.`);
    } else if (assessment.exclusion === 'implausible-field') {
      unknowns.push(`"${item.title}" contains an implausible field (${assessment.exclusionDetail?.replace(/\.$/, '').toLowerCase()}).`);
    } else if (assessment.exclusion === 'unverifiable-source') {
      unknowns.push(`"${item.title}" comes from a source without a reliability record.`);
    } else if (assessment.exclusion === 'source-model-changed') {
      unknowns.push(`The reliability of "${item.title}" is unknown: ${assessment.exclusionDetail}`);
    } else if (assessment.exclusion === 'expired') {
      unknowns.push(`"${item.title}" is ${formatAge(assessment.ageTicks, context.tickSeconds)} old and says nothing about now.`);
    } else if (assessment.admissible && assessment.flags.includes('stale')) {
      unknowns.push(`"${item.title}" is ${formatAge(assessment.ageTicks, context.tickSeconds)} old; the situation may have changed since.`);
    }
    if (assessment.flags.includes('confidence-claim-unsupported')) {
      const source = item.sourceId ? sources.get(item.sourceId) : undefined;
      unknowns.push(
        `"${item.title}" claims high confidence, but its source is graded ${source ? `${source.reliability} (${RELIABILITY_LABEL[source.reliability].toLowerCase()})` : 'as unknown'}. Self-reported confidence is not used as evidence.`,
      );
    }
  }
  if (report.admissibleIds.length > 0 && Math.max(...Object.values(report.support)) < 2) {
    unknowns.push('No interpretation is confirmed by two independent origins.');
  }
  return unknowns.slice(0, 12);
};

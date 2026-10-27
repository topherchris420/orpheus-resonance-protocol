import { assessEvidence, assessNaive } from '@/evidence/engine';
import type { EvidenceContext, EvidenceReport } from '@/evidence/types';
import { SCHEMA } from '@/engine/version';
import { calibrationRef, type CalibrationRegistry } from '../calibrationRegistry';
import type { AssessmentOutput, AssistedCondition, EvidenceReference } from '../schema';
import { abstentionExplanation, hypothesisById, RECOMMENDATION_TEXT, recommendationForReport, unknownsFor } from '../text';

export const DETERMINISTIC_PROVIDER = { id: 'orpheus-deterministic', version: '1.0.0', kind: 'deterministic' as const };

const percent = (value: number) => `${Math.round(value * 100)}%`;

const citations = (context: EvidenceContext, report: EvidenceReport, conclusion: string, includeExcluded: boolean): EvidenceReference[] => {
  const items = new Map(context.items.map((item) => [item.id, item]));
  const references: EvidenceReference[] = [];
  for (const assessment of report.items) {
    const item = items.get(assessment.id);
    if (!item) continue;
    if (assessment.admissible && item.claim) {
      const supports = item.claim === conclusion;
      references.push({
        evidenceId: item.id,
        role: supports ? 'supports' : 'contradicts',
        note: `${item.title} asserts "${hypothesisById(context, item.claim).short}"${
          assessment.flags.includes('stale') ? ' (aging; weight reduced)' : ''
        }.`,
      });
    } else if (includeExcluded && assessment.exclusion && !['no-claim', 'assumption', 'derived'].includes(assessment.exclusion)) {
      references.push({ evidenceId: item.id, role: 'excluded', note: assessment.exclusionDetail ?? 'Excluded.' });
    } else if (includeExcluded && (item.kind === 'assumption' || item.kind === 'derived')) {
      references.push({
        evidenceId: item.id,
        role: 'context',
        note: item.kind === 'assumption' ? 'Assumption used as context.' : 'Derived estimate; restates its inputs.',
      });
    }
  }
  return references.slice(0, 40);
};

/** Condition B (suggestion only) and C (suggestion with cited evidence) use the conventional model. */
export const conventionalOutput = (context: EvidenceContext, condition: 'B' | 'C'): AssessmentOutput => {
  const report = assessNaive(context);
  const leading = hypothesisById(context, report.leading);
  const output: AssessmentOutput = {
    schema: SCHEMA.assessment,
    decisionId: context.decisionId,
    condition,
    provider: DETERMINISTIC_PROVIDER,
    status: 'assessment',
    assessment: { hypothesisId: leading.id, statement: `${leading.label}.` },
    evidence: [],
    alternatives: [],
    flags: [],
  };
  if (condition === 'C') {
    output.evidence = citations(context, report, leading.id, false);
    const supporting = output.evidence.filter((reference) => reference.role === 'supports').length;
    output.alternatives = context.hypotheses
      .filter((hypothesis) => hypothesis.id !== leading.id)
      .map((hypothesis) => ({
        hypothesisId: hypothesis.id,
        statement: `${hypothesis.label}.`,
        whyNotPreferred: `${report.support[hypothesis.id]} report(s) support it, against ${supporting} for the suggested interpretation, weighted by source grade.`,
      }));
    output.explanation =
      supporting > 0
        ? `Suggested because ${supporting} of ${report.admissibleIds.length} reports support it once each report is weighted by its source grade.`
        : 'No report supports any interpretation; the suggestion falls back to the prior.';
  }
  return output;
};

/** Condition D: assessment or explicit abstention, with evidence, alternatives, unknowns and bounded recommendation. */
export const uncertaintyAwareOutput = (
  context: EvidenceContext,
  options: { threshold: number; registry: CalibrationRegistry },
): AssessmentOutput => {
  const report = assessEvidence(context, { threshold: options.threshold });
  const calibration = options.registry.lookup(report.method);
  const leading = hypothesisById(context, report.leading);
  const recommendationKind = recommendationForReport(report);
  const unknowns = unknownsFor(context, report);
  const probabilityAllowed = report.domain.evaluated && calibration !== undefined;
  const probabilityWithheld = !calibration
    ? 'No evaluated calibration record exists for this method and engine version.'
    : !report.domain.evaluated
      ? `Outside the evaluated conditions: ${report.domain.reasons.join(' ')}`
      : undefined;

  const evidence = citations(context, report, report.leading, true);
  const alternatives = context.hypotheses
    .filter((hypothesis) => !report.sufficiency.sufficient || hypothesis.id !== leading.id)
    .map((hypothesis) => ({
      hypothesisId: hypothesis.id,
      statement: `${hypothesis.label}.`,
      whyNotPreferred: report.sufficiency.sufficient
        ? `${report.support[hypothesis.id]} independent origin(s) support it, against ${report.support[leading.id]} for the assessment${
            probabilityAllowed ? `; estimated probability ${percent(report.posterior[hypothesis.id])}` : ''
          }.`
        : `${report.support[hypothesis.id]} independent origin(s) support it${
            probabilityAllowed ? `; estimated probability ${percent(report.posterior[hypothesis.id])}, below the ${percent(report.threshold)} needed` : ''
          }.`,
    }));

  const flags = report.items.flatMap((assessment) => {
    const item = context.items.find((candidate) => candidate.id === assessment.id);
    if (!item) return [];
    if (assessment.exclusion === 'integrity-failure') return [{ code: 'integrity-failure', message: `"${item.title}" failed its integrity check.` }];
    if (assessment.exclusion === 'source-model-changed') return [{ code: 'distribution-shift', message: `"${item.title}": ${assessment.exclusionDetail}` }];
    if (assessment.exclusion === 'duplicate-origin') return [{ code: 'duplicate-origin', message: `"${item.title}" repeats an origin already counted.` }];
    if (assessment.flags.includes('confidence-claim-unsupported')) {
      return [{ code: 'unsupported-confidence-claim', message: `"${item.title}" claims high confidence its source record does not support.` }];
    }
    return [];
  });
  if (report.misfit.detected) flags.push({ code: 'model-misfit', message: 'The evidence pattern does not fit the source model.' });
  if (report.missing.length > 0) flags.push({ code: 'missing-observation', message: `${report.missing.length} scheduled observation(s) missing.` });

  const base = {
    schema: SCHEMA.assessment,
    decisionId: context.decisionId,
    condition: 'D' as AssistedCondition,
    provider: DETERMINISTIC_PROVIDER,
    evidence,
    alternatives,
    uncertainty: {
      unknowns,
      ...(probabilityAllowed && calibration
        ? {
            probability: {
              hypothesisId: leading.id,
              value: report.leadingProbability,
              method: report.method,
              calibrationRef: calibrationRef(calibration),
            },
          }
        : {}),
      ...(probabilityWithheld ? { probabilityWithheld } : {}),
    },
    recommendation: { kind: recommendationKind, text: RECOMMENDATION_TEXT[recommendationKind] },
    flags: flags.slice(0, 12),
  };

  if (!report.sufficiency.sufficient) {
    return {
      ...base,
      status: 'abstention',
      abstention: { reason: report.sufficiency.reason!, explanation: abstentionExplanation(context, report) },
      explanation: 'Orpheus checked every item against its data-quality rules, combined the admissible ones, and found no interpretation it can establish.',
    } as AssessmentOutput;
  }

  const supporting = evidence.filter((reference) => reference.role === 'supports').length;
  const contradicting = evidence.filter((reference) => reference.role === 'contradicts').length;
  return {
    ...base,
    status: 'assessment',
    assessment: { hypothesisId: leading.id, statement: `The evidence supports: ${leading.label.charAt(0).toLowerCase()}${leading.label.slice(1)}.` },
    explanation: `${supporting} admissible item(s) from ${report.support[leading.id]} independent origin(s) support this${
      contradicting ? `; ${contradicting} contradict it but carry less weight` : ''
    }. ${report.items.filter((item) => !item.admissible).length} item(s) were set aside by data-quality rules.`,
  } as AssessmentOutput;
};

import { Bot, CheckCircle2, CircleSlash, MinusCircle, PlusCircle, ShieldAlert, ShieldQuestion } from 'lucide-react';
import { committedCalibrationRecord } from '@/assistant/calibrationRegistry';
import { CONDITION_LABEL, type AssessmentOutput, type AssistanceCondition } from '@/assistant/schema';
import { InfoTip } from '@/components/common/InfoTip';
import { exclusionText } from '@/evidence/engine';
import type { EvidenceContext, EvidenceReport } from '@/evidence/types';

const percent = (value: number) => `${Math.round(value * 100)}%`;

const RECOMMENDATION_LABEL: Record<string, string> = {
  'verify-independently': 'Verify independently',
  'request-update': 'Request a current observation',
  'check-integrity': 'Re-request the damaged message',
  'compare-sources': 'Review the source records',
  'review-before-relying': 'Review before relying on it',
};

const ABSTENTION_LABEL: Record<string, string> = {
  'unresolved-conflict': 'Unresolved conflict',
  'insufficient-confidence': 'Evidence too weak',
  'no-admissible-evidence': 'No usable evidence',
  'model-misfit': 'Model does not fit',
  'guardrail-rejection': 'Output rejected',
  'assistant-unavailable': 'Assistant unavailable',
};

export const ReasoningTrace = ({ context, report }: { context: EvidenceContext; report: EvidenceReport }) => {
  const title = (id: string) => context.items.find((item) => item.id === id)?.title ?? id;
  return (
    <div className="space-y-3 text-xs text-o-text2">
      <div className="overflow-x-auto">
        <table className="o-table min-w-[28rem]">
          <caption className="sr-only">How each item was weighed</caption>
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col">Used?</th>
              <th scope="col">Weight</th>
              <th scope="col">Reason</th>
            </tr>
          </thead>
          <tbody>
            {report.items.map((item) => (
              <tr key={item.id}>
                <td className="text-o-text">{title(item.id)}</td>
                <td>{item.admissible ? 'Yes' : 'No'}</td>
                <td>{item.effectiveAccuracy !== undefined ? `${percent(item.effectiveAccuracy)} right` : '—'}</td>
                <td>{item.admissible ? (item.flags.includes('stale') ? 'Current weight reduced for age.' : 'Admissible.') : (item.exclusionDetail ?? exclusionText(item.exclusion!))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Combined with Bayes' rule under the declared source model:{' '}
        {context.hypotheses.map((hypothesis) => `${hypothesis.short} ${percent(report.posterior[hypothesis.id])}`).join(' · ')}. Concluding requires{' '}
        {percent(report.threshold)}.
      </p>
      {report.misfit.checked && (
        <p>
          Model fit check: the chance of this much disagreement under the best interpretation is{' '}
          {report.misfit.tailProbability !== null && report.misfit.tailProbability < 0.001 ? 'below 0.1%' : percent(report.misfit.tailProbability ?? 1)}
          {report.misfit.detected ? ' — too unlikely; the model does not fit.' : '.'}
        </p>
      )}
      {!report.domain.evaluated && <p>Outside the evaluated conditions: {report.domain.reasons.join(' ')}</p>}
    </div>
  );
};

interface AssistantPanelProps {
  condition: AssistanceCondition;
  output: AssessmentOutput | null;
  context: EvidenceContext;
  report: EvidenceReport;
  /** Hide the assistant until the participant has given an initial answer (sequential designs). */
  hiddenReason?: string;
  /** Show "Assistant" without the condition name, so study participants are not told which condition is expected to help. */
  neutralLabel?: boolean;
}

export const AssistantPanel = ({ condition, output, context, report, hiddenReason, neutralLabel = false }: AssistantPanelProps) => {
  const title = (id: string) => context.items.find((item) => item.id === id)?.title ?? id;
  const label = (id: string) => context.hypotheses.find((hypothesis) => hypothesis.id === id)?.short ?? id;

  if (condition === 'A') {
    return (
      <section aria-label="Assistant" className="rounded-lg border border-dashed border-o-line-strong p-4 text-sm text-o-text3">
        No assistant in this condition. Assess the evidence yourself.
      </section>
    );
  }
  if (hiddenReason) {
    return (
      <section aria-label="Assistant" className="rounded-lg border border-dashed border-o-line-strong p-4 text-sm text-o-text3">
        {hiddenReason}
      </section>
    );
  }
  if (!output) return null;
  const abstaining = output.status === 'abstention';
  const references = output.evidence;

  return (
    <section aria-label={neutralLabel ? 'Assistant' : `Assistant: ${CONDITION_LABEL[condition]}`} className="rounded-xl border border-o-amber/40 bg-o-s2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Bot aria-hidden="true" className="h-4 w-4 text-o-amber" />
        <h3 className="text-sm font-semibold text-o-text">{neutralLabel ? 'Assistant' : `Assistant · ${CONDITION_LABEL[condition]}`}</h3>
        <span className="o-chip border-o-amber/50 text-o-amber">AI statement, not evidence</span>
        <InfoTip term="ai-statement" />
      </div>

      {abstaining ? (
        <div className="mt-3 rounded-lg border border-o-amber/50 bg-o-bg/50 p-3" role="status">
          <p className="flex items-center gap-2 text-sm font-semibold text-o-amber">
            <ShieldQuestion aria-hidden="true" className="h-4 w-4" />
            Insufficient evidence · {ABSTENTION_LABEL[output.abstention!.reason] ?? output.abstention!.reason}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-o-text">{output.abstention!.explanation}</p>
        </div>
      ) : (
        <div className="mt-3">
          <p className="o-eyebrow">{condition === 'D' ? 'Assessment' : 'Suggestion'}</p>
          <p className="mt-1 flex items-start gap-2 text-base font-medium text-o-text">
            {condition === 'D' && <CheckCircle2 aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-o-teal" />}
            {output.assessment?.statement}
          </p>
        </div>
      )}

      {output.explanation && condition !== 'B' && <p className="mt-2 text-sm text-o-text2">{output.explanation}</p>}

      {references.length > 0 && (
        <div className="mt-3">
          <p className="o-eyebrow">Evidence cited</p>
          <ul className="mt-1.5 space-y-1 text-sm">
            {references.map((reference) => (
              <li key={`${reference.evidenceId}-${reference.role}`} className="flex items-start gap-2 text-o-text2">
                {reference.role === 'supports' ? (
                  <PlusCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-o-teal" />
                ) : reference.role === 'contradicts' ? (
                  <MinusCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-o-red" />
                ) : (
                  <CircleSlash aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-o-text3" />
                )}
                <span>
                  <span className="sr-only">{reference.role}: </span>
                  <span className="font-medium text-o-text">{title(reference.evidenceId)}</span> —{' '}
                  {reference.role === 'supports' ? 'supports' : reference.role === 'contradicts' ? 'contradicts' : reference.role === 'excluded' ? 'set aside' : 'context'}. {reference.note}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {output.alternatives.length > 0 && (
        <div className="mt-3">
          <p className="o-eyebrow">{abstaining ? 'Interpretations considered' : 'Alternatives'}</p>
          <ul className="mt-1.5 space-y-1 text-sm text-o-text2">
            {output.alternatives.map((alternative) => (
              <li key={alternative.hypothesisId}>
                <span className="font-medium text-o-text">{label(alternative.hypothesisId)}</span> — {alternative.whyNotPreferred}
              </li>
            ))}
          </ul>
        </div>
      )}

      {output.uncertainty && (
        <div className="mt-3">
          <div className="flex items-center gap-1">
            <p className="o-eyebrow">Uncertainty</p>
            <InfoTip term="probability" />
          </div>
          {output.uncertainty.probability ? (
            <p className="mt-1 text-sm text-o-text2">
              Estimated probability for <span className="font-medium text-o-text">{label(output.uncertainty.probability.hypothesisId)}</span>:{' '}
              <span className="font-semibold text-o-text">{percent(output.uncertainty.probability.value)}</span>. Calibration measured on{' '}
              {committedCalibrationRecord.trials.toLocaleString('en-US')} simulated trials (expected calibration error {committedCalibrationRecord.ece.toFixed(3)}); real sources are not guaranteed to behave like the model.
            </p>
          ) : output.uncertainty.probabilityWithheld ? (
            <p className="mt-1 text-sm text-o-text3">No probability shown. {output.uncertainty.probabilityWithheld}</p>
          ) : null}
          {output.uncertainty.unknowns.length > 0 && (
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-o-text2">
              {output.uncertainty.unknowns.map((unknown) => (
                <li key={unknown}>{unknown}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {output.recommendation && (
        <div className="mt-3 rounded-lg border border-o-line p-3">
          <p className="o-eyebrow">Recommended next step · {RECOMMENDATION_LABEL[output.recommendation.kind]}</p>
          <p className="mt-1 text-sm text-o-text">{output.recommendation.text}</p>
          <p className="mt-1 text-xs text-o-text3">Analysis and verification only. The assistant cannot take any action in the simulation.</p>
        </div>
      )}

      {output.flags.some((flag) => flag.code === 'guardrail-rejection' || flag.code === 'assistant-unavailable') && (
        <p className="mt-3 flex items-start gap-2 text-xs text-o-amber">
          <ShieldAlert aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {output.flags.find((flag) => flag.code === 'guardrail-rejection' || flag.code === 'assistant-unavailable')!.message}
        </p>
      )}

      {condition === 'D' && (
        <details className="mt-3 rounded-lg border border-o-line p-3">
          <summary className="cursor-pointer text-sm font-medium text-o-teal">Inspect the reasoning</summary>
          <div className="mt-3">
            <ReasoningTrace context={context} report={report} />
          </div>
        </details>
      )}
    </section>
  );
};

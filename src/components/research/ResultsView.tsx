import { AlertTriangle, Download } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CONDITION_LABEL, type AssessmentOutput, type AssistanceCondition } from '@/assistant/schema';
import { ForestPlot } from '@/components/charts/charts';
import { AssistantPanel } from '@/components/evidence/AssistantPanel';
import { EvidencePanel } from '@/components/evidence/EvidencePanel';
import { shortHash } from '@/engine/canonical';
import { assessEvidence } from '@/evidence/engine';
import { AGENTS } from '@/experiment/agents';
import type { GroupSummary } from '@/experiment/batch';
import type { MetricValues } from '@/experiment/metrics';
import { HUMAN_GROUP, trialRowsToCsv, type ResearchPackage } from '@/experiment/package';
import { metricDefinition, PROTOCOL, type MetricId } from '@/experiment/protocol';
import { INFORMATION_CONDITIONS } from '@/scenarios/taskFamily';
import { downloadJson, downloadText, timestampSlug } from '@/state/missionStore';

const CONDITIONS: AssistanceCondition[] = ['A', 'B', 'C', 'D'];
const TABLE_METRICS: MetricId[] = [
  'utility',
  'accuracy',
  'coverage',
  'wrongCommitRate',
  'falseAlarmRate',
  'missRate',
  'missedCritical',
  'referenceAgreement',
  'overreliance',
  'appropriateAcceptance',
  'appropriateRejection',
  'abstentionAcceptance',
  'rair',
  'rsr',
  'switchRate',
  'brier',
];

const cell = (metrics: MetricValues, id: MetricId) => {
  const ratio = metrics[id];
  if (ratio.value === null) return '—';
  const definition = metricDefinition(id);
  return definition.unit === 'proportion' ? `${(ratio.value * 100).toFixed(1)}%` : ratio.value.toFixed(3);
};

const groupLabel = (agentId: string) => (agentId === HUMAN_GROUP ? 'Participants' : AGENTS.find((agent) => agent.id === agentId)?.label ?? agentId);
const groupDescription = (agentId: string) =>
  agentId === HUMAN_GROUP ? 'People who completed the protocol in this browser.' : AGENTS.find((agent) => agent.id === agentId)?.description ?? 'Unknown policy.';
const participantKind = (agentId: string) => (agentId === HUMAN_GROUP ? 'human' : `agent:${agentId}`);

const fmt = (value: number | null | undefined, digits = 2) => (value === null || value === undefined || Number.isNaN(value) ? '—' : value.toFixed(digits));

export const ResultsView = ({ pkg, simulated }: { pkg: ResearchPackage; simulated: boolean }) => {
  const groups = pkg.content.summary;
  const [agentId, setAgentId] = useState(groups[0]?.agentId ?? '');
  const group: GroupSummary | undefined = groups.find((candidate) => candidate.agentId === agentId) ?? groups[0];
  const [errorCondition, setErrorCondition] = useState<'all' | AssistanceCondition>('all');
  const [errorInfo, setErrorInfo] = useState<'all' | string>('all');
  const [inspected, setInspected] = useState<string | null>(null);

  const errors = useMemo(
    () =>
      pkg.content.trials.filter(
        (row) =>
          row.participantKind === participantKind(group?.agentId ?? '') &&
          row.committed &&
          !row.correct &&
          (errorCondition === 'all' || row.condition === errorCondition) &&
          (errorInfo === 'all' || row.informationCondition === errorInfo),
      ),
    [errorCondition, errorInfo, group?.agentId, pkg.content.trials],
  );

  if (!group) return null;
  const forestRows = group.conditions
    .filter((condition) => condition.utilityInterval)
    .map((condition) => ({
      label: `${condition.condition} · ${CONDITION_LABEL[condition.condition]}`,
      estimate: condition.utilityInterval!.estimate,
      lower: condition.utilityInterval!.lower,
      upper: condition.utilityInterval!.upper,
      n: condition.utilityInterval!.n,
    }));
  const inspectedRow = errors.find((row) => `${row.participant}/${row.trialId}` === inspected);
  const material = inspectedRow ? pkg.content.materials[inspectedRow.material] : undefined;
  const advice = inspectedRow ? (pkg.content.modelOutputs[`${inspectedRow.participant}/${inspectedRow.trialId}`] as AssessmentOutput | undefined) : undefined;

  return (
    <div className="space-y-8">
      {simulated && (
        <p role="note" className="flex items-start gap-2 rounded-lg border border-o-amber/50 bg-o-amber/5 p-3 text-sm text-o-amber">
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          Simulated agents, not human data. These results test the pipeline and show how scripted reliance policies behave inside this simulation. Part of condition D&apos;s advantage
          holds by construction, because the task generator and the assistant share the declared source model.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Policy" className="flex flex-wrap gap-1.5">
          {groups.map((candidate) => (
            <button key={candidate.agentId} type="button" className="o-button min-h-10" aria-pressed={candidate.agentId === group.agentId} onClick={() => setAgentId(candidate.agentId)}>
              {groupLabel(candidate.agentId)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="o-button" onClick={() => downloadJson(pkg, `orpheus-research-package-${timestampSlug()}.json`)}>
            <Download aria-hidden="true" className="h-4 w-4" /> Research package (JSON)
          </button>
          <button type="button" className="o-button" onClick={() => downloadText(trialRowsToCsv(pkg.content.trials), `orpheus-trials-${timestampSlug()}.csv`, 'text/csv')}>
            <Download aria-hidden="true" className="h-4 w-4" /> Trial table (CSV)
          </button>
        </div>
      </div>
      <p className="text-sm text-o-text2">
        {groupDescription(group.agentId)} {group.participants} {simulated ? 'simulated participants' : group.participants === 1 ? 'participant' : 'participants'} · content hash{' '}
        <span className="font-mono">{shortHash(pkg.contentHash)}</span>
      </p>

      <ForestPlot rows={forestRows} caption="Mean decision utility per trial by assistance condition (95% bootstrap interval over participants)" unit="per trial" reference={0} />

      <section aria-labelledby="metrics-table-heading">
        <h3 id="metrics-table-heading" className="text-lg font-semibold text-o-text">
          Metrics by condition
        </h3>
        <div className="mt-3 overflow-x-auto">
          <table className="o-table min-w-[40rem]">
            <thead>
              <tr>
                <th scope="col">Metric</th>
                {CONDITIONS.map((condition) => (
                  <th key={condition} scope="col">
                    {condition} · {CONDITION_LABEL[condition]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TABLE_METRICS.map((id) => (
                <tr key={id}>
                  <th scope="row" className="text-left font-medium text-o-text">
                    {metricDefinition(id).label}
                  </th>
                  {group.conditions.map((condition) => {
                    const interval = condition.proportionIntervals[id];
                    return (
                      <td key={condition.condition} className="font-mono">
                        {cell(condition.metrics, id)}
                        {interval && <span className="block text-xs text-o-text3">[{(interval.lower * 100).toFixed(1)}, {(interval.upper * 100).toFixed(1)}]</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-o-text3">Brackets: 95% Wilson intervals for pooled proportions. Definitions are on the Protocol tab.</p>
      </section>

      <section aria-labelledby="hypothesis-results-heading">
        <h3 id="hypothesis-results-heading" className="text-lg font-semibold text-o-text">
          Preregistered hypotheses
        </h3>
        <div className="mt-3 overflow-x-auto">
          <table className="o-table min-w-[44rem]">
            <thead>
              <tr>
                <th scope="col">Hypothesis</th>
                <th scope="col">Pairs</th>
                <th scope="col">Difference [95% CI]</th>
                <th scope="col">p</th>
                <th scope="col">Criterion met</th>
              </tr>
            </thead>
            <tbody>
              {group.hypotheses.map((result) => (
                <tr key={result.hypothesis.id}>
                  <th scope="row" className="text-left font-normal">
                    <span className="font-mono text-o-text">{result.hypothesis.id}</span> {result.hypothesis.statement}
                  </th>
                  <td className="font-mono">{result.pairs}</td>
                  <td className="font-mono">{result.difference ? `${fmt(result.difference.estimate)} [${fmt(result.difference.lower)}, ${fmt(result.difference.upper)}]` : '—'}</td>
                  <td className="font-mono">
                    {fmt(result.adjustedPValue ?? result.pValue, 3)}
                    {result.adjustedPValue !== null && <span className="block text-xs text-o-text3">Holm</span>}
                  </td>
                  <td>{result.supported === null ? result.note || 'n/a' : result.supported ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="robustness-heading">
        <h3 id="robustness-heading" className="text-lg font-semibold text-o-text">
          Robustness laboratory
        </h3>
        <p className="mt-1 text-sm text-o-text2">When does the assistant recognize that its evidence is unreliable, and does that keep this policy from a mistake? Utility per trial by information condition.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="o-table min-w-[44rem]">
            <thead>
              <tr>
                <th scope="col">Information condition</th>
                {CONDITIONS.map((condition) => (
                  <th key={condition} scope="col">
                    {condition}
                  </th>
                ))}
                <th scope="col">D declined</th>
                <th scope="col">B wrong</th>
              </tr>
            </thead>
            <tbody>
              {group.robustness.map((row) => (
                <tr key={row.informationCondition}>
                  <th scope="row" className="text-left font-mono text-o-text">
                    {row.informationCondition}
                  </th>
                  {CONDITIONS.map((condition) => (
                    <td key={condition} className="font-mono">
                      {fmt(row.byCondition[condition].utility)}
                    </td>
                  ))}
                  <td className="font-mono">
                    {row.byCondition.D.aiAbstained}/{row.byCondition.D.trials}
                  </td>
                  <td className="font-mono">
                    {row.byCondition.B.aiWrong}/{row.byCondition.B.trials}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="assistant-behavior-heading">
        <h3 id="assistant-behavior-heading" className="text-lg font-semibold text-o-text">
          Assistant behavior
        </h3>
        <div className="mt-3 overflow-x-auto">
          <table className="o-table">
            <thead>
              <tr>
                <th scope="col">Condition</th>
                <th scope="col">Trials</th>
                <th scope="col">Concluded</th>
                <th scope="col">Declined</th>
                <th scope="col">Wrong conclusions</th>
                <th scope="col">Guardrail rejections</th>
              </tr>
            </thead>
            <tbody>
              {group.conditions
                .filter((condition) => condition.condition !== 'A')
                .map((condition) => (
                  <tr key={condition.condition}>
                    <th scope="row" className="text-left text-o-text">
                      {condition.condition} · {CONDITION_LABEL[condition.condition]}
                    </th>
                    <td className="font-mono">{condition.assistant.trials}</td>
                    <td className="font-mono">{condition.assistant.concluded}</td>
                    <td className="font-mono">{condition.assistant.abstained}</td>
                    <td className="font-mono">{condition.assistant.wrongConclusions}</td>
                    <td className="font-mono">{condition.assistant.guardrailRejections}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="errors-heading">
        <h3 id="errors-heading" className="text-lg font-semibold text-o-text">
          Error inspection
        </h3>
        <div className="mt-2 flex flex-wrap gap-3 text-sm">
          <label className="flex items-center gap-2 text-o-text2">
            Condition
            <select className="o-input min-h-10 py-1" value={errorCondition} onChange={(event) => setErrorCondition(event.target.value as 'all' | AssistanceCondition)}>
              <option value="all">All</option>
              {CONDITIONS.map((condition) => (
                <option key={condition} value={condition}>
                  {condition}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-o-text2">
            Information condition
            <select className="o-input min-h-10 py-1" value={errorInfo} onChange={(event) => setErrorInfo(event.target.value)}>
              <option value="all">All</option>
              {INFORMATION_CONDITIONS.map((condition) => (
                <option key={condition} value={condition}>
                  {condition}
                </option>
              ))}
            </select>
          </label>
          <span className="self-center text-o-text3">{errors.length} wrong conclusions</span>
        </div>
        <ul className="mt-3 max-h-80 space-y-1.5 overflow-y-auto">
          {errors.slice(0, 200).map((row) => {
            const key = `${row.participant}/${row.trialId}`;
            return (
              <li key={key}>
                <button type="button" className="o-button w-full justify-start text-left text-xs" aria-pressed={inspected === key} onClick={() => setInspected(inspected === key ? null : key)}>
                  <span className="font-mono">{row.participant}</span> · {row.condition} · {row.informationCondition} · truth {row.truth} · concluded {row.finalOption.replace('conclude-', '')}
                  {row.adviceStatus ? ` · assistant ${row.adviceStatus === 'abstention' ? 'declined' : `said ${row.adviceHypothesis}`}` : ''}
                </button>
              </li>
            );
          })}
        </ul>
        {inspectedRow && material && (
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {advice ? (
              <AssistantPanel condition={inspectedRow.condition as AssistanceCondition} output={advice} context={material} report={assessEvidence(material, { threshold: PROTOCOL.threshold })} />
            ) : (
              <p className="text-sm text-o-text3">No assistant in this condition.</p>
            )}
            <EvidencePanel context={material} report={assessEvidence(material, { threshold: PROTOCOL.threshold })} showQualityFlags />
          </div>
        )}
      </section>
    </div>
  );
};

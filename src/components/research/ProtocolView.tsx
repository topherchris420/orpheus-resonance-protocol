import { Download } from 'lucide-react';
import { CONDITION_LABEL, CONDITION_SUMMARY } from '@/assistant/schema';
import { shortHash } from '@/engine/canonical';
import { assignParticipant } from '@/experiment/counterbalance';
import { PROTOCOL, protocolHash } from '@/experiment/protocol';
import { CONDITION_DESCRIPTION } from '@/scenarios/taskFamily';
import { downloadJson } from '@/state/missionStore';

export const ProtocolView = () => (
  <div className="space-y-8">
    <section className="o-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="o-eyebrow">
            Preregistered protocol · {PROTOCOL.id}@{PROTOCOL.version} · hash <span className="font-mono">{shortHash(protocolHash())}</span>
          </p>
          <h2 className="mt-2 text-xl font-semibold text-o-text">{PROTOCOL.title}</h2>
          <p className="mt-2 text-o-text2">{PROTOCOL.question}</p>
          <p className="mt-3 text-sm text-o-text2">{PROTOCOL.design}</p>
        </div>
        <button type="button" className="o-button" onClick={() => downloadJson({ protocol: PROTOCOL, hash: protocolHash() }, `orpheus-protocol-${PROTOCOL.version}.json`)}>
          <Download aria-hidden="true" className="h-4 w-4" /> Download protocol (JSON)
        </button>
      </div>
    </section>

    <section aria-labelledby="conditions-heading">
      <h3 id="conditions-heading" className="text-lg font-semibold text-o-text">
        Conditions and counterbalancing
      </h3>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {PROTOCOL.conditions.map((condition) => (
          <div key={condition} className="o-panel p-4 text-sm">
            <p className="font-semibold text-o-text">
              {condition} · {CONDITION_LABEL[condition]}
            </p>
            <p className="mt-1 text-o-text2">{CONDITION_SUMMARY[condition]}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="o-table">
          <caption className="text-left text-sm text-o-text2">Williams square rows (participant index modulo 4): block order, trial set and narrative form per block.</caption>
          <thead>
            <tr>
              <th scope="col">Row</th>
              {[1, 2, 3, 4].map((block) => (
                <th key={block} scope="col">
                  Block {block}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2, 3].map((row) => {
              const assignment = assignParticipant(row);
              return (
                <tr key={row}>
                  <th scope="row" className="text-left text-o-text">
                    {row}
                  </th>
                  {assignment.conditions.map((condition, block) => (
                    <td key={block} className="font-mono">
                      {condition} · set {assignment.structureSets[block] + 1} · form {assignment.forms[block] + 1}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>

    <section aria-labelledby="mix-heading">
      <h3 id="mix-heading" className="text-lg font-semibold text-o-text">
        Information conditions in every block
      </h3>
      <p className="mt-1 text-sm text-o-text2">
        Each block contains the same {PROTOCOL.trialsPerBlock} conditions in a participant-specific order, with ground truth balanced 6 alarm / 6 benign. Payoff: +{PROTOCOL.payoff.correct}{' '}
        correct, {PROTOCOL.payoff.wrong} wrong, {PROTOCOL.payoff.defer} verify — so concluding pays only at {Math.round(PROTOCOL.threshold * 100)}% or more.
      </p>
      <ul className="mt-3 grid gap-2 md:grid-cols-2">
        {Object.entries(CONDITION_DESCRIPTION).map(([condition, description]) => (
          <li key={condition} className="rounded-lg border border-o-line p-3 text-sm">
            <span className="font-mono text-o-teal-strong">{condition}</span> — <span className="text-o-text2">{description}</span>
          </li>
        ))}
      </ul>
    </section>

    <section aria-labelledby="hypotheses-heading">
      <h3 id="hypotheses-heading" className="text-lg font-semibold text-o-text">
        Hypotheses
      </h3>
      <div className="mt-3 overflow-x-auto">
        <table className="o-table min-w-[44rem]">
          <thead>
            <tr>
              <th scope="col">Id</th>
              <th scope="col">Statement</th>
              <th scope="col">Metric</th>
              <th scope="col">Comparison</th>
              <th scope="col">Family</th>
            </tr>
          </thead>
          <tbody>
            {PROTOCOL.hypotheses.map((hypothesis) => (
              <tr key={hypothesis.id}>
                <th scope="row" className="text-left font-mono text-o-text">
                  {hypothesis.id}
                </th>
                <td>{hypothesis.statement}</td>
                <td className="font-mono">{hypothesis.metric}</td>
                <td className="font-mono">
                  {hypothesis.comparison[0]} {hypothesis.direction === 'greater' ? '>' : hypothesis.direction === 'less' ? '<' : '≠'} {hypothesis.comparison[1]}
                  {hypothesis.subset ? ` (${hypothesis.subset.join(', ')})` : ''}
                </td>
                <td>{hypothesis.family}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <div className="o-panel p-4">
          <dt className="font-semibold text-o-text">Primary analysis</dt>
          <dd className="mt-1 text-o-text2">{PROTOCOL.analysis.primary}</dd>
        </div>
        <div className="o-panel p-4">
          <dt className="font-semibold text-o-text">Intervals and multiplicity</dt>
          <dd className="mt-1 text-o-text2">
            {PROTOCOL.analysis.intervals} {PROTOCOL.analysis.multiplicity}
          </dd>
        </div>
        <div className="o-panel p-4">
          <dt className="font-semibold text-o-text">Planned sample</dt>
          <dd className="mt-1 text-o-text2">
            {PROTOCOL.plannedSample.participants} participants. {PROTOCOL.plannedSample.note}
          </dd>
        </div>
        <div className="o-panel p-4">
          <dt className="font-semibold text-o-text">Exclusions</dt>
          <dd className="mt-1 text-o-text2">{PROTOCOL.analysis.exclusions.join(' ')}</dd>
        </div>
      </dl>
    </section>

    <section aria-labelledby="metrics-heading">
      <h3 id="metrics-heading" className="text-lg font-semibold text-o-text">
        Metric definitions
      </h3>
      <dl className="mt-3 grid gap-2 md:grid-cols-2">
        {PROTOCOL.metrics.map((metric) => (
          <div key={metric.id} className="rounded-lg border border-o-line p-3 text-sm">
            <dt className="font-semibold text-o-text">
              {metric.label} <span className="font-mono text-xs text-o-text3">{metric.id}</span>
            </dt>
            <dd className="mt-1 text-o-text2">{metric.definition}</dd>
          </div>
        ))}
      </dl>
    </section>
  </div>
);

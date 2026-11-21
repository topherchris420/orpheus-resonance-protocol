import { committedCalibrationRecord } from '@/assistant/calibrationRegistry';
import { AppShell } from '@/components/common/AppShell';
import { SignalBadge } from '@/components/common/ProvenanceBadge';
import { EVIDENCE_LADDER, LADDER_STAGES } from '@/content/evidenceLadder';
import { GLOSSARY } from '@/content/glossary';
import { LIMITATIONS } from '@/experiment/package';
import { INFERRED_SIGNALS_NOTE, SIGNALS } from '@/sensing/registry';

const stageIndex = (stage: string) => LADDER_STAGES.findIndex((candidate) => candidate.id === stage);

const Method = () => (
  <AppShell mode="Method">
    <div className="mx-auto max-w-6xl space-y-12 px-4 py-10 sm:px-6">
      <header>
        <p className="o-eyebrow text-o-teal">Method</p>
        <h1 className="mt-2 text-3xl font-semibold text-o-text">What Orpheus establishes, and what it does not</h1>
        <p className="mt-3 max-w-3xl text-o-text2">
          Intelligence earns authority through evidence, not confidence. This page applies the same rule to Orpheus itself: every capability is placed on an evidence ladder, every
          displayed signal is labeled measured, simulated or inferred, and every limitation is stated.
        </p>
      </header>

      <section aria-labelledby="ladder-heading">
        <h2 id="ladder-heading" className="text-xl font-semibold text-o-text">
          Evidence ladder
        </h2>
        <ol className="mt-3 flex flex-wrap gap-2 text-xs" aria-label="Stages">
          {LADDER_STAGES.map((stage, index) => (
            <li key={stage.id} className="o-chip border-o-line-strong text-o-text2">
              {index + 1}. {stage.label} — {stage.meaning}
            </li>
          ))}
        </ol>
        <div className="mt-4 overflow-x-auto">
          <table className="o-table min-w-[48rem]">
            <caption className="sr-only">Capabilities and the stage of evidence each has reached</caption>
            <thead>
              <tr>
                <th scope="col">Capability</th>
                <th scope="col">Stage reached</th>
                <th scope="col">Evidence</th>
                <th scope="col">Not yet established</th>
              </tr>
            </thead>
            <tbody>
              {EVIDENCE_LADDER.map((entry) => (
                <tr key={entry.capability}>
                  <td className="font-medium text-o-text">{entry.capability}</td>
                  <td>
                    <span className="whitespace-nowrap">
                      {stageIndex(entry.stage) + 1}/6 · {LADDER_STAGES[stageIndex(entry.stage)].label}
                    </span>
                  </td>
                  <td>{entry.evidence}</td>
                  <td>{entry.notYet}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="signals-heading">
        <h2 id="signals-heading" className="text-xl font-semibold text-o-text">
          Measured, simulated, inferred
        </h2>
        <p className="mt-2 text-sm text-o-text2">{INFERRED_SIGNALS_NOTE}</p>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {SIGNALS.map((signal) => (
            <li key={signal.id} className="o-panel p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <SignalBadge category={signal.category} />
                <h3 className="font-semibold text-o-text">{signal.label}</h3>
              </div>
              <p className="mt-2 text-o-text2">{signal.method}</p>
              <p className="mt-2 text-o-text3">
                <span className="text-o-text2">Indicates:</span> {signal.indicates}
              </p>
              <p className="mt-1 text-o-text3">
                <span className="text-o-text2">Does not indicate:</span> {signal.doesNotIndicate}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="engine-heading" className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 id="engine-heading" className="text-xl font-semibold text-o-text">
            How the uncertainty-aware assistant reasons
          </h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-o-text2">
            <li>Set aside assistant statements, assumptions and derived estimates as evidence.</li>
            <li>Exclude items that fail integrity or plausibility checks, come from a source without a record, or from a source whose record no longer applies.</li>
            <li>Reduce the weight of aging items linearly to nothing at twice their freshness window.</li>
            <li>Count each origin once, so relays are not mistaken for confirmation.</li>
            <li>Combine the rest with Bayes' rule under the declared source grades.</li>
            <li>Check model fit: if reliable sources disagree far more than the model allows, decline.</li>
            <li>Conclude only at 80% or more — the level at which concluding pays off under the payoff matrix (+1 / −4 / 0). Otherwise, say what is unknown and what would help.</li>
          </ol>
        </div>
        <div className="o-panel p-5 text-sm text-o-text2">
          <h3 className="font-semibold text-o-text">Calibration record</h3>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-o-text3">Method</dt>
            <dd>{committedCalibrationRecord.method}</dd>
            <dt className="text-o-text3">Trials</dt>
            <dd>{committedCalibrationRecord.trials.toLocaleString('en-US')}</dd>
            <dt className="text-o-text3">Expected calibration error</dt>
            <dd>{committedCalibrationRecord.ece}</dd>
            <dt className="text-o-text3">Brier score</dt>
            <dd>{committedCalibrationRecord.brier}</dd>
            <dt className="text-o-text3">Coverage at 0.80</dt>
            <dd>{Math.round(committedCalibrationRecord.coverage * 100)}%</dd>
            <dt className="text-o-text3">Accuracy when concluding</dt>
            <dd>{Math.round(committedCalibrationRecord.selectiveAccuracy * 100)}%</dd>
          </dl>
          <p className="mt-3 text-o-text3">{committedCalibrationRecord.evaluatedOn}</p>
        </div>
      </section>

      <section aria-labelledby="glossary-heading">
        <h2 id="glossary-heading" className="text-xl font-semibold text-o-text">
          Glossary
        </h2>
        <dl className="mt-4 grid gap-3 md:grid-cols-2">
          {Object.values(GLOSSARY).map((entry) => (
            <div key={entry.term} className="o-panel p-4 text-sm">
              <dt className="font-semibold text-o-text">{entry.term}</dt>
              <dd className="mt-1 text-o-text2">{entry.short}</dd>
              <dd className="mt-1 text-o-text3">{entry.detail}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="limits-heading">
        <h2 id="limits-heading" className="text-xl font-semibold text-o-text">
          Limitations
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-o-text2">
          {LIMITATIONS.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      </section>
    </div>
  </AppShell>
);

export default Method;

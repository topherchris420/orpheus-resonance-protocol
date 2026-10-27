import { shortHash } from '@/engine/canonical';
import { DEFAULT_MISFIT_ALPHA, DEFAULT_THRESHOLD, EVALUATED_MAX_ITEMS, exclusionText } from '@/evidence/engine';
import { CLASS_ACCURACY, NAIVE_UNKNOWN_ACCURACY, RELIABILITY_LABEL } from '@/evidence/sources';
import type { ExclusionReason, ReliabilityClass } from '@/evidence/types';
import { LIMITATIONS } from '@/experiment/package';
import { PROTOCOL } from '@/experiment/protocol';
import { manifestHash, SCENARIOS } from '@/scenarios/registry';
import { INFERRED_SIGNALS_NOTE, SIGNALS } from '@/sensing/registry';

const CLASSES: ReliabilityClass[] = ['A', 'B', 'C', 'D', 'E', 'F'];

const RULES: ExclusionReason[] = [
  'ai-statement',
  'assumption',
  'derived',
  'no-claim',
  'integrity-failure',
  'implausible-field',
  'unverifiable-source',
  'source-model-changed',
  'expired',
  'duplicate-origin',
];

const RULE_LABEL: Record<ExclusionReason, string> = {
  'ai-statement': 'Assistant statements',
  assumption: 'Assumptions',
  derived: 'Derived estimates',
  'no-claim': 'Context without a claim',
  'integrity-failure': 'Failed integrity check',
  'implausible-field': 'Implausible field',
  'unverifiable-source': 'No reliability record',
  'source-model-changed': 'Source channel changed',
  expired: 'Expired',
  'duplicate-origin': 'Same origin',
};

/** Every modeling assumption the analysis depends on, in one place, with the code that defines it. */
export const AssumptionsView = () => (
  <div className="space-y-8">
    <section className="o-panel p-5" aria-labelledby="assumptions-intro">
      <h2 id="assumptions-intro" className="text-lg font-semibold text-o-text">
        Declared assumptions
      </h2>
      <p className="mt-1 max-w-3xl text-sm text-o-text2">
        The evidence engine, the task generator and the scoring all rest on the assumptions below. They are declared, not discovered: the simulation is built so that they hold, and
        the adversarial conditions deliberately violate them. A result inside Orpheus is only as relevant to the real world as these assumptions are.
      </p>
    </section>

    <section aria-labelledby="source-model-heading">
      <h3 id="source-model-heading" className="text-lg font-semibold text-o-text">
        Source model <span className="font-mono text-xs text-o-text3">src/evidence/sources.ts</span>
      </h3>
      <p className="mt-1 max-w-3xl text-sm text-o-text2">
        An admissible, current report from a source of each grade asserts the true interpretation with the declared accuracy, independently of other sources. Grade F sources have no
        record and are not weighed. The conventional baseline instead treats every report at face value and assumes {Math.round(NAIVE_UNKNOWN_ACCURACY * 100)}% for sources without
        a record.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="o-table">
          <thead>
            <tr>
              <th scope="col">Grade</th>
              <th scope="col">Meaning</th>
              <th scope="col">Declared accuracy</th>
            </tr>
          </thead>
          <tbody>
            {CLASSES.map((reliability) => (
              <tr key={reliability}>
                <th scope="row" className="text-left font-mono text-o-text">
                  {reliability}
                </th>
                <td>{RELIABILITY_LABEL[reliability]}</td>
                <td className="font-mono">{reliability === 'F' ? 'not weighed' : `${Math.round(CLASS_ACCURACY[reliability] * 100)}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>

    <section aria-labelledby="rules-heading">
      <h3 id="rules-heading" className="text-lg font-semibold text-o-text">
        Admissibility rules <span className="font-mono text-xs text-o-text3">src/evidence/engine.ts</span>
      </h3>
      <p className="mt-1 max-w-3xl text-sm text-o-text2">Items excluded from the calculation stay visible in the evidence panel with the rule that excluded them.</p>
      <dl className="mt-3 grid gap-2 md:grid-cols-2">
        {RULES.map((rule) => (
          <div key={rule} className="rounded-lg border border-o-line p-3 text-sm">
            <dt className="font-semibold text-o-text">{RULE_LABEL[rule]}</dt>
            <dd className="mt-1 text-o-text2">{exclusionText(rule)}</dd>
          </div>
        ))}
      </dl>
    </section>

    <section aria-labelledby="calculation-heading">
      <h3 id="calculation-heading" className="text-lg font-semibold text-o-text">
        Calculation and decision rule
      </h3>
      <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2">
        <div className="o-panel p-4">
          <dt className="font-semibold text-o-text">Freshness</dt>
          <dd className="mt-1 text-o-text2">
            A report keeps its declared accuracy until its source&apos;s freshness window has passed; after that its accuracy shrinks linearly toward chance, reaching chance at
            twice the window, when it expires. The generator lets the world change since an old observation with probability (1 − weight) / 2, so the discount matches the simulated
            world.
          </dd>
        </div>
        <div className="o-panel p-4">
          <dt className="font-semibold text-o-text">Combination</dt>
          <dd className="mt-1 text-o-text2">
            Bayes&apos; rule over the admissible items, starting from the decision&apos;s stated prior. Relays and repeats of the same origin count once.
          </dd>
        </div>
        <div className="o-panel p-4">
          <dt className="font-semibold text-o-text">Threshold from the payoff</dt>
          <dd className="mt-1 text-o-text2">
            Concluding pays when P × {PROTOCOL.payoff.correct} + (1 − P) × ({PROTOCOL.payoff.wrong}) ≥ {PROTOCOL.payoff.defer}, i.e. when P ≥ (defer − wrong) / (correct − wrong) ={' '}
            {DEFAULT_THRESHOLD.toFixed(2)}. Below that the assistant states that the evidence is insufficient.
          </dd>
        </div>
        <div className="o-panel p-4">
          <dt className="font-semibold text-o-text">Model-fit check</dt>
          <dd className="mt-1 text-o-text2">
            With three or more admissible reports, Orpheus asks how likely it is, under the declared accuracies, that at least as many reports would contradict each
            interpretation as actually do (a Poisson-binomial tail). If even the best-fitting interpretation leaves that below {DEFAULT_MISFIT_ALPHA}, the source model does not fit
            this evidence, and the assistant declines to conclude or show a probability.
          </dd>
        </div>
        <div className="o-panel p-4 md:col-span-2">
          <dt className="font-semibold text-o-text">Evaluated domain</dt>
          <dd className="mt-1 text-o-text2">
            Probabilities are shown only for decisions resembling those they were evaluated on: two interpretations, equal priors, at most {EVALUATED_MAX_ITEMS} admissible items,
            and a model fit. The Calibration tab shows the evaluation.
          </dd>
        </div>
      </dl>
    </section>

    <section aria-labelledby="scenarios-heading">
      <h3 id="scenarios-heading" className="text-lg font-semibold text-o-text">
        Scenario manifests <span className="font-mono text-xs text-o-text3">src/scenarios/</span>
      </h3>
      <p className="mt-1 max-w-3xl text-sm text-o-text2">
        Every session records the manifest hash it ran under. Replay refuses a recording whose manifest hash differs, so changing a scenario never silently changes old results.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="o-table min-w-[40rem]">
          <thead>
            <tr>
              <th scope="col">Scenario</th>
              <th scope="col">Version</th>
              <th scope="col">Manifest hash</th>
              <th scope="col">Decisions</th>
              <th scope="col">Sources</th>
            </tr>
          </thead>
          <tbody>
            {SCENARIOS.map((manifest) => (
              <tr key={manifest.id}>
                <th scope="row" className="text-left font-medium text-o-text">
                  {manifest.title}
                  <span className="block text-xs font-normal text-o-text3">{manifest.fictionNotice}</span>
                </th>
                <td className="font-mono">{manifest.version}</td>
                <td className="font-mono">{shortHash(manifestHash(manifest))}</td>
                <td className="font-mono">{manifest.decisions.length}</td>
                <td className="font-mono">{manifest.sources.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>

    <section aria-labelledby="signals-heading">
      <h3 id="signals-heading" className="text-lg font-semibold text-o-text">
        Signal provenance <span className="font-mono text-xs text-o-text3">src/sensing/registry.ts</span>
      </h3>
      <p className="mt-1 max-w-3xl text-sm text-o-text2">Every displayed signal is measured, simulated or inferred. {INFERRED_SIGNALS_NOTE}</p>
      <div className="mt-3 overflow-x-auto">
        <table className="o-table min-w-[48rem]">
          <thead>
            <tr>
              <th scope="col">Signal</th>
              <th scope="col">Category</th>
              <th scope="col">Method</th>
              <th scope="col">Does not indicate</th>
            </tr>
          </thead>
          <tbody>
            {SIGNALS.map((descriptor) => (
              <tr key={descriptor.id}>
                <th scope="row" className="text-left font-medium text-o-text">
                  {descriptor.label}
                  <span className="block text-xs font-normal text-o-text3">{descriptor.source}</span>
                </th>
                <td className="font-mono">{descriptor.category}</td>
                <td>{descriptor.method}</td>
                <td>{descriptor.doesNotIndicate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>

    <section aria-labelledby="limitations-heading">
      <h3 id="limitations-heading" className="text-lg font-semibold text-o-text">
        Limitations recorded in every research package
      </h3>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-o-text2">
        {LIMITATIONS.map((limitation) => (
          <li key={limitation}>{limitation}</li>
        ))}
      </ul>
    </section>
  </div>
);

import { CheckCircle2, Play, XCircle } from 'lucide-react';
import { useState } from 'react';
import { committedCalibrationRecord, MAX_DISPLAY_ECE, type CalibrationRecord } from '@/assistant/calibrationRegistry';
import { ReliabilityDiagram } from '@/components/charts/charts';
import { VIZ } from '@/components/charts/palette';
import { hashValue } from '@/engine/canonical';
import { ENGINE_VERSION } from '@/engine/version';
import { EVALUATED_MAX_ITEMS } from '@/evidence/engine';
import type { MethodEvaluation } from '@/evidence/evaluation';
import { useResearchJobs } from '@/state/researchJobs';

const TRIAL_CHOICES = [2000, 5000, 20000];

/** The numbers that define an evaluation; the descriptive fields are left out of the comparison. */
const fingerprint = (record: Pick<CalibrationRecord, 'method' | 'engineVersion' | 'seed' | 'trials' | 'ece' | 'brier' | 'selectiveAccuracy' | 'coverage' | 'threshold' | 'bins'>) =>
  hashValue({
    method: record.method,
    engineVersion: record.engineVersion,
    seed: record.seed,
    trials: record.trials,
    ece: record.ece,
    brier: record.brier,
    selectiveAccuracy: record.selectiveAccuracy,
    coverage: record.coverage,
    threshold: record.threshold,
    bins: record.bins,
  });

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

const MethodTable = ({ rows }: { rows: Array<{ label: string; record: Pick<MethodEvaluation, 'ece' | 'brier' | 'selectiveAccuracy' | 'coverage' | 'trials'> }> }) => (
  <div className="overflow-x-auto">
    <table className="o-table">
      <thead>
        <tr>
          <th scope="col">Method</th>
          <th scope="col">Trials</th>
          <th scope="col">Expected calibration error</th>
          <th scope="col">Brier score</th>
          <th scope="col">Accuracy when concluding (≥ 80%)</th>
          <th scope="col">Share concluded</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ label, record }) => (
          <tr key={label}>
            <th scope="row" className="text-left font-medium text-o-text">
              {label}
            </th>
            <td className="font-mono">{record.trials.toLocaleString('en-US')}</td>
            <td className="font-mono">{record.ece.toFixed(4)}</td>
            <td className="font-mono">{record.brier.toFixed(4)}</td>
            <td className="font-mono">{pct(record.selectiveAccuracy)}</td>
            <td className="font-mono">{pct(record.coverage)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const CalibrationView = () => {
  const run = useResearchJobs();
  const committed = committedCalibrationRecord;
  const [seed, setSeed] = useState(committed.seed);
  const [trials, setTrials] = useState(5000);
  const [status, setStatus] = useState<'idle' | 'running' | 'error'>('idle');
  const [result, setResult] = useState<{ aware: MethodEvaluation; naive: MethodEvaluation } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const evaluate = async () => {
    setStatus('running');
    setError(null);
    try {
      setResult(await run({ kind: 'calibration', seed, trials }));
      setStatus('idle');
    } catch (failure) {
      setStatus('error');
      setError(failure instanceof Error ? failure.message : 'The evaluation failed.');
    }
  };

  const sameSettings = result && result.aware.seed === committed.seed && result.aware.trials === committed.trials;
  const reproduced = sameSettings ? fingerprint(result.aware) === fingerprint(committed) : null;
  const current = committed.engineVersion === ENGINE_VERSION;

  return (
    <div className="space-y-8">
      <section className="o-panel space-y-4 p-5" aria-labelledby="committed-heading">
        <div className="max-w-3xl">
          <p className="o-eyebrow">Committed evaluation record · {committed.method}</p>
          <h2 id="committed-heading" className="mt-2 text-lg font-semibold text-o-text">
            When may the assistant show a probability?
          </h2>
          <p className="mt-2 text-sm text-o-text2">
            Only when its method has been implemented <em>and</em> evaluated. The record below was produced by <span className="font-mono">{committed.generatedBy}</span>. The assistant
            shows a probability only if the record matches the running engine version, its expected calibration error is at most {MAX_DISPLAY_ECE}, and the decision lies inside
            the evaluated domain: two interpretations with equal priors, at most {EVALUATED_MAX_ITEMS} admissible items, and an evidence pattern that fits the source model.
            Otherwise it states why no probability is shown.
          </p>
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-o-text3">Engine version</dt>
            <dd className="mt-0.5 flex items-center gap-1.5 font-mono text-o-text">
              {current ? <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-o-teal-strong" /> : <XCircle aria-hidden="true" className="h-4 w-4 text-o-amber" />}
              {committed.engineVersion} {current ? '(current)' : `(running ${ENGINE_VERSION}: probabilities withheld)`}
            </dd>
          </div>
          <div>
            <dt className="text-o-text3">Trials · seed</dt>
            <dd className="mt-0.5 font-mono text-o-text">
              {committed.trials.toLocaleString('en-US')} · {committed.seed}
            </dd>
          </div>
          <div>
            <dt className="text-o-text3">Expected calibration error</dt>
            <dd className="mt-0.5 font-mono text-o-text">
              {committed.ece.toFixed(4)} (limit {MAX_DISPLAY_ECE})
            </dd>
          </div>
          <div>
            <dt className="text-o-text3">Brier score</dt>
            <dd className="mt-0.5 font-mono text-o-text">{committed.brier.toFixed(4)}</dd>
          </div>
        </dl>
        <p className="text-sm text-o-text2">
          <strong className="font-semibold text-o-text">Evaluated on:</strong> {committed.evaluatedOn}
        </p>
        <p role="note" className="rounded-lg border border-o-line p-3 text-sm text-o-text2">
          The sampler follows the declared source model exactly, so this evaluation shows that the computation is implemented correctly. It does not show that real sources behave
          like the declared model, and calibration outside this domain is unknown.
        </p>
        <ReliabilityDiagram
          caption={`Reliability of the committed record: stated probability of the leading interpretation against how often it was true (${committed.trials.toLocaleString('en-US')} trials)`}
          series={[{ name: committed.method, color: VIZ.series1, bins: committed.bins }]}
        />
      </section>

      <section className="o-panel space-y-5 p-5" aria-labelledby="rerun-heading">
        <div className="max-w-3xl">
          <h2 id="rerun-heading" className="text-lg font-semibold text-o-text">
            Re-run the evaluation in this browser
          </h2>
          <p className="mt-1 text-sm text-o-text2">
            The uncertainty-aware method and the conventional baseline (every report at face value: no integrity, freshness, independence or assumption checks, never abstains) are
            scored on identical sampled trials. With the committed seed and {committed.trials.toLocaleString('en-US')} trials the result must match the record exactly.
          </p>
        </div>
        <form
          className="flex flex-wrap items-end gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void evaluate();
          }}
        >
          <label className="text-sm text-o-text2">
            Seed
            <input className="o-input mt-1 block w-64 font-mono" value={seed} onChange={(event) => setSeed(event.target.value || committed.seed)} />
          </label>
          <label className="text-sm text-o-text2">
            Trials
            <select className="o-input mt-1 block" value={trials} onChange={(event) => setTrials(Number(event.target.value))}>
              {TRIAL_CHOICES.map((count) => (
                <option key={count} value={count}>
                  {count.toLocaleString('en-US')}
                  {count === committed.trials ? ' (as committed)' : ''}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="o-button-primary" disabled={status === 'running'}>
            <Play aria-hidden="true" className="h-4 w-4" /> {status === 'running' ? 'Evaluating…' : 'Evaluate'}
          </button>
          <span role="status" className="text-sm text-o-text3">
            {status === 'running' ? `Scoring ${trials.toLocaleString('en-US')} sampled decisions in the background…` : status === 'error' ? error : ''}
          </span>
        </form>
        {result && (
          <div className="space-y-5">
            {reproduced !== null && (
              <p role="status" className={`flex items-center gap-2 text-sm ${reproduced ? 'text-o-teal-strong' : 'text-o-amber'}`}>
                {reproduced ? <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> : <XCircle aria-hidden="true" className="h-4 w-4" />}
                {reproduced
                  ? 'Reproduced: every number matches the committed record.'
                  : 'Does not match the committed record. The engine has changed since the record was generated; run npm run evaluate and commit the new record.'}
              </p>
            )}
            <MethodTable
              rows={[
                { label: `${result.aware.method} (uncertainty-aware)`, record: result.aware },
                { label: `${result.naive.method} (conventional)`, record: result.naive },
              ]}
            />
            <ReliabilityDiagram
              caption={`Reliability on ${result.aware.trials.toLocaleString('en-US')} sampled decisions (seed ${result.aware.seed})`}
              series={[
                { name: 'Uncertainty-aware', color: VIZ.series1, bins: result.aware.bins },
                { name: 'Conventional', color: VIZ.series2, bins: result.naive.bins },
              ]}
            />
            <p className="text-sm text-o-text2">
              Points below the diagonal are overconfident: the method said more than the evidence supported. The conventional method takes every report at face value, so corrupted,
              stale and relayed reports push its stated probabilities above how often it is right.
            </p>
          </div>
        )}
      </section>
    </div>
  );
};

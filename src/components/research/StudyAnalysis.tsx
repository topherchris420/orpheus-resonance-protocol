import { CheckCircle2, ExternalLink, FileUp, XCircle } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { shortHash } from '@/engine/canonical';
import type { ResearchPackage } from '@/experiment/package';
import { PROTOCOL } from '@/experiment/protocol';
import type { CombineResult, Exclusion } from '@/experiment/reproduce';
import { useResearchJobs } from '@/state/researchJobs';

const MAX_FILES = 200;
const MAX_BYTES = 60 * 1024 * 1024;

const STEPS = [
  'Obtain ethics approval for your institution. Orpheus collects no personal information, but a study with people still needs review.',
  'Pilot with a few people and revise the planned sample with a power analysis, as the protocol states.',
  `For each participant, open the study runner in a fresh tab, enter the next participant number (the Latin-square row is the number minus one, modulo 4), and hand over after setup.`,
  'At the end, download the participant package. Nothing is stored anywhere else.',
  'Load all participant packages here. Each one is verified by replay before it is combined; the summary is recomputed from the replayed sessions.',
];

/** Running a study with people, and combining participant packages into one analysis. */
export const StudyAnalysis = ({ onPackage }: { onPackage: (pkg: ResearchPackage) => void }) => {
  const run = useResearchJobs();
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'idle' | 'running' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<CombineResult | null>(null);

  const combine = async (files: File[]) => {
    setResult(null);
    setMessage(null);
    if (files.length > MAX_FILES) {
      setStatus('error');
      setMessage(`Select at most ${MAX_FILES} files.`);
      return;
    }
    setStatus('running');
    const inputs: Array<{ name: string; raw: unknown }> = [];
    for (const file of files) {
      if (file.size > MAX_BYTES) {
        inputs.push({ name: file.name, raw: null });
        continue;
      }
      try {
        inputs.push({ name: file.name, raw: JSON.parse(await file.text()) });
      } catch {
        inputs.push({ name: file.name, raw: null });
      }
    }
    try {
      setResult(await run({ kind: 'combine', inputs, generatedAt: new Date().toISOString() }));
      setStatus('idle');
    } catch (failure) {
      setStatus('error');
      setMessage(failure instanceof Error ? failure.message : 'Combining failed.');
    }
  };

  const exclusions = (result?.pkg?.content.configuration.exclusions as Exclusion[] | undefined) ?? [];
  const accepted = result?.pkg?.content.participants.length ?? 0;

  return (
    <div className="space-y-6">
      <section className="o-panel space-y-4 p-5" aria-labelledby="run-study-heading">
        <div className="max-w-3xl">
          <h2 id="run-study-heading" className="text-lg font-semibold text-o-text">
            Run the protocol with people
          </h2>
          <p className="mt-1 text-sm text-o-text2">
            No human data has been collected with Orpheus so far. The runner implements protocol {PROTOCOL.id}@{PROTOCOL.version}: participant information and consent, two
            practice trials, four counterbalanced blocks with sequential advice (answer first, then see the assistant), and the workload, comprehension and comfort questionnaire
            after each block.
          </p>
        </div>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-o-text2">
          {STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <Link to="/study" className="o-button-primary inline-flex">
          <ExternalLink aria-hidden="true" className="h-4 w-4" /> Open the study runner
        </Link>
      </section>

      <section className="o-panel space-y-4 p-5" aria-labelledby="combine-heading">
        <div className="max-w-3xl">
          <h2 id="combine-heading" className="text-lg font-semibold text-o-text">
            Analyze participant packages
          </h2>
          <p className="mt-1 text-sm text-o-text2">
            Select every participant package. Packages that fail verification, sessions recorded under other settings (such as demonstrations), and duplicate participant codes are
            left out and listed. The protocol&apos;s exclusion rule — fewer than half of the scored trials answered — is applied and reported.
          </p>
        </div>
        <input
          ref={input}
          type="file"
          multiple
          accept="application/json,.json"
          className="hidden"
          aria-label="Participant package files"
          id="study-packages"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = '';
            if (files.length) void combine(files);
          }}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="o-button-primary" onClick={() => input.current?.click()} disabled={status === 'running'}>
            <FileUp aria-hidden="true" className="h-4 w-4" /> Select participant packages…
          </button>
          <span role="status" className="text-sm text-o-text3">
            {status === 'running' ? 'Verifying and replaying every session…' : status === 'error' ? message : ''}
          </span>
        </div>

        {result && (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="o-table">
                <thead>
                  <tr>
                    <th scope="col">File</th>
                    <th scope="col">Verified</th>
                    <th scope="col">Content hash</th>
                    <th scope="col">Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {result.inputs.map((entry, index) => {
                    const ok =
                      entry.verification.schemaOk &&
                      entry.verification.contentHashOk &&
                      entry.verification.protocolMatches &&
                      entry.verification.sessions.every((session) => session.verified) &&
                      entry.verification.issues.length === 0;
                    return (
                      <tr key={`${entry.name}-${index}`}>
                        <th scope="row" className="text-left font-normal text-o-text">
                          {entry.name}
                        </th>
                        <td>
                          <span className={`flex items-center gap-1.5 ${ok ? 'text-o-teal-strong' : 'text-o-red'}`}>
                            {ok ? <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> : <XCircle aria-hidden="true" className="h-4 w-4" />}
                            {ok ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="font-mono">{entry.contentHash ? shortHash(entry.contentHash) : '—'}</td>
                        <td className="text-o-text2">{entry.verification.issues.join(' ') || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {result.rejected.length > 0 && (
              <p className="text-sm text-o-amber">
                Not combined: {result.rejected.map((entry) => `${entry.participant} (${entry.reason})`).join('; ')}
              </p>
            )}
            {result.duplicates.length > 0 && <p className="text-sm text-o-amber">Duplicate participant codes, kept once: {result.duplicates.join(', ')}</p>}
            {exclusions.length > 0 && (
              <p className="text-sm text-o-amber">
                Excluded by the protocol rule: {exclusions.map((entry) => `${entry.participant} (${entry.completed} of ${entry.planned} trials)`).join('; ')}
              </p>
            )}
            {result.pkg ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-o-text2">
                  {accepted} participant{accepted === 1 ? '' : 's'} combined · package <span className="font-mono">{shortHash(result.pkg.contentHash)}</span>
                </p>
                <button type="button" className="o-button" onClick={() => onPackage(result.pkg!)}>
                  Show combined results
                </button>
              </div>
            ) : (
              <p className="text-sm text-o-text3">No session could be combined.</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

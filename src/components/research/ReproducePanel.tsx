import { CheckCircle2, FileUp, MinusCircle, XCircle } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { shortHash } from '@/engine/canonical';
import { SCHEMA } from '@/engine/version';
import type { PackageVerification, ResearchPackage } from '@/experiment/package';
import { useResearchJobs } from '@/state/researchJobs';

const MAX_BYTES = 60 * 1024 * 1024;

const Check = ({ ok, label, detail }: { ok: boolean | null; label: string; detail?: string }) => (
  <li className="flex items-start gap-2 text-sm">
    {ok === null ? (
      <MinusCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-o-text3" />
    ) : ok ? (
      <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-o-teal-strong" />
    ) : (
      <XCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-o-red" />
    )}
    <span>
      <span className="text-o-text">
        {label}: {ok === null ? 'not checked' : ok ? 'yes' : 'no'}
      </span>
      {detail && <span className="block text-o-text3">{detail}</span>}
    </span>
  </li>
);

export const ReproducePanel = ({ current, onOpen }: { current: ResearchPackage | null; onOpen: (pkg: ResearchPackage) => void }) => {
  const run = useResearchJobs();
  const input = useRef<HTMLInputElement>(null);
  const [rerun, setRerun] = useState(true);
  const [status, setStatus] = useState<'idle' | 'running' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<{ name: string; raw: unknown } | null>(null);
  const [verification, setVerification] = useState<PackageVerification | null>(null);

  const verify = async (name: string, raw: unknown) => {
    setLoaded({ name, raw });
    setVerification(null);
    setStatus('running');
    setMessage(null);
    try {
      setVerification(await run({ kind: 'reproduce', raw, rerun }));
      setStatus('idle');
    } catch (failure) {
      setStatus('error');
      setMessage(failure instanceof Error ? failure.message : 'Verification failed.');
    }
  };

  const readFile = async (file: File) => {
    if (file.size > MAX_BYTES) {
      setStatus('error');
      setMessage('The file is larger than 60 MB and was not opened.');
      return;
    }
    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      setStatus('error');
      setMessage('The file is not valid JSON.');
      return;
    }
    const kind = (raw as { schema?: unknown } | null)?.schema;
    if (kind === SCHEMA.session || kind === SCHEMA.legacySession) {
      setStatus('error');
      setMessage('This is a mission record. Open it in Replay, which verifies and steps through mission sessions.');
      return;
    }
    await verify(file.name, raw);
  };

  const pkg = loaded?.raw as ResearchPackage | undefined;
  const verifiedSessions = verification?.sessions.filter((session) => session.verified).length ?? 0;
  const allGood =
    verification !== null &&
    verification.schemaOk &&
    verification.contentHashOk &&
    verification.protocolMatches &&
    verifiedSessions === verification.sessions.length &&
    verification.reproduced !== false;

  return (
    <div className="space-y-6">
      <section className="o-panel space-y-4 p-5" aria-labelledby="reproduce-heading">
        <div className="max-w-3xl">
          <h2 id="reproduce-heading" className="text-lg font-semibold text-o-text">
            Verify and reproduce a research package
          </h2>
          <p className="mt-1 text-sm text-o-text2">
            Verification recomputes the content hash, checks the protocol version, and rebuilds every recorded session from its configuration and command log, comparing the final
            state hash. Simulated batches can also be regenerated from their recorded configuration, which must produce the identical content hash. This establishes that the software
            reproduces the same computation; it is not scientific validation of the results.
          </p>
          <p className="mt-2 text-sm text-o-text3">
            Mission records from Explorer are verified in <Link className="o-link" to="/replay">Replay</Link>.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={input}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            id="package-file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void readFile(file);
            }}
          />
          <button type="button" className="o-button-primary" onClick={() => input.current?.click()} disabled={status === 'running'}>
            <FileUp aria-hidden="true" className="h-4 w-4" /> Open research package…
          </button>
          {current && (
            <button type="button" className="o-button" disabled={status === 'running'} onClick={() => void verify('Package generated in this session', current)}>
              Verify the package generated in this session
            </button>
          )}
          <label className="flex items-center gap-2 text-sm text-o-text2">
            <input type="checkbox" checked={rerun} onChange={(event) => setRerun(event.target.checked)} />
            Also regenerate simulated batches from their configuration
          </label>
        </div>
        <p role="status" className="text-sm text-o-text3">
          {status === 'running' ? 'Replaying every session in the background…' : status === 'error' ? message : ''}
        </p>
      </section>

      {verification && loaded && (
        <section className="o-panel space-y-4 p-5" aria-labelledby="verification-heading">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="o-eyebrow">{loaded.name}</p>
              <h3 id="verification-heading" className={`mt-1 flex items-center gap-2 text-lg font-semibold ${allGood ? 'text-o-teal-strong' : 'text-o-red'}`}>
                {allGood ? <CheckCircle2 aria-hidden="true" className="h-5 w-5" /> : <XCircle aria-hidden="true" className="h-5 w-5" />}
                {allGood ? 'Verified' : 'Verification failed'}
              </h3>
              {pkg?.contentHash && (
                <p className="mt-1 text-sm text-o-text3">
                  Content hash <span className="font-mono">{shortHash(pkg.contentHash)}</span>
                  {pkg.content?.kind ? ` · ${pkg.content.kind === 'agent-batch' ? 'simulated agents' : 'human study'}` : ''}
                </p>
              )}
            </div>
            {verification.schemaOk && pkg && (
              <button type="button" className="o-button" onClick={() => onOpen(pkg)}>
                Show results{verification.contentHashOk ? '' : ' (unverified)'}
              </button>
            )}
          </div>
          <ul className="space-y-2">
            <Check ok={verification.schemaOk} label="Orpheus research package" />
            <Check ok={verification.schemaOk ? verification.contentHashOk : null} label="Content hash matches" detail="Any edit to the package after generation changes the hash." />
            <Check ok={verification.schemaOk ? verification.protocolMatches : null} label="Produced under this build's protocol" />
            <Check
              ok={verification.sessions.length ? verifiedSessions === verification.sessions.length : null}
              label={`Sessions reproduced by replay (${verifiedSessions} of ${verification.sessions.length})`}
            />
            <Check
              ok={verification.reproduced}
              label="Regenerated batch has the identical content hash"
              detail={verification.reproduced === null ? 'Applies to simulated batches when regeneration is selected.' : undefined}
            />
          </ul>
          {verification.issues.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-o-text">Issues</h4>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-o-text2">
                {verification.issues.slice(0, 50).map((issue, index) => (
                  <li key={index}>{issue}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

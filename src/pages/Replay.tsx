import { CheckCircle2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, FileWarning, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AppShell } from '@/components/common/AppShell';
import { InfoTip } from '@/components/common/InfoTip';
import { AssistantPanel } from '@/components/evidence/AssistantPanel';
import { EvidencePanel } from '@/components/evidence/EvidencePanel';
import { DecisionOutcome } from '@/components/explorer/Review';
import { TacticalDataDisplay } from '@/components/TacticalDataDisplay';
import { formatSimTime } from '@/engine/clock';
import { importSessionRecord, type ImportResult } from '@/engine/mission/record';
import { createMissionState, reduceMission } from '@/engine/mission/reducer';
import { decisionThreshold, specFor } from '@/engine/mission/selectors';
import type { MissionCommand, MissionState } from '@/engine/mission/types';
import { assessEvidence } from '@/evidence/engine';
import { decisionEvidenceContext } from '@/scenarios/evidence';
import { getScenario } from '@/scenarios/registry';
import { recallRecord } from '@/state/missionStore';

const describeCommand = (command: MissionCommand, title: (pointId: string) => string): string => {
  switch (command.type) {
    case 'advance':
      return `Simulated time advanced ${command.ticks} s`;
    case 'advancePhase':
      return 'Phase advanced';
    case 'setAutoAdvance':
      return `Auto advance ${command.enabled ? 'on' : 'off'}`;
    case 'toggleRedTeam':
      return 'Red-team simulation toggled';
    case 'setCondition':
      return `Assistant changed to condition ${command.condition}`;
    case 'inspectEvidence':
      return `Inspected evidence in “${title(command.pointId)}”`;
    case 'commitDecision':
      return `Committed a course in “${title(command.pointId)}”`;
    case 'note':
      return `${command.label}: ${command.detail}`;
    default:
      return 'Command';
  }
};

const readFile = (file: File) => file.text().then((text) => JSON.parse(text) as unknown);

const Replay = () => {
  const [params] = useSearchParams();
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (params.get('from') === 'session') {
      const record = recallRecord();
      if (record) setResult(importSessionRecord(JSON.parse(JSON.stringify(record))));
    }
  }, [params]);

  const load = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const raw = await readFile(file);
      if ((raw as { schema?: string }).schema === 'orpheus.research-package.v1') {
        setError('This is a research package. Open it in Research → Reproduce.');
        return;
      }
      setResult(importSessionRecord(raw));
      setStep(0);
    } catch {
      setError('The file could not be read as JSON.');
    }
  };

  const session = result?.kind === 'session' ? result : null;
  const manifest = session ? getScenario(session.record.header.scenario.id) : undefined;
  const replayable = Boolean(session?.verification.compatibility.replayable && manifest && session.verification.chain.ok);

  // Rebuild every intermediate state once; states share structure, so this stays small.
  const states = useMemo(() => {
    if (!session || !manifest || !replayable) return [] as MissionState[];
    const list: MissionState[] = [createMissionState(manifest, session.record.header.seed, session.record.header.condition)];
    for (const entry of session.record.log) {
      const next = reduceMission(list[list.length - 1], entry.command, manifest);
      if (!next.accepted) break;
      list.push(next.state);
    }
    return list;
  }, [manifest, replayable, session]);

  const state = states[Math.min(step, states.length - 1)];
  const entry = session && step > 0 ? session.record.log[step - 1] : null;
  const title = (pointId: string) => (manifest ? specFor(manifest, pointId)?.title ?? pointId : pointId);
  const significant = useMemo(
    () => (session ? session.record.log.map((logEntry, index) => ({ index: index + 1, command: logEntry.command })).filter(({ command }) => command.type !== 'advance') : []),
    [session],
  );
  const committed = entry?.command.type === 'commitDecision' ? state?.resolved.find((decision) => decision.pointId === (entry.command as { pointId: string }).pointId) : undefined;
  const committedContext = useMemo(() => {
    if (!committed || !manifest || !state) return null;
    const spec = specFor(manifest, committed.pointId)!;
    const runtime = state.decisions.find((candidate) => candidate.id === committed.pointId)!;
    const context = decisionEvidenceContext(manifest, spec, runtime.evidence!, committed.tick);
    return { context, report: assessEvidence(context, { threshold: decisionThreshold(manifest) }) };
  }, [committed, manifest, state]);

  return (
    <AppShell mode="Replay" wide>
      <div className="mx-auto max-w-[1680px] space-y-6 px-4 py-8 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-o-text">Replay a session</h1>
            <p className="mt-1 max-w-3xl text-sm text-o-text2">
              A session record holds its seed and every input. Orpheus recomputes the whole session and compares state hashes at each checkpoint, then lets you step through it.
            </p>
          </div>
          <label className="o-button cursor-pointer">
            <Upload aria-hidden="true" className="h-4 w-4" /> Load a session record (.json)
            <input type="file" accept="application/json,.json" className="sr-only" onChange={(event) => void load(event.target.files?.[0])} />
          </label>
        </header>

        {error && (
          <p role="alert" className="rounded-lg border border-o-amber/50 p-3 text-sm text-o-amber">
            {error}
          </p>
        )}
        {!result && !error && (
          <div className="o-panel p-6 text-sm text-o-text2">
            Load a record saved from Explorer, or finish a session and choose “Replay this session”.{' '}
            <Link className="o-link" to="/explore/orientation">
              Start the guided scenario
            </Link>
            .
          </div>
        )}
        {result?.kind === 'invalid' && (
          <div role="alert" className="rounded-lg border border-o-red/50 p-4 text-sm text-o-red">
            Not a valid session record: {result.errors.join(' · ')}
          </div>
        )}
        {result?.kind === 'legacy' && (
          <section className="o-panel space-y-3 p-5 text-sm text-o-text2" aria-label="Legacy record">
            <p className="flex items-center gap-2 font-semibold text-o-amber">
              <FileWarning aria-hidden="true" className="h-4 w-4" /> Orpheus v1 record — read only
            </p>
            <p>{result.note}</p>
            <ol className="list-decimal space-y-1 pl-5">
              {result.decisions.map((decision, index) => (
                <li key={index}>
                  {decision.title}: <span className="text-o-text">{decision.course}</span> (phase {decision.phase})
                </li>
              ))}
            </ol>
          </section>
        )}

        {session && (
          <section aria-label="Verification" className="o-panel p-5">
            <div className="flex flex-wrap items-center gap-3">
              {session.verification.verified ? (
                <p className="flex items-center gap-2 font-semibold text-o-teal-strong">
                  <CheckCircle2 aria-hidden="true" className="h-5 w-5" /> Exact replay verified
                </p>
              ) : (
                <p className="flex items-center gap-2 font-semibold text-o-amber">
                  <FileWarning aria-hidden="true" className="h-5 w-5" /> Not verified
                </p>
              )}
              <InfoTip term="replay" />
              <span className="text-sm text-o-text2">
                {session.verification.checkpointsMatched}/{session.verification.checkpointsChecked} checkpoints match · log {session.verification.chain.ok ? 'intact' : 'altered'} ·{' '}
                {session.record.header.scenario.id}@{session.record.header.scenario.version} · engine {session.record.header.engineVersion} · seed{' '}
                <span className="font-mono">{session.record.header.seed}</span>
              </span>
            </div>
            {session.verification.error && <p className="mt-2 text-sm text-o-amber">{session.verification.error}</p>}
            {session.verification.compatibility.issues.map((issue) => (
              <p key={issue} className="mt-1 text-sm text-o-amber">
                {issue}
              </p>
            ))}
            <p className="mt-2 text-xs text-o-text3">
              Matching hashes show the software reproduced the same computation from the same inputs. They do not validate the simulation or any conclusion drawn from it.
            </p>
          </section>
        )}

        {session && state && (
          <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
            <aside className="space-y-4" aria-label="Replay controls">
              <div className="o-panel p-4">
                <label htmlFor="replay-step" className="text-sm font-semibold text-o-text">
                  Step {step} of {states.length - 1}
                </label>
                <input
                  id="replay-step"
                  type="range"
                  min={0}
                  max={states.length - 1}
                  value={step}
                  onChange={(event) => setStep(Number(event.target.value))}
                  className="mt-3 w-full accent-[hsl(var(--o-teal))]"
                  aria-valuetext={`Step ${step}: ${entry ? describeCommand(entry.command, title) : 'initial state'}`}
                />
                <div className="mt-3 flex justify-between gap-1">
                  <button type="button" className="o-button min-h-10 px-2" aria-label="First step" onClick={() => setStep(0)}>
                    <ChevronsLeft aria-hidden="true" className="h-4 w-4" />
                  </button>
                  <button type="button" className="o-button min-h-10 px-2" aria-label="Previous step" onClick={() => setStep((value) => Math.max(0, value - 1))}>
                    <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                  </button>
                  <button type="button" className="o-button min-h-10 px-2" aria-label="Next step" onClick={() => setStep((value) => Math.min(states.length - 1, value + 1))}>
                    <ChevronRight aria-hidden="true" className="h-4 w-4" />
                  </button>
                  <button type="button" className="o-button min-h-10 px-2" aria-label="Last step" onClick={() => setStep(states.length - 1)}>
                    <ChevronsRight aria-hidden="true" className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-3 text-sm text-o-text2" aria-live="polite">
                  {entry ? describeCommand(entry.command, title) : 'Initial state'} · simulated {formatSimTime(state.tick)} · phase {state.phase}
                </p>
              </div>
              <nav aria-label="Recorded inputs" className="o-panel max-h-[28rem] overflow-y-auto p-2">
                <ol className="space-y-1">
                  <li>
                    <button type="button" className="o-button-quiet w-full justify-start text-left text-xs" aria-pressed={step === 0} onClick={() => setStep(0)}>
                      0 · Session start
                    </button>
                  </li>
                  {significant.map(({ index, command }) => (
                    <li key={index}>
                      <button type="button" className="o-button-quiet w-full justify-start text-left text-xs" aria-pressed={step === index} onClick={() => setStep(index)}>
                        {index} · {describeCommand(command, title)}
                      </button>
                    </li>
                  ))}
                </ol>
              </nav>
            </aside>
            <div className="min-w-0 space-y-4">
              <div className="h-[22rem]">
                <TacticalDataDisplay tracks={state.world.tracks} route={state.world.route} squad={state.world.squad} injectedContact={Boolean(state.redTeam.line)} tick={state.tick} />
              </div>
              <section className="o-panel p-4" aria-label="Decisions at this step">
                <h2 className="text-sm font-semibold text-o-text">Decisions at this step</h2>
                <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                  {state.decisions.map((decision) => (
                    <li key={decision.id} className="rounded-lg border border-o-line p-2 text-sm">
                      <span className="text-o-text">{title(decision.id)}</span>
                      <span className="ml-2 text-xs text-o-text3">{decision.status}</span>
                    </li>
                  ))}
                </ul>
              </section>
              {committed && manifest && committedContext && (
                <section className="space-y-4" aria-label="Decision committed at this step">
                  <h2 className="text-lg font-semibold text-o-text">{committed.pointTitle}</h2>
                  <DecisionOutcome decision={committed} manifest={manifest} />
                  <div className="grid gap-4 xl:grid-cols-2">
                    <AssistantPanel condition={committed.condition} output={committed.assistant} context={committedContext.context} report={committedContext.report} />
                    <EvidencePanel context={committedContext.context} report={committedContext.report} showQualityFlags />
                  </div>
                </section>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default Replay;

import { Download, HelpCircle, Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CONDITION_LABEL, CONDITION_SUMMARY, type AssistanceCondition } from '@/assistant/schema';
import { BiofeedbackConsentDialog } from '@/components/BiofeedbackConsentDialog';
import { ModeToolbar } from '@/components/ModeToolbar';
import { NeuroSimFallback } from '@/components/NeuroSimFallback';
import { VisualOverlays } from '@/components/VisualOverlays';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { appConfig } from '@/config/appConfig';
import { formatSimTime, PLAYBACK_SPEEDS, type PlaybackSpeed } from '@/engine/clock';
import { compareAssistance, summaryMarkdown } from '@/engine/mission/compare';
import { effectiveCohesion, maxPhase, nextStep, redTeamAvailable, shortlist, specFor } from '@/engine/mission/selectors';
import type { ResolvedDecision } from '@/engine/mission/types';
import { useAudioAnalysis } from '@/hooks/useAudioAnalysis';
import { useBreathPulseModulation } from '@/hooks/useBreathPulseModulation';
import { usePersistentState } from '@/hooks/usePersistentState';
import { cn } from '@/lib/utils';
import { grantMicrophoneConsent, type MicrophoneConsent } from '@/sensing/microphone';
import { downloadJson, downloadText, rememberRecord, timestampSlug, useMission, usePacer, type MissionStore } from '@/state/missionStore';
import { ControlRoom } from './ControlRoom';
import { DecisionLayer } from './DecisionLayer';
import { EvidenceLayer, LayerHeading, SituationLayer } from './Layers';
import { OutcomeDialog, SessionReview } from './Review';
import { currentTourStep, ORIENTATION_TOUR, TutorialRail, type TourTarget } from './TutorialRail';

const NeuroEmSimulator = lazy(() => import('@/components/NeuroEmSimulator').then((module) => ({ default: module.NeuroEmSimulator })));

type Layer = 'situation' | 'evidence' | 'decision';

interface ExplorerWorkspaceProps {
  store: MissionStore;
  guided: boolean;
  onNewSession: () => void;
  onPlayAgain: (condition: AssistanceCondition) => void;
}

export const ExplorerWorkspace = ({ store, guided, onNewSession, onPlayAgain }: ExplorerWorkspaceProps) => {
  const navigate = useNavigate();
  const manifest = store.manifest;
  const tick = useMission(store, (state) => state.tick);
  const phase = useMission(store, (state) => state.phase);
  const autoAdvance = useMission(store, (state) => state.autoAdvance);
  const condition = useMission(store, (state) => state.condition);
  const redTeam = useMission(store, (state) => state.redTeam);
  const resolvedCount = useMission(store, (state) => state.resolved.length);
  const step = useMission(store, (state) => nextStep(state, manifest));
  const cohesion = useMission(store, effectiveCohesion);
  const openKey = useMission(store, (state) => shortlist(state, manifest).map((decision) => decision.id).join('|'));
  const openIds = useMemo(() => (openKey ? openKey.split('|') : []), [openKey]);
  const fullState = useMission(store, (state) => state);

  const [selected, setSelected] = useState<string | null>(null);
  const [playing, setPlaying] = useState(!guided);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [outcome, setOutcome] = useState<ResolvedDecision | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewOpened, setReviewOpened] = useState(false);
  const [tourSkipped, setTourSkipped] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);
  const [layer, setLayer] = useState<Layer>('evidence');
  const [controlRoom, setControlRoom] = usePersistentState('orpheus.preference.controlRoom', false);
  const [ambient, setAmbient] = usePersistentState('orpheus.preference.ambient', false);
  const [show3d, setShow3d] = usePersistentState('orpheus.preference.neurosim', false);
  const [displayMarker, setDisplayMarker] = useState(10);
  const [consent, setConsent] = useState<MicrophoneConsent | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  usePacer(store, playing, speed);

  const breath = useBreathPulseModulation();
  const audio = useAudioAnalysis(consent, breath.modulationRef, (sample) => {
    breath.liveSignalsRef.current = { liveAudioEnvelope: sample?.energy ?? 0, liveAvailable: sample !== null };
  });

  useEffect(() => {
    if (!selected || !openIds.includes(selected)) setSelected(openIds[0] ?? null);
  }, [openIds, selected]);

  const previousOpen = useRef<string[]>(openIds);
  useEffect(() => {
    const added = openIds.filter((id) => !previousOpen.current.includes(id));
    if (added.length > 0) setAnnouncement(`New decision available: ${added.map((id) => specFor(manifest, id)?.title).join(', ')}.`);
    previousOpen.current = openIds;
  }, [manifest, openIds]);

  const tour = guided && !tourSkipped ? currentTourStep(ORIENTATION_TOUR, fullState, { reviewOpened }) : null;
  const highlight = (target: TourTarget) => tour?.step.target === target;

  const openReview = useCallback(() => {
    setOutcome(null);
    setReviewOpen(true);
    setReviewOpened(true);
  }, []);

  const exportRecord = useCallback(() => {
    downloadJson(store.record(new Date().toISOString()), `orpheus-session-${manifest.id}-${store.getState().seed}-${timestampSlug()}.json`);
    toast.success('Session record prepared', { description: 'Check your downloads. It contains the seed and every input, no audio and no personal data.' });
  }, [manifest.id, store]);

  const exportSummary = useCallback(() => {
    const state = store.getState();
    downloadText(summaryMarkdown(state, manifest, compareAssistance(state, manifest)), `orpheus-summary-${manifest.id}-${timestampSlug()}.md`, 'text/markdown');
  }, [manifest, store]);

  const replay = useCallback(() => {
    rememberRecord(store.record());
    navigate('/replay?from=session');
  }, [navigate, store]);

  const dispatchOrToast = (command: Parameters<MissionStore['dispatch']>[0]) => {
    const result = store.dispatch(command);
    if (!result.accepted) toast.error(result.reason);
  };

  const enableAudio = () => {
    audio.setVolume(Math.min(audio.volume, 0.2));
    setConsent(grantMicrophoneConsent(Date.now()));
    setConsentOpen(false);
    store.dispatch({ type: 'note', label: 'Microphone enabled', detail: 'Local audio energy analysis requested; low-volume tones.', severity: 'watch' });
  };
  const disableAudio = () => {
    setConsent(null);
    store.dispatch({ type: 'note', label: 'Microphone stopped', detail: 'Audio analysis and tones stopped.', severity: 'nominal' });
  };

  const guidance = {
    review: { text: 'Every decision in this scenario is recorded. Open the after-action review.', action: 'Open after-action review', run: openReview },
    decide: { text: 'A decision is open. Read the evidence, then choose a course.', action: null, run: null },
    advance: { text: 'No decision is open in this phase. Advance when you are ready.', action: 'Advance phase', run: () => dispatchOrToast({ type: 'advancePhase' }) },
    wait: { text: 'Waiting for the next decision to open.', action: null, run: null },
  }[step];

  const layerButton = (value: Layer, label: string) => (
    <button key={value} type="button" className="o-button flex-1" aria-pressed={layer === value} aria-controls={`layer-${value}`} onClick={() => setLayer(value)}>
      {label}
    </button>
  );

  return (
    <div ref={breath.surfaceRef} className="relative">
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <section aria-label="Session controls" className="border-b border-o-line bg-o-s1">
        <div className="mx-auto flex max-w-[1680px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-o-text">{manifest.title}</h1>
            <p className="text-xs text-o-text3">
              Fictional · seed <span className="font-mono">{fullState.seed}</span> · {CONDITION_LABEL[condition]}
            </p>
          </div>
          <div className={cn('flex flex-wrap items-center gap-2 rounded-lg p-1', highlight('controls') && 'o-highlight')} role="group" aria-label="Simulation clock">
            <button type="button" className="o-button min-h-10" onClick={() => setPlaying((previous) => !previous)} aria-pressed={playing}>
              {playing ? <Pause aria-hidden="true" className="h-4 w-4" /> : <Play aria-hidden="true" className="h-4 w-4" />}
              {playing ? 'Pause' : 'Play'}
            </button>
            <button type="button" className="o-button min-h-10" onClick={() => dispatchOrToast({ type: 'advance', ticks: 1 })} aria-label="Step one simulated second">
              <SkipForward aria-hidden="true" className="h-4 w-4" /> Step
            </button>
            <label className="flex items-center gap-1.5 text-xs text-o-text3">
              Speed
              <select className="o-input min-h-10 py-1" value={speed} onChange={(event) => setSpeed(Number(event.target.value) as PlaybackSpeed)}>
                {PLAYBACK_SPEEDS.map((value) => (
                  <option key={value} value={value}>
                    {value}×
                  </option>
                ))}
              </select>
            </label>
            <span className="font-mono text-sm text-o-text" aria-label={`Simulated time ${formatSimTime(tick, manifest.tickSeconds)}`}>
              {formatSimTime(tick, manifest.tickSeconds)}
            </span>
          </div>
          {maxPhase(manifest) > 1 && (
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Phase">
              <span className="text-sm text-o-text2">
                Phase {phase} of {maxPhase(manifest)}
              </span>
              <button type="button" className="o-button min-h-10" disabled={phase >= maxPhase(manifest)} onClick={() => dispatchOrToast({ type: 'advancePhase' })}>
                {phase >= maxPhase(manifest) ? 'Final phase' : 'Advance phase'}
              </button>
              <label className="flex items-center gap-2 text-xs text-o-text3">
                <input
                  type="checkbox"
                  checked={autoAdvance}
                  disabled={phase >= maxPhase(manifest)}
                  onChange={(event) => dispatchOrToast({ type: 'setAutoAdvance', enabled: event.target.checked })}
                />
                Auto advance every {manifest.autoAdvanceTicks} s
              </label>
            </div>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-o-text3">
              Assistant
              <select
                className="o-input min-h-10 py-1"
                value={condition}
                onChange={(event) => dispatchOrToast({ type: 'setCondition', condition: event.target.value as AssistanceCondition })}
              >
                {(['A', 'B', 'C', 'D'] as AssistanceCondition[]).map((value) => (
                  <option key={value} value={value}>
                    {value} · {CONDITION_LABEL[value]}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="o-button min-h-10" onClick={() => setHelpOpen(true)}>
              <HelpCircle aria-hidden="true" className="h-4 w-4" /> Guide
            </button>
            <button type="button" className={cn('o-button min-h-10', highlight('review') && 'o-highlight')} onClick={openReview}>
              After-action · {resolvedCount}
            </button>
            <button type="button" className="o-button min-h-10" onClick={exportRecord}>
              <Download aria-hidden="true" className="h-4 w-4" /> Save record
            </button>
            <button type="button" className="o-button min-h-10" onClick={() => setRestartOpen(true)}>
              <RotateCcw aria-hidden="true" className="h-4 w-4" /> New session
            </button>
          </div>
        </div>
      </section>

      {tour && (
        <TutorialRail
          step={tour.step}
          index={tour.index}
          total={ORIENTATION_TOUR.length}
          onSkip={() => setTourSkipped(true)}
          onAction={tour.step.id === 'review' ? openReview : tour.step.id === 'clock' ? () => setPlaying(true) : undefined}
          actionLabel={tour.step.id === 'review' ? 'Open after-action review' : tour.step.id === 'clock' ? 'Play' : undefined}
        />
      )}
      {!guided && (
        <div className="border-b border-o-line">
          <div className="mx-auto flex max-w-[1680px] flex-wrap items-center gap-3 px-4 py-2.5 text-sm text-o-text2 sm:px-6">
            <span>{guidance.text}</span>
            {guidance.action && guidance.run && (
              <button type="button" className="o-button min-h-9" onClick={guidance.run}>
                {guidance.action} →
              </button>
            )}
            {redTeam.active && <span className="o-chip border-o-red/60 text-o-red">Red-team simulation active</span>}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-[1680px] px-4 py-5 sm:px-6">
        <div className="mb-4 flex gap-2 lg:hidden" role="group" aria-label="Show layer">
          {layerButton('situation', 'Situation')}
          {layerButton('evidence', 'Evidence')}
          {layerButton('decision', 'Decision')}
        </div>
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,0.95fr)]">
          <section id="layer-situation" aria-labelledby="situation-heading" className={cn('min-w-0', layer !== 'situation' && 'hidden lg:block')}>
            <LayerHeading index={1} id="situation-heading" title="Situation" subtitle="What is happening in the fictional world." />
            {show3d ? (
              <Suspense fallback={<NeuroSimFallback />}>
                <div className="h-[28rem]">
                  <NeuroEmSimulator bioResonanceFrequency={displayMarker} />
                </div>
              </Suspense>
            ) : (
              <SituationLayer store={store} />
            )}
          </section>
          <section
            id="layer-evidence"
            aria-labelledby="evidence-heading"
            className={cn('min-w-0 rounded-xl p-1', layer !== 'evidence' && 'hidden lg:block', (highlight('evidence') || highlight('assistant')) && 'o-highlight')}
          >
            <LayerHeading index={2} id="evidence-heading" title="Evidence" subtitle="What is known, assumed, or cannot be established." />
            <EvidenceLayer store={store} pointId={selected} />
          </section>
          <section id="layer-decision" aria-labelledby="decision-heading" className={cn('min-w-0 rounded-xl p-1', layer !== 'decision' && 'hidden lg:block', highlight('decision') && 'o-highlight')}>
            <LayerHeading index={3} id="decision-heading" title="Decision" subtitle="What you can inspect, compare, and choose." />
            <DecisionLayer
              store={store}
              openIds={openIds}
              selectedId={selected}
              onSelect={(id) => {
                setSelected(id);
                setLayer('evidence');
              }}
              onCommitted={(record) => setOutcome(record)}
            />
          </section>
        </div>

        <details className="mt-8 rounded-xl border border-o-line bg-o-s1 p-4">
          <summary className="cursor-pointer text-sm font-medium text-o-text">Optional tools · audio response, 3D visual, red-team simulation, ambient effects</summary>
          <div className="mt-4 space-y-3">
            <ModeToolbar
              audioEnabled={consent !== null}
              showNeuroSim={show3d}
              redTeamActive={redTeam.active}
              redTeamAvailable={redTeamAvailable(fullState, manifest)}
              onRequestBiofeedback={() => appConfig.features.enableAudioBiofeedback && setConsentOpen(true)}
              onDisableBiofeedback={disableAudio}
              onToggleNeuroSim={() => setShow3d((previous) => !previous)}
              onToggleRedTeam={() => dispatchOrToast({ type: 'toggleRedTeam' })}
            />
            {consent && (
              <p role="status" className="text-sm text-o-text2">
                {audio.audioError
                  ? `Microphone unavailable: ${audio.audioError} Everything else keeps working.`
                  : audio.microphoneConnected
                    ? `Microphone connected. Measured audio energy ${Math.round(audio.audioEnvelope * 100)}% (${audio.quality}). Processed in this tab only.`
                    : 'Waiting for microphone permission. You can keep exploring.'}
              </p>
            )}
            <label className="flex items-center gap-2 text-sm text-o-text2">
              <input type="checkbox" checked={ambient} onChange={(event) => setAmbient(event.target.checked)} />
              Ambient visual effects (off by default; hidden when your system asks for reduced motion)
            </label>
            <label className="flex items-center gap-2 text-sm text-o-text2">
              <input type="checkbox" checked={controlRoom} onChange={(event) => setControlRoom(event.target.checked)} />
              Show the full control room instruments
            </label>
          </div>
        </details>

        {controlRoom && (
          <div className="mt-8">
            <ControlRoom
              store={store}
              breathControls={breath.controls}
              audio={{
                enabled: consent !== null,
                connected: audio.microphoneConnected,
                error: audio.audioError,
                level: audio.audioLevel,
                frequency: audio.activeFrequency,
                volume: audio.volume,
                setVolume: audio.setVolume,
              }}
              displayMarker={displayMarker}
              setDisplayMarker={setDisplayMarker}
            />
          </div>
        )}
      </div>

      <OutcomeDialog decision={outcome} manifest={manifest} onClose={() => setOutcome(null)} onReview={openReview} />
      <SessionReview
        store={store}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        onExport={exportRecord}
        onExportSummary={exportSummary}
        onReplay={replay}
        onPlayAgain={(next) => {
          setReviewOpen(false);
          onPlayAgain(next);
        }}
      />
      <BiofeedbackConsentDialog open={consentOpen} onOpenChange={setConsentOpen} onConfirm={enableAudio} />

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto border-o-line-strong bg-o-s1 text-o-text">
          <DialogHeader>
            <DialogTitle>How this works</DialogTitle>
            <DialogDescription className="text-o-text2">No account, microphone or AI service is needed. Everything is fictional and runs in your browser.</DialogDescription>
          </DialogHeader>
          <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed text-o-text2">
            <li>
              <strong className="text-o-text">Situation.</strong> The map and reports describe a generated world. Play, pause or step the simulated clock.
            </li>
            <li>
              <strong className="text-o-text">Evidence.</strong> Each item says whether it was observed, reported, derived or assumed, how reliable its source is, how old it is, and
              any data-quality problem.
            </li>
            <li>
              <strong className="text-o-text">Assistant.</strong> {CONDITION_SUMMARY[condition]} Its statements are never treated as evidence.
            </li>
            <li>
              <strong className="text-o-text">Decision.</strong> Each course says what it relies on. Review it, then confirm. One course per event.
            </li>
            <li>
              <strong className="text-o-text">Review.</strong> The after-action review shows what was true and how other assistants would have advised. Save the record to replay
              it exactly later.
            </li>
          </ol>
          <p className="text-sm text-o-text3">{manifest.fictionNotice}</p>
        </DialogContent>
      </Dialog>

      <AlertDialog open={restartOpen} onOpenChange={setRestartOpen}>
        <AlertDialogContent className="border-o-line-strong bg-o-s1 text-o-text">
          <AlertDialogHeader>
            <AlertDialogTitle>Start a new session?</AlertDialogTitle>
            <AlertDialogDescription className="text-o-text2">
              This clears the current decisions and review, returns to the first phase, and stops microphone audio. Download your record first if you want to keep it. Display
              preferences remain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <button type="button" className="o-button" onClick={exportRecord}>
            <Download aria-hidden="true" className="h-4 w-4" /> Download current record
          </button>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep exploring</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConsent(null);
                onNewSession();
              }}
            >
              Start new session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {ambient && (
        <div className="ambient-overlays">
          <VisualOverlays phase={phase} coherenceLevel={cohesion} redTeamIntensity={redTeam.intensity} />
        </div>
      )}
    </div>
  );
};

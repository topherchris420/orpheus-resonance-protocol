import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import { MissionCommandStrip } from './MissionCommandStrip';
import { MissionAlertQueue } from './MissionAlertQueue';
import { ModeToolbar } from './ModeToolbar';
import { BiofeedbackConsentDialog } from './BiofeedbackConsentDialog';
import { NeuroSimFallback } from './NeuroSimFallback';
import { TouchInterface } from './TouchInterface';
import { BreathPulseControls } from './BreathPulseControls';
import { VisualOverlays } from './VisualOverlays';
import { ARCHIVE_AUDIO_THRESHOLD } from './TemporalArchive';
import { OperatorConsole } from './room/OperatorConsole';
import { SessionBar } from './room/SessionBar';
import { StatusLine } from './room/StatusLine';
import { CohesionPanel, DecisionsPanel, FeedSlot, MapPanel, MetricsPanel, ReviewPanel, TimelinePanel, VitalsPanel } from './room/panels';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { appConfig } from '@/config/appConfig';
import { missionUxInput, openDecisions } from '@/command-room/model';
import type { ConsoleContext, View } from '@/console/types';
import { effectiveCohesion, maxPhase, redTeamAvailable } from '@/engine/mission/selectors';
import type { MissionCommand } from '@/engine/mission/types';
import { useAudioAnalysis } from '../hooks/useAudioAnalysis';
import { useBreathPulseModulation, useBreathTargetRef } from '../hooks/useBreathPulseModulation';
import { useEgress } from '@/hooks/useEgress';
import { usePersistentState } from '../hooks/usePersistentState';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { browserEgressMonitor } from '@/integrity/egress';
import { fingerprint, sealOf } from '@/integrity/seal';
import { runSelfTests, runWebCryptoDifferential, type SelfTestResult } from '@/integrity/selftest';
import { deriveMissionUx } from '@/lib/missionUx';
import { downloadJson, rememberRecord, useMission, usePacer, type MissionStore } from '@/state/missionStore';
import { toast } from 'sonner';

const NEUROSIM_PREFERENCE_STORAGE_KEY = 'orpheus.preference.neurosim';
const MOBILE_TAB_STORAGE_KEY = 'orpheus.preference.mobileTab';
const MOBILE_TABS = ['map', 'vitals', 'intel', 'sim', 'events'];
const TOUCH_NOTE_INTERVAL_MS = 2000;

const NeuroEmSimulator = lazy(() =>
  import('./NeuroEmSimulator').then((module) => ({ default: module.NeuroEmSimulator })),
);

const WIDE_QUERY = '(min-width: 1280px)';
const subscribeWide = (onChange: () => void) => {
  const media = window.matchMedia(WIDE_QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
};
const useWideLayout = () => useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE_QUERY).matches, () => true);

interface PegasusSimulationProps {
  store: MissionStore;
  /** Wall-clock time of tick 0, for date-time groups. */
  epochMs: number;
  selfTests: SelfTestResult[];
  onNewSession: (seed?: string) => void;
}

/**
 * The Orpheus command room. Every value on screen is read from the deterministic engine (seeded
 * world, hash-chained command log); every operator action is a command the engine validates and
 * records. The layout is the original twelve-column grid.
 */
export const PegasusSimulation: React.FC<PegasusSimulationProps> = ({ store, epochMs, selfTests, onNewSession }) => {
  const manifest = store.manifest;
  const navigate = useNavigate();
  const wide = useWideLayout();
  const reducedMotion = usePrefersReducedMotion();
  const egress = useEgress();

  const phase = useMission(store, (state) => state.phase);
  const redTeamActive = useMission(store, (state) => state.redTeam.active);
  const redTeamIntensity = useMission(store, (state) => state.redTeam.intensity);
  const redTeamOpen = useMission(store, (state) => redTeamAvailable(state, manifest));
  const autoAdvance = useMission(store, (state) => state.autoAdvance);
  const committed = useMission(store, (state) => state.resolved.length);
  const openCount = useMission(store, (state) => openDecisions(state, manifest).length);
  const cohesion = useMission(store, effectiveCohesion);
  const pulseRate = useMission(store, (state) => state.world.squad[0]?.heartRate ?? 72);

  const [playing, setPlaying] = useState(true);
  const playingRef = useRef(playing);
  playingRef.current = playing;
  usePacer(store, playing, 1);

  const [primaryView, setPrimaryView] = useState<'map' | 'decisions'>('map');
  const [showNeuroSim, setShowNeuroSim] = usePersistentState(NEUROSIM_PREFERENCE_STORAGE_KEY, false);
  const [mobileTab, setMobileTab] = usePersistentState(MOBILE_TAB_STORAGE_KEY, 'map', (value) => typeof value === 'string' && MOBILE_TABS.includes(value));
  const [reviewOpen, setReviewOpen] = useState(false);
  const [dismissedAlertIds, setDismissedAlertIds] = useState<string[]>([]);
  const [biofeedbackDialogOpen, setBiofeedbackDialogOpen] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [displayMarker, setDisplayMarker] = useState(8);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [queued, setQueued] = useState<{ id: number; command: string } | null>(null);
  const view: View = showNeuroSim ? 'neurosim' : primaryView;

  const note = useCallback(
    (label: string, detail: string, severity: Extract<MissionCommand, { type: 'note' }>['severity'] = 'nominal') => {
      store.dispatch({ type: 'note', label, detail, severity });
    },
    [store],
  );

  const { controls: breathPulseControls, modulationRef: breathModulationRef, liveSignalsRef, targets: breathTargets } = useBreathPulseModulation();
  // Breath values go only to the elements that show them. The grid gets scale and lift, never blur.
  const breathRingRef = useBreathTargetRef(breathTargets);
  const breathOverlayRef = useBreathTargetRef(breathTargets);
  const breathMotionRef = useBreathTargetRef(breathTargets, 'motion');

  const {
    audioLevel,
    activeFrequency: audioFrequency,
    microphoneConnected,
    audioError,
    volume,
    setVolume,
  } = useAudioAnalysis(audioEnabled && appConfig.features.enableAudioBiofeedback, breathModulationRef, {
    liveSignalsRef,
    levelReportThreshold: ARCHIVE_AUDIO_THRESHOLD,
  });

  useEffect(() => {
    setDisplayMarker(audioFrequency);
  }, [audioFrequency]);

  const audioStatus = useMemo(() => ({ enabled: audioEnabled, connected: microphoneConnected, error: audioError }), [audioEnabled, microphoneConnected, audioError]);
  const uxInput = useMission(store, (state) => missionUxInput(state, audioStatus, displayMarker));
  const mission = useMemo(() => deriveMissionUx(uxInput), [uxInput]);

  useEffect(() => {
    setDismissedAlertIds((previous) => previous.filter((id) => mission.alerts.some((alert) => alert.id === id)));
  }, [mission.alerts]);

  const dispatchOrToast = useCallback(
    (command: MissionCommand) => {
      const result = store.dispatch(command);
      if (!result.accepted) toast.error(result.reason);
      return result.accepted;
    },
    [store],
  );

  // The export is noted first, so the record contains its own export and its seal is the one shown.
  const handleExport = useCallback(() => {
    note('Record exported', 'Session record downloaded; no microphone samples included.');
    const record = store.record(new Date().toISOString());
    const name = `orpheus-session-${record.header.seed}-${fingerprint(sealOf(store.getSession()).head, 2)}.json`;
    downloadJson(record, name);
    toast.success('Session record written', { description: `${name} · seed, every command, every checkpoint. No audio, no personal data.` });
    return name;
  }, [note, store]);

  const handleReplay = useCallback(() => {
    rememberRecord(store.record(new Date().toISOString()));
    navigate('/replay?from=session');
  }, [navigate, store]);

  const show = useCallback(
    (next: View) => {
      if (next === 'neurosim') {
        setShowNeuroSim(true);
      } else {
        setShowNeuroSim(false);
        setPrimaryView(next);
      }
      setMobileTab('map');
    },
    [setMobileTab, setShowNeuroSim],
  );

  const handleToggleNeuroSim = useCallback(() => {
    const next = !showNeuroSim;
    setShowNeuroSim(next);
    note(next ? 'NeuroSim enabled' : 'NeuroSim hidden', next ? '3D neuro-emulation layer is active.' : 'Primary display returned to tactical surface.');
  }, [note, setShowNeuroSim, showNeuroSim]);

  const handleToggleRedTeam = useCallback(() => {
    dispatchOrToast({ type: 'toggleRedTeam' });
  }, [dispatchOrToast]);

  const handleRequestBiofeedback = useCallback(() => {
    if (appConfig.features.enableAudioBiofeedback) setBiofeedbackDialogOpen(true);
  }, []);

  const handleConfirmBiofeedback = useCallback(() => {
    setVolume(Math.min(volume, 0.2));
    setAudioEnabled(true);
    setBiofeedbackDialogOpen(false);
    note('Microphone enabled', 'Local audio envelope analysis requested with low-volume tones.', 'watch');
  }, [note, setVolume, volume]);

  const handleDisableBiofeedback = useCallback(() => {
    setAudioEnabled(false);
    note('Microphone disabled', 'Audio analysis and tones stopped.');
  }, [note]);

  const lastTouchNote = useRef(0);
  const handleOperatorTouch = useCallback(
    (point: { x: number; y: number; intensity: number }) => {
      const now = Date.now();
      if (now - lastTouchNote.current < TOUCH_NOTE_INTERVAL_MS) return;
      lastTouchNote.current = now;
      note('Touch input', `Resonance pad at ${Math.round(point.x)}, ${Math.round(point.y)} with ${Math.round(point.intensity * 100)}% intensity.`, point.intensity > 0.85 ? 'watch' : 'nominal');
    },
    [note],
  );

  const openConsoleWith = useCallback((command: string) => {
    setQueued((previous) => ({ id: (previous?.id ?? 0) + 1, command }));
    setConsoleOpen(true);
  }, []);
  const inspectChain = useCallback(() => openConsoleWith('seal'), [openConsoleWith]);
  const startNewSession = useCallback(() => onNewSession(), [onNewSession]);

  // ` (backtick) toggles the console, unless the operator is typing. Inside the console's own prompt the
  // console decides (an empty prompt closes, otherwise the character is typed).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '`' || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      event.preventDefault();
      setConsoleOpen((previous) => !previous);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const consoleContext = useMemo<ConsoleContext>(
    () => ({
      session: () => store.getSession(),
      manifest,
      epochMs,
      dispatch: (command) => store.dispatch(command),
      clock: { playing: () => playingRef.current, setPlaying },
      show,
      openReview: () => setReviewOpen(true),
      exportRecord: handleExport,
      openReplay: handleReplay,
      newSession: onNewSession,
      egress: () => browserEgressMonitor().getSnapshot(),
      selfTest: async () => [...runSelfTests(), await runWebCryptoDifferential()],
      close: () => setConsoleOpen(false),
    }),
    [epochMs, handleExport, handleReplay, manifest, onNewSession, show, store],
  );

  const getAcclimatizationStyles = () => {
    if (redTeamActive) return 'bg-neutral-950 text-red-300';
    switch (phase) {
      case 1:
        return 'bg-neutral-950 text-emerald-300';
      case 2:
        return 'bg-neutral-950 text-cyan-300';
      case 3:
        return 'bg-neutral-950 text-amber-200';
      case 4:
        return 'bg-neutral-950 text-white';
      default:
        return 'bg-black text-emerald-300';
    }
  };

  const renderModeToolbar = () => (
    <ModeToolbar
      audioEnabled={audioEnabled}
      showNeuroSim={showNeuroSim}
      redTeamActive={redTeamActive}
      redTeamAvailable={redTeamOpen}
      onRequestBiofeedback={handleRequestBiofeedback}
      onDisableBiofeedback={handleDisableBiofeedback}
      onToggleNeuroSim={handleToggleNeuroSim}
      onToggleRedTeam={handleToggleRedTeam}
      onExport={handleExport}
    />
  );

  const renderNeuroEmSimulator = () => (
    <Suspense fallback={<NeuroSimFallback />}>
      <NeuroEmSimulator bioResonanceFrequency={displayMarker} />
    </Suspense>
  );

  const renderPrimarySurface = () => (showNeuroSim ? renderNeuroEmSimulator() : primaryView === 'decisions' ? <DecisionsPanel store={store} /> : <MapPanel store={store} />);

  const renderVitalsPanel = () => <VitalsPanel store={store} marker={displayMarker} onMarker={setDisplayMarker} volume={volume} onVolume={setVolume} />;
  const renderBreathPulsePanel = () => <BreathPulseControls controls={breathPulseControls} liveAvailable={microphoneConnected} ringRef={breathRingRef} />;
  const renderTimeline = () => <TimelinePanel store={store} onInspectChain={inspectChain} />;
  const renderMetricsPanel = () => <MetricsPanel store={store} note={note} />;
  const renderTouch = () => <TouchInterface phase={phase} onTouch={handleOperatorTouch} onFrequencyChange={setDisplayMarker} />;
  const renderStrip = () => <MissionCommandStrip mission={mission} pulseRate={pulseRate} coherenceLevel={cohesion} activeFrequency={displayMarker} />;
  const renderAlerts = () => <MissionAlertQueue alerts={mission.alerts} dismissedAlertIds={dismissedAlertIds} onDismiss={(id) => setDismissedAlertIds((previous) => [...new Set([...previous, id])])} />;
  const microphoneStatus = audioEnabled && (
    <p role="status" className="sr-only">
      {audioError ? `Microphone unavailable: ${audioError}` : microphoneConnected ? 'Microphone connected. Audio energy is processed locally.' : 'Waiting for microphone permission.'}
    </p>
  );

  return (
    // Wide screens get a definite height, so the grid's fractional rows resolve against it and the room
    // fits a 900px-tall display; below 800px the page scrolls. On phones the page simply scrolls.
    <div className={`relative flex flex-col overflow-hidden font-mono ${wide ? 'h-screen min-h-[800px]' : 'min-h-screen'} ${getAcclimatizationStyles()} transition-colors duration-500`}>
      <a href="#command-surface" className="skip-link">
        Skip to command surface
      </a>
      <SessionBar
        phase={phase}
        maxPhase={maxPhase(manifest)}
        openDecisions={openCount}
        committed={committed}
        view={view}
        autoAdvance={autoAdvance}
        autoAdvanceSeconds={manifest.autoAdvanceTicks * manifest.tickSeconds}
        consoleOpen={consoleOpen}
        onView={show}
        onReview={() => setReviewOpen(true)}
        onAdvance={() => dispatchOrToast({ type: 'advancePhase' })}
        onAutoAdvance={(enabled) => dispatchOrToast({ type: 'setAutoAdvance', enabled })}
        onConsole={() => setConsoleOpen((previous) => !previous)}
      />
      {microphoneStatus}

      {wide ? (
        <main
          id="command-surface"
          tabIndex={-1}
          ref={reducedMotion ? undefined : breathMotionRef}
          data-breathing
          className="relative z-10 grid min-h-0 flex-1 grid-cols-12 grid-rows-[auto_repeat(7,minmax(0,1fr))] gap-2 p-4"
          style={reducedMotion ? undefined : { willChange: 'transform' }}
        >
          {renderStrip()}
          <div className="col-span-3 col-start-1 row-span-3 row-start-2 min-h-0">{renderVitalsPanel()}</div>
          <div className="col-span-3 col-start-1 row-span-2 row-start-5 min-h-0 overflow-y-auto">{renderAlerts()}</div>
          <div className="col-span-3 col-start-1 row-span-2 row-start-7 min-h-0">
            <CohesionPanel store={store} />
          </div>
          <div className="col-span-6 col-start-4 row-span-4 row-start-2 min-h-0">{renderPrimarySurface()}</div>
          <div className="col-span-6 col-start-4 row-span-3 row-start-6 min-h-0">
            <FeedSlot store={store} epochMs={epochMs} audioLevel={audioLevel} />
          </div>
          <div className="col-span-3 col-start-10 row-span-1 row-start-2 min-h-0 overflow-y-auto">{renderModeToolbar()}</div>
          <div className="col-span-3 col-start-10 row-span-2 row-start-3 min-h-0">{renderTouch()}</div>
          <div className="col-span-3 col-start-10 row-span-2 row-start-5 min-h-0">{renderBreathPulsePanel()}</div>
          <div className="col-span-3 col-start-10 row-span-1 row-start-7 min-h-0">{renderTimeline()}</div>
          <div className="col-span-3 col-start-10 row-span-1 row-start-8 min-h-0">{renderMetricsPanel()}</div>
        </main>
      ) : (
        <main id="command-surface" tabIndex={-1} className="relative z-10 flex flex-1 flex-col gap-2 p-2 pb-4">
          {renderStrip()}
          {renderModeToolbar()}
          {renderAlerts()}

          <Tabs value={mobileTab} onValueChange={setMobileTab} className="flex min-h-0 flex-1 flex-col">
            <TabsList className="grid h-auto w-full grid-cols-5 rounded-none border border-current/15 bg-black/50 p-1 text-[10px]">
              <TabsTrigger value="map" className="px-1 py-2 text-[10px]">Map</TabsTrigger>
              <TabsTrigger value="vitals" className="px-1 py-2 text-[10px]">Vitals</TabsTrigger>
              <TabsTrigger value="intel" className="px-1 py-2 text-[10px]">Intel</TabsTrigger>
              <TabsTrigger value="sim" className="px-1 py-2 text-[10px]">Sim</TabsTrigger>
              <TabsTrigger value="events" className="px-1 py-2 text-[10px]">Events</TabsTrigger>
            </TabsList>

            <TabsContent value="map" className="mt-2 min-h-[58vh] flex-1">
              <div className={primaryView === 'decisions' && !showNeuroSim ? 'h-[78vh]' : 'h-[58vh]'}>{renderPrimarySurface()}</div>
            </TabsContent>

            <TabsContent value="vitals" className="mt-2 space-y-2">
              <div className="h-[max(460px,55vh)]">{renderVitalsPanel()}</div>
              <div className="h-[max(440px,55vh)]">{renderBreathPulsePanel()}</div>
              <div className="h-[400px]">
                <CohesionPanel store={store} />
              </div>
            </TabsContent>

            <TabsContent value="intel" className="mt-2 space-y-2">
              <div className="h-[60vh]">
                <FeedSlot store={store} epochMs={epochMs} audioLevel={audioLevel} archiveFirst={false} />
              </div>
            </TabsContent>

            <TabsContent value="sim" className="mt-2 space-y-2">
              <div className="h-[44vh]">{renderTouch()}</div>
              <div className="h-[60vh]">{showNeuroSim ? renderNeuroEmSimulator() : <DecisionsPanel store={store} />}</div>
            </TabsContent>

            <TabsContent value="events" className="mt-2 space-y-2">
              <div className="h-[60vh]">{renderMetricsPanel()}</div>
              <div className="h-[56vh]">{renderTimeline()}</div>
            </TabsContent>
          </Tabs>
        </main>
      )}

      <StatusLine store={store} epochMs={epochMs} playing={playing} egress={egress} selfTests={selfTests} onCommand={openConsoleWith} />

      <OperatorConsole open={consoleOpen} onClose={() => setConsoleOpen(false)} context={consoleContext} queued={queued} />

      <ReviewPanel store={store} open={reviewOpen} onOpenChange={setReviewOpen} epochMs={epochMs} onExport={handleExport} onReplay={handleReplay} onNewSession={startNewSession} />

      <BiofeedbackConsentDialog open={biofeedbackDialogOpen} onOpenChange={setBiofeedbackDialogOpen} onConfirm={handleConfirmBiofeedback} />

      {!reducedMotion && (
        <div className="ambient-overlays">
          <VisualOverlays phase={phase} coherenceLevel={cohesion} redTeamIntensity={redTeamIntensity} breathRef={breathOverlayRef} />
        </div>
      )}
    </div>
  );
};

import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TacticalDataDisplay } from './TacticalDataDisplay';
import { OperatorVitalsCognitiveLoadMonitor } from './OperatorVitalsCognitiveLoadMonitor';
import { SitRepIntelFeed } from './SitRepIntelFeed';
import { TouchInterface } from './TouchInterface';
import { DecisionMatrixSimulator } from './DecisionMatrixSimulator';
import { TemporalArchive } from './TemporalArchive';
import { SquadCohesionIndex } from './SquadCohesionIndex';
import { VisualOverlays } from './VisualOverlays';
import { MissionCommandStrip } from './MissionCommandStrip';
import { MissionAlertQueue } from './MissionAlertQueue';
import { ModeToolbar } from './ModeToolbar';
import { BiofeedbackConsentDialog } from './BiofeedbackConsentDialog';
import { OperatorEventTimeline } from './OperatorEventTimeline';
import { NeuroSimFallback } from './NeuroSimFallback';
import { useAudioAnalysis } from '../hooks/useAudioAnalysis';
import { usePhaseProgression } from '../hooks/usePhaseProgression';
import { useInteractionState } from '../hooks/useInteractionState';
import { useRedTeamSimulation } from '../hooks/useRedTeamSimulation';
import { useBreathPulseModulation } from '../hooks/useBreathPulseModulation';
import { BreathPulseControls } from './BreathPulseControls';
import { usePersistentState } from '../hooks/usePersistentState';
import { dataGenerator } from '../data/realisticData';
import { appConfig } from '@/config/appConfig';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { appendOperatorEvent, deriveMissionUx, MissionSeverity, OperatorEvent } from '@/lib/missionUx';
import { useMissionScenario } from '../hooks/useMissionScenario';
import { ScenarioOutcome } from '../data/decisionScenarios';
import { OperatorMetricsDashboard } from './OperatorMetricsDashboard';
import { useMetricsHistory } from '../hooks/useMetricsHistory';
import { useOperatorBaseline } from '../hooks/useOperatorBaseline';
import { BaselineCalibrationPanel } from './BaselineCalibrationPanel';
import { SessionReview } from './SessionReview';
import { createSessionRecord } from '@/lib/sessionRecord';
import { SessionControls } from './SessionControls';
import { calculateSquadCohesion, getSessionGuidance, sessionDecisionCount } from '@/lib/sessionGuidance';
import { toast } from 'sonner';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const NEUROSIM_PREFERENCE_STORAGE_KEY = 'orpheus.preference.neurosim';
const MOBILE_TAB_STORAGE_KEY = 'orpheus.preference.mobileTab';

const NeuroEmSimulator = lazy(() =>
  import('./NeuroEmSimulator').then((module) => ({ default: module.NeuroEmSimulator })),
);

interface PegasusSimulationProps {
  accessLevel: number;
  onRestart: () => void;
  onAccessLevelChange: (level: number) => void;
}

const createEventId = (label: string) => `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;

export const PegasusSimulation: React.FC<PegasusSimulationProps> = ({
  accessLevel,
  onRestart,
  onAccessLevelChange,
}) => {
  const [isMobile, setIsMobile] = useState(false);
  const [fullWorkspace, setFullWorkspace] = usePersistentState('orpheus.preference.fullWorkspace', false);
  const [ambient, setAmbient] = usePersistentState('orpheus.preference.ambient', false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [primaryView, setPrimaryView] = useState<'map' | 'decisions'>('map');
  const [showElectrokineticLayer, setShowElectrokineticLayer] = usePersistentState(
    NEUROSIM_PREFERENCE_STORAGE_KEY,
    false,
  );
  const [mobileTab, setMobileTab] = usePersistentState(MOBILE_TAB_STORAGE_KEY, 'map', value => typeof value === 'string' && ['map', 'vitals', 'intel', 'sim', 'events'].includes(value));
  const [dismissedAlertIds, setDismissedAlertIds] = useState<string[]>([]);
  const [biofeedbackDialogOpen, setBiofeedbackDialogOpen] = useState(false);
  const [operatorEvents, setOperatorEvents] = useState<OperatorEvent[]>([
    {
      id: 'session-started',
      timestamp: Date.now(),
      label: 'Session Started',
      detail: 'Operator command surface initialized.',
      severity: 'nominal',
    },
  ]);
  const sessionStartedAt = useRef(Date.now());
  const [intelFeed, setIntelFeed] = useState(() => dataGenerator.getIntelFeed());
  const [threatIndicators, setThreatIndicators] = useState(() => dataGenerator.generateThreatIndicators());
  const [squadPositions, setSquadPositions] = useState(() => dataGenerator.generateSquadPositions());
  const [optimalPath, setOptimalPath] = useState(() => dataGenerator.generateOptimalPath());
  const [realtimeVitals, setRealtimeVitals] = useState(() => dataGenerator.generateRealisticVitals(78, 16.2, 0.3));
  const previousStressRef = useRef(realtimeVitals.cognitiveStressIndex);
  const previousPhaseRef = useRef(1);
  const threatIndicatorsRef = useRef(threatIndicators);
  const hostilePressureRef = useRef(0.3);
  const stressModifierRef = useRef(0);

  useEffect(() => {
    threatIndicatorsRef.current = threatIndicators;
  }, [threatIndicators]);

  // Permission must be requested again on every visit, even when the browser remembers its grant.
  const [audioEnabled, setAudioEnabled] = useState(false);

  const logOperatorEvent = useCallback((label: string, detail: string, severity: MissionSeverity = 'nominal') => {
    setOperatorEvents((previous) =>
      appendOperatorEvent(previous, {
        id: createEventId(label),
        timestamp: Date.now(),
        label,
        detail,
        severity,
      }, 120),
    );
  }, []);

  const {
    controls: breathPulseControls,
    modulationRef: breathModulationRef,
    surfaceRef,
    liveSignalsRef,
  } = useBreathPulseModulation();

  const {
    audioLevel,
    audioEnvelope,
    activeFrequency: audioFrequency,
    microphoneConnected,
    audioError,
    volume,
    setVolume,
  } = useAudioAnalysis(audioEnabled && appConfig.features.enableAudioBiofeedback, breathModulationRef);

  liveSignalsRef.current = {
    liveAudioEnvelope: audioEnvelope,
    liveAvailable: microphoneConnected,
  };


  const { acclimatizationLevel, simulationMode, handleAcclimatizationAdvance, autoAdvance, setAutoAdvance } = usePhaseProgression(onAccessLevelChange);

  const {
    currentTimeline,
    temporalMoment,
    bioResonanceFrequency,
    addInteractionEvent,
    setBioResonanceFrequency,
  } = useInteractionState();

  const {
    isRedTeamModeActive,
    redTeamIntensity,
    conflictingIntel,
    toggleRedTeamMode,
  } = useRedTeamSimulation(simulationMode);

  useEffect(() => {
    setBioResonanceFrequency(audioFrequency);
  }, [audioFrequency, setBioResonanceFrequency]);

  useEffect(() => {
    previousStressRef.current = realtimeVitals.cognitiveStressIndex;
  }, [realtimeVitals.cognitiveStressIndex]);

  useEffect(() => {
    if (previousPhaseRef.current !== acclimatizationLevel) {
      logOperatorEvent(
        'Phase Advanced',
        `Acclimatization moved to phase ${acclimatizationLevel}.`,
        acclimatizationLevel >= 3 ? 'watch' : 'nominal',
      );
      previousPhaseRef.current = acclimatizationLevel;
    }
  }, [acclimatizationLevel, logOperatorEvent]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1100);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const intelTimer = setInterval(() => {
      const newIntel = dataGenerator.generateIntelUpdate(acclimatizationLevel);
      const historyWindow = Math.max(0, appConfig.limits.maxIntelFeedItems - 1);
      setIntelFeed((prev) => [...(historyWindow ? prev.slice(-historyWindow) : []), newIntel]);
      logOperatorEvent('Intel Updated', newIntel.message, newIntel.priority === 'HIGH' ? 'watch' : 'nominal');
    }, 15000 + Math.random() * 30000);

    return () => clearInterval(intelTimer);
  }, [acclimatizationLevel, logOperatorEvent]);

  useEffect(() => {
    const tacticalTimer = setInterval(() => {
      const nextThreats = dataGenerator.advanceThreatIndicators(threatIndicatorsRef.current, hostilePressureRef.current);
      setThreatIndicators(nextThreats);
      setSquadPositions((previous) => dataGenerator.advanceSquadPositions(previous, hostilePressureRef.current));
      if (Math.random() > 0.7) {
        setOptimalPath(dataGenerator.generateOptimalPath());
      }
      const hostileCount = nextThreats.filter((threat) => threat.type === 'hostile').length;
      logOperatorEvent(
        'Threat Map Refreshed',
        `${nextThreats.length} indicators refreshed; ${hostileCount} hostile.`,
        hostileCount >= 3 ? 'critical' : hostileCount > 0 ? 'watch' : 'nominal',
      );
    }, 9000);

    return () => clearInterval(tacticalTimer);
  }, [logOperatorEvent]);

  useEffect(() => {
    const vitalsTimer = setInterval(() => {
      setRealtimeVitals(
        dataGenerator.generateRealisticVitals(78, 16.2, clamp01(0.3 + redTeamIntensity * 0.5 + stressModifierRef.current)),
      );
    }, 2500);

    return () => clearInterval(vitalsTimer);
  }, [redTeamIntensity]);

  useEffect(() => {
    if (conflictingIntel) {
      logOperatorEvent('Red Team Intel', conflictingIntel, 'critical');
    }
  }, [conflictingIntel, logOperatorEvent]);

  const getAcclimatizationStyles = () => {
    if (isRedTeamModeActive) {
      return 'bg-neutral-950 text-red-300';
    }
    switch (acclimatizationLevel) {
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

  const cognitiveStressIndex = realtimeVitals.cognitiveStressIndex;
  const communicationEfficiency = 0.9 - redTeamIntensity * 0.4;

  const squadVitals = useMemo(() => squadPositions.map((member) => ({
    hrv: member.vitals.heartRate,
    respiratoryRate: 16 + Math.random() * 4,
    cognitiveStressIndex: member.status === 'wounded' ? 0.8 : cognitiveStressIndex,
  })), [squadPositions, cognitiveStressIndex]);

  const cohesionScore = calculateSquadCohesion(squadVitals.map(member => member.cognitiveStressIndex), communicationEfficiency);

  const displayedThreatIndicators = useMemo(() => conflictingIntel
    ? [...threatIndicators, { id: 'red-team-threat', position: { x: 200, y: 200 }, type: 'hostile' as const, confidence: 90, lastUpdated: Date.now() }]
    : threatIndicators,
  [conflictingIntel, threatIndicators]);

  const displayedIntelFeed = useMemo(() => conflictingIntel
    ? [...intelFeed, { id: 'red-team-intel', timestamp: Date.now(), message: conflictingIntel, clearanceLevel: 1, priority: 'CRITICAL' as const, source: 'REDTEAM' }]
    : intelFeed,
  [conflictingIntel, intelFeed]);

  const hostileThreatCount = useMemo(
    () => displayedThreatIndicators.filter((threat) => threat.type === 'hostile').length,
    [displayedThreatIndicators],
  );

  const {
    decisionPoints,
    resolvedDecisions,
    objectives,
    hostilePressure,
    stressModifier,
    cohesionModifier,
    resolveOutcome,
  } = useMissionScenario({
    phase: acclimatizationLevel,
    hostileThreatCount,
    cohesionScore,
    cognitiveStressIndex,
    redTeamActive: isRedTeamModeActive,
  });

  const effectiveCohesion = clamp01(cohesionScore + cohesionModifier);

  useEffect(() => {
    hostilePressureRef.current = hostilePressure;
  }, [hostilePressure]);

  useEffect(() => {
    stressModifierRef.current = stressModifier;
  }, [stressModifier]);

  const handleOutcomeSelect = useCallback((pointId: string, outcome: ScenarioOutcome) => {
    if (!resolveOutcome(pointId, outcome)) { toast.error('This decision is no longer available. Choose another event.'); return; }
    setIntelFeed((previous) => {
      const historyWindow = Math.max(0, appConfig.limits.maxIntelFeedItems - 1);
      return [
        ...(historyWindow ? previous.slice(-historyWindow) : []),
        {
          id: `decision-${outcome.id}-${Date.now()}`,
          timestamp: Date.now(),
          message: outcome.effects.intel,
          clearanceLevel: 1,
          priority: outcome.risk === 'HIGH' ? ('CRITICAL' as const) : ('HIGH' as const),
          source: 'COMMAND',
        },
      ];
    });
    toast.success('Choice recorded', { description: outcome.title });
    logOperatorEvent('Course Committed', `${outcome.title} — ${outcome.consequences}`, outcome.effects.severity);
  }, [logOperatorEvent, resolveOutcome]);

  const intelAccuracy = clamp01(
    1 - redTeamIntensity * 0.55 - (conflictingIntel ? 0.18 : 0) - hostilePressure * 0.12,
  );

  const metricsHistory = useMetricsHistory({
    stress: cognitiveStressIndex,
    cohesion: effectiveCohesion,
    hostilePressure,
    intelAccuracy,
  });

  const {
    baseline,
    isCalibrating,
    progress: calibrationProgress,
    startCalibration,
    cancelCalibration,
    clearBaseline,
    adjustBaseline,
  } = useOperatorBaseline({ stress: cognitiveStressIndex, cohesion: effectiveCohesion });

  const mission = useMemo(() => deriveMissionUx({
    phase: acclimatizationLevel,
    simulationMode,
    isRedTeamModeActive,
    cognitiveStressIndex,
    cohesionScore: effectiveCohesion,
    threatCount: displayedThreatIndicators.length,
    hostileThreatCount,
    audioEnabled,
    microphoneConnected,
    audioError,
    conflictingIntel,
    bioResonanceFrequency,
  }), [
    acclimatizationLevel,
    simulationMode,
    isRedTeamModeActive,
    cognitiveStressIndex,
    effectiveCohesion,
    displayedThreatIndicators.length,
    hostileThreatCount,
    audioEnabled,
    microphoneConnected,
    audioError,
    conflictingIntel,
    bioResonanceFrequency,
  ]);

  useEffect(() => {
    setDismissedAlertIds((previous) => previous.filter((id) => mission.alerts.some((alert) => alert.id === id)));
  }, [mission.alerts, setDismissedAlertIds]);

  const handleRequestBiofeedback = useCallback(() => {
    if (!appConfig.features.enableAudioBiofeedback) {
      return;
    }
    setBiofeedbackDialogOpen(true);
  }, []);

  const handleConfirmBiofeedback = useCallback(() => {
    setVolume(Math.min(volume, 0.2));
    setAudioEnabled(true);
    setBiofeedbackDialogOpen(false);
    logOperatorEvent('Microphone Enabled', 'Local audio envelope analysis requested with low-volume tones.', 'watch');
  }, [logOperatorEvent, setAudioEnabled, setVolume, volume]);

  const handleDisableBiofeedback = useCallback(() => {
    setAudioEnabled(false);
    logOperatorEvent('Microphone Disabled', 'Audio analysis and tones stopped.', 'nominal');
  }, [logOperatorEvent, setAudioEnabled]);

  const handleToggleNeuroSim = useCallback(() => {
    setShowElectrokineticLayer((previous) => {
      const next = !previous;
      logOperatorEvent(next ? 'NeuroSim Enabled' : 'NeuroSim Hidden', next ? '3D neuro-emulation layer is active.' : 'Primary display returned to tactical surface.', 'nominal');
      return next;
    });
  }, [logOperatorEvent, setShowElectrokineticLayer]);

  const handleToggleRedTeam = useCallback(() => {
    toggleRedTeamMode();
    logOperatorEvent(
      isRedTeamModeActive ? 'Red Team Disabled' : 'Red Team Enabled',
      isRedTeamModeActive ? 'Adversarial simulation feed paused.' : 'Adversarial simulation feed activated.',
      isRedTeamModeActive ? 'nominal' : 'critical',
    );
  }, [isRedTeamModeActive, logOperatorEvent, toggleRedTeamMode]);

  const handleDismissAlert = useCallback((alertId: string) => {
    setDismissedAlertIds((previous) => Array.from(new Set([...previous, alertId])));
  }, [setDismissedAlertIds]);
  const handleOperatorTouch = useCallback((event: Parameters<typeof addInteractionEvent>[0]) => {
    addInteractionEvent(event);
    logOperatorEvent(
      'Touch Input',
      `Operator touch at ${event.x.toFixed(0)}, ${event.y.toFixed(0)} with ${(event.intensity * 100).toFixed(0)}% intensity.`,
      event.intensity > 0.85 ? 'watch' : 'nominal',
    );
  }, [addInteractionEvent, logOperatorEvent]);

  const handleExport = useCallback(() => {
    const exportedAt = Date.now();
    const record = createSessionRecord({
      startedAt: sessionStartedAt.current,
      exportedAt,
      phase: acclimatizationLevel,
      microphoneActive: microphoneConnected,
      events: operatorEvents,
      metrics: metricsHistory,
      decisions: resolvedDecisions,
      objectives,
    });
    const url = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `orpheus-simulation-${new Date(exportedAt).toISOString().replace(/[:.]/g, '-')}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success('Session snapshot prepared', { description: 'Check your browser downloads for the JSON record.' });
    logOperatorEvent('Record Exported', 'Simulation record downloaded; no microphone samples included.');
  }, [acclimatizationLevel, microphoneConnected, operatorEvents, metricsHistory, resolvedDecisions, objectives, logOperatorEvent]);

  const renderModeToolbar = () => (
    <ModeToolbar
      audioEnabled={audioEnabled}
      showNeuroSim={showElectrokineticLayer}
      redTeamActive={isRedTeamModeActive}
      redTeamAvailable={simulationMode}
      onRequestBiofeedback={handleRequestBiofeedback}
      onDisableBiofeedback={handleDisableBiofeedback}
      onToggleNeuroSim={handleToggleNeuroSim}
      onToggleRedTeam={handleToggleRedTeam}
      onExport={handleExport}
    />
  );

  const renderNeuroEmSimulator = () => (
    <Suspense fallback={<NeuroSimFallback />}>
      <NeuroEmSimulator bioResonanceFrequency={bioResonanceFrequency} />
    </Suspense>
  );

  const renderPrimarySurface = () => (
    showElectrokineticLayer ? (
      renderNeuroEmSimulator()
    ) : primaryView === 'decisions' ? (
      <DecisionMatrixSimulator
        expanded={!fullWorkspace}
        decisionPoints={decisionPoints}
        committedCount={resolvedDecisions.length}
        objectives={objectives}
        onOutcomeSelect={handleOutcomeSelect}
      />
    ) : (
      <TacticalDataDisplay
        threatIndicators={displayedThreatIndicators}
        optimalPathing={optimalPath}
        squadPositions={squadPositions}
      />
    )
  );

  const renderVitalsPanel = () => (
    <OperatorVitalsCognitiveLoadMonitor
      hrv={realtimeVitals.hrv}
      respiratoryRate={realtimeVitals.respiratoryRate}
      cognitiveStressIndex={cognitiveStressIndex}
      previousCognitiveStressIndex={previousStressRef.current}
      bioResonanceSupportFrequency={bioResonanceFrequency}
      setBioResonanceSupportFrequency={setBioResonanceFrequency}
      volume={volume}
      setVolume={setVolume}
    />
  );

  const renderIntelPanel = () => (
    <SitRepIntelFeed
      intelFeed={displayedIntelFeed}
      currentClearance={acclimatizationLevel}
    />
  );

  const renderTemporalPanel = () => (
    <TemporalArchive
      phase={acclimatizationLevel}
      currentTimeline={currentTimeline}
      temporalMoment={temporalMoment}
      audioLevel={audioLevel}
    />
  );

  const renderCalibrationPanel = () => (
    <BaselineCalibrationPanel
      baseline={baseline}
      isCalibrating={isCalibrating}
      progress={calibrationProgress}
      liveStress={cognitiveStressIndex}
      liveCohesion={effectiveCohesion}
      onStart={() => {
        startCalibration();
        logOperatorEvent('Calibration Started', 'Capturing baselines for generated simulation values.', 'nominal');
      }}
      onCancel={cancelCalibration}
      onClear={() => {
        clearBaseline();
        logOperatorEvent('Baseline Cleared', 'Dashboard reverted to generated simulation values.', 'nominal');
      }}
      onAdjust={adjustBaseline}
    />
  );

  const renderMetricsPanel = () => (
    <OperatorMetricsDashboard
      history={metricsHistory}
      baseline={baseline}
      calibrationSlot={renderCalibrationPanel()}
    />
  );

  const renderBreathPulsePanel = () => (
    <BreathPulseControls
      controls={breathPulseControls}
      liveAvailable={microphoneConnected}
    />
  );

  const guidance = getSessionGuidance(acclimatizationLevel, decisionPoints.length, resolvedDecisions.length);
  const navigate = (view: 'map' | 'decisions') => {
    setShowElectrokineticLayer(false);
    setPrimaryView(view);
    setMobileTab('map');
  };

  return (
    <div
      ref={surfaceRef}
      className={`dark font-sans min-h-screen ${getAcclimatizationStyles()} transition-colors duration-500 relative overflow-hidden`}
    >
      <SessionControls
        phase={acclimatizationLevel} pending={decisionPoints.length} committed={resolvedDecisions.length}
        primaryView={primaryView} showNeuroSim={showElectrokineticLayer} fullWorkspace={fullWorkspace}
        ambient={ambient} autoAdvance={autoAdvance}
        onNavigate={navigate} onReview={() => setReviewOpen(true)} onAdvance={handleAcclimatizationAdvance}
        onWorkspaceChange={() => setFullWorkspace(previous => !previous)} onAmbientChange={() => setAmbient(previous => !previous)}
        onAutoAdvance={setAutoAdvance} onExport={handleExport} onRestart={onRestart}
      />
      <SessionReview open={reviewOpen} onOpenChange={setReviewOpen} decisions={resolvedDecisions} objectives={objectives} onExport={handleExport} />
      <main id="session-workspace" tabIndex={-1}>
      {!fullWorkspace ? (
        <div className="relative z-10 mx-auto max-w-[1500px] space-y-6 px-4 py-6 sm:px-6">
          <section className="flex flex-wrap items-center justify-between gap-5 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.04] p-5 sm:p-6" aria-label="Session progress">
            <div className="max-w-2xl"><p className="text-xs uppercase tracking-widest text-emerald-300">{resolvedDecisions.length} of {sessionDecisionCount} decisions recorded</p><h2 className="mt-2 text-2xl font-medium text-slate-100">{guidance.title}</h2><p className="mt-2 text-sm leading-relaxed text-slate-400">{guidance.detail}</p></div>
            <button className="session-button !border-emerald-300/50 !text-emerald-200" onClick={() => {
              if (guidance.action === 'review') setReviewOpen(true);
              else if (guidance.action === 'advance') { handleAcclimatizationAdvance(); navigate('decisions'); }
              else navigate('decisions');
            }}>{guidance.label} →</button>
          </section>
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-4">
              <div className={primaryView === 'decisions' && !showElectrokineticLayer ? 'min-h-[560px]' : 'h-[min(65vh,640px)] min-h-[350px]'}>{renderPrimarySurface()}</div>
              <details className="rounded-xl border border-white/10 bg-black/20 p-4"><summary className="cursor-pointer text-sm text-slate-300">Optional tools · audio, 3D view, and red-team simulation</summary><div className="mt-4">{renderModeToolbar()}</div><p className="mt-3 text-xs text-slate-400">Red-team simulation unlocks at phase 2. Audio always requires your permission.</p></details>
              {audioEnabled && <div className="rounded-lg border border-white/15 p-4"><p role="status" className="mb-3 text-sm text-slate-300">{audioError ? `Microphone unavailable: ${audioError}. You can continue without audio.` : microphoneConnected ? 'Microphone connected. Audio energy is processed locally.' : 'Waiting for microphone permission. You can continue exploring.'}</p><button className="session-button" onClick={handleDisableBiofeedback}>Stop microphone and tones</button></div>}
            </div>
            <aside className="min-w-0 space-y-5" aria-label="Session context">
              <section className="rounded-xl border border-white/10 bg-black/20 p-5"><h2 className="text-sm font-medium text-slate-100">Scenario objectives</h2><p className="mt-1 text-xs text-slate-400">Authored progress, not a performance score.</p><div className="mt-5 space-y-5">{objectives.map(objective => <div key={objective.id}><div className="flex justify-between gap-2 text-sm text-slate-200"><span>{objective.label}</span><span>{Math.round(objective.progress * 100)}%</span></div><progress className="mission-progress mt-2 h-1.5 w-full" aria-label={objective.label} value={objective.progress} max={1} /><p className="mt-2 text-xs text-slate-400">{objective.detail}</p></div>)}</div></section>
              <div className="h-[360px]">{renderIntelPanel()}</div>
              {resolvedDecisions.length > 0 && <section className="rounded-xl border border-white/10 p-5"><h2 className="text-xs uppercase tracking-widest text-slate-400">Last recorded choice</h2><p className="mt-3 text-sm text-slate-100">{resolvedDecisions[resolvedDecisions.length - 1].outcome.title}</p><button className="mt-4 text-sm text-emerald-300 underline underline-offset-4" onClick={() => setReviewOpen(true)}>Inspect your decision trail →</button></section>}
            </aside>
          </div>
        </div>
      ) : !isMobile ? (
        <div
          className="relative z-10 mx-auto grid max-w-[1500px] grid-cols-12 items-start gap-4 p-6"
          style={ambient ? {
            transform: 'scale(var(--breath-scale, 1)) translateY(var(--breath-lift, 0px))',
            filter: 'blur(var(--breath-blur, 0px))',
            willChange: 'transform, filter',
          } : undefined}
        >
          <MissionCommandStrip mission={mission} pulseRate={squadPositions[0]?.vitals.heartRate ?? 72} coherenceLevel={effectiveCohesion} activeFrequency={bioResonanceFrequency} />
          <div className="col-span-12">{renderModeToolbar()}</div>
          <div className="col-span-8 h-[640px] min-w-0">{renderPrimarySurface()}</div>
          <div className="col-span-4 h-[640px] min-w-0">{renderVitalsPanel()}</div>
          <div className="col-span-12"><MissionAlertQueue alerts={mission.alerts} dismissedAlertIds={dismissedAlertIds} onDismiss={handleDismissAlert} /></div>
          <div className="col-span-4 h-[440px] min-w-0">{renderIntelPanel()}</div>
          <div className="col-span-4 h-[440px] min-w-0"><SquadCohesionIndex squadVitals={squadVitals} communicationEfficiency={communicationEfficiency} /></div>
          <div className="col-span-4 h-[440px] min-w-0">{renderBreathPulsePanel()}</div>
          <div className="col-span-4 h-[340px] min-w-0"><TouchInterface phase={acclimatizationLevel} onTouch={handleOperatorTouch} onFrequencyChange={setBioResonanceFrequency} /></div>
          <div className="col-span-4 h-[340px] min-w-0">{renderTemporalPanel()}</div>
          <div className="col-span-4 h-[340px] min-w-0"><OperatorEventTimeline events={operatorEvents} /></div>
          <div className="col-span-12 h-[560px] min-w-0">{renderMetricsPanel()}</div>
        </div>
      ) : (
        <div className="relative z-10 flex min-h-screen flex-col gap-2 p-2 pb-4">
          <MissionCommandStrip
            mission={mission}
            pulseRate={squadPositions[0]?.vitals.heartRate ?? 72}
            coherenceLevel={effectiveCohesion}
            activeFrequency={bioResonanceFrequency}
          />

          {renderModeToolbar()}

          <MissionAlertQueue
            alerts={mission.alerts}
            dismissedAlertIds={dismissedAlertIds}
            onDismiss={handleDismissAlert}
          />

          <Tabs value={mobileTab} onValueChange={setMobileTab} className="flex min-h-0 flex-1 flex-col">
            <TabsList className="grid h-auto w-full grid-cols-5 rounded-none border border-current/15 bg-black/50 p-1 text-[10px]">
              <TabsTrigger value="map" className="px-1 py-2 text-[10px]">Map</TabsTrigger>
              <TabsTrigger value="vitals" className="px-1 py-2 text-[10px]">Vitals</TabsTrigger>
              <TabsTrigger value="intel" className="px-1 py-2 text-[10px]">Intel</TabsTrigger>
              <TabsTrigger value="sim" className="px-1 py-2 text-[10px]">Sim</TabsTrigger>
              <TabsTrigger value="events" className="px-1 py-2 text-[10px]">Events</TabsTrigger>
            </TabsList>

            <TabsContent value="map" className="mt-2 min-h-[58vh] flex-1">
              <div className="h-[58vh]">{renderPrimarySurface()}</div>
            </TabsContent>

            <TabsContent value="vitals" className="mt-2 space-y-2">
              <div className="h-[max(460px,55vh)]">{renderVitalsPanel()}</div>
              <div className="h-[max(440px,55vh)]">{renderBreathPulsePanel()}</div>
              <div className="h-[400px]">
                <SquadCohesionIndex
                  squadVitals={squadVitals}
                  communicationEfficiency={communicationEfficiency}
                />
              </div>
            </TabsContent>

            <TabsContent value="intel" className="mt-2 space-y-2">
              <div className="h-[46vh]">{renderIntelPanel()}</div>
              {simulationMode && <div className="h-[30vh]">{renderTemporalPanel()}</div>}
            </TabsContent>

            <TabsContent value="sim" className="mt-2 space-y-2">
              <div className="h-[36vh]">
                <TouchInterface
                  phase={acclimatizationLevel}
                  onTouch={handleOperatorTouch}
                  onFrequencyChange={setBioResonanceFrequency}
                />
              </div>
              <div className="h-[40vh]">
                {showElectrokineticLayer ? renderNeuroEmSimulator() : (
                  <DecisionMatrixSimulator
                    decisionPoints={decisionPoints}
                    committedCount={resolvedDecisions.length}
                    objectives={objectives}
                    onOutcomeSelect={handleOutcomeSelect}
                  />
                )}
              </div>
            </TabsContent>

            <TabsContent value="events" className="mt-2 space-y-2">
              <div className="h-[60vh]">
                {renderMetricsPanel()}
              </div>
              <div className="h-[56vh]">
                <OperatorEventTimeline events={operatorEvents} />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}

      </main>

      <BiofeedbackConsentDialog
        open={biofeedbackDialogOpen}
        onOpenChange={setBiofeedbackDialogOpen}
        onConfirm={handleConfirmBiofeedback}
      />

      {ambient && <div className="ambient-overlays"><VisualOverlays phase={acclimatizationLevel} coherenceLevel={effectiveCohesion} redTeamIntensity={redTeamIntensity} /></div>}
    </div>
  );
};

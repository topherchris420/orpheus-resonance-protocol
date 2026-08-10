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

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const AUDIO_PREFERENCE_STORAGE_KEY = 'orpheus.audio.enabled';
const NEUROSIM_PREFERENCE_STORAGE_KEY = 'orpheus.preference.neurosim';
const ALERT_ACK_STORAGE_KEY = 'orpheus.preference.acknowledgedAlerts';
const MOBILE_TAB_STORAGE_KEY = 'orpheus.preference.mobileTab';

const NeuroEmSimulator = lazy(() =>
  import('./NeuroEmSimulator').then((module) => ({ default: module.NeuroEmSimulator })),
);

interface PegasusSimulationProps {
  accessLevel: number;
  onAccessLevelChange: (level: number) => void;
}

const createEventId = (label: string) => `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;

export const PegasusSimulation: React.FC<PegasusSimulationProps> = ({
  accessLevel,
  onAccessLevelChange,
}) => {
  const [isMobile, setIsMobile] = useState(false);
  const [showElectrokineticLayer, setShowElectrokineticLayer] = usePersistentState(
    NEUROSIM_PREFERENCE_STORAGE_KEY,
    false,
  );
  const [mobileTab, setMobileTab] = usePersistentState(MOBILE_TAB_STORAGE_KEY, 'map');
  const [dismissedAlertIds, setDismissedAlertIds] = usePersistentState<string[]>(ALERT_ACK_STORAGE_KEY, []);
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
  const [intelFeed, setIntelFeed] = useState(dataGenerator.getIntelFeed());
  const [threatIndicators, setThreatIndicators] = useState(dataGenerator.generateThreatIndicators());
  const [squadPositions, setSquadPositions] = useState(dataGenerator.generateSquadPositions());
  const [optimalPath, setOptimalPath] = useState(dataGenerator.generateOptimalPath());
  const [realtimeVitals, setRealtimeVitals] = useState(dataGenerator.generateRealisticVitals(78, 16.2, 0.3));
  const previousStressRef = useRef(realtimeVitals.cognitiveStressIndex);
  const previousPhaseRef = useRef(1);
  const threatIndicatorsRef = useRef(threatIndicators);
  const hostilePressureRef = useRef(0.3);
  const stressModifierRef = useRef(0);

  useEffect(() => {
    threatIndicatorsRef.current = threatIndicators;
  }, [threatIndicators]);

  const [audioEnabled, setAudioEnabled] = usePersistentState(
    AUDIO_PREFERENCE_STORAGE_KEY,
    appConfig.features.enableAudioBiofeedback ? false : false,
  );

  const logOperatorEvent = useCallback((label: string, detail: string, severity: MissionSeverity = 'nominal') => {
    setOperatorEvents((previous) =>
      appendOperatorEvent(previous, {
        id: createEventId(label),
        timestamp: Date.now(),
        label,
        detail,
        severity,
      }),
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
    breathPattern,
    pulseRate,
    activeFrequency: audioFrequency,
    microphoneConnected,
    audioError,
    volume,
    setVolume,
  } = useAudioAnalysis(audioEnabled && appConfig.features.enableAudioBiofeedback, breathModulationRef);

  liveSignalsRef.current = {
    livePulseRate: pulseRate,
    liveBreathSignal: breathPattern,
    liveAvailable: microphoneConnected,
  };


  const { acclimatizationLevel, simulationMode } = usePhaseProgression(onAccessLevelChange);

  const {
    currentTimeline,
    temporalMoment,
    cohesionScore,
    bioResonanceFrequency,
    addInteractionEvent,
    setCohesionScore,
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
    if (!appConfig.features.enableAudioBiofeedback && audioEnabled) {
      setAudioEnabled(false);
    }
  }, [audioEnabled, setAudioEnabled]);

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
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const intelTimer = setInterval(() => {
      const newIntel = dataGenerator.generateIntelUpdate(acclimatizationLevel);
      const historyWindow = Math.max(1, appConfig.limits.maxIntelFeedItems - 1);
      setIntelFeed((prev) => [...prev.slice(-historyWindow), newIntel]);
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
    resolveOutcome(pointId, outcome);
    setIntelFeed((previous) => {
      const historyWindow = Math.max(1, appConfig.limits.maxIntelFeedItems - 1);
      return [
        ...previous.slice(-historyWindow),
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
    logOperatorEvent('Course Committed', `${outcome.title} — ${outcome.consequences}`, outcome.effects.severity);
  }, [logOperatorEvent, resolveOutcome]);

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
    logOperatorEvent('Biofeedback Enabled', 'Live biofeedback requested with low-volume support tones.', 'watch');
  }, [logOperatorEvent, setAudioEnabled, setVolume, volume]);

  const handleDisableBiofeedback = useCallback(() => {
    setAudioEnabled(false);
    logOperatorEvent('Biofeedback Disabled', 'Microphone analysis and support tones stopped.', 'nominal');
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
    ) : simulationMode ? (
      <DecisionMatrixSimulator
        decisionPoints={decisionPoints}
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

  const renderBreathPulsePanel = () => (
    <BreathPulseControls
      controls={breathPulseControls}
      liveAvailable={microphoneConnected}
      livePulseRate={pulseRate}
    />
  );

  return (
    <div
      ref={surfaceRef}
      className={`min-h-screen ${getAcclimatizationStyles()} transition-colors duration-500 relative overflow-hidden`}
    >
      {!isMobile ? (
        <div
          className="relative z-10 h-screen grid grid-cols-12 grid-rows-[auto_repeat(7,minmax(0,1fr))] gap-2 p-4"
          style={{
            transform: 'scale(var(--breath-scale, 1)) translateY(var(--breath-lift, 0px))',
            filter: 'blur(var(--breath-blur, 0px))',
            willChange: 'transform, filter',
          }}
        >

          <MissionCommandStrip
            mission={mission}
            pulseRate={pulseRate}
            coherenceLevel={effectiveCohesion}
            activeFrequency={bioResonanceFrequency}
          />

          <div className="col-start-1 col-span-3 row-start-2 row-span-3 min-h-0">
            {renderVitalsPanel()}
          </div>

          <div className="col-start-1 col-span-3 row-start-5 row-span-2 min-h-0 overflow-hidden">
            <MissionAlertQueue
              alerts={mission.alerts}
              dismissedAlertIds={dismissedAlertIds}
              onDismiss={handleDismissAlert}
            />
          </div>

          <div className="col-start-1 col-span-3 row-start-7 row-span-2 min-h-0">
            <SquadCohesionIndex
              squadVitals={squadVitals}
              communicationEfficiency={communicationEfficiency}
              onCohesionChange={setCohesionScore}
            />
          </div>

          <div className="col-start-4 col-span-6 row-start-2 row-span-4 min-h-0">
            {renderPrimarySurface()}
          </div>

          <div className="col-start-4 col-span-6 row-start-6 row-span-3 min-h-0">
            {simulationMode ? renderTemporalPanel() : renderIntelPanel()}
          </div>

          <div className="col-start-10 col-span-3 row-start-2 row-span-1 min-h-0">
            {renderModeToolbar()}
          </div>

          <div className="col-start-10 col-span-3 row-start-3 row-span-2 min-h-0">
            <TouchInterface
              phase={acclimatizationLevel}
              onTouch={handleOperatorTouch}
              onFrequencyChange={setBioResonanceFrequency}
            />
          </div>

          <div className="col-start-10 col-span-3 row-start-5 row-span-2 min-h-0">
            {renderBreathPulsePanel()}
          </div>

          <div className="col-start-10 col-span-3 row-start-7 row-span-2 min-h-0">
            <OperatorEventTimeline events={operatorEvents} />
          </div>
        </div>
      ) : (
        <div className="relative z-10 flex min-h-screen flex-col gap-2 p-2 pb-4">
          <MissionCommandStrip
            mission={mission}
            pulseRate={pulseRate}
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
              <div className="h-[42vh]">{renderVitalsPanel()}</div>
              <div className="h-[34vh]">
                <SquadCohesionIndex
                  squadVitals={squadVitals}
                  communicationEfficiency={communicationEfficiency}
                  onCohesionChange={setCohesionScore}
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
                    objectives={objectives}
                    onOutcomeSelect={handleOutcomeSelect}
                  />
                )}
              </div>
            </TabsContent>

            <TabsContent value="events" className="mt-2">
              <div className="h-[66vh]">
                <OperatorEventTimeline events={operatorEvents} />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}

      <BiofeedbackConsentDialog
        open={biofeedbackDialogOpen}
        onOpenChange={setBiofeedbackDialogOpen}
        onConfirm={handleConfirmBiofeedback}
      />

      <VisualOverlays phase={acclimatizationLevel} coherenceLevel={effectiveCohesion} redTeamIntensity={redTeamIntensity} />
    </div>
  );
};
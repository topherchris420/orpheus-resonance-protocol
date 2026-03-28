import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { TacticalDataDisplay } from './TacticalDataDisplay';
import { OperatorVitalsCognitiveLoadMonitor } from './OperatorVitalsCognitiveLoadMonitor';
import { SitRepIntelFeed } from './SitRepIntelFeed';
import { TouchInterface } from './TouchInterface';
import { DecisionMatrixSimulator, DecisionPoint } from './DecisionMatrixSimulator';
import { TemporalArchive } from './TemporalArchive';
import { SquadCohesionIndex } from './SquadCohesionIndex';
import { MissionCriticalEventRecorder, CognitiveSnapshot } from './MissionCriticalEventRecorder';
import { StatusIndicators } from './StatusIndicators';
import { HeaderStatusBar } from './HeaderStatusBar';
import { MobileHeader } from './MobileHeader';
import { CollapsiblePanel } from './CollapsiblePanel';
import { VisualOverlays } from './VisualOverlays';
import { useAudioAnalysis } from '../hooks/useAudioAnalysis';
import { usePhaseProgression } from '../hooks/usePhaseProgression';
import { useInteractionState } from '../hooks/useInteractionState';
import { useRedTeamSimulation } from '../hooks/useRedTeamSimulation';
import { Button } from './ui/button';
import { dataGenerator } from '../data/realisticData';
import { appConfig } from '@/config/appConfig';

// Stable constants to prevent unnecessary re-renders in memoized children
const EMPTY_SNAPSHOTS: CognitiveSnapshot[] = [];
const EMPTY_DECISION_POINTS: DecisionPoint[] = [];
const NO_OP = () => {};
const AUDIO_PREFERENCE_STORAGE_KEY = "orpheus.audio.enabled";
const NeuroEmSimulator = lazy(() =>
  import("./NeuroEmSimulator").then((module) => ({ default: module.NeuroEmSimulator })),
);

interface PegasusSimulationProps {
  accessLevel: number;
  onAccessLevelChange: (level: number) => void;
}

export const PegasusSimulation: React.FC<PegasusSimulationProps> = ({ 
  accessLevel, 
  onAccessLevelChange 
}) => {
  const [isMobile, setIsMobile] = useState(false);
  const [showElectrokineticLayer, setShowElectrokineticLayer] = useState(false);
  const [intelFeed, setIntelFeed] = useState(dataGenerator.getIntelFeed());
  const [threatIndicators, setThreatIndicators] = useState(dataGenerator.generateThreatIndicators());
  const [squadPositions, setSquadPositions] = useState(dataGenerator.generateSquadPositions());
  const [optimalPath, setOptimalPath] = useState(dataGenerator.generateOptimalPath());
  const [realtimeVitals, setRealtimeVitals] = useState(dataGenerator.generateRealisticVitals(78, 16.2, 0.3));
  const [audioEnabled, setAudioEnabled] = useState(() => {
    if (!appConfig.features.enableAudioBiofeedback) {
      return false;
    }

    try {
      const stored = window.localStorage.getItem(AUDIO_PREFERENCE_STORAGE_KEY);
      if (stored === null) {
        return false;
      }
      return stored === "true";
    } catch {
      return false;
    }
  });

  // Custom hooks for managing state and logic
  const {
    audioLevel,
    breathPattern,
    pulseRate,
    activeFrequency: audioFrequency,
    microphoneConnected,
    audioError,
    volume,
    setVolume
  } = useAudioAnalysis(audioEnabled);

  const { acclimatizationLevel, simulationMode, handleAcclimatizationAdvance } = usePhaseProgression(onAccessLevelChange);

  const {
    interactionEvents,
    currentTimeline,
    temporalMoment,
    cohesionScore,
    bioResonanceFrequency,
    addInteractionEvent,
    handleTemporalShift,
    setCohesionScore,
    setBioResonanceFrequency
  } = useInteractionState();

  const {
    isRedTeamModeActive,
    redTeamIntensity,
    conflictingIntel,
    toggleRedTeamMode,
  } = useRedTeamSimulation(simulationMode);

  // Set initial frequency from audio analysis
  useEffect(() => {
    setBioResonanceFrequency(audioFrequency);
  }, [audioFrequency, setBioResonanceFrequency]);

  useEffect(() => {
    if (!appConfig.features.enableAudioBiofeedback) {
      setAudioEnabled(false);
      return;
    }

    try {
      window.localStorage.setItem(AUDIO_PREFERENCE_STORAGE_KEY, String(audioEnabled));
    } catch {
      // Ignore localStorage write issues and keep runtime behavior.
    }
  }, [audioEnabled]);

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Generate realistic intel updates
  useEffect(() => {
    const intelTimer = setInterval(() => {
      const newIntel = dataGenerator.generateIntelUpdate(acclimatizationLevel);
      const historyWindow = Math.max(1, appConfig.limits.maxIntelFeedItems - 1);
      setIntelFeed(prev => [...prev.slice(-historyWindow), newIntel]);
    }, 15000 + Math.random() * 30000); // Every 15-45 seconds

    return () => clearInterval(intelTimer);
  }, [acclimatizationLevel]);

  // Update tactical data periodically
  useEffect(() => {
    const tacticalTimer = setInterval(() => {
      setThreatIndicators(dataGenerator.generateThreatIndicators(Math.floor(Math.random() * 5) + 2));
      setSquadPositions(dataGenerator.generateSquadPositions(4));
      if (Math.random() > 0.7) {
        setOptimalPath(dataGenerator.generateOptimalPath());
      }
    }, 20000 + Math.random() * 40000); // Every 20-60 seconds

    return () => clearInterval(tacticalTimer);
  }, []);

  // Update vitals with smooth live feedback (every 2.5 seconds)
  useEffect(() => {
    const vitalsTimer = setInterval(() => {
      setRealtimeVitals(dataGenerator.generateRealisticVitals(78, 16.2, 0.3 + redTeamIntensity * 0.5));
    }, 2500); // Every 2.5 seconds for live feel without glitching

    return () => clearInterval(vitalsTimer);
  }, [redTeamIntensity]);

  const getAcclimatizationStyles = () => {
    if (isRedTeamModeActive) {
      return "bg-gradient-to-br from-red-900 via-black to-black text-red-400";
    }
    switch (acclimatizationLevel) {
      case 1:
        return "bg-gradient-to-br from-slate-900 to-black text-green-400";
      case 2:
        return "bg-gradient-to-br from-blue-900 to-black text-cyan-400";
      case 3:
        return "bg-gradient-to-br from-gray-800 via-slate-900 to-black text-yellow-400";
      case 4:
        return "bg-gradient-to-br from-orange-900 via-gray-900 to-black text-white";
      default:
        return "bg-black text-green-400";
    }
  };

  const cognitiveStressIndex = realtimeVitals.cognitiveStressIndex;
  const communicationEfficiency = 0.9 - redTeamIntensity * 0.4;

  // Memoized values to prevent unnecessary re-renders and computations
  const squadVitals = useMemo(() => squadPositions.map(member => ({
    hrv: member.vitals.heartRate,
    respiratoryRate: 16 + Math.random() * 4,
    cognitiveStressIndex: member.status === 'wounded' ? 0.8 : cognitiveStressIndex
  })), [squadPositions, cognitiveStressIndex]);

  const displayedThreatIndicators = useMemo(() => conflictingIntel ?
    [...threatIndicators, { id: 'red-team-threat', position: { x: 200, y: 200 }, type: 'hostile' as const, confidence: 90, lastUpdated: Date.now() }] :
    threatIndicators,
  [conflictingIntel, threatIndicators]);

  const displayedIntelFeed = useMemo(() => conflictingIntel ?
    [...intelFeed, { id: 'red-team-intel', timestamp: Date.now(), message: conflictingIntel, clearanceLevel: 1, priority: 'CRITICAL' as const, source: 'REDTEAM' }] :
    intelFeed,
  [conflictingIntel, intelFeed]);

  const renderNeuroEmSimulator = () => (
    <Suspense
      fallback={
        <div className="h-full w-full border border-current/30 bg-black/40 backdrop-blur-sm p-4 flex items-center justify-center text-sm opacity-80">
          Loading NeuroSim module...
        </div>
      }
    >
      <NeuroEmSimulator bioResonanceFrequency={bioResonanceFrequency} />
    </Suspense>
  );

  return (
    <div className={`min-h-screen ${getAcclimatizationStyles()} transition-all duration-1000 relative overflow-hidden`}>
      {/* Control Toggles - Desktop only */}
      {!isMobile && (
        <div className="absolute top-4 right-4 z-20 flex gap-2">
          {appConfig.features.enableAudioBiofeedback && (
            <Button
              onClick={() => setAudioEnabled(prev => !prev)}
              variant={audioEnabled ? "secondary" : "outline"}
            >
              {audioEnabled ? "Disable Biofeedback" : "Enable Biofeedback"}
            </Button>
          )}
          <Button
            onClick={() => setShowElectrokineticLayer(prev => !prev)}
            variant={showElectrokineticLayer ? "secondary" : "default"}
          >
            {showElectrokineticLayer ? "NeuroSim Off" : "NeuroSim On"}
          </Button>
          {simulationMode && (
            <Button
              onClick={toggleRedTeamMode}
              variant={isRedTeamModeActive ? "destructive" : "default"}
            >
              {isRedTeamModeActive ? "Deactivate Red Team" : "Activate Red Team"}
            </Button>
          )}
        </div>
      )}

      {/* Status Indicators */}
      <StatusIndicators 
        audioError={audioError}
        microphoneConnected={microphoneConnected}
        audioEnabled={audioEnabled}
      />

      {/* Desktop Layout */}
      {!isMobile ? (
        <div className="relative z-10 h-screen grid grid-cols-12 grid-rows-8 gap-2 p-4">
          {/* Header Status Bar */}
          <HeaderStatusBar
            phase={acclimatizationLevel}
            temporalMode={simulationMode}
            microphoneConnected={microphoneConnected}
            coherenceLevel={cohesionScore}
            activeFrequency={bioResonanceFrequency}
            pulseRate={pulseRate}
            currentTimeline={currentTimeline}
            temporalMoment={temporalMoment}
          />

          {/* Left Panel - Operator Vitals */}
          <div className="col-span-3 row-span-4">
            <OperatorVitalsCognitiveLoadMonitor
              hrv={realtimeVitals.hrv}
              respiratoryRate={realtimeVitals.respiratoryRate}
              cognitiveStressIndex={cognitiveStressIndex}
              bioResonanceSupportFrequency={bioResonanceFrequency}
              setBioResonanceSupportFrequency={setBioResonanceFrequency}
              volume={volume}
              setVolume={setVolume}
            />
          </div>

          {/* Left Panel Bottom - Squad Cohesion */}
          <div className="col-span-3 row-span-3">
            <SquadCohesionIndex
              squadVitals={squadVitals}
              communicationEfficiency={communicationEfficiency}
              onCohesionChange={setCohesionScore}
            />
          </div>

          {/* Center Top - Decision Matrix Simulator or Tactical Data Display */}
          <div className="col-span-6 row-span-3">
            {showElectrokineticLayer ? (
              renderNeuroEmSimulator()
            ) : simulationMode ? (
              <DecisionMatrixSimulator
                decisionPoints={EMPTY_DECISION_POINTS}
                onOutcomeSelect={NO_OP}
              />
            ) : (
              <TacticalDataDisplay
                threatIndicators={displayedThreatIndicators}
                optimalPathing={optimalPath}
                squadPositions={squadPositions}
              />
            )}
          </div>

          {/* Center Bottom - Temporal Archive or SitRep/Intel Feed */}
          <div className="col-span-6 row-span-2">
            {simulationMode ? (
              <TemporalArchive
                phase={acclimatizationLevel}
                currentTimeline={currentTimeline}
                temporalMoment={temporalMoment}
                audioLevel={audioLevel}
              />
            ) : (
              <SitRepIntelFeed
                intelFeed={displayedIntelFeed}
                currentClearance={acclimatizationLevel}
              />
            )}
          </div>

          {/* Right Panel Top - Touch Interface */}
          <div className="col-span-3 row-span-4">
            <TouchInterface 
              phase={acclimatizationLevel}
              onTouch={addInteractionEvent}
              onFrequencyChange={setBioResonanceFrequency}
            />
          </div>

          {/* Right Panel Bottom - Mission Critical Event Recorder */}
          <div className="col-span-3 row-span-3">
            <MissionCriticalEventRecorder
              snapshots={EMPTY_SNAPSHOTS}
              onSnapshotSelect={NO_OP}
            />
          </div>

          {/* Bottom Panel - SitRep/Intel Feed when simulation mode active */}
          {simulationMode && (
            <div className="col-span-12 row-span-2">
              <SitRepIntelFeed
                intelFeed={displayedIntelFeed}
                currentClearance={acclimatizationLevel}
              />
            </div>
          )}
        </div>
      ) : (
        /* Mobile Layout */
        <div className="relative z-10 min-h-screen flex flex-col gap-2 p-2">
          {/* Mobile Header */}
          <MobileHeader
            phase={acclimatizationLevel}
            temporalMode={simulationMode}
            microphoneConnected={microphoneConnected}
            coherenceLevel={cohesionScore}
            pulseRate={pulseRate}
            currentTimeline={currentTimeline}
            temporalMoment={temporalMoment}
          />

          {/* Mobile Main Visualizer */}
          <div className="flex-1 min-h-[40vh]">
            {showElectrokineticLayer ? (
              renderNeuroEmSimulator()
            ) : simulationMode ? (
              <DecisionMatrixSimulator
                decisionPoints={EMPTY_DECISION_POINTS}
                onOutcomeSelect={NO_OP}
              />
            ) : (
              <TacticalDataDisplay
                threatIndicators={displayedThreatIndicators}
                optimalPathing={optimalPath}
                squadPositions={squadPositions}
              />
            )}
          </div>

          {/* Mobile Grid for Secondary Panels */}
          <div className="grid grid-cols-2 gap-2 h-64">
            <OperatorVitalsCognitiveLoadMonitor
              hrv={realtimeVitals.hrv}
              respiratoryRate={realtimeVitals.respiratoryRate}
              cognitiveStressIndex={cognitiveStressIndex}
              bioResonanceSupportFrequency={bioResonanceFrequency}
              setBioResonanceSupportFrequency={setBioResonanceFrequency}
              volume={volume}
              setVolume={setVolume}
            />
            <SquadCohesionIndex
              squadVitals={squadVitals}
              communicationEfficiency={communicationEfficiency}
              onCohesionChange={setCohesionScore}
            />
          </div>

          {/* Mobile Secondary Grid */}
          <div className="grid grid-cols-2 gap-2 h-64">
            <TouchInterface 
              phase={acclimatizationLevel}
              onTouch={addInteractionEvent}
              onFrequencyChange={setBioResonanceFrequency}
            />
            <MissionCriticalEventRecorder
              snapshots={EMPTY_SNAPSHOTS}
              onSnapshotSelect={NO_OP}
            />
          </div>

          {/* Mobile Temporal Archive */}
          {simulationMode && (
            <div className="h-32">
              <TemporalArchive
                phase={acclimatizationLevel}
                currentTimeline={currentTimeline}
                temporalMoment={temporalMoment}
                audioLevel={audioLevel}
              />
            </div>
          )}

          {/* Mobile SitRep/Intel Feed */}
          <div className="h-48">
            <SitRepIntelFeed
              intelFeed={displayedIntelFeed}
              currentClearance={acclimatizationLevel}
            />
          </div>
        </div>
      )}

      {/* Visual Overlays */}
      <VisualOverlays phase={acclimatizationLevel} coherenceLevel={cohesionScore} redTeamIntensity={redTeamIntensity} />
    </div>
  );
};

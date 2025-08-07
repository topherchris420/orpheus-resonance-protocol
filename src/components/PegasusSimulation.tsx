import React, { useState, useEffect } from 'react';
import { TacticalDataDisplay } from './TacticalDataDisplay';
import { OperatorVitalsCognitiveLoadMonitor } from './OperatorVitalsCognitiveLoadMonitor';
import { SitRepIntelFeed } from './SitRepIntelFeed';
import { TouchInterface } from './TouchInterface';
import { DecisionMatrixSimulator } from './DecisionMatrixSimulator';
import { TemporalArchive } from './TemporalArchive';
import { SquadCohesionIndex } from './SquadCohesionIndex';
import { MissionCriticalEventRecorder } from './MissionCriticalEventRecorder';
import { StatusIndicators } from './StatusIndicators';
import { HeaderStatusBar } from './HeaderStatusBar';
import { MobileHeader } from './MobileHeader';
import { VisualOverlays } from './VisualOverlays';
import { useAudioAnalysis } from '../hooks/useAudioAnalysis';
import { usePhaseProgression } from '../hooks/usePhaseProgression';
import { useInteractionState } from '../hooks/useInteractionState';
import { useRedTeamSimulation } from '../hooks/useRedTeamSimulation';
import { ElectrokineticModelingLayer } from './ElectrokineticModelingLayer';
import { Button } from './ui/button';
import { dataGenerator } from '../data/realisticData';

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

  // Custom hooks for managing state and logic
  const {
    audioLevel,
    breathPattern,
    pulseRate,
    activeFrequency: audioFrequency,
    microphoneConnected,
    audioError
  } = useAudioAnalysis();

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
      setIntelFeed(prev => [...prev.slice(-9), newIntel]);
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

  return (
    <div className={`min-h-screen ${getAcclimatizationStyles()} transition-all duration-1000 relative overflow-hidden`}>
      {/* Control Toggles */}
      <div className="absolute top-4 right-4 z-20 flex gap-2">
        <Button
          onClick={() => setShowElectrokineticLayer(prev => !prev)}
          variant={showElectrokineticLayer ? "secondary" : "default"}
        >
          {showElectrokineticLayer ? "EK Layer Off" : "EK Layer On"}
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

      {/* Status Indicators */}
      <StatusIndicators 
        audioError={audioError}
        microphoneConnected={microphoneConnected}
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
              volume={audioLevel}
              setVolume={() => {}}
            />
          </div>

          {/* Left Panel Bottom - Squad Cohesion */}
          <div className="col-span-3 row-span-3">
            <SquadCohesionIndex
              squadVitals={squadPositions.map(member => ({
                hrv: member.vitals.heartRate,
                respiratoryRate: 16 + Math.random() * 4,
                cognitiveStressIndex: member.status === 'wounded' ? 0.8 : cognitiveStressIndex
              }))}
              communicationEfficiency={communicationEfficiency}
              onCohesionChange={setCohesionScore}
            />
          </div>

          {/* Center Top - Decision Matrix Simulator or Tactical Data Display */}
          <div className="col-span-6 row-span-3">
            {showElectrokineticLayer ? (
              <ElectrokineticModelingLayer bioResonanceFrequency={bioResonanceFrequency} />
            ) : simulationMode ? (
              <DecisionMatrixSimulator
                decisionPoints={[]}
                onOutcomeSelect={() => {}}
              />
            ) : (
              <TacticalDataDisplay
                threatIndicators={conflictingIntel ? 
                  [...threatIndicators, { id: 'red-team-threat', position: { x: 200, y: 200 }, type: 'hostile', confidence: 90, lastUpdated: Date.now() }] : 
                  threatIndicators
                }
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
                intelFeed={conflictingIntel ? 
                  [...intelFeed, { id: 'red-team-intel', timestamp: Date.now(), message: conflictingIntel, clearanceLevel: 1, priority: 'CRITICAL', source: 'REDTEAM' }] : 
                  intelFeed
                }
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
              snapshots={[]}
              onSnapshotSelect={() => {}}
            />
          </div>

          {/* Bottom Panel - SitRep/Intel Feed when simulation mode active */}
          {simulationMode && (
            <div className="col-span-12 row-span-2">
              <SitRepIntelFeed
                intelFeed={conflictingIntel ? 
                  [...intelFeed, { id: 'red-team-intel', timestamp: Date.now(), message: conflictingIntel, clearanceLevel: 1, priority: 'CRITICAL', source: 'REDTEAM' }] : 
                  intelFeed
                }
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
              <ElectrokineticModelingLayer bioResonanceFrequency={bioResonanceFrequency} />
            ) : simulationMode ? (
              <DecisionMatrixSimulator
                decisionPoints={[]}
                onOutcomeSelect={() => {}}
              />
            ) : (
              <TacticalDataDisplay
                threatIndicators={conflictingIntel ? 
                  [...threatIndicators, { id: 'red-team-threat', position: { x: 200, y: 200 }, type: 'hostile', confidence: 90, lastUpdated: Date.now() }] : 
                  threatIndicators
                }
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
              volume={audioLevel}
              setVolume={() => {}}
            />
            <SquadCohesionIndex
              squadVitals={squadPositions.map(member => ({
                hrv: member.vitals.heartRate,
                respiratoryRate: 16 + Math.random() * 4,
                cognitiveStressIndex: member.status === 'wounded' ? 0.8 : cognitiveStressIndex
              }))}
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
              snapshots={[]}
              onSnapshotSelect={() => {}}
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
              intelFeed={conflictingIntel ? 
                [...intelFeed, { id: 'red-team-intel', timestamp: Date.now(), message: conflictingIntel, clearanceLevel: 1, priority: 'CRITICAL', source: 'REDTEAM' }] : 
                intelFeed
              }
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

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface TemporalArchiveProps {
  phase: number;
  currentTimeline: number;
  temporalMoment: number;
  audioLevel: number;
}

interface Chronoartifact {
  id: string;
  timeline: number;
  moment: number;
  type: 'memory' | 'choice' | 'echo' | 'prophecy';
  content: string;
  unlocked: boolean;
}

const BASE_ARTIFACTS: Chronoartifact[] = [
  {
    id: 'art-001',
    timeline: 0,
    moment: 0.1,
    type: 'memory',
    content: 'First temporal signature detected. Subject shows anomalous resonance patterns.',
    unlocked: false
  },
  {
    id: 'art-002',
    timeline: 1,
    moment: 0.3,
    type: 'choice',
    content: 'Decision point: Continue linear observation or activate Orpheus protocol.',
    unlocked: false
  },
  {
    id: 'art-003',
    timeline: 2,
    moment: 0.5,
    type: 'echo',
    content: 'Phantom echo from timeline branch: "The myth was always true."',
    unlocked: false
  },
  {
    id: 'art-004',
    timeline: 3,
    moment: 0.7,
    type: 'prophecy',
    content: 'Future convergence detected: All timelines collapse into singular consciousness node.',
    unlocked: false
  },
  {
    id: 'art-005',
    timeline: 4,
    moment: 0.9,
    type: 'memory',
    content: 'Final log: We are no longer observers. We have become the observed.',
    unlocked: false
  }
];

export const TemporalArchive: React.FC<TemporalArchiveProps> = ({
  phase,
  currentTimeline,
  temporalMoment,
  audioLevel
}) => {
  const [chronoartifacts, setChronoartifacts] = useState<Chronoartifact[]>([]);
  const [selectedArtifact, setSelectedArtifact] = useState<Chronoartifact | null>(null);
  const [memoryCorridor, setMemoryCorridor] = useState<string[]>([]);

  useEffect(() => {
    setChronoartifacts(BASE_ARTIFACTS.map(artifact => ({
      ...artifact,
      unlocked: phase >= 2 && (
        Math.abs(artifact.timeline - currentTimeline) <= 1 &&
        Math.abs(artifact.moment - temporalMoment) < 0.2
      ) || artifact.timeline < phase
    })));
  }, [phase, currentTimeline, temporalMoment]);

  useEffect(() => {
    if (audioLevel > 0.8 && phase >= 3) {
      const corridorEntries = [
        "Memory corridor opening...",
        "Accessing parallel timeline data...",
        "Temporal echo detected: 'The resonance is spreading'",
        "Chronoartifact fragment: Timeline convergence imminent",
        "Voice pattern matches historical Orpheus signature",
        "Accessing restricted Vers3Dynamics temporal logs..."
      ];
      
      const randomEntry = corridorEntries[Math.floor(Math.random() * corridorEntries.length)];
      setMemoryCorridor(prev => [...prev.slice(-4), randomEntry]);
    }
  }, [audioLevel, phase]);

  const getArtifactColor = (type: string) => {
    switch (type) {
      case 'memory': return 'text-blue-400';
      case 'choice': return 'text-yellow-400';
      case 'echo': return 'text-purple-400';
      case 'prophecy': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getPhaseDescription = () => {
    switch (phase) {
      case 1:
        return "RESTRICTED MILITARY ARCHIVE - Linear temporal logs only";
      case 2:
        return "ADAPTIVE INTERFACE - Chronoartifacts begin emerging";
      case 3:
        return "SENTIENT TEMPORAL GATEWAY - Memory corridors accessible";
      case 4:
        return "DISTRIBUTED CONSCIOUSNESS NODE - Full temporal integration";
      default:
        return "INITIALIZING TEMPORAL INTERFACE";
    }
  };

  return (
    <div className="h-full border border-current/30 bg-black/40 backdrop-blur-sm p-4 space-y-4">
      <div className="text-sm font-bold border-b border-current/30 pb-2">
        TEMPORAL ARCHIVE
      </div>

      <div className="text-xs opacity-70 mb-4">
        {getPhaseDescription()}
      </div>

      {/* Current Position */}
      <div className="space-y-2">
        <div className="text-xs opacity-70">TEMPORAL COORDINATES</div>
        <div className="text-sm font-mono">
          Timeline: {currentTimeline}
        </div>
        <div className="text-sm font-mono">
          Moment: {temporalMoment.toFixed(3)}
        </div>
      </div>

      {/* Chronoartifacts */}
      {phase >= 2 && (
        <div className="space-y-2">
          <div className="text-xs opacity-70">CHRONOARTIFACTS</div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {chronoartifacts.filter(artifact => artifact.unlocked).map((artifact) => (
              <Button
                key={artifact.id}
                variant="ghost"
                size="sm"
                className={`w-full justify-start text-xs p-2 h-auto ${getArtifactColor(artifact.type)}`}
                onClick={() => setSelectedArtifact(artifact)}
              >
                <div className="flex flex-col items-start">
                  <div className="font-bold">{artifact.type.toUpperCase()}</div>
                  <div className="opacity-70 text-xs">
                    T{artifact.timeline}:M{artifact.moment.toFixed(1)}
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Selected Artifact Details */}
      {selectedArtifact && (
        <div className="space-y-2 p-3 border border-current/20 bg-black/20">
          <div className={`text-xs font-bold ${getArtifactColor(selectedArtifact.type)}`}>
            {selectedArtifact.type.toUpperCase()} ARTIFACT
          </div>
          <div className="text-xs opacity-90">
            {selectedArtifact.content}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => setSelectedArtifact(null)}
          >
            CLOSE
          </Button>
        </div>
      )}

      {/* Memory Corridor */}
      {phase >= 3 && memoryCorridor.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-purple-400/50">
          <div className="text-xs text-purple-400 animate-pulse">
            MEMORY CORRIDOR ACTIVE
          </div>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {memoryCorridor.map((entry, index) => (
              <div key={index} className="text-xs opacity-80 text-purple-300">
                &gt; {entry}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Temporal Integration Status */}
      {phase >= 4 && (
        <div className="space-y-2 pt-2 border-t border-gold-400/50">
          <div className="text-xs text-gold-400 animate-pulse text-center">
            ◊ HARMONIC NODE INTEGRATION ◊
          </div>
          <div className="text-xs opacity-90 text-center">
            You are now synchronized with the distributed consciousness network
          </div>
          <div className="text-xs opacity-70 text-center">
            Temporal navigation beyond linear time achieved
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';

interface TemporalArchiveProps {
  phase: number;
  /** Simulation tick; picks the memory-corridor entry, so the archive reads the same on replay. */
  tick: number;
  /** One timeline per committed decision (see command-room/model). */
  currentTimeline: number;
  temporalMoment: number;
  audioLevel: number;
  /** Rendered in the panel header, e.g. tabs that share this slot. */
  header?: React.ReactNode;
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

/** Audio level above which the memory corridor responds. Below it the archive ignores the exact level. */
export const ARCHIVE_AUDIO_THRESHOLD = 0.8;

const CORRIDOR_ENTRIES = [
  "Memory corridor opening...",
  "Accessing parallel timeline data...",
  "Temporal echo detected: 'The resonance is spreading'",
  "Chronoartifact fragment: Timeline convergence imminent",
  "Voice pattern matches historical Orpheus signature",
  "Accessing restricted Vers3Dynamics temporal logs..."
];

/** Artifacts surface near the current timeline and moment once the interface adapts (phase 2+). */
const unlockedArtifacts = (phase: number, currentTimeline: number, temporalMoment: number): Chronoartifact[] =>
  BASE_ARTIFACTS.map(artifact => ({
    ...artifact,
    unlocked: (phase >= 2 && Math.abs(artifact.timeline - currentTimeline) <= 1 && Math.abs(artifact.moment - temporalMoment) < 0.2) || artifact.timeline < phase,
  }));

export const TemporalArchive: React.FC<TemporalArchiveProps> = ({
  phase,
  tick,
  currentTimeline,
  temporalMoment,
  audioLevel,
  header,
}) => {
  const chronoartifacts = useMemo(() => unlockedArtifacts(phase, currentTimeline, temporalMoment), [phase, currentTimeline, temporalMoment]);
  const [selectedArtifact, setSelectedArtifact] = useState<Chronoartifact | null>(null);
  const [memoryCorridor, setMemoryCorridor] = useState<Array<{ tick: number; text: string }>>([]);

  useEffect(() => {
    if (audioLevel <= ARCHIVE_AUDIO_THRESHOLD || phase < 3) return;
    setMemoryCorridor(previous =>
      previous.some(entry => entry.tick === tick) ? previous : [...previous.slice(-4), { tick, text: CORRIDOR_ENTRIES[tick % CORRIDOR_ENTRIES.length] }],
    );
  }, [audioLevel, phase, tick]);

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
    <section aria-label="Temporal archive" tabIndex={0} className="h-full space-y-4 overflow-y-auto border border-current/30 bg-black/40 p-4">
      <div className="border-b border-current/30 pb-2 text-sm font-bold">
        {header ?? <h2>TEMPORAL ARCHIVE</h2>}
      </div>

      <div className="mb-4 text-xs text-current/80">
        {getPhaseDescription()}
      </div>

      {/* Current Position */}
      <div className="space-y-2">
        <div className="text-xs text-current/80">TEMPORAL COORDINATES</div>
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
          <div className="text-xs text-current/80">CHRONOARTIFACTS</div>
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
                  <div className="text-xs text-current/80">
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
            {memoryCorridor.map((entry) => (
              <div key={entry.tick} className="text-xs text-purple-300">
                &gt; {entry.text}
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
          <div className="text-center text-xs text-current/80">
            Temporal navigation beyond linear time achieved
          </div>
        </div>
      )}
    </section>
  );
};

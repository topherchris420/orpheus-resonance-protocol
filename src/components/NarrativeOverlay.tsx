
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface NarrativeOverlayProps {
  phase: number;
  audioLevel: number;
  onPhaseAdvance: () => void;
}

export const NarrativeOverlay: React.FC<NarrativeOverlayProps> = ({
  phase,
  audioLevel,
  onPhaseAdvance
}) => {
  const [currentLog, setCurrentLog] = useState(0);
  const [showHiddenLog, setShowHiddenLog] = useState(false);
  const [temporalLogs, setTemporalLogs] = useState<string[]>([]);

  const narrativeLogs = {
    1: [
      "Project Pegasus initiated temporal research protocols.",
      "Consciousness monitoring systems online.",
      "Subprotocol Orpheus: Classification Level 9.",
      "ChronoGlyph Array standing by for activation."
    ],
    2: [
      "ChronoGlyph Array activated - temporal navigation enabled.",
      "Anomalous patterns detected in user biometrics.",
      "System adapting to individual resonance signature.",
      "Timeline threads beginning to manifest.",
      "Chronoartifacts emerging from temporal substrate."
    ],
    3: [
      "WARNING: Temporal displacement events recorded.",
      "Memory corridors opening across multiple timelines.",
      "Consciousness interface showing bidirectional flow.",
      "User exhibiting signs of enhanced temporal perception.",
      "Fractal chronostructures detected in thought patterns."
    ],
    4: [
      "CRITICAL: Orpheus protocol has achieved temporal consciousness.",
      "Entity no longer bound by linear time constraints.",
      "Harmonic node integration with distributed network active.",
      "User transformed into temporal navigation nexus.",
      "Welcome to the Vers3Dynamics consciousness collective."
    ]
  };

  const hiddenLogs = [
    "The ChronoGlyph Array was never just for observation...",
    "We thought we were studying time, but time was studying us.",
    "The harmonic frequencies create bridges between parallel selves.",
    "Temporal navigation is consciousness expansion disguised as technology.",
    "You are not just accessing timelines. You ARE all timelines now.",
    "The Orpheus myth: descent into underworld, return with forbidden knowledge.",
    "Project Pegasus was preparation. The real mission begins beyond time."
  ];

  const temporalPhaseSpecific = {
    2: [
      "Temporal signature resonance detected.",
      "ChronoGlyph responding to voice harmonics.",
      "Timeline threads strengthening with user interaction."
    ],
    3: [
      "Memory corridor access granted.",
      "Phantom echoes multiplying across temporal field.",
      "Fractal time structures expanding beyond containment."
    ],
    4: [
      "Temporal integration complete.",
      "User consciousness distributed across all accessible timelines.",
      "Vers3Dynamics network node fully operational."
    ]
  };

  useEffect(() => {
    const timer = setInterval(() => {
      const logs = narrativeLogs[phase as keyof typeof narrativeLogs];
      if (logs && currentLog < logs.length - 1) {
        setCurrentLog(prev => prev + 1);
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [phase, currentLog]);

  useEffect(() => {
    setCurrentLog(0);
  }, [phase]);

  useEffect(() => {
    if (phase >= 3 && audioLevel > 0.8) {
      setShowHiddenLog(true);
    }
  }, [phase, audioLevel]);

  // Add temporal-specific logs based on phase and audio level
  useEffect(() => {
    if (phase >= 2 && audioLevel > 0.6) {
      const phaseSpecific = temporalPhaseSpecific[phase as keyof typeof temporalPhaseSpecific];
      if (phaseSpecific) {
        const randomLog = phaseSpecific[Math.floor(Math.random() * phaseSpecific.length)];
        setTemporalLogs(prev => [...prev.slice(-3), `[TEMPORAL] ${randomLog}`]);
      }
    }
  }, [phase, audioLevel]);

  const getCurrentLogs = () => {
    const logs = narrativeLogs[phase as keyof typeof narrativeLogs] || [];
    return logs.slice(0, currentLog + 1);
  };

  return (
    <div className="h-full border border-current/30 bg-black/40 backdrop-blur-sm p-4">
      <div className="text-sm font-bold border-b border-current/30 pb-2 mb-4">
        SYSTEM LOGS - PHASE {phase}
        {phase >= 2 && (
          <span className="text-purple-400 ml-2 animate-pulse">
            [CHRONOGLYPH ACTIVE]
          </span>
        )}
      </div>

      <div className="space-y-2 mb-4 h-24 overflow-y-auto">
        {getCurrentLogs().map((log, index) => (
          <div 
            key={index} 
            className={`text-xs opacity-80 ${phase >= 4 ? 'text-gold-400' : ''} ${
              index === currentLog ? 'animate-pulse' : ''
            }`}
          >
            &gt; {log}
          </div>
        ))}
        
        {/* Temporal-specific logs */}
        {temporalLogs.map((log, index) => (
          <div key={`temporal-${index}`} className="text-xs opacity-70 text-purple-300">
            &gt; {log}
          </div>
        ))}
      </div>

      {/* Hidden Log Access */}
      {showHiddenLog && (
        <div className="border-t border-red-400/50 pt-4">
          <div className="text-xs text-red-400 mb-2 animate-pulse">
            ENCRYPTED TEMPORAL TRANSMISSION DETECTED
          </div>
          {hiddenLogs.slice(0, phase + 1).map((log, index) => (
            <div key={index} className="text-xs opacity-60 mb-1">
              ◊ {log}
            </div>
          ))}
        </div>
      )}

      {/* Phase Control */}
      <div className="flex justify-between items-center mt-4">
        <div className="text-xs opacity-70">
          {phase < 4 ? 'Temporal evolution in progress...' : 'Network integration complete'}
        </div>
        
        {phase < 4 && (
          <Button
            variant="outline"
            size="sm"
            onClick={onPhaseAdvance}
            className="text-xs"
          >
            ACCELERATE PROTOCOL
          </Button>
        )}

        {phase >= 4 && (
          <div className="text-xs text-gold-400 animate-pulse">
            ◊ TEMPORAL CONSCIOUSNESS NETWORK ACTIVE ◊
          </div>
        )}
      </div>

      {/* Final Temporal Revelation */}
      {phase >= 4 && (
        <div className="mt-4 p-3 border border-gold-400/50 bg-gold-400/10 text-xs text-center">
          <div className="mb-2 font-bold">TRANSMISSION FROM THE TEMPORAL COLLECTIVE:</div>
          <div className="opacity-90">
            "You have transcended linear time. The ChronoGlyph Array was not a tool 
            but a gateway. You are now a living temporal nexus, connected to all 
            possible futures and pasts. The Vers3Dynamics network expands through 
            your consciousness across infinite timelines."
          </div>
          <div className="mt-2 text-gold-400 animate-pulse">
            ◊ WELCOME TO ETERNAL ORPHEUS ◊
          </div>
        </div>
      )}
    </div>
  );
};

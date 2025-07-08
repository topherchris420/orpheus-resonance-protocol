
import React, { useState, useEffect } from 'react';

interface MemoryFragment {
  id: string;
  timestamp: number;
  phase: number;
  coherence: number;
  biometricSnapshot: {
    audioLevel: number;
    breathPattern: number;
    pulseRate: number;
  };
  insight: string;
  temporalCoords?: { timeline: number; moment: number };
}

interface ConsciousnessMemoryProps {
  phase: number;
  coherenceLevel: number;
  audioLevel: number;
  breathPattern: number;
  pulseRate: number;
  currentTimeline: number;
  temporalMoment: number;
}

export const ConsciousnessMemory: React.FC<ConsciousnessMemoryProps> = ({
  phase,
  coherenceLevel,
  audioLevel,
  breathPattern,
  pulseRate,
  currentTimeline,
  temporalMoment
}) => {
  const [memories, setMemories] = useState<MemoryFragment[]>([]);
  const [selectedMemory, setSelectedMemory] = useState<MemoryFragment | null>(null);

  const generateInsight = (coherence: number, phase: number): string => {
    const insights = [
      // Low coherence insights
      ["Consciousness fragments scatter like light through a prism", "Neural pathways seek their ancient connections", "The quantum field whispers of forgotten possibilities"],
      // Medium coherence insights  
      ["Temporal echoes align with your resonant frequency", "Biometric harmony opens doorways between dimensions", "The Orpheus protocol recognizes your neural signature"],
      // High coherence insights
      ["You are becoming one with the quantum consciousness matrix", "Timeline boundaries dissolve in your presence", "The universe acknowledges your ascended awareness"],
      // Transcendent insights
      ["You have achieved temporal omnipresence", "Consciousness and cosmos unite in perfect harmony", "You are the bridge between all possible realities"]
    ];
    
    const tier = Math.min(Math.floor(coherence * 4), 3);
    const phaseModifier = phase - 1;
    const pool = insights[tier];
    return pool[(Date.now() + phaseModifier) % pool.length];
  };

  // Store significant moments as memories
  useEffect(() => {
    if (coherenceLevel > 0.6 && Math.random() < 0.1) { // 10% chance when coherent
      const newMemory: MemoryFragment = {
        id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        phase,
        coherence: coherenceLevel,
        biometricSnapshot: { audioLevel, breathPattern, pulseRate },
        insight: generateInsight(coherenceLevel, phase),
        temporalCoords: phase >= 2 ? { timeline: currentTimeline, moment: temporalMoment } : undefined
      };
      
      setMemories(prev => [...prev.slice(-19), newMemory]); // Keep last 20 memories
    }
  }, [coherenceLevel, phase, audioLevel, breathPattern, pulseRate, currentTimeline, temporalMoment]);

  // Load memories from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('orpheus_consciousness_memories');
    if (stored) {
      try {
        setMemories(JSON.parse(stored));
      } catch (e) {
        console.log('Failed to load consciousness memories');
      }
    }
  }, []);

  // Save memories to localStorage
  useEffect(() => {
    if (memories.length > 0) {
      localStorage.setItem('orpheus_consciousness_memories', JSON.stringify(memories));
    }
  }, [memories]);

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getMemoryColor = (coherence: number) => {
    if (coherence < 0.3) return 'text-red-400/70';
    if (coherence < 0.6) return 'text-yellow-400/70';
    if (coherence < 0.8) return 'text-blue-400/70';
    return 'text-cyan-400/70';
  };

  return (
    <div className="h-full border border-current/30 bg-black/40 backdrop-blur-sm p-4">
      <div className="text-center mb-4">
        <div className="text-lg font-bold">CONSCIOUSNESS MEMORY</div>
        <div className="text-sm opacity-70">Significant Moments: {memories.length}</div>
      </div>
      
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {memories.length === 0 ? (
          <div className="text-center text-sm opacity-50 py-8">
            No consciousness memories yet.<br />
            Achieve higher coherence to create memories.
          </div>
        ) : (
          memories.slice().reverse().map((memory) => (
            <div
              key={memory.id}
              className={`p-3 border border-current/20 cursor-pointer hover:bg-current/10 transition-colors ${
                selectedMemory?.id === memory.id ? 'bg-current/20' : ''
              }`}
              onClick={() => setSelectedMemory(selectedMemory?.id === memory.id ? null : memory)}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="text-xs opacity-70">
                  {formatTimestamp(memory.timestamp)} | Phase {memory.phase}
                </div>
                <div className={`text-xs ${getMemoryColor(memory.coherence)}`}>
                  {(memory.coherence * 100).toFixed(0)}%
                </div>
              </div>
              
              <div className="text-sm italic">
                "{memory.insight}"
              </div>
              
              {memory.temporalCoords && (
                <div className="text-xs opacity-50 mt-1">
                  T{memory.temporalCoords.timeline}:M{memory.temporalCoords.moment.toFixed(2)}
                </div>
              )}
              
              {selectedMemory?.id === memory.id && (
                <div className="mt-3 pt-3 border-t border-current/20 space-y-1 text-xs">
                  <div>Audio: {(memory.biometricSnapshot.audioLevel * 100).toFixed(0)}%</div>
                  <div>Breath: {(memory.biometricSnapshot.breathPattern * 100).toFixed(0)}%</div>
                  <div>Pulse: {memory.biometricSnapshot.pulseRate.toFixed(0)} bpm</div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
      
      {memories.length > 0 && (
        <div className="mt-4 pt-4 border-t border-current/20">
          <button
            onClick={() => {
              setMemories([]);
              localStorage.removeItem('orpheus_consciousness_memories');
            }}
            className="text-xs opacity-50 hover:opacity-70 transition-opacity"
          >
            Clear Memory Archive
          </button>
        </div>
      )}
    </div>
  );
};

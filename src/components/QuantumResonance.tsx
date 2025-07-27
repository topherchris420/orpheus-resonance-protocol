
import React, { useEffect, useState, useRef } from 'react';

interface QuantumResonanceProps {
  audioLevel: number;
  breathPattern: number;
  pulseRate: number;
  phase: number;
  touchPoints: Array<{x: number, y: number, intensity: number}>;
  onCoherenceChange: (coherence: number) => void;
}

export const QuantumResonance: React.FC<QuantumResonanceProps> = ({
  audioLevel,
  breathPattern,
  pulseRate,
  phase,
  touchPoints,
  onCoherenceChange
}) => {
  const [coherenceLevel, setCoherenceLevel] = useState(0);
  const [quantumField, setQuantumField] = useState<Array<{x: number, y: number, energy: number}>>([]);
  const [resonanceHistory, setResonanceHistory] = useState<number[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  // Calculate consciousness coherence from biometric harmony
  useEffect(() => {
    const breathSync = Math.abs(breathPattern - 0.5) * 2; // 0-1 where 0.5 breath is most coherent
    const pulseCoherence = Math.max(0, 1 - Math.abs(pulseRate - 72) / 48); // Optimal around 72 bpm
    const audioBalance = Math.min(audioLevel * 2, 1); // Balanced audio engagement
    const touchHarmony = touchPoints.length > 0 ? Math.min(touchPoints.length / 5, 1) : 0;
    
    const rawCoherence = (breathSync + pulseCoherence + audioBalance + touchHarmony) / 4;
    const phaseBonus = phase >= 3 ? 0.2 : 0; // Bonus for advanced phases
    const finalCoherence = Math.min(rawCoherence + phaseBonus, 1);
    
    setCoherenceLevel(finalCoherence);
    onCoherenceChange(finalCoherence);
    
    // Update resonance history
    setResonanceHistory(prev => [...prev.slice(-99), finalCoherence]);
  }, [audioLevel, breathPattern, pulseRate, touchPoints, phase, onCoherenceChange]);

  // Generate quantum field visualization
  useEffect(() => {
    const fieldPoints = Array.from({ length: 20 }, (_, i) => ({
      x: Math.random(),
      y: Math.random(),
      energy: coherenceLevel * Math.random()
    }));
    setQuantumField(fieldPoints);
  }, [coherenceLevel]);

  // Canvas animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw quantum field
      quantumField.forEach((point, i) => {
        const x = point.x * canvas.width;
        const y = point.y * canvas.height;
        const radius = point.energy * 20 + 2;
        
        // Quantum particle
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${180 + coherenceLevel * 180}, 70%, 50%, ${point.energy})`;
        ctx.fill();
        
        // Entanglement lines
        quantumField.forEach((other, j) => {
          if (i < j && Math.random() < coherenceLevel * 0.1) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(other.x * canvas.width, other.y * canvas.height);
            ctx.strokeStyle = `hsla(${240 + coherenceLevel * 120}, 60%, 60%, ${coherenceLevel * 0.3})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        });
      });
      
      // Draw coherence waveform
      if (resonanceHistory.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = `hsla(${120 + coherenceLevel * 240}, 80%, 60%, 0.8)`;
        ctx.lineWidth = 2;
        
        resonanceHistory.forEach((value, i) => {
          const x = (i / resonanceHistory.length) * canvas.width;
          const y = canvas.height - (value * canvas.height * 0.3) - 20;
          
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [quantumField, resonanceHistory, coherenceLevel]);

  const getCoherenceLabel = () => {
    if (coherenceLevel < 0.2) return "QUANTUM NOISE";
    if (coherenceLevel < 0.4) return "STABILIZING";
    if (coherenceLevel < 0.6) return "COHERENT";
    if (coherenceLevel < 0.8) return "RESONANT";
    return "QUANTUM ENTANGLED";
  };

  const getCoherenceColor = () => {
    if (coherenceLevel < 0.2) return "text-red-400";
    if (coherenceLevel < 0.4) return "text-yellow-400";
    if (coherenceLevel < 0.6) return "text-blue-400";
    if (coherenceLevel < 0.8) return "text-purple-400";
    return "text-cyan-400";
  };

  return (
    <div className="h-full border border-current/30 bg-black/40 backdrop-blur-sm p-4 relative overflow-hidden">
      <div className="text-center mb-4">
        <div className="text-lg font-bold mb-2">QUANTUM RESONANCE</div>
        <div className={`text-2xl font-mono ${getCoherenceColor()} animate-pulse`}>
          {getCoherenceLabel()}
        </div>
        <div className="text-sm opacity-70 mt-1">
          Coherence: {(coherenceLevel * 100).toFixed(1)}%
        </div>
      </div>
      
      <canvas
        ref={canvasRef}
        width={300}
        height={200}
        className="w-full h-32 border border-current/20 bg-black/20"
      />
      
      <div className="mt-4 space-y-2 text-xs">
        <div className="flex justify-between">
          <span>Breath Sync:</span>
          <span className={breathPattern > 0.4 && breathPattern < 0.6 ? 'text-green-400' : 'text-yellow-400'}>
            {((1 - Math.abs(breathPattern - 0.5) * 2) * 100).toFixed(0)}%
          </span>
        </div>
        <div className="flex justify-between">
          <span>Pulse Harmony:</span>
          <span className={Math.abs(pulseRate - 72) < 12 ? 'text-green-400' : 'text-yellow-400'}>
            {(Math.max(0, 1 - Math.abs(pulseRate - 72) / 48) * 100).toFixed(0)}%
          </span>
        </div>
        <div className="flex justify-between">
          <span>Audio Balance:</span>
          <span className={audioLevel > 0.3 && audioLevel < 0.7 ? 'text-green-400' : 'text-yellow-400'}>
            {(Math.min(audioLevel * 2, 1) * 100).toFixed(0)}%
          </span>
        </div>
        <div className="flex justify-between">
          <span>Touch Nodes:</span>
          <span className={touchPoints.length > 0 ? 'text-green-400' : 'text-gray-400'}>
            {touchPoints.length}/5
          </span>
        </div>
      </div>
      
      {coherenceLevel > 0.8 && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-radial from-cyan-500/10 via-transparent to-transparent animate-pulse" />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-4xl animate-spin-slow opacity-30">
            ◊
          </div>
        </div>
      )}
    </div>
  );
};


import React, { useEffect, useState, useRef } from 'react';

interface SquadCohesionIndexProps {
  squadVitals: Array<{ hrv: number; respiratoryRate: number; cognitiveStressIndex: number }>;
  communicationEfficiency: number;
  onCohesionChange: (cohesion: number) => void;
}

export const SquadCohesionIndex: React.FC<SquadCohesionIndexProps> = React.memo(({
  squadVitals,
  communicationEfficiency,
  onCohesionChange,
}) => {
  const [cohesionScore, setCohesionScore] = useState(0);
  const [squadField, setSquadField] = useState<Array<{x: number, y: number, energy: number}>>([]);
  const [cohesionHistory, setCohesionHistory] = useState<number[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    const avgStress = squadVitals.reduce((acc, val) => acc + val.cognitiveStressIndex, 0) / squadVitals.length;
    const stressCohesion = 1 - avgStress;

    const finalCohesion = (stressCohesion + communicationEfficiency) / 2;

    setCohesionScore(finalCohesion);
    onCohesionChange(finalCohesion);

    setCohesionHistory(prev => [...prev.slice(-99), finalCohesion]);
  }, [squadVitals, communicationEfficiency, onCohesionChange]);

  useEffect(() => {
    const fieldPoints = Array.from({ length: squadVitals.length }, (_, i) => ({
      x: Math.random(),
      y: Math.random(),
      energy: cohesionScore * (1 - squadVitals[i].cognitiveStressIndex)
    }));
    setSquadField(fieldPoints);
  }, [cohesionScore, squadVitals]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      squadField.forEach((point, i) => {
        const x = point.x * canvas.width;
        const y = point.y * canvas.height;
        const radius = point.energy * 15 + 2;

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${120 + cohesionScore * 120}, 70%, 50%, ${point.energy})`;
        ctx.fill();

        squadField.forEach((other, j) => {
          if (i < j && Math.random() < cohesionScore * 0.5) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(other.x * canvas.width, other.y * canvas.height);
            ctx.strokeStyle = `hsla(180, 60%, 60%, ${cohesionScore * 0.3})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        });
      });

      if (cohesionHistory.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = `hsla(210, 80%, 60%, 0.8)`;
        ctx.lineWidth = 2;

        cohesionHistory.forEach((value, i) => {
          const x = (i / cohesionHistory.length) * canvas.width;
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
  }, [squadField, cohesionHistory, cohesionScore]);

  const getCohesionLabel = () => {
    if (cohesionScore < 0.2) return "SIGNAL DISJOINTED";
    if (cohesionScore < 0.4) return "SYNCHRONIZING";
    if (cohesionScore < 0.6) return "COHESIVE";
    if (cohesionScore < 0.8) return "BATTLE-READY";
    return "UNITARY COHESION";
  };

  const getCohesionColor = () => {
    if (cohesionScore < 0.2) return "text-red-400";
    if (cohesionScore < 0.4) return "text-yellow-400";
    if (cohesionScore < 0.6) return "text-green-400";
    if (cohesionScore < 0.8) return "text-blue-400";
    return "text-cyan-400";
  };

  return (
    <div className="h-full border border-current/30 bg-black/40 backdrop-blur-sm p-4 relative overflow-hidden">
      <div className="text-center mb-4">
        <div className="text-lg font-bold mb-2">SQUAD COHESION INDEX</div>
        <div className={`text-2xl font-mono ${getCohesionColor()} animate-pulse`}>
          {getCohesionLabel()}
        </div>
        <div className="text-sm opacity-70 mt-1">
          Cohesion Score: {(cohesionScore * 100).toFixed(1)}%
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
          <span>Avg. Squad Stress:</span>
          <span className={(squadVitals.reduce((acc, val) => acc + val.cognitiveStressIndex, 0) / squadVitals.length) > 0.5 ? 'text-red-400' : 'text-green-400'}>
            {((squadVitals.reduce((acc, val) => acc + val.cognitiveStressIndex, 0) / squadVitals.length) * 100).toFixed(0)}%
          </span>
        </div>
        <div className="flex justify-between">
          <span>Comm. Efficiency:</span>
          <span className={communicationEfficiency > 0.7 ? 'text-green-400' : 'text-yellow-400'}>
            {(communicationEfficiency * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      {cohesionScore > 0.8 && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-radial from-cyan-500/10 via-transparent to-transparent animate-pulse" />
        </div>
      )}
    </div>
  );
});

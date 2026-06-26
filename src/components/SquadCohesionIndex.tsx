import React, { useEffect, useRef, useState } from 'react';

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
  const [squadField, setSquadField] = useState<Array<{ x: number; y: number; energy: number }>>([]);
  const [cohesionHistory, setCohesionHistory] = useState<number[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  const avgStress = squadVitals.reduce((acc, val) => acc + val.cognitiveStressIndex, 0) / squadVitals.length;

  useEffect(() => {
    const stressCohesion = 1 - avgStress;
    const finalCohesion = (stressCohesion + communicationEfficiency) / 2;

    setCohesionScore(finalCohesion);
    onCohesionChange(finalCohesion);
    setCohesionHistory((prev) => [...prev.slice(-99), finalCohesion]);
  }, [avgStress, communicationEfficiency, onCohesionChange]);

  useEffect(() => {
    const fieldPoints = Array.from({ length: squadVitals.length }, (_, i) => ({
      x: Math.random(),
      y: Math.random(),
      energy: cohesionScore * (1 - squadVitals[i].cognitiveStressIndex),
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
          if (i < j && Math.random() < cohesionScore * 0.4) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(other.x * canvas.width, other.y * canvas.height);
            ctx.strokeStyle = `hsla(180, 60%, 60%, ${cohesionScore * 0.22})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        });
      });

      if (cohesionHistory.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(125, 211, 252, 0.8)';
        ctx.lineWidth = 2;

        cohesionHistory.forEach((value, i) => {
          const x = (i / cohesionHistory.length) * canvas.width;
          const y = canvas.height - value * canvas.height * 0.35 - 16;

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
    if (cohesionScore < 0.2) return 'SIGNAL DISJOINTED';
    if (cohesionScore < 0.4) return 'SYNCHRONIZING';
    if (cohesionScore < 0.6) return 'COHESIVE';
    if (cohesionScore < 0.8) return 'BATTLE-READY';
    return 'UNITARY COHESION';
  };

  const getCohesionColor = () => {
    if (cohesionScore < 0.2) return 'text-red-300';
    if (cohesionScore < 0.4) return 'text-amber-300';
    if (cohesionScore < 0.6) return 'text-emerald-300';
    if (cohesionScore < 0.8) return 'text-sky-300';
    return 'text-cyan-200';
  };

  const getCohesionRecommendation = () => {
    if (cohesionScore < 0.35) return 'Stabilize comms before movement.';
    if (communicationEfficiency < 0.65) return 'Route around interference and confirm squad acknowledgements.';
    if (cohesionScore > 0.8) return 'Unit is ready for synchronized action.';
    return 'Maintain cadence and monitor drift.';
  };

  return (
    <div className="h-full border border-current/25 bg-black/45 backdrop-blur-sm p-4 relative overflow-hidden">
      <div className="text-center mb-3">
        <div className="text-sm font-bold uppercase">Squad Cohesion</div>
        <div className={`mt-1 text-xl font-mono ${getCohesionColor()}`}>
          {getCohesionLabel()}
        </div>
        <div className="text-xs opacity-70 mt-1">
          Cohesion Score: {(cohesionScore * 100).toFixed(1)}%
        </div>
        <div className="mt-2 border border-current/15 bg-white/[0.03] px-2 py-1 text-xs text-current/70">
          {getCohesionRecommendation()}
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={300}
        height={200}
        className="w-full h-32 border border-current/20 bg-black/20"
      />

      <div className="mt-3 space-y-2 text-xs">
        <div className="flex justify-between">
          <span>Avg. Squad Stress:</span>
          <span className={avgStress > 0.5 ? 'text-red-300' : 'text-emerald-300'}>
            {(avgStress * 100).toFixed(0)}%
          </span>
        </div>
        <div className="flex justify-between">
          <span>Comm. Efficiency:</span>
          <span className={communicationEfficiency > 0.7 ? 'text-emerald-300' : 'text-amber-300'}>
            {(communicationEfficiency * 100).toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  );
});
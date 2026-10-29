import React, { useEffect, useRef } from 'react';
import { MAP_SIZE } from '@/engine/mission/world';

interface SquadCohesionIndexProps {
  /** Each member at their map position, with the modeled stress used for cohesion. */
  members: Array<{ callSign: string; x: number; y: number; stress: number }>;
  communicationEfficiency: number;
  cohesion: number;
  /** Recent cohesion samples, oldest first. */
  history: number[];
}

const getCohesionLabel = (cohesion: number) => {
  if (cohesion < 0.2) return 'SIGNAL DISJOINTED';
  if (cohesion < 0.4) return 'SYNCHRONIZING';
  if (cohesion < 0.6) return 'COHESIVE';
  if (cohesion < 0.8) return 'BATTLE-READY';
  return 'UNITARY COHESION';
};

const getCohesionColor = (cohesion: number) => {
  if (cohesion < 0.2) return 'text-red-300';
  if (cohesion < 0.4) return 'text-amber-300';
  if (cohesion < 0.6) return 'text-emerald-300';
  if (cohesion < 0.8) return 'text-sky-300';
  return 'text-cyan-200';
};

const getCohesionRecommendation = (cohesion: number, communicationEfficiency: number) => {
  if (cohesion < 0.35) return 'Stabilize comms before movement.';
  if (communicationEfficiency < 0.65) return 'Route around interference and confirm squad acknowledgements.';
  if (cohesion > 0.8) return 'Unit is ready for synchronized action.';
  return 'Maintain cadence and monitor drift.';
};

/**
 * Squad cohesion field: each member sits at their map position, sized by how much they contribute to
 * cohesion, with links whose strength follows the model. Drawn when the data change; no animation loop
 * and no randomness, so the same state always draws the same picture.
 */
export const SquadCohesionIndex: React.FC<SquadCohesionIndexProps> = React.memo(({ members, communicationEfficiency, cohesion, history }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const avgStress = members.reduce((sum, member) => sum + member.stress, 0) / (members.length || 1);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    const points = members.map((member) => ({
      x: 12 + (member.x / MAP_SIZE) * (width - 24),
      y: 12 + (member.y / MAP_SIZE) * (height - 56),
      energy: cohesion * (1 - member.stress),
    }));

    // Links: every pair, at an opacity that follows cohesion and the two members' energy.
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const strength = cohesion * Math.min(points[i].energy, points[j].energy) * 2;
        if (strength < 0.1) continue;
        ctx.beginPath();
        ctx.moveTo(points[i].x, points[i].y);
        ctx.lineTo(points[j].x, points[j].y);
        ctx.strokeStyle = `hsla(180, 60%, 60%, ${Math.min(0.6, strength * 0.5)})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    for (const point of points) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, point.energy * 15 + 2, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${120 + cohesion * 120}, 70%, 50%, ${Math.max(0.25, point.energy)})`;
      ctx.fill();
    }

    if (history.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.8)';
      ctx.lineWidth = 2;
      history.forEach((value, index) => {
        const x = (index / (history.length - 1)) * width;
        const y = height - value * height * 0.35 - 8;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
  }, [members, cohesion, history]);

  return (
    <section aria-labelledby="cohesion-heading" tabIndex={0} className="relative h-full overflow-y-auto border border-current/25 bg-black/45 p-4">
      <div className="mb-3 text-center">
        <h2 id="cohesion-heading" className="text-sm font-bold uppercase">
          Squad Cohesion
        </h2>
        <div className={`mt-1 font-mono text-xl ${getCohesionColor(cohesion)}`} aria-live="polite">
          {getCohesionLabel(cohesion)}
        </div>
        <div className="mt-1 text-xs text-current/80">Cohesion Score: {(cohesion * 100).toFixed(1)}%</div>
        <div className="mt-2 border border-current/15 bg-white/[0.03] px-2 py-1 text-xs text-current/85">{getCohesionRecommendation(cohesion, communicationEfficiency)}</div>
      </div>

      <canvas
        ref={canvasRef}
        width={300}
        height={200}
        role="img"
        aria-label={`Squad cohesion field for ${members.map((member) => member.callSign).join(', ')}; cohesion trend over the last ${history.length} samples.`}
        className="h-32 w-full border border-current/20 bg-black/20"
      />

      <div className="mt-3 space-y-2 text-xs">
        <div className="flex justify-between">
          <span>Avg. Squad Stress:</span>
          <span className={avgStress > 0.5 ? 'text-red-300' : 'text-emerald-300'}>{(avgStress * 100).toFixed(0)}%</span>
        </div>
        <div className="flex justify-between">
          <span>Comm. Efficiency:</span>
          <span className={communicationEfficiency > 0.7 ? 'text-emerald-300' : 'text-amber-300'}>{(communicationEfficiency * 100).toFixed(0)}%</span>
        </div>
      </div>
    </section>
  );
});

SquadCohesionIndex.displayName = 'SquadCohesionIndex';

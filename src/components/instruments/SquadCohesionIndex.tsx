import React, { useEffect, useRef } from 'react';
import { SignalBadge } from '@/components/common/ProvenanceBadge';

interface SquadCohesionIndexProps {
  members: Array<{ callSign: string; stress: number }>;
  communicationEfficiency: number;
  cohesion: number;
  history: number[];
}

const label = (cohesion: number) =>
  cohesion < 0.2 ? 'Disjointed' : cohesion < 0.4 ? 'Synchronizing' : cohesion < 0.6 ? 'Cohesive' : cohesion < 0.8 ? 'Strong' : 'Unified';

/**
 * Modeled squad cohesion. Members sit at fixed positions on a ring; link strength follows the model.
 * The canvas redraws only when the data change — no animation loop and no randomness.
 */
export const SquadCohesionIndex: React.FC<SquadCohesionIndexProps> = React.memo(({ members, communicationEfficiency, cohesion, history }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const averageStress = members.length ? members.reduce((sum, member) => sum + member.stress, 0) / members.length : 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    const centre = { x: width / 2, y: height * 0.42 };
    const radius = Math.min(width, height) * 0.28;
    const points = members.map((member, index) => {
      const angle = (index / Math.max(1, members.length)) * Math.PI * 2 - Math.PI / 2;
      return { x: centre.x + Math.cos(angle) * radius, y: centre.y + Math.sin(angle) * radius, member };
    });
    ctx.lineWidth = 1.5;
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const strength = cohesion * (1 - (points[i].member.stress + points[j].member.stress) / 2);
        ctx.strokeStyle = `rgba(84, 224, 202, ${Math.max(0.08, strength * 0.7)})`;
        ctx.beginPath();
        ctx.moveTo(points[i].x, points[i].y);
        ctx.lineTo(points[j].x, points[j].y);
        ctx.stroke();
      }
    }
    for (const point of points) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 5 + (1 - point.member.stress) * 6, 0, Math.PI * 2);
      ctx.fillStyle = point.member.stress > 0.6 ? 'rgba(250, 200, 92, 0.9)' : 'rgba(84, 224, 202, 0.9)';
      ctx.fill();
      ctx.fillStyle = 'rgba(230, 240, 244, 0.85)';
      ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText(point.member.callSign, point.x + 10, point.y + 4);
    }
    if (history.length > 1) {
      ctx.strokeStyle = 'rgba(120, 182, 255, 0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      history.forEach((value, index) => {
        const x = (index / (history.length - 1)) * width;
        const y = height - 8 - value * height * 0.22;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
  }, [cohesion, history, members]);

  return (
    <section aria-label="Squad cohesion" className="h-full rounded-xl border border-o-line bg-o-s1 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-o-text">Squad cohesion</h3>
        <SignalBadge category="simulated" />
      </div>
      <p className="mt-2 text-xl font-semibold text-o-text">
        {label(cohesion)} <span className="font-mono text-base text-o-text2">{Math.round(cohesion * 100)}%</span>
      </p>
      <canvas
        ref={canvasRef}
        width={320}
        height={190}
        role="img"
        aria-label={`Modeled cohesion ${Math.round(cohesion * 100)} percent across ${members.length} fictional squad members; line chart of recent cohesion below.`}
        className="mt-2 h-36 w-full rounded-lg border border-o-line bg-o-bg/60"
      />
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-o-text3">
        <div>
          <dt>Average modeled stress</dt>
          <dd className="font-mono text-sm text-o-text">{Math.round(averageStress * 100)}%</dd>
        </div>
        <div>
          <dt>Communication efficiency</dt>
          <dd className="font-mono text-sm text-o-text">{Math.round(communicationEfficiency * 100)}%</dd>
        </div>
      </dl>
    </section>
  );
});

SquadCohesionIndex.displayName = 'SquadCohesionIndex';

import React, { useEffect, useMemo, useRef } from 'react';
import type { Point, SquadMember, Track } from '@/engine/mission/types';
import { MAP_SIZE } from '@/engine/mission/world';

interface TacticalDataDisplayProps {
  tracks: Track[];
  route: Point[];
  squad: SquadMember[];
  /** A fabricated contact shown while a red-team injection is live. */
  injectedContact?: boolean;
}

const COLORS = {
  hostile: 'rgba(248, 113, 113, 0.9)',
  unknown: 'rgba(251, 191, 36, 0.9)',
  friendly: 'rgba(16, 185, 129, 0.8)',
  squad: 'rgba(16, 185, 129, 0.85)',
  label: 'rgba(209, 250, 229, 0.9)',
  route: 'rgba(34, 211, 238, 0.75)',
  grid: 'rgba(255, 255, 255, 0.08)',
};

/** Hostile ▲, unknown ◆, friendly ■: the type reads from the shape as well as the color. Sizes in CSS pixels. */
const drawContact = (ctx: CanvasRenderingContext2D, kind: Track['kind'], x: number, y: number) => {
  ctx.beginPath();
  if (kind === 'hostile') {
    ctx.moveTo(x, y - 6);
    ctx.lineTo(x - 6, y + 6);
    ctx.lineTo(x + 6, y + 6);
  } else if (kind === 'unknown') {
    ctx.moveTo(x, y - 7);
    ctx.lineTo(x + 7, y);
    ctx.lineTo(x, y + 7);
    ctx.lineTo(x - 7, y);
  } else {
    ctx.rect(x - 5, y - 5, 10, 10);
  }
  ctx.closePath();
  ctx.fillStyle = COLORS[kind];
  ctx.fill();
};

export const TacticalDataDisplay: React.FC<TacticalDataDisplayProps> = React.memo(({ tracks, route, squad, injectedContact = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contacts = useMemo(
    () => (injectedContact ? [...tracks, { id: 'red-team-injection', kind: 'hostile' as const, x: MAP_SIZE / 2, y: MAP_SIZE / 2, quality: 90, updatedTick: 0 }] : tracks),
    [injectedContact, tracks],
  );
  const hostileCount = contacts.filter((track) => track.kind === 'hostile').length;
  const unknownCount = contacts.filter((track) => track.kind === 'unknown').length;
  const mapRecommendation = hostileCount >= 3 ? 'Re-route before movement.' : hostileCount > 0 ? 'Confirm path confidence.' : 'Path remains clear.';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Redrawn only when the picture or the element's size changes; there is no animation loop. The map
    // fills the panel: world positions scale to its width and height, symbols keep their pixel size.
    const draw = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      if (canvas.width !== Math.round(width * ratio)) canvas.width = Math.round(width * ratio);
      if (canvas.height !== Math.round(height * ratio)) canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const sx = width / MAP_SIZE;
      const sy = height / MAP_SIZE;

      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= MAP_SIZE; i += 20) {
        ctx.moveTo(Math.round(i * sx) + 0.5, 0);
        ctx.lineTo(Math.round(i * sx) + 0.5, height);
        ctx.moveTo(0, Math.round(i * sy) + 0.5);
        ctx.lineTo(width, Math.round(i * sy) + 0.5);
      }
      ctx.stroke();

      if (route.length > 0) {
        ctx.strokeStyle = COLORS.route;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(route[0].x * sx, route[0].y * sy);
        for (let i = 1; i < route.length; i++) ctx.lineTo(route[i].x * sx, route[i].y * sy);
        ctx.stroke();
      }

      ctx.font = '11px monospace';
      for (const member of squad) {
        const x = member.x * sx;
        const y = member.y * sy;
        ctx.fillStyle = member.status === 'wounded' ? COLORS.unknown : COLORS.squad;
        ctx.globalAlpha = member.status === 'offline' ? 0.4 : 1;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = COLORS.label;
        ctx.fillText(member.status === 'active' ? member.callSign : `${member.callSign} ${member.status.toUpperCase()}`, x + 8, y - 8);
        ctx.globalAlpha = 1;
      }

      for (const contact of contacts) drawContact(ctx, contact.kind, contact.x * sx, contact.y * sy);
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [contacts, route, squad]);

  const wounded = squad.filter((member) => member.status !== 'active').map((member) => `${member.callSign} ${member.status}`);

  return (
    <div className="relative h-full w-full overflow-hidden border border-current/25 bg-black/45">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Tactical map: ${hostileCount} hostile, ${unknownCount} unknown and ${contacts.length - hostileCount - unknownCount} friendly contacts; squad of ${squad.length}${wounded.length ? ` (${wounded.join(', ')})` : ''}. The cyan line is the planned route.`}
        className="block h-full w-full"
      />
      <div className="absolute left-2 top-2 border border-current/20 bg-black/70 px-3 py-2 text-xs">
        <h2 className="font-bold uppercase">Tactical Map</h2>
        <div className="mt-1 text-current/80">{mapRecommendation}</div>
      </div>
      <div className="absolute bottom-2 right-2 grid grid-cols-3 gap-1 text-[10px] uppercase" aria-hidden="true">
        <span className="border border-red-400/30 bg-red-500/10 px-2 py-1 text-red-200" title="Hostile contacts (▲)">H {hostileCount}</span>
        <span className="border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-amber-200" title="Unknown contacts (◆)">U {unknownCount}</span>
        <span className="border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-emerald-200" title="Squad members (●)">S {squad.length}</span>
      </div>
    </div>
  );
});

TacticalDataDisplay.displayName = 'TacticalDataDisplay';

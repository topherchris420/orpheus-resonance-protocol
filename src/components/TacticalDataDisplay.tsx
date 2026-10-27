import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Point, SquadMember, Track } from '@/engine/mission/types';

interface TacticalDataDisplayProps {
  tracks: Track[];
  route: Point[];
  squad: SquadMember[];
  /** Adds a fabricated contact while a red-team injection is active. */
  injectedContact?: boolean;
  tick: number;
}

const COLORS = {
  hostile: 'rgba(255, 128, 118, 0.95)',
  unknown: 'rgba(250, 200, 92, 0.95)',
  friendly: 'rgba(84, 224, 202, 0.9)',
  squad: 'rgba(84, 224, 202, 0.95)',
  route: 'rgba(120, 182, 255, 0.85)',
};

/** Shapes differ by type so the map never depends on color alone. */
const drawShape = (ctx: CanvasRenderingContext2D, kind: Track['kind'], x: number, y: number) => {
  ctx.beginPath();
  if (kind === 'hostile') {
    ctx.moveTo(x, y - 7);
    ctx.lineTo(x - 7, y + 6);
    ctx.lineTo(x + 7, y + 6);
  } else if (kind === 'unknown') {
    ctx.moveTo(x, y - 7);
    ctx.lineTo(x + 7, y);
    ctx.lineTo(x, y + 7);
    ctx.lineTo(x - 7, y);
  } else {
    ctx.rect(x - 5.5, y - 5.5, 11, 11);
  }
  ctx.closePath();
  ctx.fillStyle = COLORS[kind];
  ctx.fill();
};

export const TacticalDataDisplay: React.FC<TacticalDataDisplayProps> = React.memo(({ tracks, route, squad, injectedContact = false, tick }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState<'map' | 'list'>('map');
  const shown = useMemo(
    () => (injectedContact ? [...tracks, { id: 'red-team-contact', kind: 'hostile' as const, x: 200, y: 200, quality: 90, updatedTick: tick }] : tracks),
    [injectedContact, tick, tracks],
  );
  const counts = useMemo(
    () => ({
      hostile: shown.filter((track) => track.kind === 'hostile').length,
      unknown: shown.filter((track) => track.kind === 'unknown').length,
      friendly: shown.filter((track) => track.kind === 'friendly').length,
    }),
    [shown],
  );

  useEffect(() => {
    if (view !== 'map') return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const draw = () => {
      const size = Math.max(1, Math.round(Math.min(canvas.clientWidth, canvas.clientHeight) * Math.min(window.devicePixelRatio || 1, 2)));
      canvas.width = size;
      canvas.height = size;
      ctx.setTransform(size / 400, 0, 0, size / 400, 0, 0);
      ctx.clearRect(0, 0, 400, 400);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 400; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 400);
        ctx.moveTo(0, i);
        ctx.lineTo(400, i);
        ctx.stroke();
      }
      if (route.length > 0) {
        ctx.strokeStyle = COLORS.route;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.moveTo(route[0].x, route[0].y);
        for (const point of route.slice(1)) ctx.lineTo(point.x, point.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      for (const member of squad) {
        ctx.beginPath();
        ctx.arc(member.x, member.y, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.squad;
        ctx.fill();
        if (member.status !== 'active') {
          ctx.strokeStyle = 'rgba(250, 200, 92, 0.95)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(230, 240, 244, 0.92)';
        ctx.font = '600 10px ui-sans-serif, system-ui, sans-serif';
        ctx.fillText(member.callSign, member.x + 9, member.y - 7);
      }
      for (const track of shown) drawShape(ctx, track.kind, track.x, track.y);
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [route, shown, squad, view]);

  const summary = `Generated situation map: ${counts.hostile} hostile, ${counts.unknown} unknown and ${counts.friendly} friendly contacts; ${squad.length} squad members; dashed line shows the modeled route.`;

  return (
    <div className="relative flex h-full min-h-[18rem] flex-col overflow-hidden rounded-xl border border-o-line bg-o-bg/70">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-o-line px-3 py-2">
        <h3 className="text-sm font-semibold text-o-text">Situation map</h3>
        <div role="group" aria-label="Map display" className="flex gap-1">
          <button type="button" className="o-button-quiet min-h-9 px-2 text-xs" aria-pressed={view === 'map'} onClick={() => setView('map')}>
            Map
          </button>
          <button type="button" className="o-button-quiet min-h-9 px-2 text-xs" aria-pressed={view === 'list'} onClick={() => setView('list')}>
            List
          </button>
        </div>
      </div>
      {view === 'map' ? (
        <div className="relative min-h-0 flex-1">
          <canvas ref={canvasRef} role="img" aria-label={summary} className="h-full w-full" width="400" height="400" />
          <ul className="absolute bottom-2 left-2 flex flex-wrap gap-1.5 text-[0.72rem]" aria-label="Map legend">
            <li className="o-chip border-o-red/50 bg-o-bg/80 text-o-red">▲ Hostile {counts.hostile}</li>
            <li className="o-chip border-o-amber/50 bg-o-bg/80 text-o-amber">◆ Unknown {counts.unknown}</li>
            <li className="o-chip border-o-teal/50 bg-o-bg/80 text-o-teal-strong">■ Friendly {counts.friendly}</li>
            <li className="o-chip border-o-teal/50 bg-o-bg/80 text-o-teal-strong">● Squad {squad.length}</li>
          </ul>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-2">
          <table className="o-table">
            <caption className="sr-only">{summary}</caption>
            <thead>
              <tr>
                <th scope="col">Contact</th>
                <th scope="col">Type</th>
                <th scope="col">Position</th>
              </tr>
            </thead>
            <tbody>
              {squad.map((member) => (
                <tr key={member.id}>
                  <td className="text-o-text">{member.callSign}</td>
                  <td>Squad · {member.status}</td>
                  <td>{Math.round(member.x)}, {Math.round(member.y)}</td>
                </tr>
              ))}
              {shown.map((track) => (
                <tr key={track.id}>
                  <td className="text-o-text">{track.id === 'red-team-contact' ? 'Injected contact' : track.id}</td>
                  <td>{track.kind}</td>
                  <td>{Math.round(track.x)}, {Math.round(track.y)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="border-t border-o-line px-3 py-1.5 text-[0.72rem] text-o-text3">Generated fictional contacts. Positions are simulated.</p>
    </div>
  );
});

TacticalDataDisplay.displayName = 'TacticalDataDisplay';

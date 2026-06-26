import React, { useRef, useEffect, useMemo } from 'react';

interface TacticalDataDisplayProps {
  threatIndicators: Array<{ id: string; position: { x: number; y: number }; type: 'hostile' | 'unknown' | 'friendly'; confidence?: number }>;
  optimalPathing: Array<{ x: number; y: number }>;
  squadPositions: Array<{ id: string; position: { x: number; y: number } }>;
}

export const TacticalDataDisplay: React.FC<TacticalDataDisplayProps> = React.memo(({
  threatIndicators,
  optimalPathing,
  squadPositions,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostileCount = useMemo(() => threatIndicators.filter((threat) => threat.type === 'hostile').length, [threatIndicators]);
  const unknownCount = useMemo(() => threatIndicators.filter((threat) => threat.type === 'unknown').length, [threatIndicators]);
  const mapRecommendation = hostileCount >= 3
    ? 'Re-route before movement.'
    : hostileCount > 0
      ? 'Confirm path confidence.'
      : 'Path remains clear.';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      for (let i = 0; i < canvas.width; i += 20) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }
      for (let i = 0; i < canvas.height; i += 20) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
      }

      if (optimalPathing.length > 0) {
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.75)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(optimalPathing[0].x, optimalPathing[0].y);
        for (let i = 1; i < optimalPathing.length; i++) {
          ctx.lineTo(optimalPathing[i].x, optimalPathing[i].y);
        }
        ctx.stroke();
      }

      squadPositions.forEach((member) => {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.85)';
        ctx.beginPath();
        ctx.arc(member.position.x, member.position.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(209, 250, 229, 0.9)';
        ctx.font = '10px monospace';
        ctx.fillText(member.id, member.position.x + 8, member.position.y - 8);
      });

      threatIndicators.forEach((threat) => {
        if (threat.type === 'hostile') {
          ctx.fillStyle = 'rgba(248, 113, 113, 0.9)';
        } else if (threat.type === 'unknown') {
          ctx.fillStyle = 'rgba(251, 191, 36, 0.9)';
        } else {
          ctx.fillStyle = 'rgba(16, 185, 129, 0.75)';
        }
        ctx.beginPath();
        ctx.moveTo(threat.position.x, threat.position.y - 6);
        ctx.lineTo(threat.position.x - 6, threat.position.y + 6);
        ctx.lineTo(threat.position.x + 6, threat.position.y + 6);
        ctx.closePath();
        ctx.fill();
      });
    };

    draw();
  }, [threatIndicators, optimalPathing, squadPositions]);

  return (
    <div className="relative w-full h-full border border-current/25 bg-black/45 backdrop-blur-sm overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full" width="400" height="400" />
      <div className="absolute top-2 left-2 border border-current/20 bg-black/70 px-3 py-2 text-xs backdrop-blur-sm">
        <div className="font-bold uppercase">Tactical Map</div>
        <div className="mt-1 text-current/65">{mapRecommendation}</div>
      </div>
      <div className="absolute bottom-2 right-2 grid grid-cols-3 gap-1 text-[10px] uppercase">
        <span className="border border-red-400/30 bg-red-500/10 px-2 py-1 text-red-200">H {hostileCount}</span>
        <span className="border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-amber-200">U {unknownCount}</span>
        <span className="border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-emerald-200">S {squadPositions.length}</span>
      </div>
    </div>
  );
});
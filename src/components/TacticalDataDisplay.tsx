
import React, { useRef, useEffect } from 'react';

interface TacticalDataDisplayProps {
  threatIndicators: Array<{ id: string; position: { x: number; y: number }; type: 'hostile' | 'unknown' | 'friendly' }>;
  optimalPathing: Array<{ x: number; y: number }>;
  squadPositions: Array<{ id: string; position: { x: number; y: number } }>;
}

export const TacticalDataDisplay: React.FC<TacticalDataDisplayProps> = React.memo(({
  threatIndicators,
  optimalPathing,
  squadPositions,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
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

      // Draw optimal path
      if (optimalPathing.length > 0) {
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(optimalPathing[0].x, optimalPathing[0].y);
        for (let i = 1; i < optimalPathing.length; i++) {
          ctx.lineTo(optimalPathing[i].x, optimalPathing[i].y);
        }
        ctx.stroke();
      }

      // Draw squad positions
      squadPositions.forEach(member => {
        ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
        ctx.beginPath();
        ctx.arc(member.position.x, member.position.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText(member.id, member.position.x + 8, member.position.y - 8);
      });

      // Draw threat indicators
      threatIndicators.forEach(threat => {
        if (threat.type === 'hostile') {
          ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
        } else if (threat.type === 'unknown') {
          ctx.fillStyle = 'rgba(255, 255, 0, 0.8)';
        } else {
          ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
        }
        ctx.beginPath();
        ctx.moveTo(threat.position.x, threat.position.y - 5);
        ctx.lineTo(threat.position.x - 5, threat.position.y + 5);
        ctx.lineTo(threat.position.x + 5, threat.position.y + 5);
        ctx.closePath();
        ctx.fill();
      });
    };

    draw();

  }, [threatIndicators, optimalPathing, squadPositions]);

  return (
    <div className="relative w-full h-full border border-current/30 bg-black/40 backdrop-blur-sm">
      <canvas ref={canvasRef} className="w-full h-full" width="400" height="400" />
      <div className="absolute top-2 left-2 font-bold">TACTICAL DATA DISPLAY</div>
    </div>
  );
});

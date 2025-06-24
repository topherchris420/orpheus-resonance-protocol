
import React, { useRef, useEffect } from 'react';

interface CymaticVisualizerProps {
  audioLevel: number;
  frequency: number;
  phase: number;
  breathPattern: number;
  touchPoints: Array<{x: number, y: number, intensity: number}>;
}

export const CymaticVisualizer: React.FC<CymaticVisualizerProps> = ({
  audioLevel,
  frequency,
  phase,
  breathPattern,
  touchPoints
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      const width = canvas.width;
      const height = canvas.height;
      
      // Clear with fade effect
      ctx.fillStyle = `rgba(0, 0, 0, ${0.1 + breathPattern * 0.05})`;
      ctx.fillRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const time = Date.now() * 0.001;

      // Base cymatic pattern
      const baseRadius = 100 + audioLevel * 50 + breathPattern * 30;
      const points = Math.floor(frequency / 10) + phase * 3;

      // Draw cymatic patterns
      for (let i = 0; i < points; i++) {
        const angle = (i / points) * Math.PI * 2 + time * 0.5;
        const radius = baseRadius + Math.sin(time * 2 + i) * 20;
        
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;

        // Color based on phase
        let color;
        switch (phase) {
          case 1:
            color = `hsl(120, 70%, ${50 + audioLevel * 30}%)`;
            break;
          case 2:
            color = `hsl(${180 + i * 10}, 80%, ${60 + audioLevel * 40}%)`;
            break;
          case 3:
            color = `hsl(${240 + Math.sin(time + i) * 60}, 90%, ${70 + audioLevel * 30}%)`;
            break;
          case 4:
            color = `hsl(${45 + Math.sin(time * 2 + i) * 30}, 100%, ${80 + audioLevel * 20}%)`;
            break;
          default:
            color = 'rgb(0, 255, 0)';
        }

        ctx.beginPath();
        ctx.arc(x, y, 3 + audioLevel * 5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Connect points with lines for higher phases
        if (phase >= 2 && i > 0) {
          const prevAngle = ((i - 1) / points) * Math.PI * 2 + time * 0.5;
          const prevRadius = baseRadius + Math.sin(time * 2 + (i - 1)) * 20;
          const prevX = centerX + Math.cos(prevAngle) * prevRadius;
          const prevY = centerY + Math.sin(prevAngle) * prevRadius;

          ctx.beginPath();
          ctx.moveTo(prevX, prevY);
          ctx.lineTo(x, y);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1 + audioLevel * 2;
          ctx.globalAlpha = 0.6;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }

      // Sacred geometry overlay for higher phases
      if (phase >= 3) {
        ctx.strokeStyle = `rgba(255, 215, 0, ${0.3 + audioLevel * 0.4})`;
        ctx.lineWidth = 2;
        
        // Flower of life pattern
        const petalRadius = 50 + breathPattern * 20;
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2;
          const x = centerX + Math.cos(angle) * petalRadius;
          const y = centerY + Math.sin(angle) * petalRadius;
          
          ctx.beginPath();
          ctx.arc(x, y, petalRadius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Touch point effects
      touchPoints.forEach((point, index) => {
        const age = touchPoints.length - index;
        const alpha = (1 - age / touchPoints.length) * point.intensity;
        
        ctx.beginPath();
        ctx.arc(point.x, point.y, 20 + point.intensity * 30, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.lineWidth = 3;
        ctx.stroke();

        // Ripple effect
        ctx.beginPath();
        ctx.arc(point.x, point.y, 40 + age * 10, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [audioLevel, frequency, phase, breathPattern, touchPoints]);

  return (
    <div className="h-full border border-current/30 bg-black/40 backdrop-blur-sm relative">
      <canvas
        ref={canvasRef}
        width={600}
        height={400}
        className="w-full h-full"
      />
      <div className="absolute top-2 left-2 text-xs opacity-70">
        CYMATIC RESONANCE FIELD
      </div>
      <div className="absolute bottom-2 right-2 text-xs opacity-70">
        {frequency}Hz | Amplitude: {Math.round(audioLevel * 100)}%
      </div>
    </div>
  );
};

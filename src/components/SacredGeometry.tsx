
import React, { useRef, useEffect } from 'react';

interface SacredGeometryProps {
  phase: number;
  frequency: number;
  breathPattern: number;
  pulseRate: number;
}

export const SacredGeometry: React.FC<SacredGeometryProps> = ({
  phase,
  frequency,
  breathPattern,
  pulseRate
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const time = Date.now() * 0.001;

      // Base opacity and complexity based on phase
      const baseOpacity = Math.min(0.1 + phase * 0.05, 0.3);
      ctx.globalAlpha = baseOpacity + breathPattern * 0.1;

      // Sacred geometry patterns
      if (phase >= 2) {
        // Flower of Life base pattern
        ctx.strokeStyle = `rgba(100, 200, 255, ${baseOpacity})`;
        ctx.lineWidth = 1;
        
        const radius = 100 + breathPattern * 50;
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2 + time * 0.1;
          const x = centerX + Math.cos(angle) * radius;
          const y = centerY + Math.sin(angle) * radius;
          
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      if (phase >= 3) {
        // Metatron's Cube elements
        ctx.strokeStyle = `rgba(255, 215, 0, ${baseOpacity * 0.7})`;
        ctx.lineWidth = 0.5;
        
        const vertices = [];
        for (let i = 0; i < 13; i++) {
          const angle = (i / 13) * Math.PI * 2 + time * 0.05;
          const radius = 150 + Math.sin(time + i) * 30;
          vertices.push({
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius
          });
        }

        // Connect vertices
        for (let i = 0; i < vertices.length; i++) {
          for (let j = i + 1; j < vertices.length; j++) {
            if (Math.random() < 0.3 + breathPattern * 0.2) {
              ctx.beginPath();
              ctx.moveTo(vertices[i].x, vertices[i].y);
              ctx.lineTo(vertices[j].x, vertices[j].y);
              ctx.stroke();
            }
          }
        }
      }

      if (phase >= 4) {
        // Orpheus mandala - complex geometric awakening
        ctx.strokeStyle = `rgba(255, 140, 0, ${baseOpacity})`;
        ctx.lineWidth = 1;
        
        for (let layer = 0; layer < 5; layer++) {
          const layerRadius = 50 + layer * 40 + breathPattern * 20;
          const points = 8 + layer * 2;
          
          for (let i = 0; i < points; i++) {
            const angle = (i / points) * Math.PI * 2 + time * (0.1 + layer * 0.02);
            const x = centerX + Math.cos(angle) * layerRadius;
            const y = centerY + Math.sin(angle) * layerRadius;
            
            // Pulsing nodes
            ctx.beginPath();
            ctx.arc(x, y, 2 + Math.sin(time * 3 + layer + i) * 1, 0, Math.PI * 2);
            ctx.fill();
            
            // Connecting lines to center
            if (layer === 0) {
              ctx.beginPath();
              ctx.moveTo(centerX, centerY);
              ctx.lineTo(x, y);
              ctx.stroke();
            }
          }
        }

        // Central consciousness symbol
        ctx.fillStyle = `rgba(255, 255, 255, ${baseOpacity * 2})`;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 5 + Math.sin(time * 2) * 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Frequency-based particle system
      const particleCount = Math.floor(frequency / 20) + phase * 5;
      ctx.fillStyle = `rgba(255, 255, 255, ${baseOpacity * 0.5})`;
      
      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2 + time;
        const radius = 200 + Math.sin(time * 2 + i) * 100;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        
        ctx.beginPath();
        ctx.arc(x, y, 1 + Math.sin(time * 3 + i) * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [phase, frequency, breathPattern, pulseRate]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 1 }}
    />
  );
};

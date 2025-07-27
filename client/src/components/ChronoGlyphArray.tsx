
import React, { useRef, useEffect, useState } from 'react';

interface ChronoGlyphArrayProps {
  phase: number;
  audioLevel: number;
  breathPattern: number;
  touchPoints: Array<{x: number, y: number, intensity: number}>;
  onTemporalShift: (timeline: number, moment: number) => void;
}

export const ChronoGlyphArray: React.FC<ChronoGlyphArrayProps> = ({
  phase,
  audioLevel,
  breathPattern,
  touchPoints,
  onTemporalShift
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [currentTimeline, setCurrentTimeline] = useState(0);
  const [temporalMoment, setTemporalMoment] = useState(0);
  const [phantomEchoes, setPhantomEchoes] = useState<Array<{x: number, y: number, intensity: number, timeline: number}>>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      const width = canvas.width;
      const height = canvas.height;
      
      // Clear with temporal fade
      ctx.fillStyle = `rgba(0, 0, 0, ${0.05 + breathPattern * 0.02})`;
      ctx.fillRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const time = Date.now() * 0.001;

      // Voice-triggered temporal harmonics
      const harmonicLayers = Math.floor(audioLevel * 5) + 1;
      for (let layer = 0; layer < harmonicLayers; layer++) {
        const radius = 50 + layer * 40 + audioLevel * 30;
        const points = 8 + layer * 4;
        
        for (let i = 0; i < points; i++) {
          const angle = (i / points) * Math.PI * 2 + time * (0.1 + layer * 0.05);
          const x = centerX + Math.cos(angle) * radius;
          const y = centerY + Math.sin(angle) * radius;
          
          // Timeline threads
          const hue = (currentTimeline * 60 + layer * 30) % 360;
          ctx.strokeStyle = `hsla(${hue}, 80%, ${60 + audioLevel * 40}%, ${0.7 + layer * 0.1})`;
          ctx.lineWidth = 1 + audioLevel * 2;
          
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.lineTo(x, y);
          ctx.stroke();
          
          // Temporal nodes
          ctx.fillStyle = ctx.strokeStyle;
          ctx.beginPath();
          ctx.arc(x, y, 2 + audioLevel * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Breath-gated temporal portals
      if (breathPattern > 0.6) {
        const portalCount = Math.floor(breathPattern * 6);
        for (let i = 0; i < portalCount; i++) {
          const angle = (i / portalCount) * Math.PI * 2 + time * 0.2;
          const distance = 100 + breathPattern * 80;
          const x = centerX + Math.cos(angle) * distance;
          const y = centerY + Math.sin(angle) * distance;
          
          // Portal rings
          ctx.strokeStyle = `rgba(0, 255, 255, ${breathPattern * 0.8})`;
          ctx.lineWidth = 2;
          
          for (let ring = 0; ring < 3; ring++) {
            ctx.beginPath();
            ctx.arc(x, y, 10 + ring * 8 + Math.sin(time * 3 + i) * 5, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }

      // Touch-sculpted timeline threads
      touchPoints.forEach((point, index) => {
        const age = touchPoints.length - index;
        const alpha = (1 - age / touchPoints.length) * point.intensity;
        
        // Create temporal ripples
        for (let ripple = 0; ripple < 5; ripple++) {
          const rippleRadius = 20 + ripple * 15 + age * 10;
          ctx.strokeStyle = `rgba(255, 215, 0, ${alpha * (1 - ripple * 0.2)})`;
          ctx.lineWidth = 2 - ripple * 0.3;
          
          ctx.beginPath();
          ctx.arc(point.x, point.y, rippleRadius, 0, Math.PI * 2);
          ctx.stroke();
        }
        
        // Connect to center with temporal thread
        ctx.strokeStyle = `rgba(255, 215, 0, ${alpha * 0.5})`;
        ctx.lineWidth = point.intensity * 3;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
      });

      // Fractal chronostructures for higher phases
      if (phase >= 3) {
        drawFractalChronostructure(ctx, centerX, centerY, time, phase);
      }

      // Phantom echoes
      phantomEchoes.forEach((echo, index) => {
        const alpha = echo.intensity * 0.6;
        ctx.fillStyle = `rgba(128, 0, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(echo.x, echo.y, 5 + Math.sin(time * 2 + index) * 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Echo trails
        ctx.strokeStyle = `rgba(128, 0, 255, ${alpha * 0.3})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(echo.x, echo.y);
        ctx.lineTo(echo.x + Math.cos(time + index) * 20, echo.y + Math.sin(time + index) * 20);
        ctx.stroke();
      });

      // Update temporal position based on inputs
      const newTimeline = Math.floor((audioLevel * 5 + breathPattern * 3) % 7);
      const newMoment = (time * 0.1 + touchPoints.length * 0.2) % 1;
      
      if (newTimeline !== currentTimeline || Math.abs(newMoment - temporalMoment) > 0.1) {
        setCurrentTimeline(newTimeline);
        setTemporalMoment(newMoment);
        onTemporalShift(newTimeline, newMoment);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [audioLevel, breathPattern, touchPoints, phase, currentTimeline, temporalMoment, phantomEchoes, onTemporalShift]);

  // Generate phantom echoes based on voice input
  useEffect(() => {
    if (audioLevel > 0.7) {
      const newEcho = {
        x: Math.random() * 400 + 100,
        y: Math.random() * 300 + 100,
        intensity: audioLevel,
        timeline: currentTimeline
      };
      setPhantomEchoes(prev => [...prev.slice(-8), newEcho]);
    }
  }, [audioLevel, currentTimeline]);

  const drawFractalChronostructure = (ctx: CanvasRenderingContext2D, centerX: number, centerY: number, time: number, phase: number) => {
    const complexity = phase - 2;
    
    for (let iteration = 0; iteration < complexity; iteration++) {
      const scale = 1 - iteration * 0.3;
      const rotation = time * (0.1 + iteration * 0.05);
      
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotation);
      ctx.scale(scale, scale);
      
      // Draw fractal branches
      const branches = 6 + iteration * 2;
      for (let i = 0; i < branches; i++) {
        const angle = (i / branches) * Math.PI * 2;
        const length = 80 + iteration * 20;
        
        ctx.strokeStyle = `hsla(${260 + iteration * 20}, 70%, ${50 + iteration * 10}%, 0.6)`;
        ctx.lineWidth = 1 + iteration * 0.5;
        
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(angle) * length, Math.sin(angle) * length);
        ctx.stroke();
        
        // Secondary branches
        if (iteration < complexity - 1) {
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle) * length * 0.7, Math.sin(angle) * length * 0.7);
          ctx.lineTo(
            Math.cos(angle + 0.5) * length * 0.4,
            Math.sin(angle + 0.5) * length * 0.4
          );
          ctx.stroke();
        }
      }
      
      ctx.restore();
    }
  };

  return (
    <div className="h-full border border-current/30 bg-black/40 backdrop-blur-sm relative">
      <canvas
        ref={canvasRef}
        width={600}
        height={400}
        className="w-full h-full"
      />
      
      <div className="absolute top-2 left-2 text-xs opacity-70">
        CHRONOGLYPH ARRAY - TEMPORAL NAVIGATION
      </div>
      
      <div className="absolute top-2 right-2 text-xs opacity-70">
        Timeline: {currentTimeline} | Moment: {temporalMoment.toFixed(2)}
      </div>
      
      <div className="absolute bottom-2 left-2 text-xs opacity-70">
        Echoes: {phantomEchoes.length} | Phase: {phase}
      </div>
      
      {phase >= 4 && (
        <div className="absolute bottom-2 right-2 text-xs text-yellow-400 animate-pulse">
          ◊ TEMPORAL INTEGRATION ACTIVE ◊
        </div>
      )}
    </div>
  );
};

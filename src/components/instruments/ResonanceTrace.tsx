import { useLayoutEffect, useRef } from 'react';

interface TraceProps {
  frequency: number;
  x: number;
  y: number;
  harmonic: boolean;
}

/** A graphical response to the pad controls. Draw only when a control or the canvas size changes. */
export const ResonanceTrace = ({ frequency, x, y, harmonic }: TraceProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const pixelsWide = Math.round(width * ratio);
      const pixelsHigh = Math.round(height * ratio);
      if (canvas.width !== pixelsWide || canvas.height !== pixelsHigh) {
        canvas.width = pixelsWide;
        canvas.height = pixelsHigh;
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const cycles = .7 + Math.log10(1 + frequency) * .66;
      const phase = (x - .5) * Math.PI * 2;
      const heightScale = height * (.22 + (1 - y) * .15);
      const samples = Math.min(260, Math.ceil(width));
      for (let strand = 0; strand < 25; strand++) {
        const depth = strand / 24;
        ctx.beginPath();
        ctx.lineWidth = strand === 12 ? 1.4 : .8;
        ctx.strokeStyle = strand === 12 ? '#ffe0a8' : strand < 12 ? 'rgba(230,183,113,.68)' : 'rgba(145,203,180,.67)';
        for (let sample = 0; sample <= samples; sample++) {
          const t = sample / samples;
          const envelope = Math.sin(t * Math.PI);
          const angle = t * Math.PI * 2 * cycles + phase + depth * 2.8;
          const carrier = Math.sin(angle) * Math.cos(t * Math.PI - depth);
          const overtone = harmonic ? .36 * Math.sin(2 * angle + depth) : 0;
          const py = height * .5 + heightScale * envelope * (carrier + overtone) + (depth - .5) * height * .22;
          if (sample === 0) ctx.moveTo(0, py);
          else ctx.lineTo(t * width, py);
        }
        ctx.stroke();
      }
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [frequency, x, y, harmonic]);

  return <canvas className="resonance-trace" ref={canvasRef} aria-hidden="true" />;
};

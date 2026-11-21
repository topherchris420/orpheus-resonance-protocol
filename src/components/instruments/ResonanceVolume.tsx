import { Pause, Play, RotateCw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Color, Euler, Matrix4, PerspectiveCamera, Vector3 } from 'three';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

export type Waveform = 'sine' | 'square' | 'sawtooth';

interface ResonanceNode {
  name: string;
  position: Vector3;
  color: number;
  activity: number;
}

interface VolumeProps {
  nodes: ResonanceNode[];
  frequency: number;
  amplitude: number;
  waveform: Waveform;
}

/** A sampled surface in 3D. The two families of curves follow parallels and meridians. */
function contours(frequency: number, amplitude: number, waveform: Waveform) {
  const lobes = 2 + Math.floor(frequency / 9);
  const point = (latitude: number, longitude: number) => {
    const equator = Math.cos(latitude);
    const phase = lobes * longitude + 1.6 * latitude + frequency * .09;
    const wave = Math.sin(phase);
    const profile = waveform === 'square' ? Math.tanh(2.5 * wave) : waveform === 'sawtooth' ? wave - .47 * Math.sin(2 * phase) : wave;
    const radius = 1 + (.08 + amplitude * .31) * equator * equator * profile;
    return new Vector3(radius * equator * Math.cos(longitude), radius * Math.sin(latitude) * .94, radius * equator * Math.sin(longitude));
  };
  const turns = Math.PI * 2;
  const parallels = Array.from({ length: 32 }, (_, row) =>
    Array.from({ length: 101 }, (_, column) => point(((row + .5) / 32 - .5) * Math.PI, column / 100 * turns)),
  );
  const meridians = Array.from({ length: 18 }, (_, column) =>
    Array.from({ length: 51 }, (_, row) => point((row / 50 - .5) * Math.PI, column / 18 * turns)),
  );
  return [...parallels, ...meridians];
}

/** Perspective projection onto 2D canvas keeps the instrument usable on devices without WebGL. */
export const ResonanceVolume = ({ nodes, frequency, amplitude, waveform }: VolumeProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const yaw = useRef(.4);
  const reducedMotion = usePrefersReducedMotion();
  const [paused, setPaused] = useState(false);
  const [manualTurn, setManualTurn] = useState(0);
  const rotating = !paused && !reducedMotion;
  const curves = useMemo(() => contours(frequency, amplitude, waveform), [frequency, amplitude, waveform]);
  const active = nodes.filter((node) => node.activity > .1).map((node) => node.name);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const camera = new PerspectiveCamera(38, 1, .1, 20);
    camera.position.z = 4.05;
    camera.updateMatrixWorld();
    const rotation = new Matrix4();
    const angles = new Euler();
    const projection = new Matrix4();
    const projected = new Vector3();
    const rotated = new Vector3();
    let width = 0;
    let height = 0;
    let scale = 0;
    let visible = false;
    let frame = 0;
    let last = 0;
    const coloredNodes = nodes.map((node) => ({ ...node, ink: '#' + new Color(node.color).getHexString() }));

    const draw = () => {
      if (!width || !height) return;
      ctx.clearRect(0, 0, width, height);
      rotation.makeRotationFromEuler(angles.set(-.24, yaw.current + manualTurn * Math.PI / 6, -.14, 'XYZ'));
      projection.copy(camera.projectionMatrix).multiply(camera.matrixWorldInverse).multiply(rotation);

      // Batch all rear lines into one stroke and all front lines into another.
      const back = new Path2D();
      const front = new Path2D();
      for (const curve of curves) {
        let px = 0;
        let py = 0;
        curve.forEach((point, index) => {
          projected.copy(point).applyMatrix4(projection);
          const x = width / 2 + projected.x * scale;
          const y = height / 2 - projected.y * scale;
          if (index > 0) {
            const path = rotated.copy(point).applyMatrix4(rotation).z > .12 ? front : back;
            path.moveTo(px, py);
            path.lineTo(x, y);
          }
          px = x;
          py = y;
        });
      }
      ctx.lineWidth = .72;
      ctx.strokeStyle = '#658f82';
      ctx.globalAlpha = .45;
      ctx.stroke(back);
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#ebc38a';
      ctx.globalAlpha = .9;
      ctx.stroke(front);
      ctx.globalAlpha = 1;

      for (const node of coloredNodes) {
        projected.copy(node.position).applyMatrix4(projection);
        const x = width / 2 + projected.x * scale;
        const y = height / 2 - projected.y * scale;
        const radius = 2 + node.activity * 8;
        const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 3);
        glow.addColorStop(0, node.ink);
        glow.addColorStop(1, node.ink + '00');
        ctx.fillStyle = glow;
        ctx.fillRect(x - radius * 3, y - radius * 3, radius * 6, radius * 6);
        ctx.fillStyle = node.activity > .1 ? '#fff3ce' : node.ink;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(1.6, radius * .52), 0, Math.PI * 2);
        ctx.fill();
      }
    };
    const resize = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      scale = Math.min(width, height) * .55;
      draw();
    };
    const animate = (now: number) => {
      if (now - last >= 1000 / 24) {
        yaw.current += Math.min(.1, (now - last) / 1000) * .16;
        last = now;
        draw();
      }
      frame = requestAnimationFrame(animate);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      last = performance.now();
      if (rotating && visible && !document.hidden) frame = requestAnimationFrame(animate);
    };

    resize();
    const sizeObserver = new ResizeObserver(resize);
    sizeObserver.observe(canvas);
    const viewport = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; schedule(); });
    viewport.observe(canvas);
    document.addEventListener('visibilitychange', schedule);
    return () => {
      sizeObserver.disconnect();
      viewport.disconnect();
      document.removeEventListener('visibilitychange', schedule);
      cancelAnimationFrame(frame);
    };
  }, [curves, nodes, rotating, manualTurn]);

  return (
    <div className="resonance-volume">
      <canvas ref={canvasRef} role="img" aria-label={`Three-dimensional resonance contours. Active nodes: ${active.join(', ') || 'none'}.`} />
      <div className="volume-transport">
        {!reducedMotion && (
          <button type="button" onClick={() => setPaused(!paused)} aria-label={paused ? 'Resume rotation' : 'Pause rotation'}>
            {paused ? <Play size={16} /> : <Pause size={16} />}
          </button>
        )}
        <button type="button" onClick={() => setManualTurn((turn) => (turn + 1) % 12)} aria-label="Turn model 30 degrees"><RotateCw size={16} /></button>
      </div>
    </div>
  );
};

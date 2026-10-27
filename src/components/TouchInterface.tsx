import React, { useRef, useState } from 'react';
import { Slider } from '@/components/ui/slider';

interface TouchInterfaceProps {
  phase: number;
  onTouch: (point: { x: number; y: number; intensity: number }) => void;
  onFrequencyChange: (frequency: number) => void;
}

/** Display presets only. No frequency here is claimed to affect health, mood, cognition or anything biological. */
const PRESETS = [7.83, 432, 528, 741, 963];

/**
 * A fictional resonance pad. It responds to pointer, touch and keyboard input and changes a display
 * marker; it controls nothing in the simulation and measures nothing about the person using it.
 */
export const TouchInterface: React.FC<TouchInterfaceProps> = React.memo(({ phase, onTouch, onFrequencyChange }) => {
  const [frequency, setFrequency] = useState(432);
  const [active, setActive] = useState(false);
  const [cursor, setCursor] = useState({ x: 0.5, y: 0.5 });
  const [harmonic, setHarmonic] = useState(false);
  const padRef = useRef<HTMLDivElement>(null);
  const lastReport = useRef(0);

  const report = (x: number, y: number, intensity: number) => {
    const now = performance.now();
    if (now - lastReport.current < 1000) return;
    lastReport.current = now;
    onTouch({ x, y, intensity });
  };

  const setFromPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    setCursor({ x, y });
    return { x: x * rect.width, y: y * rect.height, intensity: event.pressure > 0 ? event.pressure : 0.75 };
  };

  const changeFrequency = (value: number) => {
    setFrequency(value);
    onFrequencyChange(value);
  };

  return (
    <section aria-label="Resonance pad" className="h-full space-y-4 rounded-xl border border-o-line bg-o-s1 p-4">
      <div className="flex items-center justify-between border-b border-o-line pb-2">
        <h3 className="text-sm font-semibold text-o-text">Resonance pad</h3>
        <span className="o-chip border-dashed border-o-text3/70 text-o-text2">Fictional instrument</span>
      </div>
      <div
        ref={padRef}
        role="slider"
        tabIndex={0}
        aria-label="Resonance pad position"
        aria-valuetext={`${Math.round(cursor.x * 100)} percent across, ${Math.round(cursor.y * 100)} percent down${active ? ', pressed' : ''}`}
        aria-valuenow={Math.round(cursor.x * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        className={`relative h-28 cursor-crosshair touch-none rounded-lg border-2 border-dashed ${active ? 'border-o-teal bg-o-teal-dim/30' : 'border-o-line-strong'}`}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setActive(true);
          const point = setFromPointer(event);
          report(point.x, point.y, point.intensity);
        }}
        onPointerMove={(event) => {
          if (active) setFromPointer(event);
        }}
        onPointerUp={() => setActive(false)}
        onPointerCancel={() => setActive(false)}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 0.1 : 0.03;
          const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
          if (moves[event.key]) {
            event.preventDefault();
            setCursor((previous) => ({ x: Math.min(1, Math.max(0, previous.x + moves[event.key][0])), y: Math.min(1, Math.max(0, previous.y + moves[event.key][1])) }));
          }
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setActive(true);
            const rect = padRef.current?.getBoundingClientRect();
            report(cursor.x * (rect?.width ?? 100), cursor.y * (rect?.height ?? 100), 0.75);
          }
        }}
        onKeyUp={(event) => {
          if (event.key === 'Enter' || event.key === ' ') setActive(false);
        }}
      >
        <span
          aria-hidden="true"
          className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-o-teal"
          style={{ left: `${cursor.x * 100}%`, top: `${cursor.y * 100}%` }}
        />
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-o-text3">
          {active ? 'Pressed' : 'Press, drag, or use arrow keys and Enter'}
        </span>
      </div>
      <div className="space-y-2">
        <p className="flex justify-between text-xs text-o-text3">
          <span>Display marker</span>
          <span className="font-mono text-o-text">{frequency} Hz</span>
        </p>
        <Slider label="Display marker frequency" valueText={(value) => `${value} hertz`} value={[frequency]} onValueChange={([value]) => changeFrequency(value)} min={20} max={2000} step={1} />
      </div>
      {phase >= 2 && (
        <div className="space-y-2">
          <p className="text-xs text-o-text3">Display presets</p>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((preset) => (
              <button key={preset} type="button" className="o-button min-h-9 px-2.5 text-xs" aria-pressed={Math.abs(frequency - preset) < 1} onClick={() => changeFrequency(preset)}>
                {preset} Hz
              </button>
            ))}
          </div>
          <p className="text-xs text-o-text3">Presets change a number on screen. Orpheus makes no claim that any frequency affects health, DNA, mood or cognition.</p>
        </div>
      )}
      {phase >= 3 && (
        <button type="button" className="o-button w-full" aria-pressed={harmonic} onClick={() => setHarmonic((previous) => !previous)}>
          {harmonic ? 'Harmonic display on' : 'Harmonic display off'}
        </button>
      )}
      {phase >= 4 && <p className="text-center text-xs text-o-text3">Story beat: the Orpheus protocol is active (fiction).</p>}
    </section>
  );
});

TouchInterface.displayName = 'TouchInterface';

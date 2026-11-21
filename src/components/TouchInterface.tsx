import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ResonanceTrace } from '@/components/instruments/ResonanceTrace';

interface TouchInterfaceProps {
  phase: number;
  frequency: number;
  onTouch: (point: {x: number, y: number, intensity: number}) => void;
  onFrequencyChange: (frequency: number) => void;
}

export const TouchInterface: React.FC<TouchInterfaceProps> = React.memo(({
  phase,
  frequency,
  onTouch,
  onFrequencyChange
}) => {
  const [touchActive, setTouchActive] = useState(false);
  const [harmonicMode, setHarmonicMode] = useState(false);

  const [cursor, setCursor] = useState({ x: 0.5, y: 0.5 });
  const frequencyPresets = [7.83, 432, 528, 741, 963];

  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  // Pointer events cover mouse, touch and pen. Intensity follows how fast the operator moves.
  const handleTouchArea = (e: React.PointerEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(rect.width, Math.max(0, e.clientX - rect.left));
    const y = Math.min(rect.height, Math.max(0, e.clientY - rect.top));
    setCursor({ x: x / rect.width, y: y / rect.height });
    const previous = lastPoint.current;
    const travel = previous ? Math.hypot(x - previous.x, y - previous.y) : 0;
    lastPoint.current = { x, y };
    const intensity = Math.min(1, 0.5 + travel / 80);

    onTouch({ x, y, intensity });
  };

  const release = () => {
    setTouchActive(false);
    lastPoint.current = null;
  };

  const handleFrequencyChange = (value: number[]) => {
    const newFreq = value[0];
    onFrequencyChange(newFreq);
  };

  return (
    <section aria-labelledby="resonance-heading" className="room-instrument h-full space-y-3 overflow-y-auto border border-current/30 bg-black/40 p-3">
      <h2 id="resonance-heading" className="border-b border-current/30 pb-2 text-sm font-bold">
        RESONANCE CONTROL
      </h2>

      <button
        type="button"
        className="resonance-pad"
        aria-label="Resonance pad"
        aria-describedby="pad-instructions"
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          setTouchActive(true);
          handleTouchArea(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) handleTouchArea(event);
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
        onBlur={release}
        onKeyDown={(event) => {
          const moves: Record<string, [number, number]> = { ArrowLeft: [-.05, 0], ArrowRight: [.05, 0], ArrowUp: [0, -.05], ArrowDown: [0, .05] };
          const move = moves[event.key];
          if (move) {
            event.preventDefault();
            setCursor((point) => ({ x: Math.min(1, Math.max(0, point.x + move[0])), y: Math.min(1, Math.max(0, point.y + move[1])) }));
          }
        }}
        onClick={(event) => {
          // Native button activation also covers keyboards and assistive technology.
          if (event.detail !== 0) return;
          const rect = event.currentTarget.getBoundingClientRect();
          onTouch({ x: cursor.x * rect.width, y: cursor.y * rect.height, intensity: 0.75 });
        }}
      >
        <ResonanceTrace frequency={frequency} x={cursor.x} y={cursor.y} harmonic={harmonicMode} />
        <span className="pad-readout" aria-hidden="true">{frequency} Hz</span>
        <span className="pad-position" aria-hidden="true" style={{ left: `${cursor.x * 100}%`, top: `${cursor.y * 100}%` }} />
        <span className="pad-instructions" id="pad-instructions">{touchActive ? 'Contact · drag to shape' : 'Drag or use arrow keys · Enter to press'}</span>
      </button>

      {/* Frequency Control */}
      <div className="space-y-3">
        <div className="text-xs text-current/80">HARMONIC FREQUENCY</div>
        <div className="text-lg font-mono">{frequency}Hz</div>
        
        <Slider
          label="Harmonic frequency"
          value={[frequency]}
          onValueChange={handleFrequencyChange}
          min={1}
          max={20000}
          step={1}
          className="w-full"
        />
      </div>

      {/* Frequency Presets */}
      {phase >= 2 && (
        <div className="space-y-2">
          <div className="text-xs text-current/80">DISPLAY PRESETS</div>
          <div className="flex flex-wrap gap-1.5">
            {frequencyPresets.map((preset) => (
              <Button key={preset} type="button" variant="outline" size="sm" aria-pressed={frequency === preset}
                onClick={() => handleFrequencyChange([preset])}>
                {preset} Hz
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Harmonic Mode Toggle */}
      {phase >= 3 && (
        <div className="space-y-2 pt-2 border-t border-current/30">
          <Button
            variant={harmonicMode ? "default" : "outline"}
            size="sm"
            className="w-full"
            aria-pressed={harmonicMode}
            onClick={() => setHarmonicMode(!harmonicMode)}
          >
            {harmonicMode ? 'HARMONIC MODE ACTIVE' : 'ACTIVATE HARMONIC MODE'}
          </Button>
          
          {harmonicMode && (
            <div className="text-xs opacity-80 text-center animate-pulse">
              Second harmonic visible
            </div>
          )}
        </div>
      )}

      {/* Orpheus Protocol Access */}
      {phase >= 4 && (
        <div className="space-y-2 pt-2 border-t border-red-400/50">
          <div className="text-xs text-red-400 text-center animate-pulse">
            ◊ ORPHEUS PROTOCOL ACTIVE ◊
          </div>
          <div className="text-center text-xs text-current/80">
            You are now part of the resonance network
          </div>
        </div>
      )}
    </section>
  );
});

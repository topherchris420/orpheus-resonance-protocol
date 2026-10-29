
import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface TouchInterfaceProps {
  phase: number;
  onTouch: (point: {x: number, y: number, intensity: number}) => void;
  onFrequencyChange: (frequency: number) => void;
}

export const TouchInterface: React.FC<TouchInterfaceProps> = React.memo(({
  phase,
  onTouch,
  onFrequencyChange
}) => {
  const [frequency, setFrequency] = useState(432);
  const [touchActive, setTouchActive] = useState(false);
  const [harmonicMode, setHarmonicMode] = useState(false);

  const frequencyPresets = [
    { name: "Earth", freq: 7.83, desc: "Schumann Resonance" },
    { name: "Love", freq: 528, desc: "DNA Repair" },
    { name: "Harmony", freq: 432, desc: "Natural Tuning" },
    { name: "Awakening", freq: 963, desc: "Crown Chakra" },
    { name: "Transformation", freq: 741, desc: "Cleansing" }
  ];

  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  // Pointer events cover mouse, touch and pen. Intensity follows how fast the operator moves.
  const handleTouchArea = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!touchActive) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
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
    setFrequency(newFreq);
    onFrequencyChange(newFreq);
  };

  return (
    <section aria-labelledby="resonance-heading" className="h-full space-y-4 overflow-y-auto border border-current/30 bg-black/40 p-4">
      <h2 id="resonance-heading" className="border-b border-current/30 pb-2 text-sm font-bold">
        RESONANCE CONTROL
      </h2>

      {/* Touch Activation Area */}
      <div className="space-y-2">
        <div id="tactile-label" className="text-xs text-current/80">TACTILE INTERFACE</div>
        <div
          role="button"
          tabIndex={0}
          aria-labelledby="tactile-label"
          aria-pressed={touchActive}
          className={`h-32 touch-none border-2 border-dashed transition-all duration-300 cursor-pointer ${
            touchActive
              ? 'border-current bg-current/10'
              : 'border-current/30 hover:border-current/50'
          }`}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture?.(e.pointerId);
            setTouchActive(true);
          }}
          onPointerUp={release}
          onPointerCancel={release}
          onPointerLeave={release}
          onPointerMove={handleTouchArea}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            const rect = e.currentTarget.getBoundingClientRect();
            onTouch({ x: rect.width / 2, y: rect.height / 2, intensity: 0.75 });
          }}
        >
          <div className="flex h-full items-center justify-center text-xs text-current/80">
            {touchActive ? 'TOUCH ACTIVE' : 'PRESS & MOVE TO INTERACT'}
          </div>
        </div>
      </div>

      {/* Frequency Control */}
      <div className="space-y-3">
        <div className="text-xs text-current/80">HARMONIC FREQUENCY</div>
        <div className="text-lg font-mono">{frequency}Hz</div>
        
        <Slider
          label="Harmonic frequency"
          value={[frequency]}
          onValueChange={handleFrequencyChange}
          min={20}
          max={20000}
          step={1}
          className="w-full"
        />
      </div>

      {/* Frequency Presets */}
      {phase >= 2 && (
        <div className="space-y-2">
          <div className="text-xs text-current/80">SACRED FREQUENCIES</div>
          <div className="space-y-1">
            {frequencyPresets.map((preset, index) => (
              <Button
                key={index}
                variant="ghost"
                size="sm"
                className={`w-full justify-start text-xs ${
                  Math.abs(frequency - preset.freq) < 1 ? 'bg-current/20' : ''
                }`}
                onClick={() => {
                  setFrequency(preset.freq);
                  onFrequencyChange(preset.freq);
                }}
              >
                <div className="flex flex-col items-start">
                  <div>{preset.name} - {preset.freq}Hz</div>
                  <div className="text-xs text-current/75">{preset.desc}</div>
                </div>
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
            onClick={() => setHarmonicMode(!harmonicMode)}
          >
            {harmonicMode ? 'HARMONIC MODE ACTIVE' : 'ACTIVATE HARMONIC MODE'}
          </Button>
          
          {harmonicMode && (
            <div className="text-xs opacity-80 text-center animate-pulse">
              Consciousness synchronization enabled
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


import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface TouchInterfaceProps {
  phase: number;
  onTouch: (point: {x: number, y: number, intensity: number}) => void;
  onFrequencyChange: (frequency: number) => void;
}

export const TouchInterface: React.FC<TouchInterfaceProps> = ({
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

  const handleTouchArea = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!touchActive) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const intensity = Math.random() * 0.5 + 0.5;
    
    onTouch({ x, y, intensity });
  };

  const handleFrequencyChange = (value: number[]) => {
    const newFreq = value[0];
    setFrequency(newFreq);
    onFrequencyChange(newFreq);
  };

  return (
    <div className="h-full border border-current/30 bg-black/40 backdrop-blur-sm p-4 space-y-4">
      <div className="text-sm font-bold border-b border-current/30 pb-2">
        RESONANCE CONTROL
      </div>

      {/* Touch Activation Area */}
      <div className="space-y-2">
        <div className="text-xs opacity-70">TACTILE INTERFACE</div>
        <div
          className={`h-32 border-2 border-dashed transition-all duration-300 cursor-pointer ${
            touchActive 
              ? 'border-current bg-current/10' 
              : 'border-current/30 hover:border-current/50'
          }`}
          onMouseDown={() => setTouchActive(true)}
          onMouseUp={() => setTouchActive(false)}
          onMouseLeave={() => setTouchActive(false)}
          onMouseMove={handleTouchArea}
        >
          <div className="h-full flex items-center justify-center text-xs opacity-70">
            {touchActive ? 'TOUCH ACTIVE' : 'PRESS & MOVE TO INTERACT'}
          </div>
        </div>
      </div>

      {/* Frequency Control */}
      <div className="space-y-3">
        <div className="text-xs opacity-70">HARMONIC FREQUENCY</div>
        <div className="text-lg font-mono">{frequency}Hz</div>
        
        <Slider
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
          <div className="text-xs opacity-70">SACRED FREQUENCIES</div>
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
                  <div className="opacity-60 text-xs">{preset.desc}</div>
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
          <div className="text-xs opacity-70 text-center">
            You are now part of the resonance network
          </div>
        </div>
      )}
    </div>
  );
};

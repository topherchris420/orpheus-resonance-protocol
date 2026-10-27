import React from 'react';
import { Waves } from 'lucide-react';
import { Slider } from '@/components/common/Slider';
import { BREATH_PULSE_PRESETS, BreathPulseControlsState } from '@/hooks/useBreathPulseModulation';

interface BreathPulseControlsProps {
  controls: BreathPulseControlsState;
  liveAvailable: boolean;
}

/** Visual pacing: sets the rhythm of the ambient animation. It measures nothing about the person. */
export const BreathPulseControls: React.FC<BreathPulseControlsProps> = React.memo(({ controls, liveAvailable }) => {
  const { breathRate, breathDepth, pulseTarget, coupling, followLive, setBreathRate, setBreathDepth, setPulseTarget, setCoupling, setFollowLive, applyPreset } = controls;
  const following = followLive && liveAvailable;
  return (
    <section aria-label="Visual pacing" className="flex h-full flex-col gap-3 overflow-y-auto rounded-xl border border-o-line bg-o-s1 p-4">
      <div className="flex items-center justify-between gap-2 border-b border-o-line pb-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-o-text">
          <Waves aria-hidden="true" className="h-4 w-4 text-o-teal" /> Visual pacing
        </h3>
        <button type="button" className="o-button min-h-9 px-2 text-xs" aria-pressed={following} disabled={!liveAvailable} onClick={() => setFollowLive(!followLive)}>
          {following ? 'Glow follows audio' : 'Manual'}
        </button>
      </div>
      <div className="flex items-center gap-3">
        <div
          aria-hidden="true"
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-o-teal/50 text-[0.7rem] uppercase tracking-widest text-o-teal"
          style={{
            transform: 'scale(calc(0.9 + var(--breath-phase, 0.5) * 0.2))',
            boxShadow: '0 0 calc(6px + var(--pulse-glow, 0) * 22px) hsl(var(--o-teal) / calc(0.15 + var(--interface-intensity, 0.2) * 0.4))',
          }}
        >
          pace
        </div>
        <dl className="min-w-0 flex-1 space-y-1 text-xs text-o-text3">
          <div className="flex justify-between">
            <dt>Cycle</dt>
            <dd className="font-mono text-o-text">{(60 / breathRate).toFixed(1)} s</dd>
          </div>
          <div className="flex justify-between">
            <dt>Pulse rhythm</dt>
            <dd className="font-mono text-o-text">{Math.round(pulseTarget)} /min</dd>
          </div>
          <div className="flex justify-between">
            <dt>Coupling</dt>
            <dd className="font-mono text-o-text">{Math.round(coupling * 100)}%</dd>
          </div>
        </dl>
      </div>
      <div role="group" aria-label="Pacing presets" className="grid grid-cols-2 gap-1.5">
        {BREATH_PULSE_PRESETS.map((preset) => (
          <button key={preset.id} type="button" className="o-button min-h-9 px-2 text-xs" aria-pressed={Math.abs(preset.breathRate - breathRate) < 0.05} onClick={() => applyPreset(preset)}>
            {preset.name}
          </button>
        ))}
      </div>
      {[
        { label: 'Animation cycles per minute', value: breathRate, min: 3, max: 20, step: 0.5, set: setBreathRate, text: (value: number) => `${value} per minute` },
        { label: 'Animation depth', value: breathDepth * 100, min: 0, max: 100, step: 1, set: (value: number) => setBreathDepth(value / 100), text: (value: number) => `${value} percent` },
        { label: 'Pulse rhythm', value: pulseTarget, min: 45, max: 120, step: 1, set: setPulseTarget, text: (value: number) => `${value} per minute` },
        { label: 'Interface coupling', value: coupling * 100, min: 0, max: 100, step: 1, set: (value: number) => setCoupling(value / 100), text: (value: number) => `${value} percent` },
      ].map((control) => (
        <div key={control.label}>
          <p className="flex justify-between text-xs text-o-text3">
            <span>{control.label}</span>
            <span className="font-mono text-o-text">{control.text(Math.round(control.value * 10) / 10)}</span>
          </p>
          <Slider label={control.label} valueText={control.text} value={[control.value]} min={control.min} max={control.max} step={control.step} onValueChange={([value]) => control.set(value)} />
        </div>
      ))}
      <p className="text-xs text-o-text3">
        These rates pace an animation. With audio on, the glow can follow microphone energy; that does not measure breathing or heart rate, and no calming effect is claimed.
      </p>
    </section>
  );
});

BreathPulseControls.displayName = 'BreathPulseControls';

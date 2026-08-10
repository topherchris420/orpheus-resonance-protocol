import React from 'react';
import { Activity, Waves } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { BREATH_PULSE_PRESETS, BreathPulseControlsState } from '@/hooks/useBreathPulseModulation';

interface BreathPulseControlsProps {
  controls: BreathPulseControlsState;
  liveAvailable: boolean;
  livePulseRate: number;
}

export const BreathPulseControls: React.FC<BreathPulseControlsProps> = React.memo(({
  controls,
  liveAvailable,
  livePulseRate,
}) => {
  const {
    breathRate,
    breathDepth,
    pulseTarget,
    coupling,
    followLive,
    setBreathRate,
    setBreathDepth,
    setPulseTarget,
    setCoupling,
    setFollowLive,
    applyPreset,
  } = controls;

  const following = followLive && liveAvailable;
  const cycleSeconds = 60 / (following ? Math.max(3, livePulseRate / 12) : breathRate);

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto border border-current/25 bg-black/45 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-current/25 pb-2">
        <div className="flex items-center gap-2 text-sm font-bold uppercase">
          <Waves className="h-4 w-4" />
          Breath &amp; Pulse
        </div>
        <Button
          variant={following ? 'default' : 'outline'}
          size="sm"
          disabled={!liveAvailable}
          onClick={() => setFollowLive(!followLive)}
          className="h-7 px-2 text-[10px] uppercase"
        >
          {following ? 'Live' : 'Manual'}
        </Button>
      </div>

      {/* Live-modulated breath ring: driven purely by CSS variables written each frame */}
      <div className="flex items-center gap-3">
        <div
          className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-cyan-300/40"
          style={{
            transform: 'scale(calc(0.9 + var(--breath-phase, 0.5) * 0.2))',
            boxShadow: '0 0 calc(6px + var(--pulse-glow, 0) * 26px) rgba(34,211,238,calc(0.15 + var(--interface-intensity, 0.2) * 0.5))',
            opacity: 'calc(0.55 + var(--interface-intensity, 0.3) * 0.45)',
          }}
        >
          <div className="text-[10px] uppercase tracking-widest text-cyan-200">sync</div>
        </div>
        <div className="min-w-0 flex-1 space-y-1 text-[11px] uppercase text-current/60">
          <div className="flex justify-between">
            <span>Cycle</span>
            <span className="text-cyan-200">{cycleSeconds.toFixed(1)} s</span>
          </div>
          <div className="flex justify-between">
            <span className="flex items-center gap-1"><Activity className="h-3 w-3" />Pulse</span>
            <span className="text-cyan-200">{Math.round(following ? livePulseRate : pulseTarget)} bpm</span>
          </div>
          <div className="flex justify-between">
            <span>Modulation</span>
            <span className="text-cyan-200">{Math.round(coupling * 100)}%</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {BREATH_PULSE_PRESETS.map((preset) => (
          <Button
            key={preset.id}
            variant={Math.abs(preset.breathRate - breathRate) < 0.05 ? 'default' : 'outline'}
            size="sm"
            onClick={() => applyPreset(preset)}
            className="h-auto whitespace-normal px-2 py-1 text-[10px] leading-tight"
          >
            {preset.name}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] uppercase text-current/60">
            <span>Breath rate</span>
            <span className="text-cyan-200">{breathRate.toFixed(1)} /min</span>
          </div>
          <Slider
            value={[breathRate]}
            min={3}
            max={20}
            step={0.5}
            disabled={following}
            onValueChange={(value) => setBreathRate(value[0])}
          />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-[11px] uppercase text-current/60">
            <span>Breath depth</span>
            <span className="text-cyan-200">{Math.round(breathDepth * 100)}%</span>
          </div>
          <Slider value={[breathDepth * 100]} max={100} step={1} onValueChange={(value) => setBreathDepth(value[0] / 100)} />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-[11px] uppercase text-current/60">
            <span>Pulse target</span>
            <span className="text-cyan-200">{Math.round(pulseTarget)} bpm</span>
          </div>
          <Slider
            value={[pulseTarget]}
            min={45}
            max={120}
            step={1}
            disabled={following}
            onValueChange={(value) => setPulseTarget(value[0])}
          />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-[11px] uppercase text-current/60">
            <span>Interface coupling</span>
            <span className="text-cyan-200">{Math.round(coupling * 100)}%</span>
          </div>
          <Slider value={[coupling * 100]} max={100} step={1} onValueChange={(value) => setCoupling(value[0] / 100)} />
        </div>
      </div>

      <p className="text-[10px] leading-snug text-current/45">
        Breath drives interface depth and tone frequency; pulse drives glow intensity and carrier pitch.
      </p>
    </div>
  );
});

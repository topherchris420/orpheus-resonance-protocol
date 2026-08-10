import { useCallback, useEffect, useMemo, useRef } from 'react';
import { usePersistentState } from './usePersistentState';

export interface BreathPulseModulationValues {
  /** 0..1 inhale/exhale oscillation */
  breathPhase: number;
  /** 0..1 cardiac oscillation */
  pulsePhase: number;
  /** Perceived interface depth 0..1 (parallax/blur/scale) */
  depth: number;
  /** Visual intensity 0..1 (glow, overlay strength) */
  intensity: number;
  /** Binaural beat frequency in Hz */
  beatFrequency: number;
  /** Carrier tone in Hz */
  carrierTone: number;
  /** Multiplier applied on top of the master volume */
  gainMultiplier: number;
}

export interface BreathPulsePreset {
  id: string;
  name: string;
  detail: string;
  breathRate: number;
  breathDepth: number;
  pulseTarget: number;
  coupling: number;
}

export const BREATH_PULSE_PRESETS: BreathPulsePreset[] = [
  { id: 'box', name: 'Box 4-4', detail: 'Steady regulation', breathRate: 7.5, breathDepth: 0.6, pulseTarget: 68, coupling: 0.6 },
  { id: 'coherent', name: 'Coherent 5.5', detail: 'HRV coherence', breathRate: 5.5, breathDepth: 0.75, pulseTarget: 62, coupling: 0.75 },
  { id: 'tactical', name: 'Tactical', detail: 'Alert readiness', breathRate: 12, breathDepth: 0.4, pulseTarget: 88, coupling: 0.45 },
  { id: 'downshift', name: 'Downshift', detail: 'Post-contact recovery', breathRate: 4.5, breathDepth: 0.9, pulseTarget: 56, coupling: 0.9 },
];

const STORAGE = {
  rate: 'orpheus.breath.rate',
  depth: 'orpheus.breath.depth',
  pulse: 'orpheus.pulse.target',
  coupling: 'orpheus.breath.coupling',
  follow: 'orpheus.breath.followLive',
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

interface UseBreathPulseModulationOptions {
  /** Live measured pulse from biofeedback, used when follow-live is enabled */
  livePulseRate?: number;
  /** Live measured breath signal (0..1) */
  liveBreathSignal?: number;
  /** Whether live biofeedback is actually running */
  liveAvailable?: boolean;
}

export const useBreathPulseModulation = ({
  livePulseRate = 72,
  liveBreathSignal = 0.5,
  liveAvailable = false,
}: UseBreathPulseModulationOptions = {}) => {
  const [breathRate, setBreathRate] = usePersistentState(STORAGE.rate, 5.5);
  const [breathDepth, setBreathDepth] = usePersistentState(STORAGE.depth, 0.7);
  const [pulseTarget, setPulseTarget] = usePersistentState(STORAGE.pulse, 66);
  const [coupling, setCoupling] = usePersistentState(STORAGE.coupling, 0.65);
  const [followLive, setFollowLive] = usePersistentState(STORAGE.follow, false);

  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const modulationRef = useRef<BreathPulseModulationValues>({
    breathPhase: 0,
    pulsePhase: 0,
    depth: 0,
    intensity: 0,
    beatFrequency: 8,
    carrierTone: 220,
    gainMultiplier: 1,
  });

  /** Live biofeedback signals, updatable after render without re-subscribing the loop. */
  const liveSignalsRef = useRef({ livePulseRate, liveBreathSignal, liveAvailable });
  const settingsRef = useRef({ breathRate, breathDepth, pulseTarget, coupling, followLive });
  settingsRef.current = { breathRate, breathDepth, pulseTarget, coupling, followLive };


  useEffect(() => {
    let frame = 0;
    let breathAngle = 0;
    let pulseAngle = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const deltaSeconds = Math.min(0.1, (now - last) / 1000);
      last = now;

      const settings = settingsRef.current;
      const useLive = settings.followLive && settings.liveAvailable;

      const effectiveBreathRate = useLive
        ? clamp(4 + settings.liveBreathSignal * 12, 3, 20)
        : settings.breathRate;
      const effectivePulse = useLive ? settings.livePulseRate : settings.pulseTarget;

      breathAngle = (breathAngle + deltaSeconds * (effectiveBreathRate / 60) * Math.PI * 2) % (Math.PI * 2);
      pulseAngle = (pulseAngle + deltaSeconds * (effectivePulse / 60) * Math.PI * 2) % (Math.PI * 2);

      const breathPhase = (Math.sin(breathAngle) + 1) / 2;
      const pulseWave = Math.pow((Math.sin(pulseAngle) + 1) / 2, 4);

      const depthAmount = settings.coupling * settings.breathDepth;
      const depth = clamp(0.25 + breathPhase * depthAmount, 0, 1);
      const intensity = clamp(
        0.2 + breathPhase * 0.45 * settings.coupling + pulseWave * 0.35 * settings.coupling,
        0,
        1,
      );

      // Slower breathing -> lower (more restorative) beat frequency.
      const beatFrequency = clamp(3 + (effectiveBreathRate - 3) * 0.7, 3, 14);
      const carrierTone = clamp(140 + effectivePulse * 1.6, 120, 400);
      const gainMultiplier = clamp(1 - depthAmount * 0.45 + breathPhase * depthAmount * 0.9, 0.15, 1.6);

      modulationRef.current = {
        breathPhase,
        pulsePhase: pulseWave,
        depth,
        intensity,
        beatFrequency,
        carrierTone,
        gainMultiplier,
      };

      const surface = surfaceRef.current;
      if (surface) {
        surface.style.setProperty('--breath-phase', breathPhase.toFixed(3));
        surface.style.setProperty('--pulse-phase', pulseWave.toFixed(3));
        surface.style.setProperty('--interface-depth', depth.toFixed(3));
        surface.style.setProperty('--interface-intensity', intensity.toFixed(3));
        surface.style.setProperty('--breath-scale', (1 + (breathPhase - 0.5) * 0.012 * settings.coupling).toFixed(4));
        surface.style.setProperty('--breath-blur', `${(2.2 * (1 - depth) * settings.coupling).toFixed(2)}px`);
        surface.style.setProperty('--breath-lift', `${((breathPhase - 0.5) * 6 * settings.coupling).toFixed(2)}px`);
        surface.style.setProperty('--pulse-glow', (pulseWave * settings.coupling).toFixed(3));
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const applyPreset = useCallback((preset: BreathPulsePreset) => {
    setBreathRate(preset.breathRate);
    setBreathDepth(preset.breathDepth);
    setPulseTarget(preset.pulseTarget);
    setCoupling(preset.coupling);
  }, [setBreathDepth, setBreathRate, setCoupling, setPulseTarget]);

  const controls = useMemo(() => ({
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
  }), [applyPreset, breathDepth, breathRate, coupling, followLive, pulseTarget, setBreathDepth, setBreathRate, setCoupling, setFollowLive, setPulseTarget]);

  return { controls, modulationRef, surfaceRef };
};

export type BreathPulseControlsState = ReturnType<typeof useBreathPulseModulation>['controls'];

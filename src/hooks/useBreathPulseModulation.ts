import { useCallback, useEffect, useMemo, useRef } from 'react';
import { usePersistentState } from './usePersistentState';

/**
 * Where the breath and pulse values are written each frame. Writing them only onto the elements that
 * use them (instead of a large ancestor) keeps the browser from restyling the whole page every frame.
 * - `variables`: the element gets the --breath-*, --pulse-* and --interface-* custom properties.
 * - `transform`: the element gets the breathing scale, lift and blur as its own transform and filter.
 */
export type BreathTargetKind = 'variables' | 'transform';

export interface BreathTargets {
  add(element: HTMLElement, kind: BreathTargetKind): void;
  remove(element: HTMLElement, kind: BreathTargetKind): void;
}

/** Callback ref for one element at a time: registers it with the breath targets while it is mounted. */
export const useBreathTargetRef = (targets: BreathTargets, kind: BreathTargetKind = 'variables') => {
  const current = useRef<HTMLElement | null>(null);
  return useCallback(
    (element: HTMLElement | null) => {
      if (current.current) targets.remove(current.current, kind);
      current.current = element;
      if (element) targets.add(element, kind);
    },
    [kind, targets],
  );
};

interface BreathFrame {
  variables: Array<[string, string]>;
  transform: string;
  filter: string;
}

const writeVariables = (element: HTMLElement, frame: BreathFrame) => {
  for (const [name, value] of frame.variables) element.style.setProperty(name, value);
};

const writeTransform = (element: HTMLElement, frame: BreathFrame) => {
  element.style.transform = frame.transform;
  element.style.filter = frame.filter;
};

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
  { id: 'box', name: 'Box 4-4', detail: 'Visual pacing preset', breathRate: 7.5, breathDepth: 0.6, pulseTarget: 68, coupling: 0.6 },
  { id: 'coherent', name: 'Slow 5.5', detail: 'Visual pacing preset', breathRate: 5.5, breathDepth: 0.75, pulseTarget: 62, coupling: 0.75 },
  { id: 'tactical', name: 'Fast', detail: 'Visual pacing preset', breathRate: 12, breathDepth: 0.4, pulseTarget: 88, coupling: 0.45 },
  { id: 'downshift', name: 'Slow 4.5', detail: 'Visual pacing preset', breathRate: 4.5, breathDepth: 0.9, pulseTarget: 56, coupling: 0.9 },
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
  /** Microphone-derived audio energy proxy (0..1), not measured respiration. */
  liveAudioEnvelope?: number;
  /** Whether local microphone processing is running. */
  liveAvailable?: boolean;
}

export const useBreathPulseModulation = ({
  liveAudioEnvelope = 0.5,
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

  /** Local audio envelope, updated after render without re-subscribing the loop. */
  const liveSignalsRef = useRef({ liveAudioEnvelope, liveAvailable });
  const variableTargetsRef = useRef(new Set<HTMLElement>());
  const transformTargetsRef = useRef(new Set<HTMLElement>());
  const latestFrameRef = useRef<BreathFrame | null>(null);
  const targets = useMemo<BreathTargets>(
    () => ({
      add: (element, kind) => {
        (kind === 'transform' ? transformTargetsRef : variableTargetsRef).current.add(element);
        // Apply the latest values at once, so a newly shown element never paints a stale frame.
        const frame = latestFrameRef.current;
        if (frame) (kind === 'transform' ? writeTransform : writeVariables)(element, frame);
      },
      remove: (element, kind) => {
        (kind === 'transform' ? transformTargetsRef : variableTargetsRef).current.delete(element);
        if (kind === 'transform') {
          element.style.transform = '';
          element.style.filter = '';
        }
      },
    }),
    [],
  );
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
      const live = liveSignalsRef.current;
      const useLive = settings.followLive && live.liveAvailable;

      // Audio energy can drive visual intensity, but cannot establish breathing or pulse rate.
      const effectiveBreathRate = settings.breathRate;
      const effectivePulse = settings.pulseTarget;

      breathAngle = (breathAngle + deltaSeconds * (effectiveBreathRate / 60) * Math.PI * 2) % (Math.PI * 2);
      pulseAngle = (pulseAngle + deltaSeconds * (effectivePulse / 60) * Math.PI * 2) % (Math.PI * 2);

      const breathPhase = (Math.sin(breathAngle) + 1) / 2;
      const pulseWave = Math.pow((Math.sin(pulseAngle) + 1) / 2, 4);

      const depthAmount = settings.coupling * settings.breathDepth;
      const audioResponse = useLive ? clamp(live.liveAudioEnvelope, 0, 1) : 0;
      const depth = clamp(0.25 + breathPhase * depthAmount, 0, 1);
      const intensity = clamp(
        0.2 + breathPhase * 0.45 * settings.coupling + pulseWave * 0.25 * settings.coupling + audioResponse * 0.1,
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

      const breathScale = (1 + (breathPhase - 0.5) * 0.012 * settings.coupling).toFixed(4);
      const breathBlur = `${(2.2 * (1 - depth) * settings.coupling).toFixed(2)}px`;
      const breathLift = `${((breathPhase - 0.5) * 6 * settings.coupling).toFixed(2)}px`;
      const frameValues: BreathFrame = {
        variables: [
          ['--breath-phase', breathPhase.toFixed(3)],
          ['--pulse-phase', pulseWave.toFixed(3)],
          ['--interface-depth', depth.toFixed(3)],
          ['--interface-intensity', intensity.toFixed(3)],
          ['--breath-scale', breathScale],
          ['--breath-blur', breathBlur],
          ['--breath-lift', breathLift],
          ['--pulse-glow', (pulseWave * settings.coupling).toFixed(3)],
        ],
        transform: `scale(${breathScale}) translateY(${breathLift})`,
        filter: `blur(${breathBlur})`,
      };
      latestFrameRef.current = frameValues;

      const surface = surfaceRef.current;
      if (surface) writeVariables(surface, frameValues);
      for (const element of variableTargetsRef.current) writeVariables(element, frameValues);
      for (const element of transformTargetsRef.current) writeTransform(element, frameValues);

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

  return { controls, modulationRef, surfaceRef, liveSignalsRef, targets };
};

export type BreathPulseControlsState = ReturnType<typeof useBreathPulseModulation>['controls'];

import React, { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Slider } from '@/components/common/Slider';
import styles from './NeuroEmSimulator.module.css';

/**
 * A decorative 3D resonance visual. Five glowing nodes respond to the sliders. It does not model a
 * brain, electromagnetic stimulation, or any effect on people.
 */
const NODES = {
  North: { position: new THREE.Vector3(0, 0.8, 0), color: 0x3fdcc6, band: [8, 20] },
  East: { position: new THREE.Vector3(0.8, 0, 0), color: 0x78b6ff, band: [18, 30] },
  South: { position: new THREE.Vector3(0, -0.8, -0.3), color: 0xb9a3ff, band: [2, 10] },
  West: { position: new THREE.Vector3(-0.8, 0, 0), color: 0xfac85c, band: [25, 40] },
  Core: { position: new THREE.Vector3(0, 0.1, 0.6), color: 0x9ff3e5, band: [5, 15] },
} as const;

type NodeName = keyof typeof NODES;
type Waveform = 'sine' | 'square' | 'sawtooth';

const pulseFor = (elapsed: number, waveform: Waveform) => {
  const phase = (elapsed * 0.75) % 1;
  if (waveform === 'square') return phase > 0.5 ? 1 : 0.45;
  if (waveform === 'sawtooth') return 0.45 + phase * 0.55;
  return 0.65 + Math.sin(elapsed * 4) * 0.25;
};

const Node = ({ position, color, activity, waveform }: { position: THREE.Vector3; color: number; activity: number; waveform: Waveform }) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const pulse = pulseFor(clock.elapsedTime, waveform);
    const scale = 0.45 + activity * (1.2 + pulse * 0.8);
    const material = meshRef.current.material as THREE.MeshStandardMaterial;
    meshRef.current.scale.set(scale, scale, scale);
    material.opacity = 0.25 + activity * 0.7;
    material.emissiveIntensity = activity * (0.35 + pulse * 0.35);
  });
  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[0.3, 28, 28]} />
      <meshStandardMaterial color={color} transparent opacity={0.35} emissive={color} emissiveIntensity={activity * 0.5} />
    </mesh>
  );
};

const Lattice = ({ activity, waveform }: { activity: Record<NodeName, number>; waveform: Waveform }) => {
  const groupRef = useRef<THREE.Group>(null!);
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += delta * 0.16;
    groupRef.current.rotation.x = 0.16;
  });
  return (
    <group ref={groupRef}>
      {(Object.keys(NODES) as NodeName[]).map((name) => (
        <Node key={name} position={NODES[name].position} color={NODES[name].color} activity={activity[name]} waveform={waveform} />
      ))}
    </group>
  );
};

interface NeuroEmSimulatorProps {
  bioResonanceFrequency: number;
}

export const NeuroEmSimulator: React.FC<NeuroEmSimulatorProps> = React.memo(({ bioResonanceFrequency }) => {
  const [frequency, setFrequency] = useState(10);
  const [amplitude, setAmplitude] = useState(0.5);
  const [waveform, setWaveform] = useState<Waveform>('sine');
  const effective = useMemo(() => frequency * 0.8 + Math.min(40, Math.max(1, bioResonanceFrequency || frequency)) * 0.2, [bioResonanceFrequency, frequency]);
  const activity = useMemo(() => {
    const levels = {} as Record<NodeName, number>;
    for (const name of Object.keys(NODES) as NodeName[]) {
      const [low, high] = NODES[name].band;
      levels[name] = effective > low && effective < high ? amplitude * Math.min(1, effective / (high + 5)) : 0;
    }
    return levels;
  }, [amplitude, effective]);
  const lit = (Object.keys(activity) as NodeName[]).filter((name) => activity[name] > 0.1);

  return (
    <section aria-label="3D resonance visual" className={styles.container}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={styles.title}>3D resonance visual</h2>
        <span className="o-chip border-dashed border-o-text3/70 text-o-text2">Decorative</span>
      </div>
      <div className={styles.mainContent}>
        <div className={styles.visualization} role="img" aria-label={`Rotating lattice of five nodes; lit: ${lit.length ? lit.join(', ') : 'none'}.`}>
          <Canvas camera={{ position: [0, 0, 3] as [number, number, number], fov: 50 }}>
            <ambientLight intensity={0.24} />
            <pointLight position={[10, 10, 10]} intensity={0.8} />
            <Lattice activity={activity} waveform={waveform} />
          </Canvas>
        </div>
        <div className={styles.controlsAndFeedback}>
          <div className={styles.controls}>
            <div className={styles.control}>
              <p className="text-sm text-o-text2">Frequency: {frequency.toFixed(1)} Hz</p>
              <Slider label="Visual frequency" valueText={(value) => `${value} hertz`} min={1} max={40} step={0.5} value={[frequency]} onValueChange={([value]) => setFrequency(value)} />
            </div>
            <div className={styles.control}>
              <p className="text-sm text-o-text2">Amplitude: {amplitude.toFixed(2)}</p>
              <Slider label="Visual amplitude" min={0} max={1} step={0.05} value={[amplitude]} onValueChange={([value]) => setAmplitude(value)} />
            </div>
            <div className={styles.control} role="group" aria-label="Waveform">
              <p className="text-sm text-o-text2">Waveform</p>
              <div className={styles.waveformButtons}>
                {(['sine', 'square', 'sawtooth'] as const).map((mode) => (
                  <button key={mode} type="button" className="o-button min-h-9 px-3 text-xs" aria-pressed={waveform === mode} onClick={() => setWaveform(mode)}>
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className={styles.feedback}>
            <h3 className={styles.feedbackTitle}>What this is</h3>
            <p className="text-sm text-o-text2">
              A decorative visualization: node glow follows the sliders and the display marker. It does not model the brain, electromagnetic fields, or any effect on people,
              and it measures nothing.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
});

NeuroEmSimulator.displayName = 'NeuroEmSimulator';

import React, { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Slider } from './ui/slider';
import { Label } from './ui/label';
import { Button } from './ui/button';
import styles from './NeuroEmSimulator.module.css';

const brainRegions = {
  'Frontal Lobe': { position: new THREE.Vector3(0, 0.3, 0.8), color: 0xffa500 },
  'Parietal Lobe': { position: new THREE.Vector3(0, 0.8, 0), color: 0x00ff00 },
  'Temporal Lobe': { position: new THREE.Vector3(-0.8, 0, 0), color: 0x0000ff },
  'Occipital Lobe': { position: new THREE.Vector3(0, 0, -0.8), color: 0xff00ff },
  'Cerebellum': { position: new THREE.Vector3(0, -0.8, -0.5), color: 0xffff00 },
};

type BrainRegionName = keyof typeof brainRegions;
type Waveform = 'sine' | 'square' | 'sawtooth';

const cognitiveEffects: Record<string, Record<string, string>> = {
  'Frontal Lobe': {
    low: 'Reduced focus',
    mid: 'Enhanced problem-solving',
    high: 'Anxiety, racing thoughts',
  },
  'Temporal Lobe': {
    low: 'Muffled hearing',
    mid: 'Auditory hallucination (tones)',
    high: 'Memory recall interference',
  },
  'Occipital Lobe': {
    low: 'Blurred peripheral vision',
    mid: 'Visual artifacts (phosphenes)',
    high: 'Pattern overlay on vision',
  },
  'Parietal Lobe': {
    low: 'Numbness in extremities',
    mid: 'Heightened spatial awareness',
    high: 'Vertigo, disorientation',
  },
  'Cerebellum': {
    low: 'Slight motor imprecision',
    mid: 'Improved motor coordination',
    high: 'Loss of balance',
  },
};

const getWaveformPulse = (elapsedTime: number, waveform: Waveform) => {
  const phase = (elapsedTime * 0.75) % 1;

  if (waveform === 'square') {
    return phase > 0.5 ? 1 : 0.45;
  }

  if (waveform === 'sawtooth') {
    return 0.45 + phase * 0.55;
  }

  return 0.65 + Math.sin(elapsedTime * 4) * 0.25;
};

const BrainRegion = ({
  name,
  position,
  color,
  activity,
  waveform,
}: {
  name: string;
  position: THREE.Vector3;
  color: number;
  activity: number;
  waveform: Waveform;
}) => {
  const meshRef = useRef<THREE.Mesh>(null!);

  useFrame(({ clock }) => {
    if (!meshRef.current) {
      return;
    }

    const pulse = getWaveformPulse(clock.elapsedTime, waveform);
    const scale = 0.45 + activity * (1.2 + pulse * 0.8);
    const material = meshRef.current.material as THREE.MeshStandardMaterial;

    meshRef.current.scale.set(scale, scale, scale);
    material.opacity = 0.25 + activity * 0.7;
    material.emissiveIntensity = activity * (0.35 + pulse * 0.35);
  });

  return (
    <mesh ref={meshRef} position={position} name={name}>
      <sphereGeometry args={[0.3, 28, 28]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={0.35}
        emissive={color}
        emissiveIntensity={activity * 0.5}
      />
    </mesh>
  );
};

const BrainModel = ({
  activityLevels,
  waveform,
}: {
  activityLevels: Record<BrainRegionName, number>;
  waveform: Waveform;
}) => {
  const groupRef = useRef<THREE.Group>(null!);

  useFrame((_, delta) => {
    if (!groupRef.current) {
      return;
    }

    groupRef.current.rotation.y += delta * 0.16;
    groupRef.current.rotation.x = 0.16;
  });

  return (
    <group ref={groupRef}>
      {Object.entries(brainRegions).map(([name, { position, color }]) => (
        <BrainRegion
          key={name}
          name={name}
          position={position}
          color={color}
          activity={activityLevels[name as BrainRegionName]}
          waveform={waveform}
        />
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

  const effectiveFrequency = useMemo(() => {
    const supportFrequency = Math.min(40, Math.max(1, bioResonanceFrequency || frequency));
    return frequency * 0.8 + supportFrequency * 0.2;
  }, [bioResonanceFrequency, frequency]);

  const activityLevels = useMemo(() => {
    const levels: Record<BrainRegionName, number> = {
      'Frontal Lobe': 0,
      'Parietal Lobe': 0,
      'Temporal Lobe': 0,
      'Occipital Lobe': 0,
      'Cerebellum': 0,
    };

    if (effectiveFrequency > 5 && effectiveFrequency < 15) levels['Frontal Lobe'] = amplitude * (effectiveFrequency / 20);
    if (effectiveFrequency > 8 && effectiveFrequency < 20) levels['Parietal Lobe'] = amplitude * (effectiveFrequency / 25);
    if (effectiveFrequency > 18 && effectiveFrequency < 30) levels['Temporal Lobe'] = amplitude * (effectiveFrequency / 35);
    if (effectiveFrequency > 25 && effectiveFrequency < 40) levels['Occipital Lobe'] = amplitude * (effectiveFrequency / 45);
    if (effectiveFrequency > 2 && effectiveFrequency < 10) levels['Cerebellum'] = amplitude * (effectiveFrequency / 15);

    return levels;
  }, [effectiveFrequency, amplitude]);

  const predictedEffects = useMemo(() => {
    return Object.entries(activityLevels)
      .map(([name, activity]) => {
        if (activity > 0.1) {
          const level = activity < 0.4 ? 'low' : activity < 0.7 ? 'mid' : 'high';
          return { name, effect: cognitiveEffects[name as BrainRegionName][level] };
        }
        return null;
      })
      .filter(Boolean);
  }, [activityLevels]);

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Neuro-EM Simulator</h2>
      <div className={styles.mainContent}>
        <div className={styles.visualization}>
          <Canvas camera={{ position: [0, 0, 3] as [number, number, number], fov: 50 }} gl={{ preserveDrawingBuffer: true }}>
            <ambientLight intensity={0.24} />
            <pointLight position={[10, 10, 10]} intensity={0.8} />
            <BrainModel activityLevels={activityLevels} waveform={waveform} />
          </Canvas>
        </div>
        <div className={styles.controlsAndFeedback}>
          <div className={styles.controls}>
            <div className={styles.control}>
              <Label htmlFor="frequency">Frequency: {frequency.toFixed(1)} Hz</Label>
              <Slider id="frequency" min={1} max={40} step={0.5} value={[frequency]} onValueChange={([val]) => setFrequency(val)} />
            </div>
            <div className={styles.control}>
              <Label htmlFor="amplitude">Amplitude: {amplitude.toFixed(2)}</Label>
              <Slider id="amplitude" min={0} max={1} step={0.05} value={[amplitude]} onValueChange={([val]) => setAmplitude(val)} />
            </div>
            <div className={styles.control}>
              <Label>Waveform</Label>
              <div className={styles.waveformButtons}>
                {(['sine', 'square', 'sawtooth'] as const).map((mode) => (
                  <Button key={mode} variant={waveform === mode ? 'secondary' : 'outline'} onClick={() => setWaveform(mode)}>
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <div className={styles.feedback}>
            <h3 className={styles.feedbackTitle}>Predicted Cognitive Effects</h3>
            <ul className={styles.effectList}>
              {predictedEffects.length > 0 ? (
                predictedEffects.map((item) => (
                  <li key={item!.name}>
                    <strong>{item!.name}:</strong> {item!.effect}
                  </li>
                ))
              ) : (
                <li>No significant effects detected.</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
});

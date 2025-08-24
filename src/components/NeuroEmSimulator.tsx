import React, { useState, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import { Slider } from './ui/slider';
import { Label } from './ui/label';
import { Button } from './ui/button';
import styles from './NeuroEmSimulator.module.css';

// --- Simulation Logic ---

// Simplified brain region definitions
const brainRegions = {
  'Frontal Lobe': { position: new THREE.Vector3(0, 0.3, 0.8), color: 0xffa500 },
  'Parietal Lobe': { position: new THREE.Vector3(0, 0.8, 0), color: 0x00ff00 },
  'Temporal Lobe': { position: new THREE.Vector3(-0.8, 0, 0), color: 0x0000ff },
  'Occipital Lobe': { position: new THREE.Vector3(0, 0, -0.8), color: 0xff00ff },
  'Cerebellum': { position: new THREE.Vector3(0, -0.8, -0.5), color: 0xffff00 },
};

type BrainRegionName = keyof typeof brainRegions;

// Cognitive effects mapping
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

// --- 3D Components ---

const BrainRegion = ({ name, position, color, activity }: { name: string, position: THREE.Vector3, color: number, activity: number }) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const scale = 0.5 + activity * 2;
  const opacity = 0.3 + activity * 0.7;

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.scale.set(scale, scale, scale);
      (meshRef.current.material as THREE.MeshStandardMaterial).opacity = opacity;
    }
  });

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={opacity}
          emissive={color}
          emissiveIntensity={activity * 0.5}
        />
      </mesh>
      <Text
        position={[0, 0.5, 0]}
        fontSize={0.1}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {name}
      </Text>
    </group>
  );
};

const BrainModel = ({ activityLevels }: { activityLevels: Record<BrainRegionName, number> }) => {
  return (
    <group>
      {Object.entries(brainRegions).map(([name, { position, color }]) => (
        <BrainRegion
          key={name}
          name={name}
          position={position}
          color={color}
          activity={activityLevels[name as BrainRegionName]}
        />
      ))}
    </group>
  );
};

// --- Main Component ---

interface NeuroEmSimulatorProps {
  bioResonanceFrequency: number;
}

export const NeuroEmSimulator: React.FC<NeuroEmSimulatorProps> = ({ bioResonanceFrequency }) => {
  const [frequency, setFrequency] = useState(10); // Hz
  const [amplitude, setAmplitude] = useState(0.5); // 0 to 1
  const [waveform, setWaveform] = useState('sine'); // sine, square, sawtooth

  // Simulation logic
  const activityLevels = useMemo(() => {
    const levels: Record<BrainRegionName, number> = {
      'Frontal Lobe': 0,
      'Parietal Lobe': 0,
      'Temporal Lobe': 0,
      'Occipital Lobe': 0,
      'Cerebellum': 0,
    };

    // Example logic: different frequencies affect different regions
    if (frequency > 5 && frequency < 15) levels['Frontal Lobe'] = amplitude * (frequency / 20);
    if (frequency > 8 && frequency < 20) levels['Parietal Lobe'] = amplitude * (frequency / 25);
    if (frequency > 18 && frequency < 30) levels['Temporal Lobe'] = amplitude * (frequency / 35);
    if (frequency > 25 && frequency < 40) levels['Occipital Lobe'] = amplitude * (frequency / 45);
    if (frequency > 2 && frequency < 10) levels['Cerebellum'] = amplitude * (frequency / 15);

    return levels;
  }, [frequency, amplitude]);

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
          <Canvas camera={{ position: [0, 0, 3], fov: 50 }}>
            <ambientLight intensity={0.2} />
            <pointLight position={[10, 10, 10]} intensity={0.8} />
            <BrainModel activityLevels={activityLevels} />
            <OrbitControls />
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
                {['sine', 'square', 'sawtooth'].map(w => (
                  <Button key={w} variant={waveform === w ? 'secondary' : 'outline'} onClick={() => setWaveform(w)}>
                    {w.charAt(0).toUpperCase() + w.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <div className={styles.feedback}>
            <h3 className={styles.feedbackTitle}>Predicted Cognitive Effects</h3>
            <ul className={styles.effectList}>
              {predictedEffects.length > 0 ? (
                predictedEffects.map(item => (
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
};

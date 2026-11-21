import React, { useMemo, useState } from 'react';
import { ResonanceVolume, type Waveform } from './instruments/ResonanceVolume';
import * as THREE from 'three';
import { Slider } from './ui/slider';
import { Label } from './ui/label';
import { Button } from './ui/button';
import styles from './NeuroEmSimulator.module.css';

const brainRegions = {
  'Frontal Lobe': { position: new THREE.Vector3(0, 0.3, 0.8), color: 0xb2f3bf },
  'Parietal Lobe': { position: new THREE.Vector3(0, 0.8, 0), color: 0xaad8a9 },
  'Temporal Lobe': { position: new THREE.Vector3(-0.8, 0, 0), color: 0x95ceef },
  'Occipital Lobe': { position: new THREE.Vector3(0, 0, -0.8), color: 0xceafe3 },
  'Cerebellum': { position: new THREE.Vector3(0, -0.8, -0.5), color: 0xa1d7b9 },
};

type BrainRegionName = keyof typeof brainRegions;
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

  const nodes = useMemo(() => (Object.keys(brainRegions) as BrainRegionName[]).map((name) => ({
    name, ...brainRegions[name], activity: activityLevels[name],
  })), [activityLevels]);

  return (
    <div className={styles.container}>
      <header className={styles.heading}><h2 className={styles.title}>Neuro-EM Simulator</h2><span>Simulated response</span></header>
      <div className={styles.mainContent}>
        <div className={styles.visualization}>
          <ResonanceVolume nodes={nodes} frequency={effectiveFrequency} waveform={waveform} amplitude={amplitude} />
        </div>
        <div className={styles.controlsAndFeedback}>
          <div className={styles.controls}>
            <div className={styles.control}>
              <Label htmlFor="frequency">Frequency: {frequency.toFixed(1)} Hz</Label>
              <Slider id="frequency" label="Visual frequency" min={1} max={40} step={0.5} value={[frequency]} onValueChange={([val]) => setFrequency(val)} />
            </div>
            <div className={styles.control}>
              <Label htmlFor="amplitude">Amplitude: {amplitude.toFixed(2)}</Label>
              <Slider id="amplitude" label="Visual amplitude" min={0} max={1} step={0.05} value={[amplitude]} onValueChange={([val]) => setAmplitude(val)} />
            </div>
            <div className={styles.control}>
              <p>Waveform</p>
              <div className={styles.waveformButtons}>
                {(['sine', 'square', 'sawtooth'] as const).map((mode) => (
                  <Button key={mode} aria-pressed={waveform === mode} variant={waveform === mode ? 'secondary' : 'outline'} onClick={() => setWaveform(mode)}>
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <div className={styles.feedback}>
            <h3 className={styles.feedbackTitle}>Simulated node response</h3>
            <ul className={styles.effectList}>
              {nodes.map((node) => (
                <li key={node.name}><span>{node.name}</span><span>{Math.round(node.activity * 100)}%</span></li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
});

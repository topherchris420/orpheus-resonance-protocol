import React, { useState, useMemo, useEffect } from 'react';
import styles from './ElectrokineticModelingLayer.module.css';
import { Slider } from './ui/slider';
import { Label } from './ui/label';
import { Button } from './ui/button';

interface ElectrokineticModelingLayerProps {
  bioResonanceFrequency: number;
}

export const ElectrokineticModelingLayer: React.FC<ElectrokineticModelingLayerProps> = ({ bioResonanceFrequency }) => {
  const [chargeSymmetry, setChargeSymmetry] = useState(0.5); // 0 to 1
  const [dielectric, setDielectric] = useState(1); // Dielectric constant
  const [voltage, setVoltage] = useState(100); // kV
  const [dIdt, setDIdt] = useState(1); // Waveform slope dI/dt

  useEffect(() => {
    // Modulate voltage based on bio-resonance frequency
    // Scaling factor can be adjusted for desired sensitivity
    const newVoltage = 50 + (bioResonanceFrequency / 10);
    setVoltage(newVoltage > 200 ? 200 : newVoltage < 10 ? 10 : newVoltage);
  }, [bioResonanceFrequency]);

  const fieldLines = useMemo(() => {
    const numLines = Math.floor(voltage / 20);
    const baseCurvature = 80;
    const curvature = baseCurvature / dielectric;

    return Array.from({ length: numLines }).map((_, i) => {
      const startY = 100 - (numLines / 2) * 10 + i * 10;
      return {
        id: i,
        d: `M 10,100 Q 150,${100 + (i - numLines / 2) * curvature} 290,100`
      };
    });
  }, [voltage, dielectric]);

  const forceVector = useMemo(() => {
    const angle = (chargeSymmetry - 0.5) * Math.PI; // -PI/2 to PI/2
    // Symbolic representation of force based on voltage and dI/dt
    const length = (voltage / 4) * (1 + dIdt);
    return {
      x1: 150,
      y1: 150,
      x2: 150 + length * Math.sin(angle),
      y2: 150 - length * Math.cos(angle),
    };
  }, [chargeSymmetry, voltage, dIdt]);

  const cymaticPatterns = useMemo(() => {
    const numCircles = Math.floor(bioResonanceFrequency / 50);
    return Array.from({ length: numCircles }).map((_, i) => ({
      id: i,
      r: (i + 1) * 20,
      // Animation duration based on dIdt, faster pulse for higher dIdt
      animationDuration: `${2 / dIdt}s`,
    }));
  }, [bioResonanceFrequency, dIdt]);

  const handleExport = () => {
    const exportData = {
      timestamp: new Date().toISOString(),
      resonanceLog: {
        bioResonanceFrequency,
      },
      simulationParameters: {
        voltage,
        chargeSymmetry,
        dielectric,
        dIdt,
      },
      symbolicForceMap: {
        forceVector,
        fieldLineCount: fieldLines.length,
      },
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `electrokinetic_log_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Electrokinetic Modeling Layer</h2>
      <div className={styles.visualization}>
        <svg width="100%" height="100%" viewBox="0 0 300 200">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5"
                markerWidth="3" markerHeight="3"
                orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#0f0" />
            </marker>
            <filter id="cymaticFilter">
              <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="3" result="turbulence" />
              <feDisplacementMap in2="turbulence" in="SourceGraphic" scale="10" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>

          {/* Cymatic Imagery */}
          <g filter="url(#cymaticFilter)" opacity="0.3">
            {cymaticPatterns.map(circle => (
              <circle
                key={circle.id}
                cx="150"
                cy="100"
                r={circle.r}
                fill="none"
                stroke="#0f0"
                strokeWidth="1"
                className={styles.cymaticCircle}
                style={{ animationDuration: circle.animationDuration }}
              />
            ))}
          </g>

          {/* Field Lines */}
          {fieldLines.map(line => (
            <path
              key={line.id}
              d={line.d}
              stroke="rgba(0, 255, 0, 0.4)"
              strokeWidth="1"
              fill="none"
              className={styles.fieldLine}
            />
          ))}

          {/* Force Vector */}
          <line
            x1={forceVector.x1} y1={forceVector.y1}
            x2={forceVector.x2} y2={forceVector.y2}
            stroke="#0f0"
            strokeWidth="2"
            markerEnd="url(#arrow)"
            className={styles.forceVector}
          />

          {/* Capacitor Plates */}
          <rect x="50" y="180" width="200" height="5" fill="rgba(0,255,255,0.5)" />
          <rect x="50" y="10" width="200" height="5" fill="rgba(255,0,255,0.5)" />
        </svg>
      </div>
      <div className={styles.controls}>
        <div className={styles.control}>
          <Label htmlFor="voltage">Voltage: {voltage} kV</Label>
          <Slider id="voltage" min={10} max={200} step={10} value={[voltage]} onValueChange={([val]) => setVoltage(val)} />
        </div>
        <div className={styles.control}>
          <Label htmlFor="symmetry">Charge Symmetry</Label>
          <Slider id="symmetry" min={0} max={1} step={0.05} value={[chargeSymmetry]} onValueChange={([val]) => setChargeSymmetry(val)} />
        </div>
        <div className={styles.control}>
          <Label htmlFor="dielectric">Dielectric Constant: {dielectric.toFixed(1)}</Label>
          <Slider id="dielectric" min={1} max={10} step={0.5} value={[dielectric]} onValueChange={([val]) => setDielectric(val)} />
        </div>
        <div className={styles.control}>
          <Label htmlFor="didt">Waveform Slope (dI/dt)</Label>
          <Slider id="didt" min={0.1} max={5} step={0.1} value={[dIdt]} onValueChange={([val]) => setDIdt(val)} />
        </div>
        <Button onClick={handleExport} className={styles.exportButton}>Export Data</Button>
      </div>
    </div>
  );
};

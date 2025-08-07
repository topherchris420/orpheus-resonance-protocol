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
    const numLines = Math.floor(voltage / 15) + 3;
    const baseCurvature = 60;
    const curvature = baseCurvature / dielectric;
    const asymmetryFactor = (chargeSymmetry - 0.5) * 40;

    return Array.from({ length: numLines }).map((_, i) => {
      const normalizedPos = (i / (numLines - 1)) - 0.5;
      const baseY = 100 + normalizedPos * 80;
      const controlY = baseY + normalizedPos * curvature + asymmetryFactor * Math.sin(normalizedPos * Math.PI);
      const endY = 100 + normalizedPos * 60 * chargeSymmetry;
      
      return {
        id: i,
        d: `M 10,${baseY} Q 150,${controlY} 290,${endY}`,
        opacity: 0.3 + (voltage / 400) + Math.abs(normalizedPos) * 0.3
      };
    });
  }, [voltage, dielectric, chargeSymmetry]);

  // Multiple force vectors based on Jefimenko field equations
  const forceVectors = useMemo(() => {
    const baseAngle = (chargeSymmetry - 0.5) * Math.PI;
    const baseLength = (voltage / 4) * (1 + dIdt);
    
    return [
      // Primary thrust vector
      {
        id: 'primary',
        x1: 150,
        y1: 100,
        x2: 150 + baseLength * Math.sin(baseAngle),
        y2: 100 - baseLength * Math.cos(baseAngle),
        color: '#0f0',
        width: 3
      },
      // Secondary field vectors
      {
        id: 'secondary-1',
        x1: 100,
        y1: 130,
        x2: 100 + (baseLength * 0.6) * Math.sin(baseAngle + 0.5),
        y2: 130 - (baseLength * 0.6) * Math.cos(baseAngle + 0.5),
        color: '#0ff',
        width: 2
      },
      {
        id: 'secondary-2',
        x1: 200,
        y1: 130,
        x2: 200 + (baseLength * 0.6) * Math.sin(baseAngle - 0.5),
        y2: 130 - (baseLength * 0.6) * Math.cos(baseAngle - 0.5),
        color: '#0ff',
        width: 2
      }
    ];
  }, [chargeSymmetry, voltage, dIdt]);

  const cymaticPatterns = useMemo(() => {
    const baseCircles = Math.floor(bioResonanceFrequency / 50) + 2;
    const patterns = [];
    
    // Concentric resonance circles
    for (let i = 0; i < baseCircles; i++) {
      patterns.push({
        id: `circle-${i}`,
        type: 'circle',
        cx: 150,
        cy: 100,
        r: (i + 1) * (15 + voltage / 50),
        animationDuration: `${2 / dIdt}s`,
        opacity: 0.2 + (i * 0.1)
      });
    }
    
    // Standing wave patterns based on charge symmetry
    const waveNodes = Math.floor(chargeSymmetry * 6) + 3;
    for (let i = 0; i < waveNodes; i++) {
      const x = 50 + (i * 200 / waveNodes);
      patterns.push({
        id: `node-${i}`,
        type: 'ellipse',
        cx: x,
        cy: 100 + Math.sin(i * Math.PI / 3) * 20 * chargeSymmetry,
        rx: 8 + voltage / 100,
        ry: 4 + voltage / 200,
        animationDuration: `${1.5 / dIdt}s`,
        opacity: 0.4
      });
    }
    
    return patterns;
  }, [bioResonanceFrequency, dIdt, voltage, chargeSymmetry]);

  // Thrust zones based on field strength and symmetry
  const thrustZones = useMemo(() => {
    const zones = [];
    const zoneIntensity = (voltage / 200) * chargeSymmetry;
    
    // Primary thrust zone
    zones.push({
      id: 'primary-zone',
      x: 130,
      y: 80,
      width: 40,
      height: 40,
      opacity: zoneIntensity * 0.3,
      color: '0, 255, 0'
    });
    
    // Secondary zones based on dielectric properties
    if (dielectric > 3) {
      zones.push({
        id: 'secondary-zone-1',
        x: 80,
        y: 120,
        width: 30,
        height: 30,
        opacity: zoneIntensity * 0.2,
        color: '0, 255, 255'
      });
      zones.push({
        id: 'secondary-zone-2',
        x: 190,
        y: 120,
        width: 30,
        height: 30,
        opacity: zoneIntensity * 0.2,
        color: '0, 255, 255'
      });
    }
    
    return zones;
  }, [voltage, chargeSymmetry, dielectric]);

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
        forceVectors,
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
            {cymaticPatterns.map(pattern => 
              pattern.type === 'circle' ? (
                <circle
                  key={pattern.id}
                  cx={pattern.cx}
                  cy={pattern.cy}
                  r={pattern.r}
                  fill="none"
                  stroke={`rgba(0, 255, 0, ${pattern.opacity})`}
                  strokeWidth="1"
                  className={styles.cymaticCircle}
                  style={{ animationDuration: pattern.animationDuration }}
                />
              ) : (
                <ellipse
                  key={pattern.id}
                  cx={pattern.cx}
                  cy={pattern.cy}
                  rx={pattern.rx}
                  ry={pattern.ry}
                  fill="none"
                  stroke={`rgba(0, 255, 255, ${pattern.opacity})`}
                  strokeWidth="1"
                  className={styles.cymaticCircle}
                  style={{ animationDuration: pattern.animationDuration }}
                />
              )
            )}
          </g>

          {/* Field Lines */}
          {fieldLines.map(line => (
            <path
              key={line.id}
              d={line.d}
              stroke={`rgba(0, 255, 0, ${line.opacity})`}
              strokeWidth="1"
              fill="none"
              className={styles.fieldLine}
            />
          ))}

          {/* Force Vectors */}
          {forceVectors.map(vector => (
            <line
              key={vector.id}
              x1={vector.x1} y1={vector.y1}
              x2={vector.x2} y2={vector.y2}
              stroke={vector.color}
              strokeWidth={vector.width}
              markerEnd="url(#arrow)"
              className={styles.forceVector}
            />
          ))}

          {/* Thrust Zones */}
          {thrustZones.map(zone => (
            <rect
              key={zone.id}
              x={zone.x}
              y={zone.y}
              width={zone.width}
              height={zone.height}
              fill={`rgba(${zone.color}, ${zone.opacity})`}
              stroke={`rgba(${zone.color}, ${zone.opacity * 2})`}
              strokeWidth="1"
              rx="5"
            />
          ))}

          {/* Dynamic Capacitor Plates */}
          <rect 
            x="50" 
            y="180" 
            width={200 + voltage / 5} 
            height={3 + dielectric} 
            fill={`rgba(0,255,255,${0.3 + voltage / 400})`} 
          />
          <rect 
            x="50" 
            y={10 - chargeSymmetry * 5} 
            width={200 + voltage / 5} 
            height={3 + dielectric} 
            fill={`rgba(255,0,255,${0.3 + voltage / 400})`} 
          />
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

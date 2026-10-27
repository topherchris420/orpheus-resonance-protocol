import React, { useState } from 'react';
import { CALIBRATION_DURATION_MS, OperatorBaseline } from '../hooks/useOperatorBaseline';

interface BaselineCalibrationPanelProps {
  baseline: OperatorBaseline | null;
  isCalibrating: boolean;
  progress: number;
  liveStress: number;
  liveCohesion: number;
  onStart: () => void;
  onCancel: () => void;
  onClear: () => void;
  onAdjust: (patch: Partial<OperatorBaseline>) => void;
}

const pct = (value: number) => `${Math.round(value * 100)}%`;

/** A chart reference window over generated values. Not a personal or physiological calibration. */
export const BaselineCalibrationPanel: React.FC<BaselineCalibrationPanelProps> = ({ baseline, isCalibrating, progress, liveStress, liveCohesion, onStart, onCancel, onClear, onAdjust }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-lg border border-o-line bg-o-s2 p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" className="font-semibold text-o-text2 hover:text-o-text" aria-expanded={expanded} onClick={() => setExpanded((previous) => !previous)}>
          {expanded ? '▾' : '▸'} Chart reference window
        </button>
        <span className="text-o-text3">
          {isCalibrating ? `Sampling ${pct(progress)}` : baseline ? `Set · stress ${pct(baseline.stress)} · cohesion ${pct(baseline.cohesion)}` : 'Not set'}
        </span>
      </div>
      {isCalibrating && <progress className="mission-progress mt-2 h-1 w-full" value={progress} max={1} aria-label="Reference window sampling progress" />}
      {expanded && (
        <div className="mt-2 space-y-2">
          <p className="text-o-text3">
            Samples the generated stress and cohesion values for {Math.round(CALIBRATION_DURATION_MS / 1000)} s; their averages become the 50% line of the charts. This is a
            reference for simulated values, not a calibration of you.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {!isCalibrating ? (
              <button type="button" className="o-button min-h-9 px-2 text-xs" onClick={onStart}>
                {baseline ? 'Sample again' : 'Start sampling'}
              </button>
            ) : (
              <button type="button" className="o-button min-h-9 px-2 text-xs" onClick={onCancel}>
                Cancel
              </button>
            )}
            {baseline && !isCalibrating && (
              <button type="button" className="o-button-quiet min-h-9 px-2 text-xs" onClick={onClear}>
                Clear
              </button>
            )}
            <span className="ml-auto text-o-text3">
              now {pct(liveStress)} / {pct(liveCohesion)}
            </span>
          </div>
          {baseline && (
            <div className="space-y-2">
              {[
                { label: `Stress reference · ${pct(baseline.stress)}`, value: baseline.stress, min: 0, max: 1, patch: (value: number) => ({ stress: value }) },
                { label: `Cohesion reference · ${pct(baseline.cohesion)}`, value: baseline.cohesion, min: 0, max: 1, patch: (value: number) => ({ cohesion: value }) },
                { label: `Window width · ±${pct(baseline.stressSpread)}`, value: baseline.stressSpread, min: 0.05, max: 0.5, patch: (value: number) => ({ stressSpread: value, cohesionSpread: value }) },
              ].map((control) => (
                <label key={control.label} className="block text-o-text3">
                  {control.label}
                  <input
                    type="range"
                    min={control.min}
                    max={control.max}
                    step={0.01}
                    value={control.value}
                    onChange={(event) => onAdjust(control.patch(Number(event.target.value)))}
                    className="mt-1 w-full accent-[hsl(var(--o-teal))]"
                  />
                </label>
              ))}
              <p className="text-o-text3">
                Captured {new Date(baseline.capturedAt).toLocaleTimeString()} · {baseline.samples} samples
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

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

export const BaselineCalibrationPanel: React.FC<BaselineCalibrationPanelProps> = ({
  baseline,
  isCalibrating,
  progress,
  liveStress,
  liveCohesion,
  onStart,
  onCancel,
  onClear,
  onAdjust,
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-current/15 bg-black/50 p-2 font-mono text-[10px]">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded((previous) => !previous)}
          className="uppercase tracking-widest opacity-80 hover:opacity-100"
          aria-expanded={expanded}
        >
          {expanded ? '▾' : '▸'} Baseline Calibration
        </button>
        <span className="opacity-60">
          {isCalibrating
            ? `Sampling ${pct(progress)}`
            : baseline
              ? `Set · stress ${pct(baseline.stress)} · cohesion ${pct(baseline.cohesion)}`
              : 'Not calibrated'}
        </span>
      </div>

      {isCalibrating && (
        <div className="mt-2 h-1 w-full bg-current/10">
          <div className="h-full bg-current/60 transition-all duration-300" style={{ width: pct(progress) }} />
        </div>
      )}

      {expanded && (
        <div className="mt-2 space-y-2">
          <p className="opacity-60">
            Sample generated stress and cohesion for {Math.round(CALIBRATION_DURATION_MS / 1000)}s. Their averages
            become the 50% midpoint of the chart. This is a simulation baseline, not a personal or physiological calibration.
          </p>

          <div className="flex flex-wrap gap-2">
            {!isCalibrating ? (
              <button
                type="button"
                onClick={onStart}
                className="border border-current/40 px-2 py-1 uppercase tracking-wider hover:bg-current/10"
              >
                {baseline ? 'Recalibrate' : 'Start Calibration'}
              </button>
            ) : (
              <button
                type="button"
                onClick={onCancel}
                className="border border-current/40 px-2 py-1 uppercase tracking-wider hover:bg-current/10"
              >
                Cancel
              </button>
            )}
            {baseline && !isCalibrating && (
              <button
                type="button"
                onClick={onClear}
                className="border border-current/20 px-2 py-1 uppercase tracking-wider opacity-70 hover:bg-current/10"
              >
                Clear
              </button>
            )}
            <span className="ml-auto self-center opacity-50">
              live {pct(liveStress)} / {pct(liveCohesion)}
            </span>
          </div>

          {baseline && (
            <div className="space-y-2">
              <label className="block">
                <span className="opacity-70">Stress baseline · {pct(baseline.stress)}</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={baseline.stress}
                  onChange={(event) => onAdjust({ stress: Number(event.target.value) })}
                  className="mt-1 w-full accent-current"
                />
              </label>
              <label className="block">
                <span className="opacity-70">Cohesion baseline · {pct(baseline.cohesion)}</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={baseline.cohesion}
                  onChange={(event) => onAdjust({ cohesion: Number(event.target.value) })}
                  className="mt-1 w-full accent-current"
                />
              </label>
              <label className="block">
                <span className="opacity-70">Sensitivity window · ±{pct(baseline.stressSpread)}</span>
                <input
                  type="range"
                  min={0.05}
                  max={0.5}
                  step={0.01}
                  value={baseline.stressSpread}
                  onChange={(event) =>
                    onAdjust({ stressSpread: Number(event.target.value), cohesionSpread: Number(event.target.value) })
                  }
                  className="mt-1 w-full accent-current"
                />
              </label>
              <p className="opacity-50">
                Captured {new Date(baseline.capturedAt).toLocaleTimeString()} · {baseline.samples} samples
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

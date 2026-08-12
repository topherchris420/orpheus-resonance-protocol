import React, { useMemo, useState } from 'react';
import { MetricSample } from '../hooks/useMetricsHistory';
import { applyBaseline, OperatorBaseline } from '../hooks/useOperatorBaseline';

interface OperatorMetricsDashboardProps {
  history: MetricSample[];
  baseline?: OperatorBaseline | null;
  calibrationSlot?: React.ReactNode;
}

type MetricKey = 'stress' | 'cohesion' | 'hostilePressure' | 'intelAccuracy';

interface MetricSpec {
  key: MetricKey;
  label: string;
  hue: number;
  /** true when a higher value is a worse mission state. */
  inverted: boolean;
}

const METRICS: MetricSpec[] = [
  { key: 'stress', label: 'Operator Stress', hue: 8, inverted: true },
  { key: 'cohesion', label: 'Squad Cohesion', hue: 140, inverted: false },
  { key: 'hostilePressure', label: 'Hostile Pressure', hue: 32, inverted: true },
  { key: 'intelAccuracy', label: 'Intel Accuracy', hue: 190, inverted: false },
];

const WIDTH = 100;
const HEIGHT = 32;

const buildPath = (values: number[]): { line: string; area: string } => {
  if (values.length === 0) return { line: '', area: '' };
  const step = values.length > 1 ? WIDTH / (values.length - 1) : WIDTH;
  const points = values.map((value, index) => {
    const x = values.length > 1 ? index * step : WIDTH / 2;
    const y = HEIGHT - Math.min(1, Math.max(0, value)) * HEIGHT;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const line = `M ${points.join(' L ')}`;
  const area = `${line} L ${WIDTH},${HEIGHT} L 0,${HEIGHT} Z`;
  return { line, area };
};

const trendOf = (values: number[]): number => {
  if (values.length < 2) return 0;
  const window = values.slice(-6);
  return window[window.length - 1] - window[0];
};

export const OperatorMetricsDashboard: React.FC<OperatorMetricsDashboardProps> = React.memo(({
  history,
  baseline,
  calibrationSlot,
}) => {
  const [calibrated, setCalibrated] = useState(true);
  const calibrationActive = Boolean(baseline) && calibrated;

  const series = useMemo(
    () =>
      METRICS.map((metric) => {
        const raw = history.map((sample) => sample[metric.key]);
        const values = calibrationActive && baseline && (metric.key === 'stress' || metric.key === 'cohesion')
          ? raw.map((value) =>
              metric.key === 'stress'
                ? applyBaseline(value, baseline.stress, baseline.stressSpread)
                : applyBaseline(value, baseline.cohesion, baseline.cohesionSpread),
            )
          : raw;
        const current = values[values.length - 1] ?? 0;
        const delta = trendOf(values);
        const average = values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
        const good = metric.inverted ? delta < -0.02 : delta > 0.02;
        const bad = metric.inverted ? delta > 0.02 : delta < -0.02;
        return { metric, ...buildPath(values), current, delta, average, good, bad };
      }),
    [history, baseline, calibrationActive],
  );

  const spanSeconds = history.length > 1
    ? Math.round((history[history.length - 1].timestamp - history[0].timestamp) / 1000)
    : 0;

  return (
    <div className="h-full overflow-hidden border border-current/20 bg-black/60 p-3 font-mono text-xs">
      <div className="mb-2 flex items-center justify-between border-b border-current/15 pb-1">
        <h3 className="text-[11px] uppercase tracking-widest opacity-90">Operator Metrics</h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] opacity-60">{spanSeconds}s window · {history.length} samples</span>
          {baseline && (
            <button
              type="button"
              onClick={() => setCalibrated((previous) => !previous)}
              className={`border px-1.5 py-0.5 text-[9px] uppercase tracking-wider ${calibrationActive ? 'border-current/50 bg-current/10' : 'border-current/20 opacity-60'}`}
              aria-pressed={calibrationActive}
            >
              Calibrated
            </button>
          )}
        </div>
      </div>

      {calibrationSlot && <div className="mb-2">{calibrationSlot}</div>}

      <div className="grid h-[calc(100%-2rem)] min-h-0 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
        {series.map(({ metric, line, area, current, delta, average, good, bad }) => (
          <div key={metric.key} className="border border-current/10 bg-black/40 p-2">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] uppercase tracking-wider opacity-75">{metric.label}</span>
              <span
                className="text-sm tabular-nums"
                style={{ color: `hsl(${metric.hue} 80% 62%)` }}
              >
                {(current * 100).toFixed(0)}%
              </span>
            </div>

            <svg
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              preserveAspectRatio="none"
              className="mt-1 h-12 w-full"
              role="img"
              aria-label={`${metric.label} trend, currently ${(current * 100).toFixed(0)} percent`}
            >
              <line x1="0" y1={HEIGHT / 2} x2={WIDTH} y2={HEIGHT / 2} stroke="currentColor" strokeOpacity="0.12" strokeWidth="0.4" />
              <path d={area} fill={`hsl(${metric.hue} 80% 55% / 0.18)`} />
              <path
                d={line}
                fill="none"
                stroke={`hsl(${metric.hue} 85% 62%)`}
                strokeWidth="1.2"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            <div className="mt-1 flex items-center justify-between text-[10px] opacity-70">
              <span>avg {(average * 100).toFixed(0)}%</span>
              <span className={good ? 'text-emerald-400' : bad ? 'text-red-400' : ''}>
                {delta > 0.02 ? '▲' : delta < -0.02 ? '▼' : '■'} {(Math.abs(delta) * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

OperatorMetricsDashboard.displayName = 'OperatorMetricsDashboard';

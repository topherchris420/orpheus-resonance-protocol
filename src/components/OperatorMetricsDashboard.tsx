import React, { useMemo, useState } from 'react';
import { formatSimTime } from '@/engine/clock';
import type { MetricSample } from '@/engine/mission/types';
import { applyBaseline, OperatorBaseline } from '../hooks/useOperatorBaseline';

interface OperatorMetricsDashboardProps {
  history: MetricSample[];
  baseline?: OperatorBaseline | null;
  calibrationSlot?: React.ReactNode;
}

type MetricKey = 'stress' | 'cohesion' | 'hostilePressure' | 'feedReliability';

const METRICS: Array<{ key: MetricKey; label: string; color: string; inverted: boolean }> = [
  { key: 'stress', label: 'Modeled stress (fictional operator)', color: 'hsl(4 86% 70%)', inverted: true },
  { key: 'cohesion', label: 'Squad cohesion (modeled)', color: 'hsl(172 68% 56%)', inverted: false },
  { key: 'hostilePressure', label: 'Hostile pressure (modeled)', color: 'hsl(40 92% 64%)', inverted: true },
  { key: 'feedReliability', label: 'Feed reliability (modeled)', color: 'hsl(212 92% 76%)', inverted: false },
];

const WIDTH = 100;
const HEIGHT = 32;

const pathFor = (values: number[]) => {
  if (values.length === 0) return { line: '', area: '' };
  const step = values.length > 1 ? WIDTH / (values.length - 1) : WIDTH;
  const points = values.map((value, index) => `${(values.length > 1 ? index * step : WIDTH / 2).toFixed(2)},${(HEIGHT - Math.min(1, Math.max(0, value)) * HEIGHT).toFixed(2)}`);
  const line = `M ${points.join(' L ')}`;
  return { line, area: `${line} L ${WIDTH},${HEIGHT} L 0,${HEIGHT} Z` };
};

/** Charts of simulation variables, with a table view for screen readers and keyboard users. */
export const OperatorMetricsDashboard: React.FC<OperatorMetricsDashboardProps> = React.memo(({ history, baseline, calibrationSlot }) => {
  const [referenced, setReferenced] = useState(true);
  const [asTable, setAsTable] = useState(false);
  const useReference = Boolean(baseline) && referenced;
  const series = useMemo(
    () =>
      METRICS.map((metric) => {
        const raw = history.map((sample) => sample[metric.key]);
        const values =
          useReference && baseline && (metric.key === 'stress' || metric.key === 'cohesion')
            ? raw.map((value) =>
                metric.key === 'stress' ? applyBaseline(value, baseline.stress, baseline.stressSpread) : applyBaseline(value, baseline.cohesion, baseline.cohesionSpread),
              )
            : raw;
        const window = values.slice(-6);
        const delta = window.length > 1 ? window[window.length - 1] - window[0] : 0;
        return { metric, values, ...pathFor(values), current: values[values.length - 1] ?? 0, delta };
      }),
    [baseline, history, useReference],
  );
  const span = history.length > 1 ? history[history.length - 1].tick - history[0].tick : 0;

  return (
    <section aria-label="Simulation variables" className="flex h-full flex-col overflow-y-auto rounded-xl border border-o-line bg-o-s1 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-o-line pb-2">
        <h3 className="text-sm font-semibold text-o-text">Simulation variables</h3>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-o-text3">
            {span} s window · {history.length} samples
          </span>
          {baseline && (
            <button type="button" className="o-button min-h-9 px-2 text-xs" aria-pressed={useReference} onClick={() => setReferenced((previous) => !previous)}>
              Reference window
            </button>
          )}
          <button type="button" className="o-button min-h-9 px-2 text-xs" aria-pressed={asTable} onClick={() => setAsTable((previous) => !previous)}>
            Table view
          </button>
        </div>
      </div>
      {calibrationSlot && <div className="mb-3">{calibrationSlot}</div>}
      {asTable ? (
        <div className="overflow-x-auto">
          <table className="o-table">
            <caption className="sr-only">Recent samples of simulation variables</caption>
            <thead>
              <tr>
                <th scope="col">Sim time</th>
                {METRICS.map((metric) => (
                  <th key={metric.key} scope="col">
                    {metric.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history
                .slice(-12)
                .reverse()
                .map((sample) => (
                  <tr key={sample.tick}>
                    <td className="font-mono">{formatSimTime(sample.tick)}</td>
                    {METRICS.map((metric) => (
                      <td key={metric.key} className="font-mono">
                        {Math.round(sample[metric.key] * 100)}%
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
          {series.map(({ metric, line, area, current, delta }) => (
            <figure key={metric.key} className="rounded-lg border border-o-line bg-o-s2 p-2">
              <figcaption className="flex items-baseline justify-between gap-2 text-xs text-o-text3">
                <span>{metric.label}</span>
                <span className="font-mono text-sm" style={{ color: metric.color }}>
                  {Math.round(current * 100)}%
                </span>
              </figcaption>
              <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="mt-1 h-12 w-full" role="img" aria-label={`${metric.label}: currently ${Math.round(current * 100)} percent, ${delta > 0.02 ? 'rising' : delta < -0.02 ? 'falling' : 'steady'}.`}>
                <path d={area} fill={metric.color} fillOpacity={0.15} />
                <path d={line} fill="none" stroke={metric.color} strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
              </svg>
              <p className="mt-1 text-right text-xs text-o-text3">
                {delta > 0.02 ? '▲ rising' : delta < -0.02 ? '▼ falling' : '■ steady'} {Math.round(Math.abs(delta) * 100)} pts
              </p>
            </figure>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-o-text3">All four are variables of the simulation, not measurements of anyone.</p>
    </section>
  );
});

OperatorMetricsDashboard.displayName = 'OperatorMetricsDashboard';

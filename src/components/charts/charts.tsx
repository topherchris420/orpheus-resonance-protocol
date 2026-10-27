import { useId, useState, type ReactNode } from 'react';
import { VIZ } from './palette';


interface Tip {
  x: number;
  y: number;
  content: ReactNode;
}

const Tooltip = ({ tip }: { tip: Tip | null }) =>
  tip ? (
    <div
      role="status"
      className="pointer-events-none absolute z-10 max-w-[16rem] -translate-x-1/2 -translate-y-full rounded-lg border border-o-line-strong bg-o-s3 px-3 py-2 text-xs text-o-text2 shadow-lg"
      style={{ left: tip.x, top: tip.y - 10 }}
    >
      {tip.content}
    </div>
  ) : null;

export interface ForestRow {
  label: string;
  estimate: number;
  lower: number;
  upper: number;
  n: number;
}

/**
 * Point estimates with 95% intervals, one row per group (a forest plot). One series, so one color and
 * no legend; a solid hairline marks the reference value. A table twin carries every number.
 */
export const ForestPlot = ({
  rows,
  caption,
  reference = 0,
  format = (value: number) => value.toFixed(2),
  unit,
}: {
  rows: ForestRow[];
  caption: string;
  reference?: number;
  format?: (value: number) => string;
  unit: string;
}) => {
  const [tip, setTip] = useState<Tip | null>(null);
  const titleId = useId();
  const width = 560;
  const labelWidth = 150;
  const rowHeight = 40;
  const top = 12;
  const axisBand = 34;
  const height = top + rows.length * rowHeight + axisBand;
  const values = rows.flatMap((row) => [row.lower, row.upper, reference]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min || 1) * 0.08;
  const lo = min - pad;
  const hi = max + pad;
  const x = (value: number) => labelWidth + ((value - lo) / (hi - lo)) * (width - labelWidth - 16);
  const ticks = Array.from({ length: 5 }, (_, index) => lo + ((hi - lo) * index) / 4);

  return (
    <figure className="space-y-3">
      <figcaption id={titleId} className="text-sm font-medium text-o-text">
        {caption}
      </figcaption>
      <div className="relative overflow-x-auto" onPointerLeave={() => setTip(null)}>
        <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[30rem] max-w-full" role="group" aria-labelledby={titleId}>
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={x(tick)} x2={x(tick)} y1={top} y2={height - axisBand} stroke={VIZ.grid} strokeWidth={1} />
              <text x={x(tick)} y={height - axisBand + 18} textAnchor="middle" className="fill-[hsl(var(--o-text-3))] text-[11px]">
                {format(tick)}
              </text>
            </g>
          ))}
          <line x1={x(reference)} x2={x(reference)} y1={top} y2={height - axisBand} stroke={VIZ.axis} strokeWidth={1} />
          {rows.map((row, index) => {
            const cy = top + index * rowHeight + rowHeight / 2;
            const label = `${row.label}: ${format(row.estimate)} ${unit}, 95% interval ${format(row.lower)} to ${format(row.upper)}, n = ${row.n}`;
            return (
              <g
                key={row.label}
                tabIndex={0}
                role="img"
                aria-label={label}
                className="outline-none focus-visible:[&>rect]:stroke-[hsl(var(--o-teal-strong))]"
                onPointerEnter={(event) => {
                  const box = (event.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                  setTip({
                    x: (x(row.estimate) / width) * box.width,
                    y: (cy / height) * box.height,
                    content: (
                      <>
                        <strong className="text-sm text-o-text">
                          {format(row.estimate)} {unit}
                        </strong>
                        <br />
                        {row.label} · 95% interval {format(row.lower)} to {format(row.upper)} · n = {row.n}
                      </>
                    ),
                  });
                }}
                onFocus={(event) => {
                  const box = (event.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                  setTip({ x: (x(row.estimate) / width) * box.width, y: (cy / height) * box.height, content: <span>{label}</span> });
                }}
                onBlur={() => setTip(null)}
              >
                <rect x={0} y={cy - rowHeight / 2} width={width} height={rowHeight} fill="transparent" stroke="transparent" strokeWidth={2} rx={6} />
                <text x={labelWidth - 12} y={cy + 4} textAnchor="end" className="fill-[hsl(var(--o-text-2))] text-[12px]">
                  {row.label}
                </text>
                <line x1={x(row.lower)} x2={x(row.upper)} y1={cy} y2={cy} stroke={VIZ.series1} strokeWidth={2} strokeLinecap="round" />
                <circle cx={x(row.estimate)} cy={cy} r={6} fill={VIZ.series1} stroke={VIZ.surface} strokeWidth={2} />
              </g>
            );
          })}
        </svg>
        <Tooltip tip={tip} />
      </div>
      <table className="o-table">
        <caption className="sr-only">{caption} — table view</caption>
        <thead>
          <tr>
            <th scope="col">Group</th>
            <th scope="col">Estimate</th>
            <th scope="col">95% interval</th>
            <th scope="col">n</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row" className="text-left font-medium text-o-text">
                {row.label}
              </th>
              <td className="font-mono">{format(row.estimate)}</td>
              <td className="font-mono">
                {format(row.lower)} to {format(row.upper)}
              </td>
              <td className="font-mono">{row.n}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
};

export interface ReliabilitySeries {
  name: string;
  color: string;
  bins: Array<{ lower: number; upper: number; count: number; meanProbability: number; observedFrequency: number }>;
}

/** Reliability diagram: stated probability against observed frequency, with the perfect-calibration diagonal. */
export const ReliabilityDiagram = ({ series, caption }: { series: ReliabilitySeries[]; caption: string }) => {
  const [tip, setTip] = useState<Tip | null>(null);
  const titleId = useId();
  const size = 360;
  const margin = { left: 44, right: 14, top: 14, bottom: 40 };
  const plot = size - margin.left - margin.right;
  const x = (value: number) => margin.left + ((value - 0.5) / 0.5) * plot;
  const y = (value: number) => margin.top + (1 - value) * plot;
  const ticksX = [0.5, 0.6, 0.7, 0.8, 0.9, 1];
  const ticksY = [0, 0.25, 0.5, 0.75, 1];
  const height = margin.top + plot + margin.bottom;
  return (
    <figure className="space-y-3">
      <figcaption id={titleId} className="text-sm font-medium text-o-text">
        {caption}
      </figcaption>
      {series.length > 1 && (
        <ul className="flex flex-wrap gap-4 text-xs text-o-text2" aria-label="Legend">
          {series.map((entry) => (
            <li key={entry.name} className="flex items-center gap-2">
              <svg width="18" height="8" aria-hidden="true">
                <line x1="0" x2="18" y1="4" y2="4" stroke={entry.color} strokeWidth="2" />
              </svg>
              {entry.name}
            </li>
          ))}
        </ul>
      )}
      <div className="relative max-w-md" onPointerLeave={() => setTip(null)}>
        <svg viewBox={`0 0 ${size} ${height}`} className="w-full" role="group" aria-labelledby={titleId}>
          {ticksY.map((tick) => (
            <g key={`y${tick}`}>
              <line x1={margin.left} x2={margin.left + plot} y1={y(tick)} y2={y(tick)} stroke={VIZ.grid} strokeWidth={1} />
              <text x={margin.left - 8} y={y(tick) + 4} textAnchor="end" className="fill-[hsl(var(--o-text-3))] text-[11px]">
                {Math.round(tick * 100)}%
              </text>
            </g>
          ))}
          {ticksX.map((tick) => (
            <text key={`x${tick}`} x={x(tick)} y={margin.top + plot + 18} textAnchor="middle" className="fill-[hsl(var(--o-text-3))] text-[11px]">
              {Math.round(tick * 100)}%
            </text>
          ))}
          <text x={margin.left + plot / 2} y={height - 4} textAnchor="middle" className="fill-[hsl(var(--o-text-3))] text-[11px]">
            Stated probability
          </text>
          <line x1={x(0.5)} y1={y(0.5)} x2={x(1)} y2={y(1)} stroke={VIZ.axis} strokeWidth={1} />
          <text x={x(0.93)} y={y(0.97) - 6} textAnchor="end" className="fill-[hsl(var(--o-text-3))] text-[10px]">
            perfect calibration
          </text>
          {series.map((entry) => {
            const bins = entry.bins.filter((bin) => bin.count > 0);
            const path = bins.map((bin, index) => `${index === 0 ? 'M' : 'L'} ${x(bin.meanProbability)} ${y(bin.observedFrequency)}`).join(' ');
            return (
              <g key={entry.name}>
                <path d={path} fill="none" stroke={entry.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                {bins.map((bin) => {
                  const label = `${entry.name}: stated ${Math.round(bin.meanProbability * 100)}%, observed ${Math.round(bin.observedFrequency * 100)}%, ${bin.count} trials`;
                  const place = (target: SVGGElement) => {
                    const box = (target.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                    setTip({
                      x: (x(bin.meanProbability) / size) * box.width,
                      y: (y(bin.observedFrequency) / height) * box.height,
                      content: (
                        <>
                          <strong className="text-sm text-o-text">observed {Math.round(bin.observedFrequency * 100)}%</strong>
                          <br />
                          {entry.name} · stated {Math.round(bin.meanProbability * 100)}% · {bin.count.toLocaleString('en-US')} trials
                        </>
                      ),
                    });
                  };
                  return (
                    <g
                      key={`${entry.name}-${bin.lower}`}
                      tabIndex={0}
                      role="img"
                      aria-label={label}
                      className="outline-none"
                      onPointerEnter={(event) => place(event.currentTarget)}
                      onFocus={(event) => place(event.currentTarget)}
                      onBlur={() => setTip(null)}
                    >
                      <circle cx={x(bin.meanProbability)} cy={y(bin.observedFrequency)} r={12} fill="transparent" />
                      <circle cx={x(bin.meanProbability)} cy={y(bin.observedFrequency)} r={4.5} fill={entry.color} stroke={VIZ.surface} strokeWidth={2} />
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
        <Tooltip tip={tip} />
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-o-text2">Table view</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="o-table">
            <caption className="sr-only">{caption} — table view</caption>
            <thead>
              <tr>
                <th scope="col">Series</th>
                <th scope="col">Bin</th>
                <th scope="col">Trials</th>
                <th scope="col">Stated</th>
                <th scope="col">Observed</th>
              </tr>
            </thead>
            <tbody>
              {series.flatMap((entry) =>
                entry.bins
                  .filter((bin) => bin.count > 0)
                  .map((bin) => (
                    <tr key={`${entry.name}-${bin.lower}`}>
                      <td>{entry.name}</td>
                      <td className="font-mono">
                        {Math.round(bin.lower * 100)}–{Math.round(bin.upper * 100)}%
                      </td>
                      <td className="font-mono">{bin.count}</td>
                      <td className="font-mono">{(bin.meanProbability * 100).toFixed(1)}%</td>
                      <td className="font-mono">{(bin.observedFrequency * 100).toFixed(1)}%</td>
                    </tr>
                  )),
              )}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
};

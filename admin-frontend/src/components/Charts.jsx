import { useEffect, useRef, useState } from 'react';
import { compact, usd } from '../lib/format.js';

// Lightweight SVG charts (no libraries). Rendered at the container's real
// pixel width so text and strokes stay crisp at every size.

function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** "Nice" axis maximum and ticks for a value range starting at zero. */
function niceScale(max, count = 4) {
  if (max <= 0) return { top: 4, ticks: [0, 1, 2, 3, 4] };
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const top = step * Math.ceil(max / step);
  const ticks = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);
  return { top, ticks };
}

const M = { top: 12, right: 8, bottom: 26, left: 44 };

function Tooltip({ x, y, title, rows }) {
  return (
    <div className="chart__tip" style={{ left: x, top: y }}>
      <strong>{title}</strong>
      {rows.map((r) => (
        <div className="chart__tip-row" key={r.label}>
          <span><i style={{ background: r.color }} />{r.label}</span>
          <b>{usd(r.value)}</b>
        </div>
      ))}
    </div>
  );
}

/** Grouped bars: data = [{ label, ...values }], series = [{ key, label, color }]. */
export function BarChart({ data = [], series, height = 240 }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const empty = !data.some((d) => series.some((s) => d[s.key] > 0));
  const max = Math.max(0, ...data.flatMap((d) => series.map((s) => d[s.key] ?? 0)));
  const { top, ticks } = niceScale(max);
  const w = Math.max(0, width - M.left - M.right);
  const h = height - M.top - M.bottom;
  const band = data.length ? w / data.length : 0;
  const inner = Math.min(band * 0.68, 46);
  const bw = inner / series.length;
  const y = (v) => M.top + h - (v / top) * h;
  const everyN = band < 34 ? 2 : 1;

  return (
    <div className="chart" ref={ref} style={{ height }} onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Bar chart">
          {ticks.map((t) => (
            <g key={t}>
              <line className="chart__grid" x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} strokeDasharray={t ? '3 4' : undefined} />
              <text className="chart__axis" x={M.left - 8} y={y(t) + 4} textAnchor="end">{compact(t)}</text>
            </g>
          ))}
          {data.map((d, i) => {
            const x0 = M.left + i * band + (band - inner) / 2;
            return (
              <g key={d.label} onMouseEnter={() => setHover(i)}>
                <rect x={M.left + i * band} y={M.top} width={band} height={h} fill={hover === i ? 'var(--hover)' : 'transparent'} rx="6" />
                {series.map((s, j) => {
                  const v = d[s.key] ?? 0;
                  const bh = Math.max(v > 0 ? 2 : 0, (v / top) * h);
                  return <rect key={s.key} x={x0 + j * bw + 1} y={M.top + h - bh} width={Math.max(1, bw - 2)} height={bh} rx="3" style={{ fill: s.color }} />;
                })}
                {i % everyN === 0 && (
                  <text className="chart__axis" x={M.left + i * band + band / 2} y={height - 6} textAnchor="middle">{d.label}</text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {empty && <div className="chart__empty">No activity in this period</div>}
      {hover != null && data[hover] && (
        <Tooltip
          x={M.left + hover * band + band / 2}
          y={y(Math.max(...series.map((s) => data[hover][s.key] ?? 0)))}
          title={data[hover].title ?? data[hover].label}
          rows={series.map((s) => ({ label: s.label, color: s.color, value: data[hover][s.key] ?? 0 }))}
        />
      )}
    </div>
  );
}

/** Smooth area/line chart with one line per series. */
export function AreaChart({ data = [], series, height = 240 }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const empty = !data.some((d) => series.some((s) => d[s.key] > 0));
  const max = Math.max(0, ...data.flatMap((d) => series.map((s) => d[s.key] ?? 0)));
  const { top, ticks } = niceScale(max);
  const w = Math.max(0, width - M.left - M.right - 12);
  const h = height - M.top - M.bottom;
  const step = data.length > 1 ? w / (data.length - 1) : 0;
  const x = (i) => M.left + 6 + i * step;
  const y = (v) => M.top + h - (v / top) * h;

  // Monotone-ish smoothing with horizontal control points.
  const pathOf = (key) => data.map((d, i) => {
    const px = x(i);
    const py = y(d[key] ?? 0);
    if (!i) return `M${px},${py}`;
    const prevX = x(i - 1);
    const prevY = y(data[i - 1][key] ?? 0);
    const cx = (prevX + px) / 2;
    return `C${cx},${prevY} ${cx},${py} ${px},${py}`;
  }).join(' ');

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round((e.clientX - r.left - M.left - 6) / (step || 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };

  return (
    <div className="chart" ref={ref} style={{ height }} onMouseLeave={() => setHover(null)}>
      {width > 0 && data.length > 0 && (
        <svg width={width} height={height} role="img" aria-label="Line chart" onMouseMove={onMove}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`area-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: s.color, stopOpacity: 0.28 }} />
                <stop offset="100%" style={{ stopColor: s.color, stopOpacity: 0 }} />
              </linearGradient>
            ))}
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line className="chart__grid" x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} strokeDasharray={t ? '3 4' : undefined} />
              <text className="chart__axis" x={M.left - 8} y={y(t) + 4} textAnchor="end">{compact(t)}</text>
            </g>
          ))}
          {data.map((d, i) => (
            <text key={d.label} className="chart__axis" x={x(i)} y={height - 6} textAnchor="middle">{d.label}</text>
          ))}
          {hover != null && <line x1={x(hover)} x2={x(hover)} y1={M.top} y2={M.top + h} stroke="var(--border-strong)" />}
          {series.map((s) => (
            <g key={s.key}>
              <path d={`${pathOf(s.key)} L${x(data.length - 1)},${M.top + h} L${x(0)},${M.top + h} Z`} fill={`url(#area-${s.key})`} />
              <path d={pathOf(s.key)} fill="none" style={{ stroke: s.color }} strokeWidth="2.5" strokeLinecap="round" />
              {hover != null && (
                <circle cx={x(hover)} cy={y(data[hover][s.key] ?? 0)} r="4.5" style={{ fill: s.color, stroke: 'var(--bg-2)' }} strokeWidth="2" />
              )}
            </g>
          ))}
        </svg>
      )}
      {empty && <div className="chart__empty">No activity in this period</div>}
      {hover != null && data[hover] && (
        <Tooltip
          x={x(hover)}
          y={y(Math.max(...series.map((s) => data[hover][s.key] ?? 0)))}
          title={data[hover].title ?? data[hover].label}
          rows={series.map((s) => ({ label: s.label, color: s.color, value: data[hover][s.key] ?? 0 }))}
        />
      )}
    </div>
  );
}

export function Legend({ series }) {
  return (
    <div className="legend">
      {series.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>)}
    </div>
  );
}

import { dayKey } from '../lib/format.js';

const shift = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return dayKey(d); };

const PRESETS = [
  { key: 'today', label: 'Today', range: () => [shift(0), shift(0)] },
  { key: 'yesterday', label: 'Yesterday', range: () => [shift(-1), shift(-1)] },
  { key: '7d', label: '7 days', range: () => [shift(-6), shift(0)] },
  { key: '30d', label: '30 days', range: () => [shift(-29), shift(0)] },
  { key: 'all', label: 'All time', range: () => ['', ''] },
];

export const todayRange = () => [shift(0), shift(0)];

/** True when a timestamp's local day falls in [from, to] (blank = open). */
export function inRange(date, from, to) {
  if (!from && !to) return true;
  const k = dayKey(date);
  return (!from || k >= from) && (!to || k <= to);
}

/** From / to date inputs with one-click presets. */
export default function DateRange({ from, to, onChange }) {
  const active = PRESETS.find((p) => { const [f, t] = p.range(); return f === from && t === to; })?.key;
  return (
    <div className="toolbar__group">
      <span className="toolbar__label">Date range</span>
      <div className="daterange">
        <input className="input" type="date" value={from} max={to || undefined} onChange={(e) => onChange(e.target.value, to)} aria-label="From date" />
        <span className="daterange__sep">–</span>
        <input className="input" type="date" value={to} min={from || undefined} onChange={(e) => onChange(from, e.target.value)} aria-label="To date" />
        <div className="presets">
          {PRESETS.map((p) => (
            <button
              type="button" key={p.key} className={`preset ${active === p.key ? 'is-active' : ''}`}
              onClick={() => onChange(...p.range())}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

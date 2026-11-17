// Lightweight SVG charts, no external libraries.

// Smooth area chart (Weekly Data).
export function AreaChart({ data = [], width = 560, height = 240 }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const pad = 10;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => [pad + i * step, pad + h - (v / max) * h]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${line} L${pad + w} ${pad + h} L${pad} ${pad + h} Z`;

  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7c6bf0" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#7c6bf0" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#areaFill)" />
      <path d={line} fill="none" stroke="#f0a04b" strokeWidth="3" />
      <path d={line} fill="none" stroke="#6b5ce0" strokeWidth="2" opacity="0.9" transform="translate(0,3)" />
    </svg>
  );
}

// Bar chart (Monthly Game Report).
export function BarChart({ data = [], width = 560, height = 240 }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const pad = 10;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const gap = 8;
  const bw = (w - gap * (data.length - 1)) / data.length;

  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {data.map((v, i) => {
        const bh = (v / max) * h;
        return (
          <rect
            key={i}
            x={pad + i * (bw + gap)}
            y={pad + h - bh}
            width={bw}
            height={bh}
            rx="3"
            fill="#f47560"
            opacity={0.55 + 0.45 * (v / max)}
          />
        );
      })}
    </svg>
  );
}

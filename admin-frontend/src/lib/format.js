// Shared value formatting.

const pad = (n) => String(n).padStart(2, '0');

/**
 * Parse an API timestamp. The database stores UTC, but values read from it are
 * sent without a zone ("2026-01-31T09:15:00.12"), so treat zone-less strings as UTC.
 */
export function parseDate(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return v;
  const s = String(v);
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`);
}

/** Local calendar day, YYYY-MM-DD. */
export const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** "2026-11-17 14:03:22" in local time. */
export function dateTime(v) {
  const d = parseDate(v);
  if (!d || Number.isNaN(d.getTime())) return '';
  return `${dayKey(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** "Nov 17, 2026" */
export function dateLong(v) {
  const d = parseDate(v);
  if (!d) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** "5m ago", "3h ago", "Nov 17" */
export function timeAgo(v) {
  const d = parseDate(v);
  if (!d) return '';
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** 1234.5 -> "1,234.50" */
export const money = (v) =>
  Number(v ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 1234.5 -> "$1,234.50" (sign before the symbol for negatives) */
export const usd = (v) => {
  const n = Number(v ?? 0);
  return `${n < 0 ? '-' : ''}$${money(Math.abs(n))}`;
};

/** Points: "1,234 P" */
export const pts = (v) => `${Number(v ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} P`;

export const int = (v) => Number(v ?? 0).toLocaleString('en-US');

export const pct = (v) => `${Number(v ?? 0).toFixed(1)}%`;

/** Short axis labels: 1200 -> "1.2K" */
export function compact(v) {
  const n = Number(v ?? 0);
  const a = Math.abs(n);
  if (a >= 1e9) return `${+(n / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${+(n / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${+(n / 1e3).toFixed(1)}K`;
  return `${+n.toFixed(2)}`;
}

/** Display label for a transaction type: "rolling payment" -> "Rolling Payment" */
export const typeLabel = (t) =>
  String(t ?? '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const LEVEL_NAMES = { 1: 'Super Admin' };
export const roleName = (role) => LEVEL_NAMES[role] ?? `Agent · Level ${String.fromCharCode(64 + Math.max(1, role))}`;

/**
 * Value formatting that matches what the ASP.NET Core backend put on the wire.
 *
 * Dates read from the database had no time zone (DateTimeKind.Unspecified), so
 * they serialize without a trailing "Z", e.g. "2025-01-31T09:15:00.123". Dates
 * created in-process from DateTime.UtcNow serialize with the "Z".
 */

// "....30.120" -> "....30.12", "....30.000" -> "....30"
const trimFraction = (s) => s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');

/** A DATETIME value read from the database (UTC-based Date, or a "YYYY-MM-DD hh:mm:ss" string). */
export function dbDate(v) {
  if (v == null) return null;
  if (v instanceof Date) return trimFraction(v.toISOString().slice(0, -1));
  return trimFraction(String(v).trim().replace(' ', 'T'));
}

/** A UTC timestamp created by this server. */
export const utcDate = (d) => trimFraction(d.toISOString().slice(0, -1)) + 'Z';

/** Numeric column value (DECIMAL / BIGINT may arrive as strings) -> number. */
export const num = (v) => (v == null ? null : Number(v));

/** Strip binary floating-point noise from money arithmetic (0.1 + 0.2 -> 0.3). */
export const money = (v) => Number(v.toPrecision(15));

import { AUX_FIELDS, type AuxField, type MetricsRow } from '../types/metrics';
import type { OccupancyStats, RiskFlag, ScorecardConfig, TimeTotals } from '../types/scorecard';
import { DEFAULT_CONFIG } from '../types/scorecard';

/** Service-level target used for "SL compliance" (share of intervals with SL ≥ 90%). */
export const SL_TARGET_PCT = 90;

/** Sum of the 12 non-productive activity columns for one row (seconds). */
export function auxTime(row: MetricsRow): number {
  let s = 0;
  for (const f of AUX_FIELDS) s += row[f];
  return s;
}

/**
 * Occupancy % = Agent on contact time ÷ (Online time − Non-productive time) × 100
 *
 * Online − Non-productive = contact time + idle time, so this matches the
 * public Amazon Connect definition: contact time ÷ (contact time + idle time).
 * Returns null when the denominator is ≤ 0 (an interval spent entirely in
 * Training or Lunch).
 */
export function occupancyPct(contactTime: number, onlineTime: number, aux: number): number | null {
  const available = onlineTime - aux;
  return available > 0 ? (contactTime / available) * 100 : null;
}

/**
 * Productive % ("capacity") = (Online time − Non-productive time) ÷ Online time × 100
 * The share of logged-in time that was available for contacts.
 */
export function productivePct(onlineTime: number, aux: number): number | null {
  return onlineTime > 0 ? ((onlineTime - aux) / onlineTime) * 100 : null;
}

export function riskFlag(occ: number | null, cfg: ScorecardConfig = DEFAULT_CONFIG): RiskFlag {
  if (occ === null) return 'no-data';
  if (occ >= cfg.targetOccupancy) return 'on-target';
  if (occ >= cfg.lowOccupancy) return 'moderate';
  return 'low';
}

export function emptyTotals(): TimeTotals {
  const aux = Object.fromEntries(AUX_FIELDS.map((f) => [f, 0])) as Record<AuxField, number>;
  return { rows: 0, onlineTime: 0, contactTime: 0, auxTime: 0, aux, contactsHandled: 0, ahtWeightedSeconds: 0, slRows: 0, slRowsMeeting: 0 };
}

export function addRow(t: TimeTotals, r: MetricsRow): TimeTotals {
  t.rows += 1;
  t.onlineTime += r.onlineTime;
  t.contactTime += r.contactTime;
  for (const f of AUX_FIELDS) t.aux[f] += r[f];
  t.auxTime += auxTime(r);
  t.contactsHandled += r.contactsHandled;
  t.ahtWeightedSeconds += r.avgHandleTime * r.contactsHandled;
  if (r.serviceLevel20 !== null) {
    t.slRows += 1;
    if (r.serviceLevel20 >= SL_TARGET_PCT) t.slRowsMeeting += 1;
  }
  return t;
}

export function sumRows(rows: MetricsRow[]): TimeTotals {
  return rows.reduce(addRow, emptyTotals());
}

/** Derive every headline metric from summed totals (ratio of sums, never average of ratios). */
export function statsFromTotals(t: TimeTotals, cfg: ScorecardConfig = DEFAULT_CONFIG): OccupancyStats {
  const occupancy = occupancyPct(t.contactTime, t.onlineTime, t.auxTime);
  const onlineHours = t.onlineTime / 3600;
  return {
    occupancy,
    productivePct: productivePct(t.onlineTime, t.auxTime),
    productiveMinutes: (t.onlineTime - t.auxTime) / 60,
    onlineMinutes: t.onlineTime / 60,
    ahtSeconds: t.contactsHandled > 0 ? t.ahtWeightedSeconds / t.contactsHandled : null,
    contactsPerHour: onlineHours > 0 ? t.contactsHandled / onlineHours : null,
    slCompliancePct: t.slRows > 0 ? (t.slRowsMeeting / t.slRows) * 100 : null,
    risk: riskFlag(occupancy, cfg),
  };
}

export const fmtPct = (v: number | null, d = 1) => (v === null ? '—' : `${v.toFixed(d)}%`);
export const fmtNum = (v: number | null, d = 1) => (v === null ? '—' : v.toFixed(d));

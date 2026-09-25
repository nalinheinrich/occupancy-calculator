import type { MetricsRow } from '../types/metrics';

/**
 * Contact-weighted AHT in seconds: Σ(AHT × contacts) ÷ Σ(contacts).
 * A plain average of interval AHTs would over-weight intervals with 1 contact
 * (one long contact in an otherwise quiet interval can show AHT of 20+ minutes).
 */
export function weightedAhtSeconds(rows: MetricsRow[]): number | null {
  let w = 0;
  let n = 0;
  for (const r of rows) {
    w += r.avgHandleTime * r.contactsHandled;
    n += r.contactsHandled;
  }
  return n > 0 ? w / n : null;
}

export const secondsToMinutes = (s: number | null) => (s === null ? null : s / 60);

export interface AhtVariance {
  actualMinutes: number | null;
  baselineMinutes: number | null;
  varianceMinutes: number | null; // actual − baseline (positive = slower than baseline)
  overTolerance: boolean;
}

/** Compare actual AHT (from metrics) against the roster "AHT (min)" baseline. */
export function ahtVariance(actualSeconds: number | null, baselineMinutes: number | null, toleranceMinutes: number): AhtVariance {
  const actualMinutes = secondsToMinutes(actualSeconds);
  const varianceMinutes = actualMinutes !== null && baselineMinutes !== null ? actualMinutes - baselineMinutes : null;
  return {
    actualMinutes,
    baselineMinutes,
    varianceMinutes,
    overTolerance: varianceMinutes !== null && varianceMinutes > toleranceMinutes,
  };
}

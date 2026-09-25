import type { PtoEntry, RosterEntry } from '../types/roster';
import { normalizeAlias } from './metricsParser';
import { parseClock, parseWindow } from './rosterParser';

/** Scheduled shift length in minutes from roster Start/End text (e.g. 9:00AM–5:30PM = 510). */
export function scheduledMinutes(start: string, end: string): number | null {
  const s = parseClock(start);
  const e = parseClock(end);
  if (s === null || e === null) return null;
  return e >= s ? e - s : e + 1440 - s; // overnight shifts wrap
}

export interface PtoAdjustment {
  alias: string;
  scheduledMinutes: number | null;
  ptoMinutes: number;
  availableMinutes: number | null;
  fullDay: boolean;
  effectiveStart: string;
  source: 'window' | 'hours';
}

/**
 * Capacity removed by PTO. Uses the PTO window when present (exact minutes),
 * otherwise "PTO Hours". PTO that covers the whole shift is treated as a full day.
 */
export function ptoAdjustment(p: PtoEntry): PtoAdjustment {
  const sched = scheduledMinutes(p.startTime, p.endTime);
  const win = parseWindow(p.ptoWindow);
  const ptoMinutes = win ? win.end - win.start : (p.ptoHours ?? 0) * 60;
  const available = sched === null ? null : Math.max(0, sched - ptoMinutes);
  return {
    alias: p.alias,
    scheduledMinutes: sched,
    ptoMinutes,
    availableMinutes: available,
    fullDay: available === 0,
    effectiveStart: p.adjustedStartTime || p.startTime,
    source: win ? 'window' : 'hours',
  };
}

export interface ShrinkageResult {
  plannedHC: number;
  actualHC: number;
  absent: string[];
  shrinkagePct: number | null;
  byRole: { role: string; planned: number; actual: number; shrinkagePct: number | null }[];
}

/**
 * Shrinkage % = (Planned HC − Actual HC) ÷ Planned HC × 100
 * Planned HC = roster rows with Standing "Active" (extra-time helpers with a
 * blank Standing are not part of the plan).
 * Actual HC  = planned agents that appear at least once in the metrics export.
 */
export function calculateShrinkage(roster: RosterEntry[], metricsAgents: Iterable<string>): ShrinkageResult {
  const seen = new Set([...metricsAgents].map(normalizeAlias));
  const planned = roster.filter((r) => r.standing.toLowerCase() === 'active');
  const present = planned.filter((r) => seen.has(normalizeAlias(r.alias)));
  const roles = [...new Set(planned.map((r) => r.role))].sort();
  const pct = (p: number, a: number) => (p > 0 ? ((p - a) / p) * 100 : null);
  return {
    plannedHC: planned.length,
    actualHC: present.length,
    absent: planned.filter((r) => !seen.has(normalizeAlias(r.alias))).map((r) => r.alias),
    shrinkagePct: pct(planned.length, present.length),
    byRole: roles.map((role) => {
      const p = planned.filter((r) => r.role === role).length;
      const a = present.filter((r) => r.role === role).length;
      return { role, planned: p, actual: a, shrinkagePct: pct(p, a) };
    }),
  };
}

import type { MetricsRow } from '../types/metrics';
import type { RosterEntry } from '../types/roster';
import type { AgentScorecard, GroupSummary, IntervalSummary, ScorecardConfig, Violation } from '../types/scorecard';
import { DEFAULT_CONFIG } from '../types/scorecard';
import { ahtVariance } from './ahtAnalysis';
import { filterFrontlineRows, filterShiftWindow, intervalLabel, normalizeAlias } from './metricsParser';
import { addRow, emptyTotals, statsFromTotals, sumRows } from './occupancyCalc';

/** Apply the shift window and (optionally) the non-frontline exclusion — the rows used for occupancy. */
export function occupancyRows(rows: MetricsRow[], cfg: ScorecardConfig = DEFAULT_CONFIG): MetricsRow[] {
  const inWindow = filterShiftWindow(rows, cfg.shiftStartHour, cfg.shiftEndHour);
  return cfg.excludeNonFrontline ? filterFrontlineRows(inWindow) : inWindow;
}

export function rosterIndex(roster: RosterEntry[]): Map<string, RosterEntry> {
  return new Map(roster.map((r) => [normalizeAlias(r.alias), r]));
}

export type MatchStatus = 'matched' | 'roster-only' | 'metrics-only';

export interface MergedAgent {
  alias: string;
  status: MatchStatus;
  roster?: RosterEntry;
  rows: MetricsRow[];
}

/** Full outer join of roster and metrics on Alias = Agent (case-insensitive). */
export function mergeRosterMetrics(roster: RosterEntry[], rows: MetricsRow[]): MergedAgent[] {
  const byAgent = new Map<string, MetricsRow[]>();
  for (const r of rows) {
    const k = normalizeAlias(r.agent);
    (byAgent.get(k) ?? byAgent.set(k, []).get(k)!).push(r);
  }
  const out: MergedAgent[] = [];
  const seen = new Set<string>();
  for (const e of roster) {
    const k = normalizeAlias(e.alias);
    seen.add(k);
    const rs = byAgent.get(k) ?? [];
    out.push({ alias: e.alias, status: rs.length ? 'matched' : 'roster-only', roster: e, rows: rs });
  }
  for (const [k, rs] of byAgent) {
    if (!seen.has(k)) out.push({ alias: rs[0].agent, status: 'metrics-only', rows: rs });
  }
  return out;
}

/** Per-agent scorecard over the given rows. Sorted by occupancy DESC (no-data last). */
export function buildAgentScorecards(rows: MetricsRow[], roster: RosterEntry[], cfg: ScorecardConfig = DEFAULT_CONFIG): AgentScorecard[] {
  const idx = rosterIndex(roster);
  const groups = new Map<string, MetricsRow[]>();
  for (const r of rows) {
    const k = normalizeAlias(r.agent);
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(r);
  }
  const cards: AgentScorecard[] = [];
  for (const [k, rs] of groups) {
    const totals = sumRows(rs);
    const stats = statsFromTotals(totals, cfg);
    const entry = idx.get(k);
    const v = ahtVariance(stats.ahtSeconds, entry?.ahtMinutes ?? null, cfg.ahtToleranceMinutes);
    cards.push({
      ...stats,
      agent: rs[0].agent,
      name: entry?.name ?? '',
      role: entry?.role ?? '(not on roster)',
      hierarchyLevel: rs[0].hierarchyLevel,
      routingProfiles: [...new Set(rs.map((r) => r.routingProfile))].sort(),
      crossTrained: entry?.crossTrained ?? [],
      onRoster: !!entry,
      intervals: new Set(rs.map((r) => r.startInterval)).size,
      contactsHandled: totals.contactsHandled,
      baselineAhtMinutes: v.baselineMinutes,
      ahtMinutes: v.actualMinutes,
      ahtVarianceMinutes: v.varianceMinutes,
      ahtFlag: v.overTolerance,
      lowOccupancyFlag: stats.occupancy !== null && stats.occupancy < cfg.lowOccupancy,
      totals,
    });
  }
  return cards.sort((a, b) => (b.occupancy ?? -1) - (a.occupancy ?? -1));
}

/** Team roll-up per interval bucket (30 or 60 minutes). */
export function buildIntervalSummaries(rows: MetricsRow[], bucketMinutes = 30, cfg: ScorecardConfig = DEFAULT_CONFIG): IntervalSummary[] {
  const map = new Map<string, { t: ReturnType<typeof emptyTotals>; agents: Set<string> }>();
  for (const r of rows) {
    const [h, m] = intervalLabel(r.startInterval).split(':').map(Number);
    if (Number.isNaN(h)) continue;
    const start = Math.floor((h * 60 + m) / bucketMinutes) * bucketMinutes;
    const key = `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`;
    const g = map.get(key) ?? map.set(key, { t: emptyTotals(), agents: new Set() }).get(key)!;
    addRow(g.t, r);
    g.agents.add(normalizeAlias(r.agent));
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([interval, g]) => ({ ...statsFromTotals(g.t, cfg), interval, headcount: g.agents.size, contactsHandled: g.t.contactsHandled, totals: g.t }));
}

/** Group rows by any key (role, routing profile, hierarchy, cross-training …). */
export function buildGroupSummaries(rows: MetricsRow[], keyOf: (r: MetricsRow) => string, cfg: ScorecardConfig = DEFAULT_CONFIG): GroupSummary[] {
  const map = new Map<string, { t: ReturnType<typeof emptyTotals>; agents: Set<string> }>();
  for (const r of rows) {
    const k = keyOf(r);
    const g = map.get(k) ?? map.set(k, { t: emptyTotals(), agents: new Set() }).get(k)!;
    addRow(g.t, r);
    g.agents.add(normalizeAlias(r.agent));
  }
  return [...map.entries()]
    .map(([group, g]) => ({ ...statsFromTotals(g.t, cfg), group, headcount: g.agents.size, contactsHandled: g.t.contactsHandled }))
    .sort((a, b) => b.headcount - a.headcount);
}

/** Daily policy limits in seconds (break 2 × 15 min, lunch 30 min, personal 3 × 6 min). */
export const POLICY_LIMITS = { Break: 1800, Lunch: 1800, Personal: 1080 } as const;

/** Agents whose DAILY total exceeds a policy limit. Applies to all roles, not only RA rows. */
export function detectViolations(rows: MetricsRow[]): Violation[] {
  const per = new Map<string, { agent: string; Break: number; Lunch: number; Personal: number }>();
  for (const r of rows) {
    const k = normalizeAlias(r.agent);
    const p = per.get(k) ?? per.set(k, { agent: r.agent, Break: 0, Lunch: 0, Personal: 0 }).get(k)!;
    p.Break += r.break_;
    p.Lunch += r.lunch;
    p.Personal += r.personal;
  }
  const out: Violation[] = [];
  for (const p of per.values()) {
    for (const cat of ['Break', 'Lunch', 'Personal'] as const) {
      if (p[cat] > POLICY_LIMITS[cat]) {
        out.push({ agent: p.agent, category: cat, actualMinutes: p[cat] / 60, limitMinutes: POLICY_LIMITS[cat] / 60, overMinutes: (p[cat] - POLICY_LIMITS[cat]) / 60 });
      }
    }
  }
  return out.sort((a, b) => b.overMinutes - a.overMinutes);
}

/** Scorecards → CSV text (for the Export tab and scripts). */
export function scorecardsToCSV(cards: AgentScorecard[]): string {
  const head = ['Agent', 'Role', 'Hierarchy', 'Routing Profiles', 'Cross Trained', 'On Roster', 'Intervals', 'Contacts', 'Occupancy %', 'Productive %', 'Productive Min', 'AHT (min)', 'Baseline AHT (min)', 'AHT Variance (min)', 'AHT Flag', 'Low Occupancy Flag', 'SL Compliance %', 'Risk'];
  const n = (v: number | null, d = 2) => (v === null ? '' : v.toFixed(d));
  const q = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lines = cards.map((c) => [
    c.agent, c.role, c.hierarchyLevel, c.routingProfiles.join('; '), c.crossTrained.join('; '), c.onRoster ? 'Y' : 'N',
    String(c.intervals), String(c.contactsHandled), n(c.occupancy), n(c.productivePct), n(c.productiveMinutes, 1),
    n(c.ahtMinutes), n(c.baselineAhtMinutes, 1), n(c.ahtVarianceMinutes), c.ahtFlag ? 'Y' : '', c.lowOccupancyFlag ? 'Y' : '', n(c.slCompliancePct, 1), c.risk,
  ].map(q).join(','));
  return [head.join(','), ...lines].join('\n') + '\n';
}

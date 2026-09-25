/**
 * Join the daily roster to the metrics export on Alias = Agent and write one
 * enriched CSV row per metrics row (roster columns appended), plus a join report.
 *
 *   npm run merge
 *   npm run merge -- --metrics report.csv --roster roster.xlsx --out output/merged.csv
 *   npm run merge -- --help
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fail, loadMetrics, loadRoster, METRICS_OPTION, parseArgs, ROSTER_OPTION } from './cli';
import { AUX_FIELDS } from '../webapp/src/types/metrics';
import { intervalLabel } from '../webapp/src/utils/metricsParser';
import { auxTime, occupancyPct } from '../webapp/src/utils/occupancyCalc';
import { mergeRosterMetrics } from '../webapp/src/utils/scorecardGenerator';

const opts = parseArgs(
  'Join the roster to the metrics export (Alias = Agent) and write one enriched row per metrics row.\n\nUsage: npm run merge -- [options]',
  {
    metrics: METRICS_OPTION,
    roster: ROSTER_OPTION,
    out: { kind: 'string', help: 'Output CSV path', default: 'output/merged-roster-metrics.csv' },
  },
);

const { rows: metrics } = loadMetrics(opts.metrics);
const { roster } = loadRoster(opts.roster);
const out = resolve(opts.out);

const merged = mergeRosterMetrics(roster, metrics);
const q = (v: unknown) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

const header = ['agent', 'join_status', 'name', 'role', 'shift', 'roster_start', 'roster_end', 'baseline_aht_min', 'cross_trained',
  'hierarchy', 'routing_profile', 'interval', 'online_sec', 'contact_sec', ...AUX_FIELDS.map((f) => `${f}_sec`), 'aux_sec',
  'occupancy_calc_pct', 'occupancy_source_pct', 'contacts', 'aht_sec'];
const lines = [header.join(',')];
for (const m of merged) {
  const e = m.roster;
  const rosterCols = [e?.name, e?.role, e?.shift, e?.start, e?.end, e?.ahtMinutes, e?.crossTrained.join('; ')];
  if (m.rows.length === 0) {
    lines.push([m.alias, m.status, ...rosterCols, ...Array(header.length - 9).fill('')].map(q).join(','));
    continue;
  }
  for (const r of m.rows) {
    const occ = occupancyPct(r.contactTime, r.onlineTime, auxTime(r));
    lines.push([r.agent, m.status, ...rosterCols, r.hierarchyLevel, r.routingProfile, intervalLabel(r.startInterval), r.onlineTime, r.contactTime,
      ...AUX_FIELDS.map((f) => r[f]), auxTime(r), occ === null ? '' : occ.toFixed(2), r.occupancySource ?? '', r.contactsHandled, r.avgHandleTime].map(q).join(','));
  }
}
try {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, lines.join('\n') + '\n');
} catch (e) {
  fail(`could not write ${out}: ${(e as Error).message}`);
}

const by = (s: string) => merged.filter((m) => m.status === s).map((m) => m.alias);
console.log(`Roster agents: ${roster.length}   Metrics agents: ${new Set(metrics.map((r) => r.agent.toLowerCase())).size}`);
console.log(`Matched:       ${by('matched').length}`);
console.log(`Roster only:   ${by('roster-only').length}  ${by('roster-only').join(', ')}`);
console.log(`Metrics only:  ${by('metrics-only').length}  ${by('metrics-only').join(', ')}`);
console.log(`Wrote ${lines.length - 1} rows → ${out}`);

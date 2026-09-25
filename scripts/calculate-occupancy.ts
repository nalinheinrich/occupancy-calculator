/**
 * Calculate team occupancy (overall + per 30-min interval) from a Historical Metrics CSV.
 *
 *   npm run occupancy                                   # uses sample-data/
 *   npm run occupancy -- --metrics path/to/report.csv [--all-profiles] [--bucket 60]
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseMetricsCSV } from '../webapp/src/utils/metricsParser';
import { fmtNum, fmtPct, statsFromTotals, sumRows } from '../webapp/src/utils/occupancyCalc';
import { buildIntervalSummaries, occupancyRows } from '../webapp/src/utils/scorecardGenerator';
import { DEFAULT_CONFIG, RISK_LABEL } from '../webapp/src/types/scorecard';

const args = process.argv.slice(2);
const opt = (name: string, def: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };

const metricsPath = resolve(opt('metrics', 'sample-data/sample-historical-metrics.csv'));
const cfg = { ...DEFAULT_CONFIG, excludeNonFrontline: !args.includes('--all-profiles') };
const bucket = Number(opt('bucket', '30'));

const all = parseMetricsCSV(readFileSync(metricsPath, 'utf8'));
const rows = occupancyRows(all, cfg);
const team = statsFromTotals(sumRows(rows), cfg);

console.log(`File: ${metricsPath}`);
console.log(`Rows: ${all.length} total → ${rows.length} after ${cfg.shiftStartHour}:00–${cfg.shiftEndHour}:00 window${cfg.excludeNonFrontline ? ' + non-frontline exclusion' : ''}`);
console.log(`Agents: ${new Set(rows.map((r) => r.agent)).size}`);
console.log(`Team occupancy:  ${fmtPct(team.occupancy, 2)}  (${RISK_LABEL[team.risk]}, target ${cfg.targetOccupancy}%)`);
console.log(`Productive %:    ${fmtPct(team.productivePct, 2)}`);
console.log(`Weighted AHT:    ${fmtNum(team.ahtSeconds)} s`);
console.log(`SL ≥ 90% rows:   ${fmtPct(team.slCompliancePct)}\n`);

console.table(buildIntervalSummaries(rows, bucket, cfg).map((i) => ({
  interval: i.interval,
  headcount: i.headcount,
  contacts: i.contactsHandled,
  'occupancy %': i.occupancy === null ? null : +i.occupancy.toFixed(1),
  'productive %': i.productivePct === null ? null : +i.productivePct.toFixed(1),
  risk: RISK_LABEL[i.risk],
})));

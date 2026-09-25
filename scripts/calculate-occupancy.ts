/**
 * Calculate team occupancy (overall + per 30/60-min interval) from a Historical Metrics CSV.
 *
 *   npm run occupancy                                   # uses sample-data/
 *   npm run occupancy -- --metrics path/to/report.csv [--all-profiles] [--bucket 60]
 *   npm run occupancy -- --help
 */
import { ALL_PROFILES_OPTION, loadMetrics, METRICS_OPTION, parseArgs } from './cli';
import { fmtNum, fmtPct, statsFromTotals, sumRows } from '../webapp/src/utils/occupancyCalc';
import { buildIntervalSummaries, occupancyRows } from '../webapp/src/utils/scorecardGenerator';
import { DEFAULT_CONFIG, RISK_LABEL } from '../webapp/src/types/scorecard';

const opts = parseArgs(
  'Calculate team occupancy overall and per interval.\n\nUsage: npm run occupancy -- [options]',
  {
    metrics: METRICS_OPTION,
    bucket: {
      kind: 'number',
      help: 'Interval size in minutes: 30 or 60 (the export has 30-minute data)',
      default: 30,
      check: (n) => (n === 30 || n === 60 ? null : 'must be 30 or 60'),
    },
    'all-profiles': ALL_PROFILES_OPTION,
  },
);

const { abs: metricsPath, rows: all } = loadMetrics(opts.metrics);
const cfg = { ...DEFAULT_CONFIG, excludeNonFrontline: !opts['all-profiles'] };
const rows = occupancyRows(all, cfg);
const team = statsFromTotals(sumRows(rows), cfg);

console.log(`File: ${metricsPath}`);
console.log(`Rows: ${all.length} total → ${rows.length} after ${cfg.shiftStartHour}:00–${cfg.shiftEndHour}:00 window${cfg.excludeNonFrontline ? ' + non-frontline exclusion' : ''}`);
if (rows.length === 0) {
  console.log('No rows left after filtering. Check the interval times, or try --all-profiles.');
  process.exit(0);
}
console.log(`Agents: ${new Set(rows.map((r) => r.agent)).size}`);
console.log(`Team occupancy:  ${fmtPct(team.occupancy, 2)}  (${RISK_LABEL[team.risk]}, target ${cfg.targetOccupancy}%)`);
console.log(`Productive %:    ${fmtPct(team.productivePct, 2)}`);
console.log(`Weighted AHT:    ${fmtNum(team.ahtSeconds)} s`);
console.log(`Intervals with SL ≥ 90%: ${fmtPct(team.slCompliancePct)}\n`);

console.table(buildIntervalSummaries(rows, opts.bucket, cfg).map((i) => ({
  interval: i.interval,
  headcount: i.headcount,
  contacts: i.contactsHandled,
  'occupancy %': i.occupancy === null ? null : +i.occupancy.toFixed(1),
  'productive %': i.productivePct === null ? null : +i.productivePct.toFixed(1),
  risk: RISK_LABEL[i.risk],
})));

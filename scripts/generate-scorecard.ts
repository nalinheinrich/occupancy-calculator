/**
 * Generate per-agent performance scorecards (CSV) from metrics + roster.
 *
 *   npm run scorecard
 *   npm run scorecard -- --metrics report.csv --roster roster.xlsx --out output/scorecards.csv [--tolerance 0.5]
 *   npm run scorecard -- --help
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { ALL_PROFILES_OPTION, fail, loadMetrics, loadRoster, METRICS_OPTION, parseArgs, ROSTER_OPTION } from './cli';
import { buildAgentScorecards, occupancyRows, scorecardsToCSV } from '../webapp/src/utils/scorecardGenerator';
import { DEFAULT_CONFIG, RISK_LABEL } from '../webapp/src/types/scorecard';

const opts = parseArgs(
  'Write one scorecard row per agent to a CSV file.\n\nUsage: npm run scorecard -- [options]',
  {
    metrics: METRICS_OPTION,
    roster: ROSTER_OPTION,
    out: { kind: 'string', help: 'Output CSV path', default: 'output/agent-scorecards.csv' },
    tolerance: {
      kind: 'number',
      help: 'AHT flag tolerance in minutes',
      default: DEFAULT_CONFIG.ahtToleranceMinutes,
      check: (n) => (n >= 0 ? null : 'must be 0 or more'),
    },
    'all-profiles': ALL_PROFILES_OPTION,
  },
);

const cfg = { ...DEFAULT_CONFIG, ahtToleranceMinutes: opts.tolerance, excludeNonFrontline: !opts['all-profiles'] };
const { rows: metrics } = loadMetrics(opts.metrics);
const { roster } = loadRoster(opts.roster);
const out = resolve(opts.out);

const cards = buildAgentScorecards(occupancyRows(metrics, cfg), roster, cfg);
try {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, scorecardsToCSV(cards));
} catch (e) {
  fail(`could not write ${out}: ${(e as Error).message}`);
}

console.table(cards.map((c) => ({
  agent: c.agent,
  role: c.role,
  contacts: c.contactsHandled,
  'occ %': c.occupancy === null ? null : +c.occupancy.toFixed(1),
  'AHT min': c.ahtMinutes === null ? null : +c.ahtMinutes.toFixed(2),
  baseline: c.baselineAhtMinutes,
  flags: [c.lowOccupancyFlag && 'low-occ', c.ahtFlag && 'aht'].filter(Boolean).join(' '),
  risk: RISK_LABEL[c.risk],
})));
console.log(`\nWrote ${cards.length} scorecards → ${out}`);

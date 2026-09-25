/**
 * Generate per-agent performance scorecards (CSV) from metrics + roster.
 *
 *   npm run scorecard
 *   npm run scorecard -- --metrics report.csv --roster roster.xlsx --out output/scorecards.csv [--tolerance 0.5]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseMetricsCSV } from '../webapp/src/utils/metricsParser';
import { parseRosterWorkbook } from '../webapp/src/utils/rosterParser';
import { buildAgentScorecards, occupancyRows, scorecardsToCSV } from '../webapp/src/utils/scorecardGenerator';
import { DEFAULT_CONFIG, RISK_LABEL } from '../webapp/src/types/scorecard';

const args = process.argv.slice(2);
const opt = (name: string, def: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };

const cfg = {
  ...DEFAULT_CONFIG,
  ahtToleranceMinutes: Number(opt('tolerance', String(DEFAULT_CONFIG.ahtToleranceMinutes))),
  excludeNonFrontline: !args.includes('--all-profiles'),
};
const metrics = parseMetricsCSV(readFileSync(resolve(opt('metrics', 'sample-data/sample-historical-metrics.csv')), 'utf8'));
const { roster } = parseRosterWorkbook(readFileSync(resolve(opt('roster', 'sample-data/sample-daily-roster.xlsx'))));
const out = resolve(opt('out', 'output/agent-scorecards.csv'));

const cards = buildAgentScorecards(occupancyRows(metrics, cfg), roster, cfg);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, scorecardsToCSV(cards));

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

/**
 * Shared command-line helpers for the scripts in this folder.
 *
 * - Accepts `--name value` and `--name=value`
 * - Rejects unknown options, missing values and stray arguments
 * - Validates numbers (with an optional per-option rule)
 * - Prints a one-line error (no stack trace) and exits with code 1
 * - Prints usage for `--help` / `-h`
 */
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import type { MetricsRow } from '../webapp/src/types/metrics';
import type { RosterWorkbook } from '../webapp/src/types/roster';
import { parseMetricsCSV } from '../webapp/src/utils/metricsParser';
import { parseRosterWorkbook } from '../webapp/src/utils/rosterParser';

export function fail(message: string): never {
  console.error(`Error: ${message}`);
  console.error('Run with --help to see the available options.');
  process.exit(1);
}

type Kind = 'string' | 'number' | 'flag';

export interface OptionSpec {
  kind: Kind;
  help: string;
  default?: string | number;
  /** For numbers: return an error message, or null when the value is valid. */
  check?: (n: number) => string | null;
}

type Values<S extends Record<string, OptionSpec>> = {
  [K in keyof S]: S[K]['kind'] extends 'flag' ? boolean : S[K]['kind'] extends 'number' ? number : string;
};

const NUMBER_RE = /^-?\d+(\.\d+)?$/;

function printHelp(usage: string, specs: Record<string, OptionSpec>): void {
  console.log(usage.trim());
  console.log('\nOptions:');
  const rows = Object.entries(specs).map(([name, s]) => [
    `  --${name}${s.kind === 'flag' ? '' : s.kind === 'number' ? ' <number>' : ' <value>'}`,
    `${s.help}${s.default !== undefined ? ` (default: ${s.default})` : ''}`,
  ]);
  rows.push(['  --help, -h', 'Show this help']);
  const width = Math.max(...rows.map(([l]) => l.length)) + 2;
  for (const [l, r] of rows) console.log(l.padEnd(width) + r);
}

export function parseArgs<const S extends Record<string, OptionSpec>>(usage: string, specs: S, argv = process.argv.slice(2)): Values<S> {
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp(usage, specs);
    process.exit(0);
  }
  const out: Record<string, string | number | boolean> = {};
  for (const [name, s] of Object.entries(specs)) {
    if (s.kind === 'flag') out[name] = false;
    else if (s.default !== undefined) out[name] = s.default;
  }

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) fail(`Unexpected argument "${token}". Options start with --, e.g. --metrics path/to/file.csv`);
    const eq = token.indexOf('=');
    const name = token.slice(2, eq >= 0 ? eq : undefined);
    const inline = eq >= 0 ? token.slice(eq + 1) : undefined;
    const spec = specs[name];
    if (!spec) fail(`Unknown option --${name}. Valid options: ${Object.keys(specs).map((k) => `--${k}`).join(', ')}`);

    if (spec.kind === 'flag') {
      if (inline !== undefined) fail(`--${name} does not take a value`);
      out[name] = true;
      continue;
    }

    let value = inline;
    if (value === undefined) {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) fail(`--${name} needs a value`);
      value = next;
      i++;
    }
    if (value.trim() === '') fail(`--${name} needs a value`);

    if (spec.kind === 'number') {
      if (!NUMBER_RE.test(value.trim())) fail(`--${name} must be a number (got "${value}")`);
      const n = Number(value);
      const problem = spec.check?.(n);
      if (problem) fail(`--${name} ${problem} (got ${value})`);
      out[name] = n;
    } else {
      out[name] = value;
    }
  }

  for (const [name, s] of Object.entries(specs)) {
    if (s.kind !== 'flag' && out[name] === undefined) fail(`--${name} is required`);
  }
  return out as Values<S>;
}

/** Read a file, failing with a clear message if it is missing or a folder. */
export function readInput(path: string, label: string): { abs: string; data: Buffer } {
  const abs = resolve(path);
  let isFile = false;
  try { isFile = statSync(abs).isFile(); } catch { fail(`${label} file not found: ${abs}`); }
  if (!isFile) fail(`${label} path is not a file: ${abs}`);
  return { abs, data: readFileSync(abs) };
}

export function loadMetrics(path: string): { abs: string; rows: MetricsRow[] } {
  const { abs, data } = readInput(path, 'Metrics');
  let rows: MetricsRow[] = [];
  try { rows = parseMetricsCSV(data.toString('utf8')); } catch (e) { fail(`${abs}: ${(e as Error).message}`); }
  if (rows.length === 0) fail(`${abs} has a header but no data rows`);
  return { abs, rows };
}

export function loadRoster(path: string): { abs: string } & RosterWorkbook {
  const { abs, data } = readInput(path, 'Roster');
  let wb: RosterWorkbook = { roster: [], pto: [] };
  try { wb = parseRosterWorkbook(data); } catch (e) { fail(`${abs}: ${(e as Error).message}`); }
  if (wb.roster.length === 0) fail(`${abs} has no roster rows (expected a "Daily Roster" sheet with an Alias column)`);
  return { abs, ...wb };
}

// Reusable option definitions ────────────────────────────────────────────────
export const METRICS_OPTION = { kind: 'string', help: 'Historical Metrics Report CSV', default: 'sample-data/sample-historical-metrics.csv' } as const;
export const ROSTER_OPTION = { kind: 'string', help: 'Daily Roster workbook (.xlsx)', default: 'sample-data/sample-daily-roster.xlsx' } as const;
export const ALL_PROFILES_OPTION = { kind: 'flag', help: 'Include Lead / Escalation / Spanish / Training rows in occupancy' } as const;

import { METRICS_HEADER_MAP, type MetricsRow } from '../types/metrics';

const PERCENT_FIELDS = new Set<keyof MetricsRow>(['occupancySource', 'serviceLevel20']);
const TEXT_FIELDS = new Set<keyof MetricsRow>(['agent', 'hierarchyLevel', 'routingProfile', 'startInterval', 'endInterval']);

/** Split one CSV line, honouring double-quoted fields and escaped quotes (""). */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

/** "1,234" → 1234, "" → 0, "abc" → 0 */
export function toNumber(v: string | undefined): number {
  if (!v) return 0;
  const n = parseFloat(v.replace(/[,%\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** "78.23%" → 78.23, "" → null */
export function toPercent(v: string | undefined): number | null {
  if (!v || !v.trim()) return null;
  const n = parseFloat(v.replace(/[%\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse the Historical Metrics Report CSV. Columns are matched by header
 * name (not position), so reordered exports still work. Unknown columns are ignored.
 */
export function parseMetricsCSV(text: string): MetricsRow[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length === 0) return [];
  const header = splitCsvLine(lines[0]).map((h) => METRICS_HEADER_MAP[h.trim().toLowerCase()]);
  if (!header.includes('agent') || !header.includes('onlineTime')) {
    throw new Error('Not a Historical Metrics Report: missing "Agent" or "Online time" column.');
  }
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row = {} as Record<keyof MetricsRow, unknown>;
    for (const key of Object.values(METRICS_HEADER_MAP)) {
      row[key] = TEXT_FIELDS.has(key) ? '' : PERCENT_FIELDS.has(key) ? null : 0;
    }
    header.forEach((key, i) => {
      if (!key) return;
      const raw = (cells[i] ?? '').trim();
      row[key] = TEXT_FIELDS.has(key) ? raw : PERCENT_FIELDS.has(key) ? toPercent(raw) : toNumber(raw);
    });
    return row as unknown as MetricsRow;
  });
}

/** "2026-01-15T09:30:00.000-07:00" → "09:30" (local wall-clock time as exported). */
export function intervalLabel(iso: string): string {
  const m = iso.match(/T(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : '';
}

/** Minutes since midnight of the interval start, or -1 if unparseable. */
export function intervalStartMinutes(iso: string): number {
  const m = iso.match(/T(\d{2}):(\d{2})/);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : -1;
}

/** Keep rows whose interval STARTS in [startHour, endHour). Default 09:00–17:00. */
export function filterShiftWindow(rows: MetricsRow[], startHour = 9, endHour = 17): MetricsRow[] {
  return rows.filter((r) => {
    const m = intervalStartMinutes(r.startInterval);
    return m >= startHour * 60 && m < endHour * 60;
  });
}

/** Routing-profile keywords treated as non-frontline. Edit to match your own profile names. */
export const NON_FRONTLINE_PROFILE_KEYWORDS = ['escalation', 'spanish', 'training'];

/**
 * Rows excluded from occupancy (they are still used for break/lunch/personal
 * compliance): Lead hierarchy, the "Lead" routing profile, and routing profiles
 * containing any NON_FRONTLINE_PROFILE_KEYWORDS.
 */
export function isExcludedFromOccupancy(row: MetricsRow): boolean {
  const h = row.hierarchyLevel.toLowerCase();
  const p = row.routingProfile.toLowerCase();
  return h === 'lead' || p === 'lead' || NON_FRONTLINE_PROFILE_KEYWORDS.some((k) => p.includes(k));
}

export function filterFrontlineRows(rows: MetricsRow[]): MetricsRow[] {
  return rows.filter((r) => !isExcludedFromOccupancy(r));
}

export const normalizeAlias = (a: string) => a.trim().toLowerCase();

import * as XLSX from 'xlsx';
import type { PtoEntry, RosterEntry, RosterWorkbook } from '../types/roster';

type Cells = string[][];

/** "9:00AM" / "9:00 AM" / "13:30" → minutes since midnight, or null. "--" and "#N/A" → null. */
export function parseClock(v: string): number | null {
  const m = v.trim().toUpperCase().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (m[3] === 'PM' && h !== 12) h += 12;
  if (m[3] === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

/** "1:00PM-2:30PM" → { start: 780, end: 870 } */
export function parseWindow(v: string): { start: number; end: number } | null {
  const [a, b] = v.split('-');
  if (!a || !b) return null;
  const start = parseClock(a);
  const end = parseClock(b);
  return start === null || end === null ? null : { start, end };
}

/** "1.5 Hours" → 1.5 */
export function parseHours(v: string): number | null {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function indexOf(header: string[], name: string): number {
  return header.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
}

/** Rows (header first) from the "Daily Roster" sheet → RosterEntry[]. Blank-alias rows are skipped. */
export function parseRosterRows(cells: Cells): RosterEntry[] {
  const [header, ...body] = cells;
  if (!header) return [];
  const col = (n: string) => indexOf(header, n);
  const idx = {
    alias: col('Alias'), name: col('Name'), standing: col('Standing'), role: col('Role'),
    shift: col('Shift'), start: col('Start'), end: col('End'), aht: col('AHT (min)'),
    b1: col('Break 1'), lunch: col('Lunch'), b2: col('Break 2'), xt: col('Cross Trained'),
  };
  if (idx.alias < 0) throw new Error('Roster sheet is missing the "Alias" column.');
  const get = (r: string[], i: number) => (i >= 0 ? String(r[i] ?? '').trim() : '');
  return body
    .filter((r) => get(r, idx.alias) !== '')
    .map((r) => {
      const aht = parseFloat(get(r, idx.aht));
      return {
        alias: get(r, idx.alias),
        name: get(r, idx.name),
        standing: get(r, idx.standing),
        role: get(r, idx.role),
        shift: get(r, idx.shift),
        start: get(r, idx.start),
        end: get(r, idx.end),
        ahtMinutes: Number.isFinite(aht) ? aht : null,
        break1: get(r, idx.b1),
        lunch: get(r, idx.lunch),
        break2: get(r, idx.b2),
        crossTrained: get(r, idx.xt).split(',').map((s) => s.trim()).filter(Boolean),
      };
    });
}

/** Rows (header first) from the "PTO Associates" sheet → PtoEntry[]. */
export function parsePtoRows(cells: Cells): PtoEntry[] {
  const [header, ...body] = cells;
  if (!header) return [];
  const col = (n: string) => indexOf(header, n);
  const get = (r: string[], n: string) => { const i = col(n); return i >= 0 ? String(r[i] ?? '').trim() : ''; };
  return body
    .filter((r) => get(r, 'Alias') !== '')
    .map((r) => ({
      alias: get(r, 'Alias'),
      shift: get(r, 'Shift'),
      startTime: get(r, 'Start Time'),
      adjustedStartTime: get(r, 'Adjusted Start Time'),
      endTime: get(r, 'End Time'),
      ptoWindow: get(r, 'PTO Times'),
      ptoHours: parseHours(get(r, 'PTO Hours')),
    }));
}

function sheetCells(wb: XLSX.WorkBook, name: string): Cells | null {
  const sheetName = wb.SheetNames.find((n) => n.trim().toLowerCase() === name.toLowerCase());
  if (!sheetName) return null;
  // raw:false keeps "9:00AM" and "2.2" exactly as displayed in Excel.
  return XLSX.utils.sheet_to_json<string[]>(wb.Sheets[sheetName], { header: 1, raw: false, defval: '' });
}

/**
 * Parse the roster workbook. Looks for sheets named "Daily Roster" and
 * "PTO Associates"; if "Daily Roster" is absent the first sheet is used.
 */
export function parseRosterWorkbook(data: ArrayBuffer | Uint8Array): RosterWorkbook {
  const wb = XLSX.read(data, { type: 'array' });
  const rosterCells = sheetCells(wb, 'Daily Roster') ?? XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' });
  const ptoCells = sheetCells(wb, 'PTO Associates') ?? [];
  return { roster: parseRosterRows(rosterCells), pto: parsePtoRows(ptoCells) };
}

/** Parse a standalone PTO workbook (first sheet or "PTO Associates"). */
export function parsePtoWorkbook(data: ArrayBuffer | Uint8Array): PtoEntry[] {
  const wb = XLSX.read(data, { type: 'array' });
  const cells = sheetCells(wb, 'PTO Associates') ?? XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' });
  return parsePtoRows(cells);
}

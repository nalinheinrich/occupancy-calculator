/**
 * Generate the SYNTHETIC sample data in sample-data/.
 * Every person, alias, number, date and queue name is invented. The output only
 * mirrors the column layout of a daily roster and an Amazon Connect agent-level
 * historical metrics export, so the app can be demoed without real data.
 *
 *   npm run generate-data            # deterministic (seed 42)
 *   npm run generate-data -- --seed 7
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as XLSX from 'xlsx';

const args = process.argv.slice(2);
const seedArg = args.indexOf('--seed');
let seed = seedArg >= 0 ? Number(args[seedArg + 1]) : 42;
const OUT = resolve('sample-data');
const DATE = '2026-01-15'; // fictional business day
const TZ = '-07:00';

// ── deterministic PRNG (mulberry32) ─────────────────────────────────────────
function rand(): number {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const uni = (a: number, b: number) => a + (b - a) * rand();
const int = (a: number, b: number) => Math.floor(uni(a, b + 1));
const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
const chance = (p: number) => rand() < p;
const gauss = () => { let s = 0; for (let i = 0; i < 6; i++) s += rand(); return s - 3; }; // ≈ N(0, 0.7)
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
function shuffle<T>(xs: T[]): T[] { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ── time helpers ────────────────────────────────────────────────────────────
const toClock = (m: number) => { const h = Math.floor(m / 60), mm = m % 60, h12 = ((h + 11) % 12) + 1; return `${h12}:${String(mm).padStart(2, '0')}${h < 12 ? 'AM' : 'PM'}`; };
const iso = (m: number) => `${DATE}T${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:00.000${TZ}`;
const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

// ── fictional people ────────────────────────────────────────────────────────
const FIRST = ['Avery', 'Blake', 'Casey', 'Dana', 'Elliot', 'Finley', 'Gray', 'Harper', 'Indigo', 'Jules', 'Kai', 'Logan', 'Morgan', 'Noel', 'Oakley', 'Parker', 'Quinn', 'Reese', 'Sage', 'Tatum', 'Umber', 'Vale', 'Wren', 'Yarrow'];
const LAST = ['Ashford', 'Brightwater', 'Calloway', 'Dunmore', 'Everly', 'Fairbanks', 'Galloway', 'Hartwell', 'Ivers', 'Jennings', 'Kingsley', 'Larkspur', 'Merriweather', 'Northcott', 'Oakridge', 'Pemberton', 'Quimby', 'Ravenscroft', 'Sterling', 'Thornbury', 'Underhill', 'Vantreese', 'Whitlock', 'Yardley'];

interface ShiftDef { start: number; end: number; b1: string[]; lunch: string[]; b2: string[] }
const SHIFTS: Record<'day' | 'early' | 'long' | 'extra', ShiftDef> = {
  day: { start: 540, end: 1050, b1: ['10:30AM', '10:45AM', '11:15AM', '--'], lunch: ['12:30PM', '1:00PM', '1:30PM'], b2: ['3:30PM', '4:00PM', '4:30PM'] },
  early: { start: 360, end: 870, b1: ['7:45AM', '8:00AM'], lunch: ['9:30AM', '10:00AM'], b2: ['11:45AM', '12:00PM'] },
  long: { start: 450, end: 1080, b1: ['9:00AM'], lunch: ['12:30PM'], b2: ['4:45PM'] },
  extra: { start: 570, end: 870, b1: ['11:30AM'], lunch: [''], b2: [''] },
};
const WEEK = ['MON-FRI', 'TUE-SAT', 'SUN-THU', 'WED-SUN', 'THU-MON'];

type Role = 'Dispatcher' | 'Senior Dispatcher' | 'Bilingual' | 'Escalations' | 'Trainer' | 'Seasonal' | 'Extra Time';
const ROLE_PLAN: [Role, number, keyof typeof SHIFTS][] = [
  ['Dispatcher', 6, 'day'], ['Dispatcher', 3, 'early'], ['Dispatcher', 1, 'long'],
  ['Senior Dispatcher', 2, 'day'], ['Bilingual', 1, 'early'], ['Escalations', 2, 'day'],
  ['Trainer', 1, 'day'], ['Seasonal', 2, 'day'], ['Extra Time', 2, 'extra'],
];
const BASE_AHT: Record<Role, [number, number]> = {
  Dispatcher: [0.8, 2.2], 'Senior Dispatcher': [1.4, 2.6], Bilingual: [1.8, 3.2], Escalations: [2.0, 3.4],
  Trainer: [1.0, 2.0], Seasonal: [1.2, 2.6], 'Extra Time': [0.9, 1.6],
};

interface Person {
  alias: string; name: string; role: Role; shiftKey: keyof typeof SHIFTS; week: string;
  aht: number | null; b1: string; lunch: string; b2: string; xt: string;
  hierarchy: 'Tenured' | 'Lead' | 'New Hire'; onRoster: boolean;
  occMean: number; ahtFactor: number;
}

const firsts = shuffle(FIRST);
const lasts = shuffle(LAST);
const used = new Set<string>();
function makeIdentity(i: number) {
  const f = firsts[i], l = lasts[i];
  let alias = (f.slice(0, 3) + l.slice(0, 4)).toLowerCase();
  while (used.has(alias)) alias += 'x';
  used.add(alias);
  return { alias, name: `${l}, ${f}` };
}

const people: Person[] = [];
let n = 0;
for (const [role, count, shiftKey] of ROLE_PLAN) {
  for (let k = 0; k < count; k++) {
    const s = SHIFTS[shiftKey];
    const { alias, name } = makeIdentity(n++);
    const [lo, hi] = BASE_AHT[role];
    people.push({
      alias, name, role, shiftKey,
      week: role === 'Extra Time' ? '' : shiftKey === 'long' ? 'MON-THU' : pick(WEEK),
      aht: role === 'Extra Time' ? null : Math.round(uni(lo, hi) * 10) / 10,
      b1: pick(s.b1), lunch: pick(s.lunch), b2: pick(s.b2),
      xt: chance(0.25) ? pick(['CHAT', 'EMAIL', 'BACKOFFICE', 'CHAT, EMAIL']) : '',
      hierarchy: 'Tenured', onRoster: true,
      occMean: clamp(0.8 + gauss() * 0.07, 0.62, 0.92), ahtFactor: uni(0.85, 1.2),
    });
  }
}
people[4].occMean = 0.56; // one clearly under-occupied agent for the demo
people[2].ahtFactor = 1.5; // one agent handling contacts well above their AHT baseline
people[7].aht = null; // one roster row with a missing AHT baseline
// Metrics-only people (not on the day's roster)
for (const hierarchy of ['Lead', 'New Hire'] as const) {
  const { alias, name } = makeIdentity(n++);
  people.push({ alias, name, role: 'Dispatcher', shiftKey: 'day', week: '', aht: null, b1: '', lunch: '', b2: '', xt: '', hierarchy, onRoster: false, occMean: 0.75, ahtFactor: 1 });
}

// ── PTO + attendance ────────────────────────────────────────────────────────
const byRole = (r: Role) => people.filter((p) => p.onRoster && p.role === r);
const earlyDispatchers = people.filter((p) => p.onRoster && p.shiftKey === 'early' && p.role === 'Dispatcher');
const dayDispatchers = people.filter((p) => p.onRoster && p.shiftKey === 'day' && p.role === 'Dispatcher');
interface Pto { p: Person; from: number; to: number; hours: number; adjusted: string; window: string }
const pto: Pto[] = [
  { p: byRole('Escalations')[1], from: 540, to: 1050, hours: 8, adjusted: '', window: '' },
  { p: earlyDispatchers[0], from: 780, to: 870, hours: 1.5, adjusted: '', window: '1:00PM-2:30PM' },
  { p: earlyDispatchers[1], from: 360, to: 600, hours: 4, adjusted: '10:00AM', window: '6:00AM-10:00AM' },
  { p: dayDispatchers[5], from: 540, to: 660, hours: 2, adjusted: '11:00AM', window: '9:00AM-11:00AM' },
];
const noShow = byRole('Seasonal')[1]; // scheduled, no PTO, no metrics → shows up in the join report

// ── metrics rows ────────────────────────────────────────────────────────────
const HEAD = ['Agent', 'Agent Hierarchy Level Two', 'Routing Profile', 'StartInterval', 'EndInterval', 'Agent on contact time', 'Occupancy', 'Online time', 'Manager Approved time', 'Training time', 'Break time', 'Huddle time', 'Personal time', 'Meeting time', 'Project time', 'Lunch time', 'Lead Approved time', 'Leadership approved time', 'Unproductive time', 'Engagement time', 'Service level 20 seconds', 'Agent interaction time', 'Average handle time', 'Contacts handled'];
const AUX = ['manager', 'training', 'break', 'huddle', 'personal', 'meeting', 'project', 'lunch', 'leadApproved', 'leadership', 'unproductive', 'engagement'] as const;
type Aux = Record<(typeof AUX)[number], number>;
const EXPORT_START = 540, EXPORT_END = 990; // interval starts 09:00 … 16:30
const INTERVAL_EFFECT: Record<number, number> = { 570: 0.06, 600: 0.05, 630: 0.04, 840: -0.05, 870: -0.03, 930: -0.08 };
const rows: string[][] = [];
const blank = (v: number) => (v > 0 ? String(Math.round(v)) : '');
const huddleTeam = new Set(shuffle(people.filter((p) => p.onRoster)).slice(0, 8).map((p) => p.alias));

function profileFor(p: Person, t: number): string {
  if (p.hierarchy === 'Lead') return t >= 870 ? 'Escalation Queue' : 'Lead';
  if (p.role === 'Escalations') return t < 780 ? 'Escalation Queue' : 'General Queue';
  if (p.role === 'Bilingual') return t < 660 ? 'Spanish Escalation' : 'General Queue';
  if (p.role === 'Senior Dispatcher' && t >= 840) return 'Specialty Queue';
  return 'General Queue';
}

function block(clock: string, minutes: number): [number, number] | null {
  const m = clock.match(/^(\d{1,2}):(\d{2})(AM|PM)$/);
  if (!m) return null;
  let h = Number(m[1]) % 12; if (m[3] === 'PM') h += 12;
  const s = h * 60 + Number(m[2]) + int(-2, 3);
  return [s, s + minutes + uni(-0.8, 1.2)];
}

for (const p of people) {
  if (p === noShow || pto.some((x) => x.p === p && x.hours >= 8)) continue;
  const s = SHIFTS[p.shiftKey];
  const start = p.hierarchy === 'New Hire' ? 750 : s.start;
  const off = pto.find((x) => x.p === p);
  const events: { kind: 'break' | 'lunch'; span: [number, number] }[] = [];
  for (const b of [p.b1, p.b2]) { const sp = block(b, 15); if (sp) events.push({ kind: 'break', span: sp }); }
  const lsp = block(p.lunch, 30); if (lsp) events.push({ kind: 'lunch', span: lsp });

  for (let t = EXPORT_START; t <= EXPORT_END; t += 30) {
    if (overlap(t, t + 30, start, s.end) === 0) continue;
    if (off && overlap(t, t + 30, off.from, off.to) >= 30) continue;
    let online = 1800;
    if (t < start + 30 && chance(0.4)) online = int(900, 1790); // late login
    if (chance(0.05)) online = int(200, 1500); // mid-interval logout

    const aux: Aux = { manager: 0, training: 0, break: 0, huddle: 0, personal: 0, meeting: 0, project: 0, lunch: 0, leadApproved: 0, leadership: 0, unproductive: 0, engagement: 0 };
    for (const e of events) aux[e.kind] += overlap(t, t + 30, e.span[0], e.span[1]) * 60;
    if (chance(0.22)) aux.personal += int(30, 420);
    if (chance(0.04)) aux.unproductive += int(20, 400);
    if (chance(0.03)) aux.leadApproved += int(60, 600);
    if (chance(0.01)) aux.manager += int(60, 500);
    if (t === 600 && huddleTeam.has(p.alias)) aux.huddle += int(300, 600);
    if (p.role === 'Trainer' && (t === 660 || t === 690)) aux.training += int(900, 1800);
    if (p.hierarchy === 'New Hire') aux.training += t < 870 ? 1800 : int(0, 600);
    if (p.hierarchy === 'Lead' && t < 870) { aux.meeting += chance(0.2) ? int(300, 1200) : 0; aux.leadership += chance(0.1) ? int(60, 300) : 0; }
    let auxSum = AUX.reduce((a, k) => a + aux[k], 0);
    if (auxSum > online) { online = Math.min(1800, Math.max(online, Math.round(auxSum))); auxSum = Math.min(auxSum, online); }
    const available = online - auxSum;

    let contact = 0;
    const leadIdle = p.hierarchy === 'Lead' && t < 870;
    if (available > 0 && !leadIdle) {
      const occ = clamp(p.occMean + (INTERVAL_EFFECT[t] ?? 0) + gauss() * 0.1, 0.2, 0.99);
      contact = Math.round(available * occ);
    }
    const baseAht = (p.aht ?? 1.5) * 60 * p.ahtFactor;
    const ahtI = baseAht * uni(0.7, 1.4);
    const contacts = contact >= 20 ? Math.max(1, Math.round(contact / ahtI)) : 0;
    const aht = contacts ? Math.round((contact / contacts) * uni(0.92, 1.08)) : 0;
    let sl = '';
    if (contacts) {
      const miss = chance(0.12) ? Math.min(contacts - 1, int(1, 2)) : 0;
      sl = `${(((contacts - miss) / contacts) * 100).toFixed(2)}%`;
    }
    const occCell = available > 0 ? `${((contact / available) * 100).toFixed(2)}%` : '';
    rows.push([
      p.alias, p.hierarchy, profileFor(p, t), iso(t), iso(t + 30),
      blank(contact), occCell, String(Math.round(online)),
      blank(aux.manager), blank(aux.training), blank(aux.break), blank(aux.huddle), blank(aux.personal), blank(aux.meeting),
      blank(aux.project), blank(aux.lunch), blank(aux.leadApproved), blank(aux.leadership), blank(aux.unproductive), blank(aux.engagement),
      sl, contacts ? String(Math.round(contact * uni(0.65, 0.95))) : '', contacts ? String(aht) : '', contacts ? String(contacts) : '',
    ]);
  }
}

// ── write files ─────────────────────────────────────────────────────────────
const csv = (aoa: string[][]) => aoa.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n') + '\n';
const rosterAoa = [['Alias', 'Name', 'Standing', 'Role', 'Shift', 'Start', 'End', 'AHT (min)', 'Break 1', 'Lunch', 'Break 2', 'Cross Trained'],
  ...people.filter((p) => p.onRoster).map((p) => {
    const s = SHIFTS[p.shiftKey];
    return [p.alias, p.name, p.role === 'Extra Time' ? '' : 'Active', p.role, p.week, toClock(s.start), toClock(s.end), p.aht === null ? '' : p.aht.toFixed(1), p.b1, p.lunch, p.b2, p.xt];
  })];
const ptoAoa = [['Alias', 'Shift', 'Start Time', 'Adjusted Start Time', 'End Time', 'PTO Times', 'PTO Hours'],
  ...pto.map(({ p, hours, adjusted, window }) => [p.alias, p.week, toClock(SHIFTS[p.shiftKey].start), adjusted, toClock(SHIFTS[p.shiftKey].end), window, `${hours} Hours`])];

const sheet = (aoa: string[][]) => XLSX.utils.aoa_to_sheet(aoa.map((r) => r.map((c) => (c === '' ? null : c))));
function xlsx(file: string, sheets: [string, string[][]][]) {
  const wb = XLSX.utils.book_new();
  for (const [name, aoa] of sheets) XLSX.utils.book_append_sheet(wb, sheet(aoa), name);
  writeFileSync(resolve(OUT, file), XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

mkdirSync(OUT, { recursive: true });
writeFileSync(resolve(OUT, 'sample-historical-metrics.csv'), csv([HEAD, ...rows]));
writeFileSync(resolve(OUT, 'sample-daily-roster.csv'), csv(rosterAoa));
writeFileSync(resolve(OUT, 'sample-pto-associates.csv'), csv(ptoAoa));
xlsx('sample-daily-roster.xlsx', [['Daily Roster', rosterAoa], ['PTO Associates', ptoAoa]]);
xlsx('sample-pto-associates.xlsx', [['PTO Associates', ptoAoa]]);

console.log(`Roster: ${rosterAoa.length - 1} agents · PTO: ${ptoAoa.length - 1} · Metrics: ${rows.length} rows, ${new Set(rows.map((r) => r[0])).size} agents`);
console.log(`No-show (roster only, no PTO): ${noShow.alias}`);

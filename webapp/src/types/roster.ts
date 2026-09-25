/** One row of the "Daily Roster" sheet. Times are kept as the original text (e.g. "9:00AM"). */
export interface RosterEntry {
  alias: string; // join key → MetricsRow.agent
  name: string;
  standing: string; // "Active", or blank for extra-time helpers who are not on the plan
  role: string; // free text, e.g. Dispatcher | Senior Dispatcher | Trainer | Escalations | Seasonal | Extra Time | Bilingual
  shift: string; // e.g. MON-FRI, TUE-SAT
  start: string;
  end: string;
  ahtMinutes: number | null; // "AHT (min)" baseline; null when blank
  break1: string; // "--" means no first break
  lunch: string;
  break2: string;
  crossTrained: string[]; // "CHAT, EMAIL" → ["CHAT", "EMAIL"]
}

/** One row of the "PTO Associates" sheet. */
export interface PtoEntry {
  alias: string;
  shift: string;
  startTime: string;
  adjustedStartTime: string; // blank when PTO is not at the start of the shift
  endTime: string;
  ptoWindow: string; // e.g. "1:00PM-2:30PM"; blank for a full-day PTO
  ptoHours: number | null; // "1.5 Hours" → 1.5
}

export interface RosterWorkbook {
  roster: RosterEntry[];
  pto: PtoEntry[];
}

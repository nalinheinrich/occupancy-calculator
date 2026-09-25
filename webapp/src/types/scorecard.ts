import type { AuxField } from './metrics';

export type RiskFlag = 'on-target' | 'moderate' | 'low' | 'no-data';

/** Text labels so risk is never conveyed by color alone. */
export const RISK_LABEL: Record<RiskFlag, string> = {
  'on-target': 'On target',
  moderate: 'Moderate',
  low: 'Low',
  'no-data': 'No data',
};

/** Tunable thresholds. Defaults are documented in docs/formulas.md. */
export interface ScorecardConfig {
  targetOccupancy: number; // ≥ target → on-target (default 85)
  lowOccupancy: number; // < low → low; between → moderate (default 70)
  ahtToleranceMinutes: number; // flag if actual AHT > roster baseline + tolerance
  shiftStartHour: number; // interval filter, inclusive (default 9)
  shiftEndHour: number; // interval filter, exclusive (default 17)
  excludeNonFrontline: boolean; // drop Lead rows and Escalation / Spanish / Training routing profiles
}

export const DEFAULT_CONFIG: ScorecardConfig = {
  targetOccupancy: 85,
  lowOccupancy: 70,
  ahtToleranceMinutes: 0.5,
  shiftStartHour: 9,
  shiftEndHour: 17,
  excludeNonFrontline: true,
};

/** Summed seconds for any group of metrics rows. */
export interface TimeTotals {
  rows: number;
  onlineTime: number;
  contactTime: number;
  auxTime: number;
  aux: Record<AuxField, number>;
  contactsHandled: number;
  ahtWeightedSeconds: number; // Σ(AHT × contacts) — divide by contactsHandled
  slRows: number; // rows with a service level value
  slRowsMeeting: number; // rows with SL ≥ slTarget
}

export interface OccupancyStats {
  occupancy: number | null; // contact ÷ (online − aux) × 100
  productivePct: number | null; // (online − aux) ÷ online × 100  ("capacity")
  productiveMinutes: number;
  onlineMinutes: number;
  ahtSeconds: number | null;
  contactsPerHour: number | null;
  slCompliancePct: number | null;
  risk: RiskFlag;
}

export interface AgentScorecard extends OccupancyStats {
  agent: string;
  name: string;
  role: string;
  hierarchyLevel: string;
  routingProfiles: string[];
  crossTrained: string[];
  onRoster: boolean;
  intervals: number;
  contactsHandled: number;
  baselineAhtMinutes: number | null;
  ahtMinutes: number | null;
  ahtVarianceMinutes: number | null;
  ahtFlag: boolean;
  lowOccupancyFlag: boolean;
  totals: TimeTotals;
}

export interface IntervalSummary extends OccupancyStats {
  interval: string; // "09:30"
  headcount: number;
  contactsHandled: number;
  totals: TimeTotals;
}

export interface GroupSummary extends OccupancyStats {
  group: string;
  headcount: number;
  contactsHandled: number;
}

export interface Violation {
  agent: string;
  category: 'Break' | 'Lunch' | 'Personal';
  actualMinutes: number;
  limitMinutes: number;
  overMinutes: number;
}

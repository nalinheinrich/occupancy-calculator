/**
 * One row of the Amazon Connect "Historical Metrics Report" export.
 * One row = one agent × one routing profile × one 30-minute interval.
 * All time values are in SECONDS. Blank cells in the export become 0
 * (numeric fields) or null (percent fields that were blank at the source).
 */
export interface MetricsRow {
  agent: string;
  hierarchyLevel: string; // "Agent Hierarchy Level Two": e.g. Tenured | Lead | New Hire
  routingProfile: string;
  startInterval: string; // ISO 8601 with offset, e.g. 2026-01-15T09:30:00.000-07:00
  endInterval: string;
  contactTime: number; // "Agent on contact time"
  occupancySource: number | null; // "Occupancy" as reported by Connect (0–100), null if blank
  onlineTime: number;
  managerApproved: number;
  training: number;
  break_: number;
  huddle: number;
  personal: number;
  meeting: number;
  project: number;
  lunch: number;
  leadApproved: number;
  leadershipApproved: number;
  unproductive: number;
  engagement: number;
  serviceLevel20: number | null; // "Service level 20 seconds" (0–100), null if blank
  interactionTime: number;
  avgHandleTime: number; // seconds
  contactsHandled: number;
}

/** The 12 non-productive (auxiliary) activity columns in the export. */
export const AUX_FIELDS = [
  'managerApproved',
  'training',
  'break_',
  'huddle',
  'personal',
  'meeting',
  'project',
  'lunch',
  'leadApproved',
  'leadershipApproved',
  'unproductive',
  'engagement',
] as const;

export type AuxField = (typeof AUX_FIELDS)[number];

export const AUX_LABELS: Record<AuxField, string> = {
  managerApproved: 'Manager Approved',
  training: 'Training',
  break_: 'Break',
  huddle: 'Huddle',
  personal: 'Personal',
  meeting: 'Meeting',
  project: 'Project',
  lunch: 'Lunch',
  leadApproved: 'Lead Approved',
  leadershipApproved: 'Leadership Approved',
  unproductive: 'Unproductive',
  engagement: 'Engagement',
};

/** Exact CSV header text → MetricsRow key. Matching is case-insensitive. */
export const METRICS_HEADER_MAP: Record<string, keyof MetricsRow> = {
  'agent': 'agent',
  'agent hierarchy level two': 'hierarchyLevel',
  'routing profile': 'routingProfile',
  'startinterval': 'startInterval',
  'endinterval': 'endInterval',
  'agent on contact time': 'contactTime',
  'occupancy': 'occupancySource',
  'online time': 'onlineTime',
  'manager approved time': 'managerApproved',
  'training time': 'training',
  'break time': 'break_',
  'huddle time': 'huddle',
  'personal time': 'personal',
  'meeting time': 'meeting',
  'project time': 'project',
  'lunch time': 'lunch',
  'lead approved time': 'leadApproved',
  'leadership approved time': 'leadershipApproved',
  'unproductive time': 'unproductive',
  'engagement time': 'engagement',
  'service level 20 seconds': 'serviceLevel20',
  'agent interaction time': 'interactionTime',
  'average handle time': 'avgHandleTime',
  'contacts handled': 'contactsHandled',
};

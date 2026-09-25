import type { MetricsRow } from '../types/metrics';
import type { RosterEntry } from '../types/roster';
import { calculateShrinkage } from '../utils/capacityCalc';
import { fmtPct } from '../utils/occupancyCalc';
import { mergeRosterMetrics } from '../utils/scorecardGenerator';

const STATUS_TEXT = { matched: 'In both', 'roster-only': 'Roster only (no metrics)', 'metrics-only': 'Metrics only (not on roster)' };

export default function RosterView({ roster, rows }: { roster: RosterEntry[]; rows: MetricsRow[] }) {
  const merged = mergeRosterMetrics(roster, rows);
  const shrink = calculateShrinkage(roster, rows.map((r) => r.agent));
  const count = (s: keyof typeof STATUS_TEXT) => merged.filter((m) => m.status === s).length;

  return (
    <>
      <section aria-labelledby="join-h">
        <h2 id="join-h">Roster ↔ metrics join (Alias = Agent)</h2>
        <p>In both: {count('matched')} · Roster only: {count('roster-only')} · Metrics only: {count('metrics-only')}</p>
        <p>
          Shrinkage: planned {shrink.plannedHC} Active, actual {shrink.actualHC} → <strong>{fmtPct(shrink.shrinkagePct)}</strong>
          {shrink.absent.length > 0 && <> (absent: {shrink.absent.join(', ')})</>}
        </p>
      </section>
      <section aria-labelledby="roster-h">
        <h2 id="roster-h">Daily roster</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Alias</th><th>Name</th><th>Standing</th><th>Role</th><th>Shift</th><th>Start</th><th>End</th><th className="num">AHT (min)</th><th>Break 1</th><th>Lunch</th><th>Break 2</th><th>Cross trained</th><th>Join status</th></tr></thead>
            <tbody>
              {merged.map((m) => (
                <tr key={m.alias}>
                  <td>{m.alias}</td><td>{m.roster?.name}</td><td>{m.roster?.standing}</td><td>{m.roster?.role}</td>
                  <td>{m.roster?.shift}</td><td>{m.roster?.start}</td><td>{m.roster?.end}</td>
                  <td className="num">{m.roster?.ahtMinutes ?? ''}</td><td>{m.roster?.break1}</td><td>{m.roster?.lunch}</td><td>{m.roster?.break2}</td>
                  <td>{m.roster?.crossTrained.join(', ')}</td><td>{STATUS_TEXT[m.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

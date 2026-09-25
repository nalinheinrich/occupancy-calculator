import type { MetricsRow } from '../types/metrics';
import { RISK_LABEL, type AgentScorecard, type ScorecardConfig } from '../types/scorecard';
import { detectViolations } from '../utils/scorecardGenerator';
import { fmtNum, fmtPct, statsFromTotals, sumRows } from '../utils/occupancyCalc';

interface Props {
  occRows: MetricsRow[]; // shift window + RA filter applied
  allRows: MetricsRow[]; // unfiltered (violations apply to every role)
  cards: AgentScorecard[];
  cfg: ScorecardConfig;
}

export default function OccupancyDashboard({ occRows, allRows, cards, cfg }: Props) {
  const s = statsFromTotals(sumRows(occRows), cfg);
  const counts = { 'on-target': 0, moderate: 0, low: 0, 'no-data': 0 };
  cards.forEach((c) => counts[c.risk]++);
  const violations = detectViolations(allRows).slice(0, 20);

  const kpis: [string, string][] = [
    ['Team occupancy', fmtPct(s.occupancy)],
    ['Productive % (capacity)', fmtPct(s.productivePct)],
    ['Productive hours', fmtNum(s.productiveMinutes / 60)],
    ['Contacts handled', String(sumRows(occRows).contactsHandled)],
    ['AHT (min, weighted)', fmtNum(s.ahtSeconds === null ? null : s.ahtSeconds / 60, 2)],
    ['Contacts / online hour', fmtNum(s.contactsPerHour)],
    ['Intervals with SL ≥ 90%', fmtPct(s.slCompliancePct)],
    ['Agents scored', String(cards.length)],
  ];

  return (
    <>
      <section aria-labelledby="dash-h">
        <h2 id="dash-h">Occupancy dashboard</h2>
        <p className="muted">
          Occupancy = contact time ÷ (online − non-productive time). Target {cfg.targetOccupancy}%, low below {cfg.lowOccupancy}%.
          Window {cfg.shiftStartHour}:00–{cfg.shiftEndHour}:00{cfg.excludeNonFrontline ? ', non-frontline rows excluded' : ''}.
        </p>
        <div className="kpis">
          {kpis.map(([l, v]) => (
            <div className="kpi" key={l}><div className="label">{l}</div><div className="value">{v}</div></div>
          ))}
        </div>
        <p>
          {(['on-target', 'moderate', 'low', 'no-data'] as const).map((k) => (
            <span key={k} className={k} style={{ marginRight: 16 }}>{RISK_LABEL[k]}: {counts[k]}</span>
          ))}
        </p>
      </section>
      <section aria-labelledby="viol-h">
        <h2 id="viol-h">Policy violations (all roles, daily totals)</h2>
        {violations.length === 0 ? <p>No agent exceeded the break (30 min), lunch (30 min) or personal (18 min) limits.</p> : (
          <div className="table-wrap">
            <table>
              <caption>Top {violations.length} by minutes over limit</caption>
              <thead><tr><th>Agent</th><th>Category</th><th className="num">Actual (min)</th><th className="num">Limit (min)</th><th className="num">Over (min)</th></tr></thead>
              <tbody>
                {violations.map((v) => (
                  <tr key={v.agent + v.category}>
                    <td>{v.agent}</td><td>{v.category}</td>
                    <td className="num">{v.actualMinutes.toFixed(1)}</td><td className="num">{v.limitMinutes}</td><td className="num">{v.overMinutes.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

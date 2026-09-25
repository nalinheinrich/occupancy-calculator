import { useMemo, useState } from 'react';
import type { MetricsRow } from '../types/metrics';
import { RISK_LABEL, type ScorecardConfig } from '../types/scorecard';
import { intervalLabel, normalizeAlias } from '../utils/metricsParser';
import { auxTime, fmtNum, fmtPct, occupancyPct, riskFlag } from '../utils/occupancyCalc';
import { buildIntervalSummaries } from '../utils/scorecardGenerator';

/** Team occupancy per interval + an agent × interval heatmap (the per-30-minute scorecard). */
export default function IntervalBreakdown({ rows, cfg }: { rows: MetricsRow[]; cfg: ScorecardConfig }) {
  const [bucket, setBucket] = useState(30);
  const intervals = useMemo(() => buildIntervalSummaries(rows, bucket, cfg), [rows, bucket, cfg]);

  const heat = useMemo(() => {
    const labels = [...new Set(rows.map((r) => intervalLabel(r.startInterval)))].sort();
    const cell = new Map<string, { c: number; o: number; a: number }>();
    const agents = new Map<string, string>();
    for (const r of rows) {
      const k = `${normalizeAlias(r.agent)}|${intervalLabel(r.startInterval)}`;
      agents.set(normalizeAlias(r.agent), r.agent);
      const v = cell.get(k) ?? { c: 0, o: 0, a: 0 };
      v.c += r.contactTime; v.o += r.onlineTime; v.a += auxTime(r);
      cell.set(k, v);
    }
    const list = [...agents.entries()].sort((a, b) => a[1].localeCompare(b[1], undefined, { numeric: true }));
    return { labels, list, cell };
  }, [rows]);

  return (
    <>
      <section aria-labelledby="iv-h">
        <h2 id="iv-h">Team occupancy by interval</h2>
        <label>Bucket size
          <select value={bucket} onChange={(e) => setBucket(Number(e.target.value))}>
            <option value={30}>30 minutes</option>
            <option value={60}>60 minutes</option>
          </select>
        </label>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Interval</th><th className="num">Headcount</th><th className="num">Contacts</th><th className="num">Occupancy</th><th className="num">Productive %</th><th className="num">AHT (min)</th><th>Risk</th></tr></thead>
            <tbody>
              {intervals.map((i) => (
                <tr key={i.interval}>
                  <td>{i.interval}</td><td className="num">{i.headcount}</td><td className="num">{i.contactsHandled}</td>
                  <td className={`num cell-${i.risk}`}>{fmtPct(i.occupancy)}</td><td className="num">{fmtPct(i.productivePct)}</td>
                  <td className="num">{fmtNum(i.ahtSeconds === null ? null : i.ahtSeconds / 60, 2)}</td><td className={i.risk}>{RISK_LABEL[i.risk]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section aria-labelledby="heat-h">
        <h2 id="heat-h">Agent × interval heatmap</h2>
        <p className="muted">Each cell is occupancy for that 30-minute interval. "—" means no available time (all non-productive). Blank means not logged in.</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Agent</th>{heat.labels.map((l) => <th key={l} className="num">{l}</th>)}</tr></thead>
            <tbody>
              {heat.list.map(([key, name]) => (
                <tr key={key}>
                  <td>{name}</td>
                  {heat.labels.map((l) => {
                    const v = heat.cell.get(`${key}|${l}`);
                    if (!v) return <td key={l} />;
                    const occ = occupancyPct(v.c, v.o, v.a);
                    const risk = riskFlag(occ, cfg);
                    return <td key={l} className={`num cell-${risk}`} title={RISK_LABEL[risk]}>{occ === null ? '—' : occ.toFixed(0)}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

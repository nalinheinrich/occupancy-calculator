import type { MetricsRow } from '../types/metrics';
import { AUX_FIELDS, AUX_LABELS } from '../types/metrics';
import type { ScorecardConfig } from '../types/scorecard';
import { fmtPct, sumRows } from '../utils/occupancyCalc';
import { buildIntervalSummaries } from '../utils/scorecardGenerator';

/** Productive vs non-productive minutes, team-wide and per interval. */
export default function CapacityAnalysis({ rows, cfg }: { rows: MetricsRow[]; cfg: ScorecardConfig }) {
  const t = sumRows(rows);
  const intervals = buildIntervalSummaries(rows, 30, cfg);
  const cats = AUX_FIELDS.map((f) => ({ f, sec: t.aux[f] })).sort((a, b) => b.sec - a.sec);

  return (
    <>
      <section aria-labelledby="np-h">
        <h2 id="np-h">Where non-productive time goes</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Category</th><th className="num">Minutes</th><th className="num">% of online</th><th className="num">% of non-productive</th></tr></thead>
            <tbody>
              {cats.map(({ f, sec }) => (
                <tr key={f}>
                  <td>{AUX_LABELS[f]}</td><td className="num">{(sec / 60).toFixed(1)}</td>
                  <td className="num">{fmtPct(t.onlineTime ? (sec / t.onlineTime) * 100 : null)}</td>
                  <td className="num">{fmtPct(t.auxTime ? (sec / t.auxTime) * 100 : null)}</td>
                </tr>
              ))}
              <tr><th>Total non-productive</th><th className="num">{(t.auxTime / 60).toFixed(1)}</th><th className="num">{fmtPct(t.onlineTime ? (t.auxTime / t.onlineTime) * 100 : null)}</th><th className="num">100%</th></tr>
            </tbody>
          </table>
        </div>
      </section>
      <section aria-labelledby="cap-h">
        <h2 id="cap-h">Capacity by interval</h2>
        <p className="muted">Capacity (productive %) = (online − non-productive) ÷ online. Idle = productive − contact time.</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Interval</th><th className="num">Online min</th><th className="num">Non-productive min</th><th className="num">Productive min</th><th className="num">Contact min</th><th className="num">Idle min</th><th className="num">Capacity</th></tr></thead>
            <tbody>
              {intervals.map((i) => (
                <tr key={i.interval}>
                  <td>{i.interval}</td>
                  <td className="num">{i.onlineMinutes.toFixed(0)}</td>
                  <td className="num">{(i.totals.auxTime / 60).toFixed(0)}</td>
                  <td className="num">{i.productiveMinutes.toFixed(0)}</td>
                  <td className="num">{(i.totals.contactTime / 60).toFixed(0)}</td>
                  <td className="num">{(i.productiveMinutes - i.totals.contactTime / 60).toFixed(0)}</td>
                  <td className="num">{fmtPct(i.productivePct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

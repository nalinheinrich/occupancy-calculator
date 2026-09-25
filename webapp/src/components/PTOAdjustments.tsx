import type { MetricsRow } from '../types/metrics';
import type { PtoEntry } from '../types/roster';
import { ptoAdjustment } from '../utils/capacityCalc';
import { normalizeAlias } from '../utils/metricsParser';

export default function PTOAdjustments({ pto, rows }: { pto: PtoEntry[]; rows: MetricsRow[] }) {
  const inMetrics = new Set(rows.map((r) => normalizeAlias(r.agent)));
  const adj = pto.map((p) => ({ p, a: ptoAdjustment(p) }));
  const lost = adj.reduce((s, { a }) => s + a.ptoMinutes, 0);

  return (
    <section aria-labelledby="pto-h">
      <h2 id="pto-h">PTO adjustments</h2>
      <p>{pto.length} PTO entries remove <strong>{(lost / 60).toFixed(1)} hours</strong> of scheduled capacity.</p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Alias</th><th>Shift</th><th>Start</th><th>Adjusted start</th><th>End</th><th>PTO window</th><th className="num">PTO hours</th><th className="num">Scheduled min</th><th className="num">PTO min</th><th className="num">Available min</th><th>In metrics?</th></tr></thead>
          <tbody>
            {adj.map(({ p, a }) => (
              <tr key={p.alias}>
                <td>{p.alias}</td><td>{p.shift}</td><td>{p.startTime}</td><td>{p.adjustedStartTime || '—'}</td><td>{p.endTime}</td>
                <td>{p.ptoWindow || (a.fullDay ? 'Full day' : '—')}</td><td className="num">{p.ptoHours ?? ''}</td>
                <td className="num">{a.scheduledMinutes ?? '—'}</td><td className="num">{a.ptoMinutes}</td><td className="num">{a.availableMinutes ?? '—'}</td>
                <td>{inMetrics.has(normalizeAlias(p.alias)) ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">
        PTO minutes use the PTO window when present, otherwise PTO Hours. A shift of 9:00AM–5:30PM is 510 scheduled minutes
        (lunch included), so an "8 Hours" PTO leaves 30 minutes on paper; check such rows against the metrics export.
      </p>
    </section>
  );
}

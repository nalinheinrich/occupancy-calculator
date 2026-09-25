import { useState } from 'react';
import type { MetricsRow } from '../types/metrics';
import type { PtoEntry, RosterEntry } from '../types/roster';
import { parseMetricsCSV } from '../utils/metricsParser';
import { parsePtoWorkbook, parseRosterWorkbook } from '../utils/rosterParser';
import sampleMetricsUrl from '../../../sample-data/sample-historical-metrics.csv?url';
import sampleRosterUrl from '../../../sample-data/sample-daily-roster.xlsx?url';
import samplePtoUrl from '../../../sample-data/sample-pto-associates.xlsx?url';

interface Props {
  metricsCount: number;
  rosterCount: number;
  ptoCount: number;
  onMetrics: (rows: MetricsRow[]) => void;
  onRoster: (roster: RosterEntry[], pto: PtoEntry[]) => void;
  onPto: (pto: PtoEntry[]) => void;
}

/** File inputs for the three sources. Everything is parsed in the browser; nothing is uploaded. */
export default function MetricsUpload({ metricsCount, rosterCount, ptoCount, onMetrics, onRoster, onPto }: Props) {
  const [error, setError] = useState('');

  const guard = async (fn: () => Promise<void>) => {
    setError('');
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  const loadSample = () => guard(async () => {
    const [m, r, p] = await Promise.all([sampleMetricsUrl, sampleRosterUrl, samplePtoUrl].map((u) => fetch(u)));
    onMetrics(parseMetricsCSV(await m.text()));
    const wb = parseRosterWorkbook(await r.arrayBuffer());
    onRoster(wb.roster, wb.pto);
    onPto(parsePtoWorkbook(await p.arrayBuffer()));
  });

  return (
    <section aria-labelledby="upload-h">
      <h2 id="upload-h">Load data</h2>
      <p className="muted">Files are read locally in your browser. No data leaves your machine.</p>
      <div className="row">
        <label>
          Historical Metrics Report (.csv)
          <input type="file" accept=".csv,text/csv" onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) guard(async () => onMetrics(parseMetricsCSV(await f.text())));
          }} />
        </label>
        <label>
          Daily Roster (.xlsx — "Daily Roster" + optional "PTO Associates" sheet)
          <input type="file" accept=".xlsx,.xls" onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) guard(async () => { const wb = parseRosterWorkbook(await f.arrayBuffer()); onRoster(wb.roster, wb.pto); });
          }} />
        </label>
        <label>
          PTO Associates (.xlsx, optional)
          <input type="file" accept=".xlsx,.xls" onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) guard(async () => onPto(parsePtoWorkbook(await f.arrayBuffer())));
          }} />
        </label>
        <button type="button" onClick={loadSample}>Load synthetic sample data</button>
      </div>
      <p aria-live="polite">
        Loaded: {metricsCount} metrics rows · {rosterCount} roster agents · {ptoCount} PTO entries
      </p>
      {error && <p role="alert" className="error">{error}</p>}
    </section>
  );
}

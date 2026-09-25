import type { AgentScorecard, IntervalSummary } from '../types/scorecard';
import { scorecardsToCSV } from '../utils/scorecardGenerator';

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  // Revoke after the browser has started the download; revoking synchronously
  // can cancel it in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function intervalsToCSV(rows: IntervalSummary[]): string {
  const n = (v: number | null, d = 2) => (v === null ? '' : v.toFixed(d));
  return ['Interval,Headcount,Contacts,Occupancy %,Productive %,Productive Min,AHT (sec),Risk',
    ...rows.map((i) => [i.interval, i.headcount, i.contactsHandled, n(i.occupancy), n(i.productivePct), n(i.productiveMinutes, 1), n(i.ahtSeconds, 1), i.risk].join(',')),
  ].join('\n') + '\n';
}

export default function ExportReport({ cards, intervals }: { cards: AgentScorecard[]; intervals: IntervalSummary[] }) {
  return (
    <section aria-labelledby="exp-h">
      <h2 id="exp-h">Export</h2>
      <div className="row">
        <button type="button" disabled={!cards.length} onClick={() => download('agent-scorecards.csv', scorecardsToCSV(cards))}>
          Download agent scorecards (.csv)
        </button>
        <button type="button" disabled={!intervals.length} onClick={() => download('interval-summary.csv', intervalsToCSV(intervals))}>
          Download interval summary (.csv)
        </button>
      </div>
      <p className="muted">Exports contain agent aliases. Treat them as internal data.</p>
    </section>
  );
}

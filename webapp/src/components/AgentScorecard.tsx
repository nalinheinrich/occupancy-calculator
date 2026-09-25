import { useMemo, useState } from 'react';
import { RISK_LABEL, type AgentScorecard as Card } from '../types/scorecard';
import { fmtNum, fmtPct } from '../utils/occupancyCalc';

type SortKey = 'occupancy' | 'ahtVarianceMinutes' | 'contactsHandled' | 'agent';

export default function AgentScorecard({ cards }: { cards: Card[] }) {
  const [sort, setSort] = useState<SortKey>('occupancy');
  const [flagsOnly, setFlagsOnly] = useState(false);

  const shown = useMemo(() => {
    const list = flagsOnly ? cards.filter((c) => c.lowOccupancyFlag || c.ahtFlag) : cards;
    return [...list].sort((a, b) => {
      if (sort === 'agent') return a.agent.localeCompare(b.agent, undefined, { numeric: true });
      return ((b[sort] as number | null) ?? -Infinity) - ((a[sort] as number | null) ?? -Infinity);
    });
  }, [cards, sort, flagsOnly]);

  return (
    <section aria-labelledby="sc-h">
      <h2 id="sc-h">Agent scorecards</h2>
      <div className="row">
        <label>Sort by
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="occupancy">Occupancy (high → low)</option>
            <option value="ahtVarianceMinutes">AHT variance (high → low)</option>
            <option value="contactsHandled">Contacts (high → low)</option>
            <option value="agent">Agent</option>
          </select>
        </label>
        <label style={{ flexDirection: 'row', alignItems: 'center' }}>
          <input type="checkbox" checked={flagsOnly} onChange={(e) => setFlagsOnly(e.target.checked)} /> Flagged only
        </label>
      </div>
      <div className="table-wrap">
        <table>
          <caption>{shown.length} agents</caption>
          <thead>
            <tr>
              <th>Agent</th><th>Role</th><th>Hierarchy</th><th>Routing profile(s)</th><th className="num">Intervals</th>
              <th className="num">Contacts</th><th className="num">Occupancy</th><th className="num">Productive %</th>
              <th className="num">AHT (min)</th><th className="num">Baseline</th><th className="num">Variance</th><th>Flags</th><th>Risk</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <tr key={c.agent}>
                <td>{c.agent}</td><td>{c.role}</td><td>{c.hierarchyLevel}</td><td>{c.routingProfiles.join(', ')}</td>
                <td className="num">{c.intervals}</td><td className="num">{c.contactsHandled}</td>
                <td className="num">{fmtPct(c.occupancy)}</td><td className="num">{fmtPct(c.productivePct)}</td>
                <td className="num">{fmtNum(c.ahtMinutes, 2)}</td><td className="num">{fmtNum(c.baselineAhtMinutes)}</td>
                <td className="num">{c.ahtVarianceMinutes === null ? '—' : `${c.ahtVarianceMinutes >= 0 ? '+' : ''}${c.ahtVarianceMinutes.toFixed(2)}`}</td>
                <td>{[c.lowOccupancyFlag && 'Low occ', c.ahtFlag && 'AHT high'].filter(Boolean).join(', ')}</td>
                <td className={c.risk}>{RISK_LABEL[c.risk]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

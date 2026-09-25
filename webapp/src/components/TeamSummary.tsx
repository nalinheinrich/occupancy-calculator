import { useMemo, useState } from 'react';
import type { MetricsRow } from '../types/metrics';
import type { RosterEntry } from '../types/roster';
import { RISK_LABEL, type ScorecardConfig } from '../types/scorecard';
import { normalizeAlias } from '../utils/metricsParser';
import { fmtNum, fmtPct } from '../utils/occupancyCalc';
import { buildGroupSummaries, rosterIndex } from '../utils/scorecardGenerator';

type GroupBy = 'role' | 'routingProfile' | 'hierarchyLevel' | 'crossTrained';

const LABELS: Record<GroupBy, string> = {
  role: 'Roster role',
  routingProfile: 'Routing profile',
  hierarchyLevel: 'Agent hierarchy',
  crossTrained: 'Cross-trained (Y/N)',
};

export default function TeamSummary({ rows, roster, cfg }: { rows: MetricsRow[]; roster: RosterEntry[]; cfg: ScorecardConfig }) {
  const [by, setBy] = useState<GroupBy>('role');
  const idx = useMemo(() => rosterIndex(roster), [roster]);

  const groups = useMemo(() => {
    const keyOf = (r: MetricsRow): string => {
      const e = idx.get(normalizeAlias(r.agent));
      if (by === 'role') return e?.role ?? '(not on roster)';
      if (by === 'crossTrained') return !e ? '(not on roster)' : e.crossTrained.length ? `Yes (${e.crossTrained.join(', ')})` : 'No';
      return r[by] || '(blank)';
    };
    return buildGroupSummaries(rows, keyOf, cfg);
  }, [rows, idx, by, cfg]);

  return (
    <section aria-labelledby="ts-h">
      <h2 id="ts-h">Team summary</h2>
      <label>Group by
        <select value={by} onChange={(e) => setBy(e.target.value as GroupBy)}>
          {(Object.keys(LABELS) as GroupBy[]).map((k) => <option key={k} value={k}>{LABELS[k]}</option>)}
        </select>
      </label>
      {cfg.excludeNonFrontline && <p className="muted">Non-frontline rows are excluded. Turn off the filter in Settings to compare escalation, Spanish and Lead queues.</p>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>{LABELS[by]}</th><th className="num">Agents</th><th className="num">Contacts</th><th className="num">Occupancy</th><th className="num">Productive %</th><th className="num">AHT (min)</th><th className="num">SL ≥ 90%</th><th>Risk</th></tr></thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.group}>
                <td>{g.group}</td><td className="num">{g.headcount}</td><td className="num">{g.contactsHandled}</td>
                <td className="num">{fmtPct(g.occupancy)}</td><td className="num">{fmtPct(g.productivePct)}</td>
                <td className="num">{fmtNum(g.ahtSeconds === null ? null : g.ahtSeconds / 60, 2)}</td>
                <td className="num">{fmtPct(g.slCompliancePct)}</td><td className={g.risk}>{RISK_LABEL[g.risk]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

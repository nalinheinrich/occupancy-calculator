import { useMemo, useState, type ChangeEvent } from 'react';
import AgentScorecard from './components/AgentScorecard';
import CapacityAnalysis from './components/CapacityAnalysis';
import ExportReport from './components/ExportReport';
import IntervalBreakdown from './components/IntervalBreakdown';
import MetricsUpload from './components/MetricsUpload';
import OccupancyDashboard from './components/OccupancyDashboard';
import PTOAdjustments from './components/PTOAdjustments';
import RosterView from './components/RosterView';
import TeamSummary from './components/TeamSummary';
import type { MetricsRow } from './types/metrics';
import type { PtoEntry, RosterEntry } from './types/roster';
import { DEFAULT_CONFIG, type ScorecardConfig } from './types/scorecard';
import { buildAgentScorecards, buildIntervalSummaries, occupancyRows } from './utils/scorecardGenerator';

const TABS = ['Data', 'Dashboard', 'Scorecards', 'Intervals', 'Capacity', 'Team', 'Roster', 'PTO', 'Export', 'Settings'] as const;
type Tab = (typeof TABS)[number];

export default function App() {
  const [tab, setTab] = useState<Tab>('Data');
  const [metrics, setMetrics] = useState<MetricsRow[]>([]);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [pto, setPto] = useState<PtoEntry[]>([]);
  const [cfg, setCfg] = useState<ScorecardConfig>(DEFAULT_CONFIG);

  // Single data pipeline: every tab sees the same filtered rows.
  const occRows = useMemo(() => occupancyRows(metrics, cfg), [metrics, cfg]);
  const cards = useMemo(() => buildAgentScorecards(occRows, roster, cfg), [occRows, roster, cfg]);
  const intervals = useMemo(() => buildIntervalSummaries(occRows, 30, cfg), [occRows, cfg]);

  const num = (k: keyof ScorecardConfig) => (e: ChangeEvent<HTMLInputElement>) => setCfg({ ...cfg, [k]: Number(e.target.value) });

  return (
    <>
      <header>
        <h1>RGM Performance Occupancy Calculator</h1>
        <p>Daily roster + Amazon Connect 30-minute interval metrics → occupancy, AHT and capacity.</p>
      </header>
      <nav role="tablist" aria-label="Views">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t}</button>
        ))}
      </nav>
      <main role="tabpanel" aria-label={tab}>
        {tab === 'Data' && (
          <MetricsUpload
            metricsCount={metrics.length} rosterCount={roster.length} ptoCount={pto.length}
            onMetrics={setMetrics}
            onRoster={(r, p) => { setRoster(r); if (p.length) setPto(p); }}
            onPto={(p) => { if (p.length) setPto(p); }}
          />
        )}
        {tab !== 'Data' && tab !== 'Settings' && metrics.length === 0 && tab !== 'Roster' && tab !== 'PTO' && (
          <p>Load a Historical Metrics Report (or the sample data) on the Data tab first.</p>
        )}
        {tab === 'Dashboard' && metrics.length > 0 && <OccupancyDashboard occRows={occRows} allRows={metrics} cards={cards} cfg={cfg} />}
        {tab === 'Scorecards' && metrics.length > 0 && <AgentScorecard cards={cards} />}
        {tab === 'Intervals' && metrics.length > 0 && <IntervalBreakdown rows={occRows} cfg={cfg} />}
        {tab === 'Capacity' && metrics.length > 0 && <CapacityAnalysis rows={occRows} cfg={cfg} />}
        {tab === 'Team' && metrics.length > 0 && <TeamSummary rows={occRows} roster={roster} cfg={cfg} />}
        {tab === 'Roster' && <RosterView roster={roster} rows={metrics} />}
        {tab === 'PTO' && <PTOAdjustments pto={pto} rows={metrics} />}
        {tab === 'Export' && metrics.length > 0 && <ExportReport cards={cards} intervals={intervals} />}
        {tab === 'Settings' && (
          <section aria-labelledby="set-h">
            <h2 id="set-h">Settings</h2>
            <div className="row">
              <label>Target occupancy %<input type="number" value={cfg.targetOccupancy} onChange={num('targetOccupancy')} /></label>
              <label>Low occupancy below %<input type="number" value={cfg.lowOccupancy} onChange={num('lowOccupancy')} /></label>
              <label>AHT tolerance (min)<input type="number" step="0.1" value={cfg.ahtToleranceMinutes} onChange={num('ahtToleranceMinutes')} /></label>
              <label>Window start hour<input type="number" min={0} max={23} value={cfg.shiftStartHour} onChange={num('shiftStartHour')} /></label>
              <label>Window end hour<input type="number" min={1} max={24} value={cfg.shiftEndHour} onChange={num('shiftEndHour')} /></label>
              <label style={{ flexDirection: 'row', alignItems: 'center' }}>
                <input type="checkbox" checked={cfg.excludeNonFrontline} onChange={(e) => setCfg({ ...cfg, excludeNonFrontline: e.target.checked })} />
                Exclude non-frontline rows (Lead, Escalation, Spanish, Training profiles)
              </label>
            </div>
            <button type="button" onClick={() => setCfg(DEFAULT_CONFIG)}>Reset defaults</button>
          </section>
        )}
      </main>
    </>
  );
}

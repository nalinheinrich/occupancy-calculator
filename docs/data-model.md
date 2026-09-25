# Data Model

Three inputs, one join key, one analysis pipeline. All examples use the synthetic files in `sample-data/`.

## Entities

```mermaid
erDiagram
    ROSTER ||--o{ METRICS_ROW : "Alias = Agent"
    ROSTER ||--o| PTO : "Alias = Alias"
    ROSTER {
        string Alias PK
        string Name
        string Standing
        string Role
        string Shift
        string Start
        string End
        float  AHT_min
        string Break1
        string Lunch
        string Break2
        string CrossTrained
    }
    PTO {
        string Alias FK
        string StartTime
        string AdjustedStartTime
        string EndTime
        string PTOTimes
        string PTOHours
    }
    METRICS_ROW {
        string Agent FK
        string HierarchyLevelTwo
        string RoutingProfile
        datetime StartInterval
        float OnlineTime_sec
        float ContactTime_sec
        float Aux12_sec
        string Occupancy
        string ServiceLevel20
        float AHT_sec
        float ContactsHandled
    }
```

Grain:

```
┌──────────────┬──────────────────────────────────────────────────────────┐
│ Roster       │ 1 row per agent per day                                  │
│ PTO          │ 1 row per agent with PTO that day                        │
│ Metrics      │ 1 row per agent × routing profile × 30-minute interval   │
└──────────────┴──────────────────────────────────────────────────────────┘
```

## Relationships

```
Daily Roster (xlsx)                        Historical Metrics (csv)
┌──────────────────┐                       ┌──────────────────────────┐
│ Alias ◄──────────┼────── join ───────────┼─► Agent                  │
│ Name             │                       │ Agent Hierarchy Level Two│
│ Role ────────────┼── group by ──┐        │ Routing Profile ─── filter / group by
│ Shift            │              │        │ StartInterval ───── window + bucket
│ Start / End ─────┼── scheduled minutes   │ Online time              │
│ AHT (min) ◄──────┼── compare ───┼────────┼─► Average handle time    │
│ Break 1/Lunch/B2 │  (reference only)     │ 12 aux columns           │
│ Cross Trained ───┼── group by ──┘        │ Agent on contact time    │
└──────────────────┘                       │ Occupancy                │
                                           │ Service level 20 seconds │
PTO Associates (xlsx)                      │ Contacts handled         │
┌──────────────────┐                       └──────────────────────────┘
│ Alias ◄──────────┼── join (same key)
│ PTO Times/Hours ─┼── reduces scheduled capacity
│ Adjusted Start   │
└──────────────────┘
```

Scheduled break and lunch times in the roster are carried through for reference. They are **not** checked against the metrics' break and lunch seconds, because the export gives seconds per interval, not start times.

## Join behaviour

`mergeRosterMetrics()` is a full outer join on the normalized key (`trim().toLowerCase()`):

```
┌───────────────┬──────────────────────────────────────┬────────┐
│ Status        │ Meaning                              │ Sample │
├───────────────┼──────────────────────────────────────┼────────┤
│ matched       │ on roster, has metrics rows          │     18 │
│ roster-only   │ scheduled, no metrics rows           │      2 │
│ metrics-only  │ has metrics, not on the day's roster │      2 │
└───────────────┴──────────────────────────────────────┴────────┘
```

Metrics-only agents are still scored. They show role `(not on roster)` and have no AHT baseline.

## Pipeline

```mermaid
flowchart LR
    CSV[Historical Metrics CSV] --> P1[parseMetricsCSV]
    XLSX[Roster XLSX] --> P2[parseRosterWorkbook]
    PTOX[PTO XLSX] --> P3[parsePtoWorkbook]
    P1 --> W[filterShiftWindow 09:00-17:00]
    W --> FL[filterFrontlineRows]
    FL --> SC[buildAgentScorecards]
    P2 --> SC
    FL --> IV[buildIntervalSummaries]
    FL --> GS[buildGroupSummaries]
    P1 --> V[detectViolations - all roles]
    P1 --> SH[calculateShrinkage]
    P2 --> SH
    P3 --> PT[ptoAdjustment]
```

## Which rows each view uses

```
┌─────────────────────────────┬───────────────────────┬─────────────────────────┐
│ View                        │ Shift window          │ Non-frontline excluded  │
├─────────────────────────────┼───────────────────────┼─────────────────────────┤
│ Dashboard KPIs, Scorecards, │ yes                   │ yes (toggle)            │
│ Intervals, Capacity, Team   │                       │                         │
│ Violations                  │ no                    │ no                      │
│ Roster join, Shrinkage, PTO │ no                    │ no                      │
└─────────────────────────────┴───────────────────────┴─────────────────────────┘
```

Sample effect: 272 rows → 272 in window → **244** after the non-frontline exclusion. The 28 excluded rows are 11 `Lead`/`Lead`, 5 `Lead`/`Escalation Queue`, 8 `Tenured`/`Escalation Queue` and 4 `Tenured`/`Spanish Escalation`.

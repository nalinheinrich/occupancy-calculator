# User Guide (Operations Managers)

## 1. Get the files

```
┌──────────────────────────────┬──────────────────────────────────────────────────┐
│ File                         │ What it is                                       │
├──────────────────────────────┼──────────────────────────────────────────────────┤
│ Historical Metrics Report    │ Agent-level historical metrics export, 30-minute │
│ (.csv)                       │ intervals, with the columns listed in            │
│                              │ sample-data/data-dictionary.md                   │
│ Daily Roster (.xlsx)         │ Your team's roster. Sheet "Daily Roster";        │
│                              │ optional sheet "PTO Associates"                  │
│ PTO Associates (.xlsx)       │ Optional; only if PTO is kept in a separate file │
└──────────────────────────────┴──────────────────────────────────────────────────┘
```

Column names must match the headers in the data dictionary (case and order do not matter).

## 2. Start the app

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173). Files are processed in your browser; nothing is uploaded to a server.

## 3. Load data (Data tab)

Choose the metrics CSV and roster workbook, or click **Load synthetic sample data**. The status line confirms what was read. With the sample: 272 metrics rows, 20 roster agents, 4 PTO entries.

## 4. Tabs

```
┌────────────┬─────────────────────────────────────────────────────────────────┐
│ Dashboard  │ Team occupancy, capacity, AHT, contacts, SL, risk counts,        │
│            │ top-20 policy violations                                         │
│ Scorecards │ One row per agent. Sort by occupancy / AHT variance / contacts;  │
│            │ "Flagged only" shows low occupancy or AHT over baseline          │
│ Intervals  │ Team occupancy per 30 or 60 min + agent × interval heatmap       │
│ Capacity   │ Where non-productive minutes go; productive vs idle by interval  │
│ Team       │ Compare by roster role, routing profile, hierarchy, cross-trained│
│ Roster     │ Roster with join status and shrinkage                            │
│ PTO        │ Capacity removed by PTO and whether PTO agents appear in metrics │
│ Export     │ Download scorecards and interval summary as CSV                  │
│ Settings   │ Targets, AHT tolerance, time window, non-frontline filter        │
└────────────┴─────────────────────────────────────────────────────────────────┘
```

## 5. A daily review in five steps (sample values)

1. **Dashboard**: is team occupancy in band? Sample: 79.76%, Moderate.
2. **Intervals**: find the weakest half-hours. Sample: 15:30 is lowest at 71.8%.
3. **Capacity**: is a weak interval caused by high aux time (low capacity) or low volume (high capacity, low occupancy)? Sample 13:30: capacity 63.3% (lunch hour). Sample 15:30: capacity 78.9% with occupancy 71.8% (low volume).
4. **Scorecards → Flagged only**: sample flags `caswhit` (54.3% occupancy), `tatlark` (68.8% occupancy) and `umbquim` (AHT 3.21 min vs 2.0 baseline).
5. **Dashboard → Violations**: follow up on the top overages. Sample: `caswhit` Personal 20.2 min against an 18-min limit.

## 6. Settings

```
┌──────────────────────────┬─────────┬────────────────────────────────────────────┐
│ Setting                  │ Default │ Effect                                     │
├──────────────────────────┼─────────┼────────────────────────────────────────────┤
│ Target occupancy %       │ 85      │ ≥ target = On target                       │
│ Low occupancy below %    │ 70      │ < value = Low, flagged on scorecards       │
│ AHT tolerance (min)      │ 0.5     │ Flag when actual AHT > baseline + value    │
│ Window start / end hour  │ 9 / 17  │ Intervals starting outside are ignored     │
│ Exclude non-frontline    │ on      │ Drops Lead rows and Escalation, Spanish,   │
│                          │         │ Training routing profiles                  │
└──────────────────────────┴─────────┴────────────────────────────────────────────┘
```

The window matters for early shifts: the sample roster has 6:00AM and 7:30AM starts, but intervals before 09:00 are ignored by default.

## 7. Command-line scripts

```bash
npm run occupancy                      # team + interval occupancy
npm run scorecard                      # writes output/agent-scorecards.csv
npm run merge                          # writes output/merged-roster-metrics.csv + join report
npm run generate-data                  # rebuilds the synthetic sample-data/

# your own files
npm run scorecard -- --metrics ./private-data/report.csv --roster ./private-data/roster.xlsx
```

`output/` and `private-data/` are git-ignored.

## 8. Troubleshooting

```
┌──────────────────────────────────────────┬──────────────────────────────────────────┐
│ Symptom                                  │ Check                                    │
├──────────────────────────────────────────┼──────────────────────────────────────────┤
│ "missing Agent or Online time column"    │ Wrong file, or headers were renamed      │
│ Every agent shows "(not on roster)"      │ Alias spelling differs from agent login  │
│ Occupancy "—"                            │ No available time (all aux) in the scope │
│ An agent has 100 % in a tiny interval    │ Very short online time; read headcount   │
│ Baseline AHT empty                       │ Roster "AHT (min)" is blank              │
└──────────────────────────────────────────┴──────────────────────────────────────────┘
```

## 9. Data handling

Real rosters and exports contain employee identifiers. Keep them in `private-data/` (ignored by git) and never commit them. Only the synthetic files in `sample-data/` belong in the repository.

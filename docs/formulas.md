# Formulas

Every formula here is implemented in `webapp/src/utils/` and used identically by the web app and `scripts/`. Worked examples use the synthetic files in `sample-data/`.

## 1. Non-productive (aux) time

```
Non-Productive = Manager Approved + Training + Break + Huddle + Personal + Meeting
               + Project + Lunch + Lead Approved + Leadership Approved
               + Unproductive + Engagement                       (12 columns, seconds)
```

Code: `auxTime()` in `occupancyCalc.ts`.

## 2. Occupancy %

```
Occupancy % = Agent on contact time ÷ (Online time − Non-Productive) × 100
```

Code: `occupancyPct()`. Returns "no data" when `Online − Non-Productive ≤ 0` (an interval spent fully in lunch or training has no available time to be occupied).

### Why this formula

Amazon Connect publicly defines Occupancy as contact time ÷ (contact time + idle time) ([Metric definitions in Amazon Connect](https://docs.aws.amazon.com/connect/latest/adminguide/metrics-definitions.html)). When every logged-in second is either on contact, idle, or one of the non-productive statuses, `Online − Non-Productive` equals contact + idle, so the two definitions are the same.

If your status setup has time that fits none of these buckets (for example after-contact work tracked separately), compare this calculation with your export's own `Occupancy` column before relying on it.

### Worked example — `caswhit`, 16:30–17:00

```
┌─────────────────────────┬──────────┐
│ Online time             │  1,800 s │
│ Break time              │    872 s │
│ Personal time           │    245 s │
│ Non-productive (sum)    │  1,117 s │
│ Available               │    683 s │  = 1,800 − 1,117
│ Agent on contact time   │    411 s │
├─────────────────────────┼──────────┤
│ Occupancy (calculated)  │  60.18 % │  = 411 ÷ 683
│ Occupancy (CSV column)  │  60.15 % │
└─────────────────────────┴──────────┘
```

The 0.03-point gap is rounding: the generator writes each time column as whole seconds after computing the percentage.

### Aggregating

Group occupancy is always a **ratio of sums**, never an average of interval percentages:

```
Occupancy(group) = Σ contact ÷ (Σ online − Σ non-productive) × 100
```

Averaging percentages would give a 3-minute login the same weight as a full 30-minute interval.

## 3. Productive % (capacity)

```
Productive Minutes = (Online time − Non-Productive) ÷ 60
Capacity %         = (Online time − Non-Productive) ÷ Online time × 100
Idle Minutes       = Productive Minutes − Contact time ÷ 60
```

Code: `productivePct()`, `statsFromTotals()`.

Capacity is not occupancy: it counts idle time as productive. Both are reported, under separate names.

## 4. AHT

```
AHT (seconds, group) = Σ(Average handle time × Contacts handled) ÷ Σ Contacts handled
AHT (minutes)        = AHT (seconds) ÷ 60
AHT variance (min)   = Actual AHT (min) − Roster "AHT (min)"
AHT flag             = variance > tolerance       (default tolerance 0.5 min, configurable)
```

Contact-weighting matters: one long contact in a quiet interval can show a very high interval AHT.

Example — `umbquim`: actual 3.21 min vs baseline 2.0 min → variance +1.21 min → **flagged**.

## 5. Throughput and service level

```
Contacts per online hour = Σ Contacts handled ÷ (Σ Online time ÷ 3600)
SL compliance %          = intervals with "Service level 20 seconds" ≥ 90% ÷ intervals with an SL value × 100
```

The export has an interval-level percentage, not answered-within-20s counts, so SL compliance is measured per interval. The 90% interval target is a configurable default (`SL_TARGET_PCT`).

## 6. Risk bands

```
┌────────────┬───────────────┐
│ On target  │  ≥ 85 %       │
│ Moderate   │  70 – 84.99 % │
│ Low        │  < 70 %       │
│ No data    │  no available time
└────────────┴───────────────┘
```

Change them in the Settings tab or `DEFAULT_CONFIG`.

## 7. Scorecard algorithm (per agent)

```
1. Keep rows whose interval starts 09:00 ≤ t < 17:00           filterShiftWindow()
2. Drop non-frontline rows (Lead hierarchy/profile; profile    filterFrontlineRows()
   contains escalation | spanish | training)
3. Group by Agent (case-insensitive)
4. Sum online, contact, 12 aux columns, contacts, AHT×contacts  sumRows()
5. Occupancy = Σcontact ÷ (Σonline − Σaux)                     occupancyPct()
6. Compare weighted AHT to roster baseline                      ahtVariance()
7. Flag occupancy < 70 %; flag AHT > baseline + tolerance
8. Sort by occupancy descending
```

Exclusion is by **routing profile**, not roster role. The sample's `Bilingual` agent is scored only for the intervals worked on `General Queue`.

## 8. Shrinkage

```
Planned HC   = roster rows with Standing = "Active"
Actual HC    = planned agents with ≥ 1 metrics row
Shrinkage %  = (Planned − Actual) ÷ Planned × 100
```

Sample: planned 18 (the 2 Extra Time rows have a blank Standing), actual 16, absent `harhart` and `ellyard` → **11.1 %**.

## 9. PTO capacity

```
Scheduled minutes = End − Start                    (9:00AM–5:30PM = 510)
PTO minutes       = PTO window length, else PTO Hours × 60
Available minutes = max(0, Scheduled − PTO)
```

Sample total: 15.5 PTO hours (480 + 90 + 240 + 120 minutes). The roster shift length includes lunch, so an `8 Hours` PTO on a 510-minute shift leaves 30 minutes "available" on paper.

## 10. Policy limits (violations)

```
┌──────────┬──────────────────────┬──────────┐
│ Break    │ 2 × 15 min           │ 30 min   │
│ Lunch    │ 1 × 30 min           │ 30 min   │
│ Personal │ 3 × 6 min            │ 18 min   │
└──────────┴──────────────────────┴──────────┘
```

Daily totals per agent, all roles included (`POLICY_LIMITS`). Sample: 15 violations; the largest is `caswhit` Personal 20.2 min (+2.2).

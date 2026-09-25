# Occupancy Guide

## What occupancy measures

Occupancy is the share of an agent's **available** time spent on contacts.

```
                  ┌──────────────────── Online time ────────────────────┐
                  ┌── Non-productive ──┐┌──────── Available ────────────┐
                  │ break, lunch,      ││ on contact      │ idle        │
                  │ training, personal…││                 │             │
                  └────────────────────┘└─────────────────┴─────────────┘
Occupancy  =  on contact ÷ available
Capacity   =  available ÷ online
```

Two different questions:
- **Occupancy**: when agents were available, how busy were they? (demand vs staffing)
- **Capacity / productive %**: how much of logged-in time was available at all? (shrinkage inside the shift)

## Why it matters in dispatch operations

- **Too low**: available agents are idle. Contacts arrived slower than staffing assumed, or routing sent work elsewhere.
- **Too high**: agents take contacts back-to-back with no recovery time. AWS notes that higher occupancy can lower service levels and raise burnout risk ([AWS Contact Center blog](https://aws.amazon.com/blogs/contact-center/routing-contacts-based-on-performance-objectives-in-amazon-connect-agent-occupancy-part-2/)).
- **By interval**: the team number hides the peaks. The interval view shows which half-hours need more or fewer agents.

## Target bands used here

```
┌────────────┬───────────────┬─────────────────────────────────────────┐
│ Band       │ Occupancy     │ Typical reading                         │
├────────────┼───────────────┼─────────────────────────────────────────┤
│ On target  │ ≥ 85 %        │ Staffing matches demand                 │
│ Moderate   │ 70 – 84.99 %  │ Some idle time; watch the trend         │
│ Low        │ < 70 %        │ Idle capacity or a data/routing issue   │
└────────────┴───────────────┴─────────────────────────────────────────┘
```

These are defaults. Targets vary by channel and site; set your own in Settings.

## Reading the sample results

Synthetic day 2026-01-15, window 09:00–17:00, non-frontline rows excluded, 19 agents, 244 rows:

```
┌──────────────────────────────┬─────────────┐
│ Team occupancy               │  79.76 %    │  Moderate
│ Productive % (capacity)      │  80.93 %    │
│ Productive minutes           │  5,800.7    │
│ Contacts handled             │  2,758      │
│ Weighted AHT                 │  100.7 s    │
│ Contacts per online hour     │  23.1       │
│ Intervals with SL ≥ 90 %     │  91.9 %     │
│ Agents: on target / mod / low│  5 / 12 / 2 │
└──────────────────────────────┴─────────────┘
```

By interval (30 min):

```
┌───────┬────┬────────┬──────────┐
│ Start │ HC │ Occ %  │ Capacity │
├───────┼────┼────────┼──────────┤
│ 09:00 │ 12 │  77.9  │   89.0   │
│ 09:30 │ 14 │  86.5  │   86.5   │
│ 10:00 │ 15 │  89.5  │   72.9   │  ← highest occupancy
│ 10:30 │ 15 │  83.6  │   76.0   │
│ 11:00 │ 17 │  81.3  │   85.8   │
│ 11:30 │ 17 │  76.3  │   81.1   │
│ 12:00 │ 17 │  79.6  │   90.9   │
│ 12:30 │ 18 │  80.7  │   69.8   │
│ 13:00 │ 18 │  80.4  │   69.9   │
│ 13:30 │ 18 │  79.1  │   63.3   │  ← lowest capacity
│ 14:00 │ 18 │  75.2  │   90.3   │
│ 14:30 │ 13 │  78.0  │   96.7   │
│ 15:00 │ 13 │  80.8  │   93.5   │
│ 15:30 │ 13 │  71.8  │   78.9   │  ← lowest occupancy
│ 16:00 │ 13 │  79.4  │   79.1   │
│ 16:30 │ 13 │  77.5  │   81.2   │
└───────┴────┴────────┴──────────┘
```

What the sample shows:
- 09:30–10:00 are the busiest intervals.
- 12:30–13:30 have the lowest capacity (63–70%): most lunches in the roster fall there.
- 15:30 has the lowest occupancy (71.8%) with capacity near 79%, so agents were available and volume did not fill the time.

Where non-productive time went (same 244 rows): Lunch 32.9%, Break 28.7%, Personal 14.6%, Training 13.3%, Lead Approved 4.7%, Huddle 3.7%, all others < 2%.

## Common pitfalls

- **Averaging percentages.** Always divide summed seconds. A 3-minute login at 100% would otherwise count as much as a full interval.
- **Using capacity as occupancy.** `(online − aux) ÷ online` is not occupancy; it treats idle time as busy.
- **Leads and escalation queues.** Lead rows are mostly non-contact time; in the sample the Lead's `Lead` profile rows are 0% occupancy. Keep the non-frontline filter on for floor occupancy.
- **Short intervals.** An agent online for a few seconds can show 100%. Look at headcount and online minutes next to the percentage.
- **One day is one day.** The sample is a single day; trends need several exports.

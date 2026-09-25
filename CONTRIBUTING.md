# Contributing

Thanks for helping improve the RGM Performance Occupancy Calculator.

## 👤 Author & maintainer

| | |
|---|---|
| Author | **Nalin Heinrich** (@nalinheinrich) |
| GitHub | [github.com/nalinheinrich](https://github.com/nalinheinrich) |
| Email | [nalinheinrich@gmail.com](mailto:nalinheinrich@gmail.com) |
| Role | Creator, maintainer, license holder (MIT) |

## 🔗 Project links

| | Link |
|---|---|
| Repository | https://github.com/nalinheinrich/occupancy-calculator |
| Issues | https://github.com/nalinheinrich/occupancy-calculator/issues |
| Pull requests | https://github.com/nalinheinrich/occupancy-calculator/pulls |
| Contributors | https://github.com/nalinheinrich/occupancy-calculator/graphs/contributors |
| License | [LICENSE](LICENSE) (MIT © 2026 Nalin Heinrich) |

## 🙌 Contributors

| Name | GitHub | Contribution |
|------|--------|--------------|
| Nalin Heinrich | [@nalinheinrich](https://github.com/nalinheinrich) | Author: app, data model, formulas, docs |

Contributors whose pull requests are merged may add themselves to this table in the same PR.

## Pull request workflow

1. Open an [issue](https://github.com/nalinheinrich/occupancy-calculator/issues) describing the change (bug, feature or doc fix).
2. Fork the repo and create a branch: `git checkout -b feature/short-description`.
3. Make the change, then run `npm run typecheck` and `npm run build`.
4. Open a [pull request](https://github.com/nalinheinrich/occupancy-calculator/pulls) against `main` and link the issue.
5. The maintainer ([@nalinheinrich](https://github.com/nalinheinrich)) reviews and merges.

## Fork and customize for your call center

1. Fork on GitHub, then clone your fork:
   ```bash
   git clone https://github.com/<you>/occupancy-calculator.git
   cd occupancy-calculator
   npm install
   ```
2. Adjust defaults in `webapp/src/types/scorecard.ts` → `DEFAULT_CONFIG`:
   ```
   ┌─────────────────────┬─────────┬──────────────────────────────────┐
   │ targetOccupancy     │ 85      │ your site's target               │
   │ lowOccupancy        │ 70      │ flag threshold                   │
   │ ahtToleranceMinutes │ 0.5     │ AHT flag tolerance               │
   │ shiftStartHour/End  │ 9 / 17  │ your operating window            │
   │ excludeNonFrontline │ true    │ drop Lead / non-floor profiles   │
   └─────────────────────┴─────────┴──────────────────────────────────┘
   ```
3. Edit which routing profiles are excluded in `metricsParser.ts` → `NON_FRONTLINE_PROFILE_KEYWORDS`.
4. Edit policy limits in `scorecardGenerator.ts` → `POLICY_LIMITS` (seconds).
5. Edit the SL interval target in `occupancyCalc.ts` → `SL_TARGET_PCT`.

## Swap in your own roster and metrics

1. Put real files in `private-data/` (git-ignored).
2. **Metrics CSV** — headers must match `METRICS_HEADER_MAP` in `webapp/src/types/metrics.ts` (case-insensitive; order does not matter). If your Connect report names a column differently, add an entry there.
3. **Roster XLSX** — sheet `Daily Roster` (or the first sheet) with the 12 headers in `sample-data/data-dictionary.md`. PTO on a sheet named `PTO Associates` or a separate workbook.
4. **Join key** — roster `Alias` must equal the Connect agent login. Run `npm run merge -- --metrics … --roster …` and check the "Roster only" / "Metrics only" lists first.
5. Different aux categories? Update `AUX_FIELDS`, `AUX_LABELS` and `METRICS_HEADER_MAP` together, then compare the calculated occupancy with your export's own `Occupancy` column.

## Sample data

`sample-data/` must stay **100% synthetic**. Never commit real rosters, exports, names, aliases, queue names or statistics derived from them, not even anonymized.
- To change the sample, edit `scripts/generate-synthetic-data.ts` and run `npm run generate-data`.
- Then update the counts in `sample-data/data-dictionary.md`, the docs and the README from the regenerated files. Do not estimate numbers.

## Code style

- TypeScript `strict`; no `any`. Run `npm run typecheck` before a PR.
- Calculation logic lives only in `webapp/src/utils/` as pure functions. Components and scripts import it; they do not re-implement math.
- Time values stay in **seconds** until display.
- Aggregate as ratio of sums (`sumRows` → `statsFromTotals`); never average percentages.
- New formulas: add a docstring with the formula, and document it in `docs/formulas.md` with a worked example from `sample-data/`.
- UI: semantic tables with headers, labelled inputs, and text labels next to colors (risk is never color-only).
- Pin exact dependency versions in `package.json`.
- Small, focused PRs with a description of what changed and how you checked it (e.g. `npm run occupancy` output before/after).

## Reporting issues

Open a [GitHub issue](https://github.com/nalinheinrich/occupancy-calculator/issues) with steps to reproduce. Never attach real rosters or exports; reproduce the problem with `sample-data/` or `npm run generate-data -- --seed N`.

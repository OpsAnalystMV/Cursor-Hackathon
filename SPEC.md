# Pace — build spec

A cashflow tool for people who earn daily and get billed monthly.

## 1. The problem, stated precisely

A daily earner is paid in ~$160 increments and billed in ~$2,122 cliffs. Every budgeting product
opens with an account balance. For this user the balance is the wrong number, because most of it is
already committed — median committed share of income is over half, and the top decile is near
totality (exact figures in `fixtures.json` → `population`).

**Pace is not a forecaster. It is an accounting reframe.** It computes what is already true and
currently invisible: how much of the balance is spoken for, what one worked day has to clear, when
the next cliff lands, and how many shifts stand between the two. Every number it shows is
arithmetic over obligations and earnings. Nothing is predicted.

### Why prediction was cut — read this before proposing a model

An earlier version of this spec asked for a shortfall forecaster validated against the 520 real
advances. That was tested and it failed. Three independent checks, all recorded in
`fixtures.json` → `negativeResult`:

1. Advance rate is flat across all five quintiles of prior-week ending balance.
2. Prior balance, prior net cashflow and income are statistically indistinguishable between
   advance weeks and non-advance weeks.
3. A pace-deficit detector and a free-balance detector, each run 7 days ahead of 404 eligible
   advances against a matched control group of worker-days with no advance in the following 14
   days, produced lift of 1.11x and 1.05x. Cross-sectionally, negative free balance is *less*
   common among borrowers than non-borrowers — lift 0.65x, inverted.

Advance events in this dataset are statistically independent of the cashflow state. This is most
likely an artifact of how the data was produced, not a claim about real EWA users — but it means no
predictive claim is supportable from these files. Do not add a detector, a risk score, a
propensity model, or a "likely to need an advance" flag. If a request implies one, stop and say so.

## 2. Non-goals

Do not build any of these, even if they seem easy or a request implies them:

- Any predictive model, risk score, propensity flag, or "likely to need an advance" indicator.
  See §1. This is the hard one — it will feel like the obvious next feature. It is not supportable.
- Spending-by-category pie charts or donut charts
- Monthly budget envelopes or category limits
- Net worth, credit score, or savings goals
- Streaks, badges, confetti, or any gamification
- Bank linking, auth, onboarding, or multi-user accounts
- Retrospective "you spent 12% more on coffee" comparisons

Every one of these either assumes a salaried user with a fixed pay date, or claims knowledge the
data does not contain.

## 3. Data contract

Six CSVs live in `/data`. Column names are exact — do not rename, infer, or guess. Load them
verbatim into SQLite at seed time. See `data_manifest.json` for sha256 and content assertions.

### Tables

- `workers.csv` — 220 rows
- `daily_earnings.csv` — 12,204 rows
- `recurring_obligations.csv` — 849 rows (`monthly` 811 | `biweekly` 38) — **handle both**
- `transactions.csv` — 31,726 rows
- `earned_wage_advances.csv` — 535 rows; exclude `cancelled` everywhere; never a model input
- `weekly_cashflow_summary.csv` — 3,072 rows; **`buffer_days_estimate` is corrupt — never read it**

## 4. The math module — `lib/pace.ts`

Pure functions, no I/O, no React. Every function that needs history takes explicit `asOf: Date`.
Tests assert against `fixtures.json` — **that file is the arbiter. Never edit it to match an
implementation.**

### Shared definitions — implement exactly

- `DATA_START = 2026-04-01`.
- `availableDays(asOf) = daysBetween(DATA_START, asOf) + 1` (inclusive of both ends).
- `windowDays(asOf) = availableDays < 14 ? null : min(56, availableDays)`. Every trailing-window
  function returns `null` when `windowDays` is null.
- **Trailing window** = the dates `[asOf - windowDays + 1, asOf]`, both inclusive.
- **`p20(values)`**: sort ascending. `i = (n - 1) * 0.2`. If `i` is an integer return `s[i]`,
  otherwise linearly interpolate: `s[floor(i)] + (s[ceil(i)] - s[floor(i)]) * (i - floor(i))`.
- **Day-of-week index: Monday = 0**, Sunday = 6.
- **Biweekly obligations**: anchor = the first date on or after `DATA_START` whose day-of-month
  equals `due_day_of_month`. Occurrences are `anchor + 14k` for integer `k >= 0`.
- **`obligationCalendar(from, to)`** covers `(from, to]` — exclusive of `from`, inclusive of `to`.
- **End-of-day**: comparisons against `asOf` include the whole day.
- Round currency to 2dp at the boundary of each function.

### Functions

See the agent prompt / full SPEC body for signatures: `committedMonthly`, `expectedWorkDaysPerMonth`,
`dayRate`, `floorDayNet`, `medianHoursPerShift`, `dowWorkProbability`, `latestBalance`,
`discretionaryDailyRate`, `obligationCalendar`, `committedInHorizon`, `freeBalance`, `nextCliff`,
`cliffReadiness`, `todaySplit`, `advanceCost`, `solve`.

## 5. `/proof` — the negative result

There is no backtest to run. Render `fixtures.json` → `negativeResult` and `population` as the
design rationale. Do not rebuild a detector.

## 6–7. Screens and demo

Four routes (`/`, `/pace`, `/solve`, `/proof`). Demo: W-0001 as of 2026-04-16 — values in
`fixtures.json` → `cases[0]`. Never show raw `latestBalance`; `freeBalance` is the number.

## 8. Stack

Next.js 15 App Router, TypeScript strict, better-sqlite3, Tailwind, vitest. Hand-rolled SVG charts.

## 9. Build order

1. Seed (done) → 2. Math + tests against all 8 fixtures cases → 3. Today → 4. Pace → 5. Solve →
6. Proof → 7. Worker/date pickers.

## 10. Rules for the agent

- Never generate/synthesize/mock `/data`. Hash mismatch → stop.
- Never build a predictive model. See §1.
- Never read `buffer_days_estimate`. Never use a mean for income.
- Never display `latestBalance` in UI. Never express APR. Never use advances as UI inputs.
- Never edit `fixtures.json` or `data_manifest.json` to make a test pass.
- Phrase `dowWorkProbability` in the past tense.

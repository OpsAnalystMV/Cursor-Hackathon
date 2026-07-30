# Pace — build spec

A cashflow tool for people who earn daily and get billed monthly.

## 1. The problem, stated precisely

A daily earner is paid in ~$160 increments and billed in ~$2,122 cliffs. Every budgeting product
solves the reporting half of that ("where did it go") when the real question is forward-looking and
per-shift: **is today's shift on pace for the 1st?**

Three findings from the source dataset (220 Alberta workers, Apr–Jun 2026) define the product:

1. **The cliff is deterministic.** Bills cluster on a median of 3 due-days per worker, and 197 of
   ~600 monthly obligations land on the 1st. Date and amount are knowable 30 days out. Yet 41% of
   real advances were taken within 3 days of a bill.
2. **Balance does not predict borrowing.** Median prior-week balance in advance weeks was $3,749 vs
   $3,541 in non-advance weeks, and the advance rate is flat across all five balance quintiles
   (22–30%, no gradient). Workers borrowed while holding cash, because they could not tell which
   dollars were already committed. Median committed share of income is 53%; p90 is 87%.
3. **The gaps are tiny.** Median advance = 3.3 hours of work, 93% under 6 hours. Median fee = 7
   minutes of work. Small enough that most shortfalls have more than one available fix.

**Therefore:** never show a raw balance. Show what is committed, what is free, and whether today
cleared its share. Then solve the gap rather than reporting it.

## 2. Non-goals

Do not build any of these, even if they seem easy:

- Spending-by-category pie charts or donut charts
- Monthly budget envelopes or category limits
- Net worth, credit score, or savings goals
- Streaks, badges, confetti, or any gamification
- Bank linking, auth, onboarding, or multi-user accounts
- "You spent 12% more on coffee than last month" style retrospectives

Every one of these assumes a salaried user with a fixed pay date.

## 3. Data contract

Six CSVs live in `/data`. Column names are exact — do not rename, infer, or guess. Load them
verbatim into SQLite at seed time.

### `workers.csv` — 220 rows, one per worker
```
worker_id, city, province, occupation, pay_type, typical_daily_net_cad, income_volatility,
tip_share, household_size, dependents, has_bank_account, uses_prepaid_card,
primary_employer_id, tenure_months, has_side_gig, commute_mode, rent_burden_band
```
- `pay_type` ∈ `hourly | daily | gig`
- `rent_burden_band` ∈ `low | moderate | high | severe`
- `income_volatility` is a float, roughly 0.1–0.6

### `daily_earnings.csv` — 12,204 rows, one per shift
```
earnings_id, worker_id, work_date, employer_id, shift_type, hours_worked, gross_pay_cad,
tips_cad, deductions_cad, net_pay_cad, paid_same_day, pay_method
```
- `work_date` is a date, `2026-04-01` → `2026-06-30`
- `shift_type` ∈ `day | evening | night | split`
- `paid_same_day` is 0/1 and is **40% ones** — the 0 rows are earned-but-not-yet-received
- `hours_worked` mean 7.6, p20 5.6

### `recurring_obligations.csv` — 849 rows, ~4 per worker
```
obligation_id, worker_id, name, category, amount_cad, frequency, due_day_of_month,
autopay, essential
```
- `frequency` ∈ `monthly` (811 rows) | `biweekly` (38 rows) — **handle both**
- `due_day_of_month` is an integer 1–28, never null
- `category` ∈ `housing | utilities | phone | childcare | debt_payment | entertainment`
- `autopay` and `essential` are 0/1. 44% autopay, 90% essential.

### `transactions.csv` — 31,726 rows
```
txn_id, worker_id, txn_ts, direction, amount_cad, category, merchant_type, channel,
is_essential, running_balance_cad, notes
```
- `direction` ∈ `debit | credit`
- `notes` contains `obligation_id=O-xxxxx` on ~47% of rows, null otherwise
- `running_balance_cad` is the balance after the transaction — use the latest row per worker as
  the current balance
- Runs `2026-04-01` → `2026-07-05`

### `earned_wage_advances.csv` — 535 rows
```
advance_id, worker_id, requested_at, amount_cad, fee_cad, status, repaid_at,
repayment_source, reason_code
```
- `status` ∈ `repaid | outstanding | cancelled` — **exclude `cancelled` (15 rows) everywhere**
- `repaid_at` is null for outstanding rows
- Used only as the backtest target and demo history. Never as a model input.

### `weekly_cashflow_summary.csv` — 3,072 worker-weeks
```
worker_id, week_start, income_cad, expense_cad, essential_expense_cad, net_cashflow_cad,
advances_count, advances_amount_cad, advance_fees_cad, ending_balance_cad,
buffer_days_estimate, negative_balance_flag
```
- **`buffer_days_estimate` is corrupt.** 330 nulls, range −1,414 to 17,569, mean 391 vs median 48.
  Do not read this column. Do not display it. Recompute buffer independently if needed.
- This table is a convenience rollup. Prefer computing from the source tables.

## 4. The math module — `lib/pace.ts`

Build this first, as pure functions with no I/O and no React. Every function takes an explicit
`asOf: Date` so the backtest can replay history honestly. Unit tests before UI.

All windows are **trailing and expanding**: the dataset starts 2026-04-01, so a 56-day trailing
window does not exist in April. Use `min(56, daysAvailable)` with a hard minimum of 14 days of
history; return `null` rather than a guess when there is less.

```ts
committedMonthly(workerId, asOf): number
```
Sum of `amount_cad` for `frequency='monthly'`, plus `amount_cad * 26/12` for each `biweekly` row.
Return the total and the essential-only subtotal separately.

```ts
expectedWorkDaysPerMonth(workerId, asOf): number
```
Distinct `work_date` count in the trailing window ÷ window length × 30.44.

```ts
dayRate(workerId, asOf): number
```
`committedMonthly / expectedWorkDaysPerMonth`. This is **the number** — the amount one worked day
must clear to cover the month's obligations. Median across the dataset is ~$85 of a $160 day.
W-0001's is ~$143 of a $185 average day.

```ts
floorDayNet(workerId, asOf): number
```
20th percentile of `net_pay_cad` across shifts in the trailing window. Requires ≥5 shifts, else
fall back to `typical_daily_net_cad * 0.75`. Dataset-wide: mean day $160 vs p20 day $115, so
planning on the mean overstates a bad day by 26%. **Never forecast with a mean.**

```ts
dowWorkProbability(workerId, asOf): number[]  // length 7, Mon=0
```
For each day of week: shifts worked on that weekday ÷ occurrences of that weekday in the window.
This is what preserves the multi-day earnings gaps that cause shortfalls — smoothing income to a
daily average erases the exact thing being predicted.

```ts
discretionaryDailyRate(workerId, asOf): number
```
Sum of `amount_cad` where `direction='debit'` and `is_essential=0` over the trailing 28 days, ÷ 28.
Dataset median is $92/wk, which is 1.4× the typical advance.

```ts
projectForward(workerId, asOf, horizonDays = 35): ProjectionDay[]
```
Start from the latest `running_balance_cad` at or before `asOf`. For each day forward:
- add `floorDayNet * dowWorkProbability[dow]`
- subtract `discretionaryDailyRate`
- subtract every obligation due that day (monthly: `due_day_of_month === day`; biweekly: every 14
  days anchored on the first occurrence of `due_day_of_month` within the window)

Return `{ date, openingBalance, expectedIncome, obligations[], closingBalance }[]`.

```ts
shortfall(workerId, asOf): Shortfall | null
```
First day in the projection where `closingBalance < 0`. Return
`{ date, amount, daysOfWarning, drivingObligations[] }` where `amount` is the largest deficit
through that date and `daysOfWarning = date - asOf`.

```ts
solve(workerId, asOf, shortfall): Option[]
```
Return every **feasible** option, ranked by effort ascending. Effort order is fixed:
`move (1) < trim (2) < earn (3) < advance (4)`. An advance is always ranked last and always shown
with its cost in work-minutes.

- **move** — obligations due on or before the shortfall date, sorted by `essential ASC, autopay
  DESC, amount ASC`. Emit one option per obligation whose deferral to `shortfallDate + 7` clears
  the deficit. 44% of obligations are autopay and therefore reschedulable.
- **trim** — `shortfall.amount / discretionaryDailyRate` = days of discretionary spend to forgo.
- **earn** — `shiftsNeeded = ceil(amount / floorDayNet)`,
  `hoursNeeded = amount / (floorDayNet / medianHoursPerShift)`. Feasible only if
  `shiftsNeeded <= historicalMaxShiftsPerWeek - shiftsAlreadyThisWeek`.
- **advance** — `amount = ceil(shortfall.amount)`, `fee = max(1.99, 0.0425 * amount)`,
  `costInWorkMinutes = fee / (floorDayNet / medianHoursPerShift / 60)`. Observed median fee is
  4.76% of amount with a $1.99 floor; ~17% of real advances carried no fee.

```ts
todaySplit(workerId, date): { netEarned, committed, buffer, yours, earnedNotYetPaid }
```
The hero calculation.
- `netEarned` = sum of `net_pay_cad` for shifts on `date`
- `committed` = `min(netEarned, dayRate)`
- `buffer` = `max(0, netEarned - floorDayNet)` — the above-a-bad-day surplus
- `yours` = `netEarned - committed - buffer`
- `earnedNotYetPaid` = sum of `net_pay_cad` where `paid_same_day = 0` and not yet settled.
  60% of shifts are not same-day paid, so this is usually non-zero and is the honest version of
  "your money exists but you can't reach it."

## 5. The backtest — `lib/backtest.ts`

This produces the headline number for the demo. Run it as a CLI script, output a JSON summary.

For every advance where `status != 'cancelled'` and `requested_at >= 2026-04-22` (so that 14 days
of history plus 7 days of lead time exist):

1. `asOf = requested_at - 7 days`
2. `proj = projectForward(worker, asOf, 14)`
3. Flagged if the projection shows any negative closing balance, **or** if cumulative expected
   income over the window falls short of cumulative `dayRate` for the expected work days in it.

Report: share of real advances flagged ≥7 days early, median days of warning, and the same broken
out by `pay_type` and `rent_burden_band`. Expect roughly 55–70% given that 41% sit within 3 days of
a deterministic bill.

**This metric is also the product's success metric.** The app wins by reducing advance volume, so
say so in the pitch.

## 6. Screens

Four routes. Mobile-width layout — this user is on a phone after a shift, at 18:00–23:00.

### `/` — Today
The hero. One card, in this order:
- `You cleared $171 today.`
- `$143 was already spoken for.` / `$28 is yours.`
- A single horizontal bar segmented committed / buffer / yours. No pie chart.
- If `earnedNotYetPaid > 0`: `$162 earned Thursday, lands Monday.`
- If a shortfall exists: one line, `You're $84 short on May 1 — half a shift`, linking to Pace.

Never render a raw account balance anywhere on this screen.

### `/pace` — The month ahead
- The forward projection as a bar series: small daily income bars against obligation cliffs, with
  the shortfall date marked. The visual point is the disproportion — a $2,122 cliff next to $160
  bars — so do not normalise it away or use a log scale.
- `Your number: $143/day` as a reference line.
- Days-of-warning counter: `11 days of notice`.

### `/solve` — Close the gap
- The ranked options from `solve()`, each expressed in the user's native units: shifts, hours,
  days of spending, work-minutes. Never lead with a percentage or an APR.
- Each option shows what it costs and what it does not solve.
- The advance option sits last and displays `$3.45 — about 7 minutes of your Thursday`.

### `/proof` — Backtest (demo route, judges only)
The backtest output: N real advances, share flagged early, median days of warning, and the W-0001
walkthrough as a worked example.

## 7. Demo script — W-0001, all real data

Do not invent a persona. Use this worker; every figure below is in the dataset.

- Moving helper, Calgary, `pay_type=daily`, `rent_burden_band=severe`, `income_volatility=0.48`
- Obligations: Rent $2,056 (due 1st), Mobile phone $66 (1st), Utilities $154 (5th),
  Streaming $9.99 (22nd) — $2,286/mo against ~$2,953/mo earned, so **77% committed**
- 48 shifts in 91 days. April: worked the 1st–3rd, 5th–7th, 9th–11th, 13th–15th, then **nothing
  from the 16th to the 20th**, then the 21st, 23rd, 24th, 26th, 27th, 30th
- Best day all month: $236. Bills due on May 1: $2,122 — nine days of work, due at once.
- Real advances taken: Apr 13 ($34.59), Apr 27 ($71.34, `reason_code=bill_due`, 20:53),
  Apr 30 ($117.03)

The beat: the five-day gap starting Apr 16 puts them $740 off pace. Our projection surfaces the
May 1 shortfall **on Apr 16, eleven days before they actually borrowed**, with three cheaper
options ranked above the advance.

## 8. Stack and structure

- Next.js 15 App Router, TypeScript strict mode
- SQLite via `better-sqlite3`, seeded from `/data/*.csv` by `scripts/seed.ts`
- Tailwind for layout; hand-rolled inline SVG for all charts. No charting library — the bar-vs-cliff
  proportion is the whole point and chart libraries will fight you on it.
- `vitest` for the math module

```
/data                  the six CSVs, unmodified
/scripts/seed.ts       CSV -> SQLite, with a row-count assertion per table
/lib/db.ts             query helpers, one function per access pattern
/lib/pace.ts           pure math, no I/O
/lib/pace.test.ts      unit tests, written before the UI
/lib/backtest.ts       replay harness
/app/page.tsx          Today
/app/pace/page.tsx     The month ahead
/app/solve/page.tsx    Close the gap
/app/proof/page.tsx    Backtest results
```

## 9. Build order

Do not start a phase before the previous one passes.

1. **Seed.** `scripts/seed.ts` loads all six CSVs into SQLite. Assert exact row counts: workers 220,
   daily_earnings 12204, recurring_obligations 849, transactions 31726, earned_wage_advances 535,
   weekly_cashflow_summary 3072. Print them.
2. **Math + tests.** Every function in §4, with unit tests pinned to W-0001's real values:
   `committedMonthly = 2286`, `dayRate ≈ 143`, `floorDayNet ≈ 147`. Tests must fail if the
   biweekly frequency handling is dropped.
3. **Backtest.** Run it, print the number. If the flagged share comes out under 40%, stop and
   report — the thesis is wrong and the UI should not be built on it.
4. **Today screen.** Static for W-0001 on a fixed date first, then parameterised.
5. **Pace screen.** The projection chart.
6. **Solve screen.** Ranked options.
7. **Proof screen.** Backtest output.
8. **Worker switcher** in the header, so judges can see it hold up across the 220.

## 10. Rules for the agent

- Never read `buffer_days_estimate`. It is corrupt.
- Never forecast from a mean. Use `floorDayNet` (p20).
- Never display a raw account balance in the user-facing UI.
- Never express a cost as an APR in the UI. Work-minutes or dollars only.
- Never use the advances table as a model input — it is the evaluation target.
- Exclude `status='cancelled'` advances everywhere.
- Round every displayed number. Currency to whole dollars above $10, two decimals below.
- If a computation lacks enough history, return `null` and render an explicit empty state. Do not
  substitute a default and carry on silently.

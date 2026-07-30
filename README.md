# Pace

Cashflow tool for people who earn daily and get billed monthly.

**Pace is an accounting reframe, not a forecaster.** It shows what of the balance is already committed, what one worked day must clear, and when the next cliff lands.

## Phase status

1. **Seed** — done (`npm run seed`)
2. **Math + tests** — done (`npm test`, all 8 `fixtures.json` cases)
3. **Screens** — Today, Pace, Solve, Proof + worker/date pickers

## Commands

```bash
npm install
npm run seed
npm test
npm run dev
```

Default demo: **W-0035** as of **2026-04-20** (stressed but closable). Case 1 didn’t-work state: `/?worker=W-0001&date=2026-04-16`.

## Spec

[`SPEC.md`](./SPEC.md) · [`fixtures.json`](./fixtures.json) · [`.cursor/rules/pace.mdc`](./.cursor/rules/pace.mdc)

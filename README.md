# Pace

Cashflow tool for people who earn daily and get billed monthly.

Never show a balance — show whether today's shift cleared its share of what's coming.

## Stack

Next.js 15 (App Router, TypeScript strict) · Tailwind · better-sqlite3 · vitest

## Phase 1 — seed

```bash
npm install
# CSVs live in /data (regenerate with: python3 scripts/generate_data.py)
npm run seed
```

Asserts exact row counts from `SPEC.md` §3. Fails loudly on mismatch.

## Spec

See [`SPEC.md`](./SPEC.md). Hard constraints: [`.cursor/rules/pace.mdc`](./.cursor/rules/pace.mdc).

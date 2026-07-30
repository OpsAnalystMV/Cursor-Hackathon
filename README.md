# Pace

Cashflow tool for people who earn daily and get billed monthly.

Never show a balance — show whether today's shift cleared its share of what's coming.

## Stack

Next.js 15 (App Router, TypeScript strict) · Tailwind · better-sqlite3 · vitest

## Phase 1 — seed

Canonical CSVs live in `/data`. Hashes and content assertions live in `data_manifest.json`.

```bash
npm install
npm run seed   # verifies sha256, loads SQLite, asserts content sums
npm test       # includes scripts/seed.test.ts hash checks (CI)
```

If `/data` is missing or a hash mismatches, seed aborts. Do not generate replacements.

## Spec

See [`SPEC.md`](./SPEC.md). Hard constraints: [`.cursor/rules/pace.mdc`](./.cursor/rules/pace.mdc).

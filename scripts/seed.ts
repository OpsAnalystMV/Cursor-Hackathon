/**
 * Phase 1 seed: load the six CSVs from /data into SQLite verbatim.
 * Asserts exact row counts from SPEC §3 / §9. Fails loudly on mismatch.
 *
 * Never reads buffer_days_estimate for product logic — the column is loaded
 * for fidelity to the CSV contract only.
 */
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { parse } from "csv-parse/sync";

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const DB_PATH = path.join(DATA_DIR, "pace.db");

const EXPECTED: Record<string, number> = {
  workers: 220,
  daily_earnings: 12204,
  recurring_obligations: 849,
  transactions: 31726,
  earned_wage_advances: 535,
  weekly_cashflow_summary: 3072,
};

const TABLES: Record<
  string,
  { file: string; columns: string[]; types: Record<string, string> }
> = {
  workers: {
    file: "workers.csv",
    columns: [
      "worker_id",
      "city",
      "province",
      "occupation",
      "pay_type",
      "typical_daily_net_cad",
      "income_volatility",
      "tip_share",
      "household_size",
      "dependents",
      "has_bank_account",
      "uses_prepaid_card",
      "primary_employer_id",
      "tenure_months",
      "has_side_gig",
      "commute_mode",
      "rent_burden_band",
    ],
    types: {
      worker_id: "TEXT PRIMARY KEY",
      city: "TEXT",
      province: "TEXT",
      occupation: "TEXT",
      pay_type: "TEXT",
      typical_daily_net_cad: "REAL",
      income_volatility: "REAL",
      tip_share: "REAL",
      household_size: "INTEGER",
      dependents: "INTEGER",
      has_bank_account: "INTEGER",
      uses_prepaid_card: "INTEGER",
      primary_employer_id: "TEXT",
      tenure_months: "INTEGER",
      has_side_gig: "INTEGER",
      commute_mode: "TEXT",
      rent_burden_band: "TEXT",
    },
  },
  daily_earnings: {
    file: "daily_earnings.csv",
    columns: [
      "earnings_id",
      "worker_id",
      "work_date",
      "employer_id",
      "shift_type",
      "hours_worked",
      "gross_pay_cad",
      "tips_cad",
      "deductions_cad",
      "net_pay_cad",
      "paid_same_day",
      "pay_method",
    ],
    types: {
      earnings_id: "TEXT PRIMARY KEY",
      worker_id: "TEXT",
      work_date: "TEXT",
      employer_id: "TEXT",
      shift_type: "TEXT",
      hours_worked: "REAL",
      gross_pay_cad: "REAL",
      tips_cad: "REAL",
      deductions_cad: "REAL",
      net_pay_cad: "REAL",
      paid_same_day: "INTEGER",
      pay_method: "TEXT",
    },
  },
  recurring_obligations: {
    file: "recurring_obligations.csv",
    columns: [
      "obligation_id",
      "worker_id",
      "name",
      "category",
      "amount_cad",
      "frequency",
      "due_day_of_month",
      "autopay",
      "essential",
    ],
    types: {
      obligation_id: "TEXT PRIMARY KEY",
      worker_id: "TEXT",
      name: "TEXT",
      category: "TEXT",
      amount_cad: "REAL",
      frequency: "TEXT",
      due_day_of_month: "INTEGER",
      autopay: "INTEGER",
      essential: "INTEGER",
    },
  },
  transactions: {
    file: "transactions.csv",
    columns: [
      "txn_id",
      "worker_id",
      "txn_ts",
      "direction",
      "amount_cad",
      "category",
      "merchant_type",
      "channel",
      "is_essential",
      "running_balance_cad",
      "notes",
    ],
    types: {
      txn_id: "TEXT PRIMARY KEY",
      worker_id: "TEXT",
      txn_ts: "TEXT",
      direction: "TEXT",
      amount_cad: "REAL",
      category: "TEXT",
      merchant_type: "TEXT",
      channel: "TEXT",
      is_essential: "INTEGER",
      running_balance_cad: "REAL",
      notes: "TEXT",
    },
  },
  earned_wage_advances: {
    file: "earned_wage_advances.csv",
    columns: [
      "advance_id",
      "worker_id",
      "requested_at",
      "amount_cad",
      "fee_cad",
      "status",
      "repaid_at",
      "repayment_source",
      "reason_code",
    ],
    types: {
      advance_id: "TEXT PRIMARY KEY",
      worker_id: "TEXT",
      requested_at: "TEXT",
      amount_cad: "REAL",
      fee_cad: "REAL",
      status: "TEXT",
      repaid_at: "TEXT",
      repayment_source: "TEXT",
      reason_code: "TEXT",
    },
  },
  weekly_cashflow_summary: {
    file: "weekly_cashflow_summary.csv",
    columns: [
      "worker_id",
      "week_start",
      "income_cad",
      "expense_cad",
      "essential_expense_cad",
      "net_cashflow_cad",
      "advances_count",
      "advances_amount_cad",
      "advance_fees_cad",
      "ending_balance_cad",
      "buffer_days_estimate",
      "negative_balance_flag",
    ],
    types: {
      worker_id: "TEXT",
      week_start: "TEXT",
      income_cad: "REAL",
      expense_cad: "REAL",
      essential_expense_cad: "REAL",
      net_cashflow_cad: "REAL",
      advances_count: "INTEGER",
      advances_amount_cad: "REAL",
      advance_fees_cad: "REAL",
      ending_balance_cad: "REAL",
      // Corrupt column — stored for CSV fidelity; never query in product code.
      buffer_days_estimate: "REAL",
      negative_balance_flag: "INTEGER",
    },
  },
};

function loadCsv(file: string): Record<string, string>[] {
  const full = path.join(DATA_DIR, file);
  if (!fs.existsSync(full)) {
    throw new Error(`Missing CSV: ${full}`);
  }
  const raw = fs.readFileSync(full, "utf8");
  return parse(raw, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    cast: false,
  }) as Record<string, string>[];
}

function emptyToNull(v: string | undefined): string | null {
  if (v === undefined || v === "") return null;
  return v;
}

function seed(): void {
  if (!fs.existsSync(DATA_DIR)) {
    throw new Error(`Data directory missing: ${DATA_DIR}`);
  }

  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
  }

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  const counts: Record<string, number> = {};

  const insertAll = db.transaction(() => {
    for (const [table, spec] of Object.entries(TABLES)) {
      const colDefs = spec.columns
        .map((c) => `${c} ${spec.types[c] ?? "TEXT"}`)
        .join(", ");
      db.exec(`CREATE TABLE ${table} (${colDefs})`);

      const rows = loadCsv(spec.file);
      const headers = Object.keys(rows[0] ?? {});
      for (const col of spec.columns) {
        if (!headers.includes(col)) {
          throw new Error(
            `${spec.file}: missing required column "${col}". Found: ${headers.join(", ")}`,
          );
        }
      }
      // Refuse renamed/extra surprise columns that aren't in the contract
      const unexpected = headers.filter((h) => !spec.columns.includes(h));
      if (unexpected.length > 0) {
        throw new Error(
          `${spec.file}: unexpected columns (do not rename/infer): ${unexpected.join(", ")}`,
        );
      }

      const placeholders = spec.columns.map(() => "?").join(", ");
      const stmt = db.prepare(
        `INSERT INTO ${table} (${spec.columns.join(", ")}) VALUES (${placeholders})`,
      );

      for (const row of rows) {
        stmt.run(...spec.columns.map((c) => emptyToNull(row[c])));
      }

      const count = (
        db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }
      ).n;
      counts[table] = count;
    }
  });

  insertAll();

  console.log("Pace seed — row counts:");
  let failed = false;
  for (const [table, expected] of Object.entries(EXPECTED)) {
    const actual = counts[table] ?? -1;
    const ok = actual === expected;
    const mark = ok ? "OK" : "FAIL";
    console.log(`  ${table}: ${actual} (expected ${expected}) [${mark}]`);
    if (!ok) failed = true;
  }

  // Guardrail: biweekly rows must be present (naive due_day matching drops these)
  const biweekly = (
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM recurring_obligations WHERE frequency = 'biweekly'`,
      )
      .get() as { n: number }
  ).n;
  const monthly = (
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM recurring_obligations WHERE frequency = 'monthly'`,
      )
      .get() as { n: number }
  ).n;
  console.log(`  recurring_obligations breakdown: monthly=${monthly}, biweekly=${biweekly}`);
  if (monthly !== 811 || biweekly !== 38) {
    console.error(
      `FAIL: expected monthly=811 biweekly=38, got monthly=${monthly} biweekly=${biweekly}`,
    );
    failed = true;
  }

  db.close();

  if (failed) {
    console.error("\nSeed FAILED — row counts do not match SPEC. Refusing to continue.");
    process.exit(1);
  }

  console.log(`\nSeed OK → ${DB_PATH}`);
}

seed();

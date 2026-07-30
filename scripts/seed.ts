/**
 * Phase 1 seed: verify canonical hashes, load /data CSVs into SQLite, assert
 * row counts and content_assertions from data_manifest.json.
 *
 * Never reads buffer_days_estimate for product logic — the column is loaded
 * for fidelity to the CSV contract only.
 *
 * Never generate / synthesize /data. Missing or mismatched files abort the seed.
 */
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { parse } from "csv-parse/sync";
import {
  DATA_DIR,
  assertCanonicalHashes,
  loadManifest,
  round2,
  type DataManifest,
} from "./data-integrity";

const DB_PATH = path.join(DATA_DIR, "pace.db");

const FILE_TO_TABLE: Record<string, string> = {
  "workers.csv": "workers",
  "daily_earnings.csv": "daily_earnings",
  "recurring_obligations.csv": "recurring_obligations",
  "transactions.csv": "transactions",
  "earned_wage_advances.csv": "earned_wage_advances",
  "weekly_cashflow_summary.csv": "weekly_cashflow_summary",
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

function scalar(db: Database.Database, sql: string): number {
  const row = db.prepare(sql).get() as Record<string, number | null>;
  const v = Object.values(row)[0];
  return v == null ? 0 : Number(v);
}

function computeContentAssertions(db: Database.Database): Record<string, number> {
  return {
    "daily_earnings.sum_net_pay_cad": round2(
      scalar(db, "SELECT SUM(net_pay_cad) AS v FROM daily_earnings"),
    ),
    "daily_earnings.sum_gross_pay_cad": round2(
      scalar(db, "SELECT SUM(gross_pay_cad) AS v FROM daily_earnings"),
    ),
    "daily_earnings.sum_tips_cad": round2(
      scalar(db, "SELECT SUM(tips_cad) AS v FROM daily_earnings"),
    ),
    "daily_earnings.count_paid_same_day": scalar(
      db,
      "SELECT COUNT(*) AS v FROM daily_earnings WHERE paid_same_day = 1",
    ),
    "daily_earnings.distinct_employer_id": scalar(
      db,
      "SELECT COUNT(DISTINCT employer_id) AS v FROM daily_earnings",
    ),
    "recurring_obligations.sum_amount_cad": round2(
      scalar(db, "SELECT SUM(amount_cad) AS v FROM recurring_obligations"),
    ),
    "recurring_obligations.count_monthly_due_day_1": scalar(
      db,
      `SELECT COUNT(*) AS v FROM recurring_obligations
       WHERE frequency = 'monthly' AND due_day_of_month = 1`,
    ),
    "transactions.sum_amount_cad": round2(
      scalar(db, "SELECT SUM(amount_cad) AS v FROM transactions"),
    ),
    "transactions.count_notes_not_null": scalar(
      db,
      `SELECT COUNT(*) AS v FROM transactions
       WHERE notes IS NOT NULL AND notes != ''`,
    ),
    "advances_excl_cancelled.sum_amount_cad": round2(
      scalar(
        db,
        `SELECT SUM(amount_cad) AS v FROM earned_wage_advances
         WHERE status != 'cancelled'`,
      ),
    ),
    "advances_excl_cancelled.sum_fee_cad": round2(
      scalar(
        db,
        `SELECT SUM(fee_cad) AS v FROM earned_wage_advances
         WHERE status != 'cancelled'`,
      ),
    ),
    "advances_excl_cancelled.max_amount_cad": round2(
      scalar(
        db,
        `SELECT MAX(amount_cad) AS v FROM earned_wage_advances
         WHERE status != 'cancelled'`,
      ),
    ),
    "advances.min_requested_hour": scalar(
      db,
      `SELECT MIN(CAST(strftime('%H', replace(requested_at, 'T', ' ')) AS INTEGER)) AS v
       FROM earned_wage_advances`,
    ),
    "advances.max_requested_hour": scalar(
      db,
      `SELECT MAX(CAST(strftime('%H', replace(requested_at, 'T', ' ')) AS INTEGER)) AS v
       FROM earned_wage_advances`,
    ),
  };
}

function assertContent(
  actual: Record<string, number>,
  expected: DataManifest["content_assertions"],
): boolean {
  console.log("\nContent assertions:");
  let failed = false;
  for (const [key, exp] of Object.entries(expected)) {
    if (!(key in actual)) {
      console.log(`  ${key}: MISSING from computed set [FAIL]`);
      failed = true;
      continue;
    }
    const got = actual[key];
    const expRounded = typeof exp === "number" && !Number.isInteger(exp) ? round2(exp) : exp;
    const gotRounded =
      typeof got === "number" && !Number.isInteger(expRounded) ? round2(got) : got;
    const ok = gotRounded === expRounded;
    console.log(
      `  ${key}: ${gotRounded} (expected ${expRounded}) [${ok ? "OK" : "FAIL"}]`,
    );
    if (!ok) failed = true;
  }
  return !failed;
}

function seed(): void {
  const manifest = loadManifest();

  console.log("Pace seed — canonical hash verification:");
  const hashChecks = assertCanonicalHashes(manifest);
  for (const c of hashChecks) {
    console.log(`  ${c.file}: sha256=${c.actual} [OK]`);
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

  console.log("\nRow counts:");
  let failed = false;
  for (const [file, meta] of Object.entries(manifest.files)) {
    const table = FILE_TO_TABLE[file];
    if (!table) {
      console.log(`  ${file}: no table mapping [FAIL]`);
      failed = true;
      continue;
    }
    const actual = counts[table] ?? -1;
    const ok = actual === meta.rows;
    console.log(
      `  ${table}: ${actual} (expected ${meta.rows}) [${ok ? "OK" : "FAIL"}]`,
    );
    if (!ok) failed = true;
  }

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
  console.log(
    `  recurring_obligations breakdown: monthly=${monthly}, biweekly=${biweekly}`,
  );
  if (monthly !== 811 || biweekly !== 38) {
    console.error(
      `FAIL: expected monthly=811 biweekly=38, got monthly=${monthly} biweekly=${biweekly}`,
    );
    failed = true;
  }

  const contentOk = assertContent(
    computeContentAssertions(db),
    manifest.content_assertions,
  );
  if (!contentOk) failed = true;

  db.close();

  if (failed) {
    console.error(
      "\nSeed FAILED — assertions do not match data_manifest.json. Refusing to continue.",
    );
    process.exit(1);
  }

  console.log(`\nSeed OK → ${DB_PATH}`);
}

try {
  seed();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

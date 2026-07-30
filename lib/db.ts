/**
 * SQLite access helpers — one function per access pattern.
 * Never reads buffer_days_estimate.
 */
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const ROOT = path.resolve(__dirname, "..");
const DB_PATH = path.join(ROOT, "data", "pace.db");

export type WorkerRow = {
  worker_id: string;
  city: string;
  province: string;
  occupation: string;
  pay_type: string;
  typical_daily_net_cad: number;
  income_volatility: number;
  tip_share: number;
  household_size: number;
  dependents: number;
  has_bank_account: number;
  uses_prepaid_card: number;
  primary_employer_id: string;
  tenure_months: number;
  has_side_gig: number;
  commute_mode: string;
  rent_burden_band: string;
};

export type ObligationRow = {
  obligation_id: string;
  worker_id: string;
  name: string;
  category: string;
  amount_cad: number;
  frequency: "monthly" | "biweekly";
  due_day_of_month: number;
  autopay: number;
  essential: number;
};

export type EarningRow = {
  earnings_id: string;
  worker_id: string;
  work_date: string;
  employer_id: string;
  shift_type: string;
  hours_worked: number;
  gross_pay_cad: number;
  tips_cad: number;
  deductions_cad: number;
  net_pay_cad: number;
  paid_same_day: number;
  pay_method: string;
};

export type TransactionRow = {
  txn_id: string;
  worker_id: string;
  txn_ts: string;
  direction: "debit" | "credit";
  amount_cad: number;
  category: string;
  merchant_type: string;
  channel: string;
  is_essential: number;
  running_balance_cad: number;
  notes: string | null;
};

let _db: Database.Database | null = null;

export function openDb(dbPath: string = DB_PATH): Database.Database {
  if (!fs.existsSync(dbPath)) {
    throw new Error(
      `SQLite missing at ${dbPath}. Run \`npm run seed\` with canonical /data CSVs.`,
    );
  }
  if (_db) {
    try {
      _db.close();
    } catch {
      /* ignore */
    }
  }
  _db = new Database(dbPath, { readonly: true });
  _db.pragma("foreign_keys = ON");
  return _db;
}

export function getDb(): Database.Database {
  if (!_db) return openDb();
  return _db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

export function listWorkerIds(db: Database.Database = getDb()): string[] {
  return db
    .prepare(`SELECT worker_id FROM workers ORDER BY worker_id`)
    .all()
    .map((r) => (r as { worker_id: string }).worker_id);
}

export function getWorker(
  workerId: string,
  db: Database.Database = getDb(),
): WorkerRow | null {
  return (
    (db
      .prepare(`SELECT * FROM workers WHERE worker_id = ?`)
      .get(workerId) as WorkerRow | undefined) ?? null
  );
}

export function getObligations(
  workerId: string,
  db: Database.Database = getDb(),
): ObligationRow[] {
  return db
    .prepare(
      `SELECT * FROM recurring_obligations WHERE worker_id = ? ORDER BY obligation_id`,
    )
    .all(workerId) as ObligationRow[];
}

export function getEarningsInRange(
  workerId: string,
  fromDate: string,
  toDate: string,
  db: Database.Database = getDb(),
): EarningRow[] {
  return db
    .prepare(
      `SELECT * FROM daily_earnings
       WHERE worker_id = ? AND work_date >= ? AND work_date <= ?
       ORDER BY work_date, earnings_id`,
    )
    .all(workerId, fromDate, toDate) as EarningRow[];
}

/** Latest transaction at or before end of asOf day, ordered by (txn_ts, txn_id). */
export function getLatestTransaction(
  workerId: string,
  asOfDate: string,
  db: Database.Database = getDb(),
): TransactionRow | null {
  const endTs = `${asOfDate}T23:59:59.999`;
  return (
    (db
      .prepare(
        `SELECT * FROM transactions
         WHERE worker_id = ? AND txn_ts <= ?
         ORDER BY txn_ts DESC, txn_id DESC
         LIMIT 1`,
      )
      .get(workerId, endTs) as TransactionRow | undefined) ?? null
  );
}

/** Discretionary debit total over [fromDate 00:00, asOfDate 23:59:59]. */
export function sumDiscretionaryDebits(
  workerId: string,
  fromDate: string,
  asOfDate: string,
  db: Database.Database = getDb(),
): number {
  const fromTs = `${fromDate}T00:00:00`;
  const endTs = `${asOfDate}T23:59:59.999`;
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(amount_cad), 0) AS v FROM transactions
       WHERE worker_id = ?
         AND direction = 'debit'
         AND is_essential = 0
         AND txn_ts >= ? AND txn_ts <= ?`,
    )
    .get(workerId, fromTs, endTs) as { v: number };
  return Number(row.v);
}

export function getAllWorkDates(
  db: Database.Database = getDb(),
): { worker_id: string; work_date: string }[] {
  return db
    .prepare(
      `SELECT worker_id, work_date FROM daily_earnings ORDER BY worker_id, work_date`,
    )
    .all() as { worker_id: string; work_date: string }[];
}

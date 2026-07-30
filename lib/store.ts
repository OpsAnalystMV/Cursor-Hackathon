/**
 * In-memory PaceStore loaded once from SQLite — keeps math pure and tests fast.
 */
import type {
  EarningRow,
  ObligationRow,
  TransactionRow,
  WorkerRow,
} from "./db";
import {
  getDb,
  getEarningsInRange as dbEarnings,
  getLatestTransaction as dbLatestTxn,
  getObligations as dbObligations,
  getWorker as dbWorker,
  listWorkerIds,
  sumDiscretionaryDebits as dbDisc,
} from "./db";
import type { PaceStore } from "./pace";

export function createMemoryStore(): PaceStore & {
  workerIds: string[];
  allEarnings: EarningRow[];
} {
  const db = getDb();
  const workerIds = listWorkerIds(db);
  const workers = new Map<string, WorkerRow>();
  const obligations = new Map<string, ObligationRow[]>();
  const earningsByWorker = new Map<string, EarningRow[]>();
  const txnsByWorker = new Map<string, TransactionRow[]>();

  for (const id of workerIds) {
    const w = dbWorker(id, db);
    if (w) workers.set(id, w);
    obligations.set(id, dbObligations(id, db));
    earningsByWorker.set(
      id,
      db
        .prepare(
          `SELECT * FROM daily_earnings WHERE worker_id = ? ORDER BY work_date, earnings_id`,
        )
        .all(id) as EarningRow[],
    );
    txnsByWorker.set(
      id,
      db
        .prepare(
          `SELECT * FROM transactions WHERE worker_id = ? ORDER BY txn_ts, txn_id`,
        )
        .all(id) as TransactionRow[],
    );
  }

  const allEarnings = workerIds.flatMap((id) => earningsByWorker.get(id) ?? []);

  return {
    workerIds,
    allEarnings,
    getWorker(workerId) {
      return workers.get(workerId) ?? null;
    },
    getObligations(workerId) {
      return obligations.get(workerId) ?? [];
    },
    getEarningsInRange(workerId, fromDate, toDate) {
      return (earningsByWorker.get(workerId) ?? []).filter(
        (e) => e.work_date >= fromDate && e.work_date <= toDate,
      );
    },
    getLatestTransaction(workerId, asOfDate) {
      const endTs = `${asOfDate}T23:59:59.999`;
      const txns = txnsByWorker.get(workerId) ?? [];
      let best: TransactionRow | null = null;
      for (const t of txns) {
        if (t.txn_ts <= endTs) best = t;
        else break;
      }
      return best;
    },
    sumDiscretionaryDebits(workerId, fromDate, asOfDate) {
      const fromTs = `${fromDate}T00:00:00`;
      const endTs = `${asOfDate}T23:59:59.999`;
      let sum = 0;
      for (const t of txnsByWorker.get(workerId) ?? []) {
        if (t.txn_ts < fromTs) continue;
        if (t.txn_ts > endTs) break;
        if (t.direction === "debit" && t.is_essential === 0) {
          sum += t.amount_cad;
        }
      }
      return sum;
    },
  };
}

/** Fallback store that hits SQLite directly (for app routes). */
export function createDbStore(): PaceStore {
  return {
    getWorker: dbWorker,
    getObligations: dbObligations,
    getEarningsInRange: dbEarnings,
    getLatestTransaction: dbLatestTxn,
    sumDiscretionaryDebits: dbDisc,
  };
}

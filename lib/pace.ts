/**
 * Pace math — accounting reframe over obligations and earnings.
 * Pure arithmetic. No prediction. No I/O (callers pass a PaceStore).
 *
 * fixtures.json is the arbiter. Never edit fixtures to match this file.
 */
import type {
  EarningRow,
  ObligationRow,
  TransactionRow,
  WorkerRow,
} from "./db";

export const DATA_START = "2026-04-01";

export type CalendarEntry = {
  date: string;
  obligationId: string;
  amount: number;
  essential: number;
  autopay: number;
};

export type Cliff = { date: string; amount: number; daysAway: number };

export type CliffReadiness = {
  cliffDate: string;
  cliffAmount: number;
  daysAway: number;
  obligationsBefore: number;
  availableAtCliff: number;
  gap: number;
  shiftsNeeded: number;
  shiftsExpected: number;
};

export type TodaySplit = {
  netEarned: number;
  committed: number;
  buffer: number;
  yours: number;
  earnedNotYetPaid: number;
};

export type AdvanceCost = {
  amount: number;
  fee: number;
  feePct: number;
  workMinutes: number;
};

export type SolveOption =
  | {
      kind: "move";
      effort: 1;
      obligationId: string;
      amount: number;
      closesGap: boolean;
    }
  | {
      kind: "trim";
      effort: 2;
      days: number;
      dailyRate: number;
    }
  | {
      kind: "earn";
      effort: 3;
      shiftsNeeded: number;
      hoursNeeded: number;
    }
  | {
      kind: "advance";
      effort: 4;
      cost: AdvanceCost;
    };

export type PaceStore = {
  getWorker(workerId: string): WorkerRow | null;
  getObligations(workerId: string): ObligationRow[];
  getEarningsInRange(
    workerId: string,
    fromDate: string,
    toDate: string,
  ): EarningRow[];
  getLatestTransaction(
    workerId: string,
    asOfDate: string,
  ): TransactionRow | null;
  sumDiscretionaryDebits(
    workerId: string,
    fromDate: string,
    asOfDate: string,
  ): number;
};

export function round2(n: number): number {
  return Number(n.toFixed(2));
}

export function round1(n: number): number {
  return Number(n.toFixed(1));
}

export function round4(n: number): number {
  return Number(n.toFixed(4));
}

/** Parse YYYY-MM-DD as UTC noon to avoid DST issues. */
export function parseDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

export function formatDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(iso: string, n: number): string {
  const d = parseDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return formatDate(d);
}

/** Inclusive calendar-day distance from a → b. */
export function daysBetween(aIso: string, bIso: string): number {
  const a = parseDate(aIso);
  const b = parseDate(bIso);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** Monday = 0 … Sunday = 6. */
export function dowMonday0(iso: string): number {
  return (parseDate(iso).getUTCDay() + 6) % 7;
}

export function availableDays(asOf: string): number {
  return daysBetween(DATA_START, asOf) + 1;
}

export function windowDays(asOf: string): number | null {
  const avail = availableDays(asOf);
  if (avail < 14) return null;
  return Math.min(56, avail);
}

export function trailingWindow(
  asOf: string,
): { from: string; to: string; days: number } | null {
  const days = windowDays(asOf);
  if (days == null) return null;
  return { from: addDays(asOf, -(days - 1)), to: asOf, days };
}

/**
 * p20: sort ascending. i = (n-1)*0.2.
 * Integer i → s[i]; else linear interpolate.
 */
export function p20(values: number[]): number {
  if (values.length === 0) throw new Error("p20 of empty");
  const s = [...values].sort((a, b) => a - b);
  const i = (s.length - 1) * 0.2;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  if (lo === hi) return s[lo];
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
}

export function median(values: number[]): number {
  if (values.length === 0) throw new Error("median of empty");
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  if (s.length % 2 === 1) return s[mid];
  return (s[mid - 1] + s[mid]) / 2;
}

function monthlyOccurrences(
  dueDay: number,
  fromExclusive: string,
  toInclusive: string,
): string[] {
  const out: string[] = [];
  const start = parseDate(fromExclusive);
  const end = parseDate(toInclusive);
  // Walk months covering the range
  let y = start.getUTCFullYear();
  let m = start.getUTCMonth(); // 0-based
  // Start from month of fromExclusive (may need prior if due day after from in same month is still after from)
  for (let guard = 0; guard < 48; guard++) {
    const lastDay = new Date(Date.UTC(y, m + 1, 0, 12)).getUTCDate();
    if (dueDay <= lastDay) {
      const cand = formatDate(new Date(Date.UTC(y, m, dueDay, 12)));
      if (cand > fromExclusive && cand <= toInclusive) out.push(cand);
      if (parseDate(cand) > end && cand > toInclusive) break;
    }
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
    // stop once month starts after toInclusive
    const monthStart = formatDate(new Date(Date.UTC(y, m, 1, 12)));
    if (monthStart > toInclusive) break;
  }
  return out;
}

function biweeklyAnchor(dueDay: number): string {
  // First date on or after DATA_START whose day-of-month equals dueDay
  let d = DATA_START;
  for (let i = 0; i < 32; i++) {
    if (parseDate(d).getUTCDate() === dueDay) return d;
    d = addDays(d, 1);
  }
  throw new Error(`No biweekly anchor for due_day_of_month=${dueDay}`);
}

function biweeklyOccurrences(
  dueDay: number,
  fromExclusive: string,
  toInclusive: string,
): string[] {
  const out: string[] = [];
  let d = biweeklyAnchor(dueDay);
  while (d <= toInclusive) {
    if (d > fromExclusive) out.push(d);
    d = addDays(d, 14);
  }
  return out;
}

export function createPace(store: PaceStore) {
  function committedMonthly(workerId: string): { total: number; essential: number } {
    const obs = store.getObligations(workerId);
    let total = 0;
    let essential = 0;
    for (const o of obs) {
      const amt =
        o.frequency === "biweekly" ? o.amount_cad * (26 / 12) : o.amount_cad;
      total += amt;
      if (o.essential === 1) essential += amt;
    }
    return { total: round2(total), essential: round2(essential) };
  }

  function expectedWorkDaysPerMonth(
    workerId: string,
    asOf: string,
  ): number | null {
    const win = trailingWindow(asOf);
    if (!win) return null;
    const earnings = store.getEarningsInRange(workerId, win.from, win.to);
    const distinct = new Set(earnings.map((e) => e.work_date)).size;
    return distinct / win.days * 30.44;
  }

  function dayRate(workerId: string, asOf: string): number | null {
    const ewd = expectedWorkDaysPerMonth(workerId, asOf);
    if (ewd == null || ewd === 0) return null;
    return round2(committedMonthly(workerId).total / ewd);
  }

  function floorDayNet(workerId: string, asOf: string): number | null {
    const win = trailingWindow(asOf);
    if (!win) return null;
    const earnings = store.getEarningsInRange(workerId, win.from, win.to);
    if (earnings.length < 5) {
      const w = store.getWorker(workerId);
      if (!w) return null;
      return round2(w.typical_daily_net_cad * 0.75);
    }
    return round2(p20(earnings.map((e) => e.net_pay_cad)));
  }

  function medianHoursPerShift(
    workerId: string,
    asOf: string,
  ): number | null {
    const win = trailingWindow(asOf);
    if (!win) return null;
    const earnings = store.getEarningsInRange(workerId, win.from, win.to);
    if (earnings.length === 0) return null;
    return round2(median(earnings.map((e) => e.hours_worked)));
  }

  function dowWorkProbability(
    workerId: string,
    asOf: string,
  ): number[] | null {
    const win = trailingWindow(asOf);
    if (!win) return null;
    const earnings = store.getEarningsInRange(workerId, win.from, win.to);
    const worked = new Set(earnings.map((e) => e.work_date));
    const occ = [0, 0, 0, 0, 0, 0, 0];
    const hit = [0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < win.days; i++) {
      const d = addDays(win.from, i);
      const dow = dowMonday0(d);
      occ[dow] += 1;
      if (worked.has(d)) hit[dow] += 1;
    }
    return occ.map((o, i) => (o === 0 ? 0 : hit[i] / o));
  }

  function latestBalance(workerId: string, asOf: string): number | null {
    const txn = store.getLatestTransaction(workerId, asOf);
    if (!txn) return null;
    return round2(txn.running_balance_cad);
  }

  function discretionaryDailyRate(workerId: string, asOf: string): number {
    const from = addDays(asOf, -27);
    const sum = store.sumDiscretionaryDebits(workerId, from, asOf);
    return round2(sum / 28);
  }

  function obligationCalendar(
    workerId: string,
    from: string,
    to: string,
  ): CalendarEntry[] {
    const obs = store.getObligations(workerId);
    const entries: CalendarEntry[] = [];
    for (const o of obs) {
      const dates =
        o.frequency === "biweekly"
          ? biweeklyOccurrences(o.due_day_of_month, from, to)
          : monthlyOccurrences(o.due_day_of_month, from, to);
      for (const date of dates) {
        entries.push({
          date,
          obligationId: o.obligation_id,
          amount: round2(o.amount_cad),
          essential: o.essential,
          autopay: o.autopay,
        });
      }
    }
    entries.sort((a, b) =>
      a.date === b.date
        ? a.obligationId.localeCompare(b.obligationId)
        : a.date.localeCompare(b.date),
    );
    return entries;
  }

  function committedInHorizon(
    workerId: string,
    asOf: string,
    days: number,
  ): number {
    const cal = obligationCalendar(workerId, asOf, addDays(asOf, days));
    return round2(cal.reduce((s, e) => s + e.amount, 0));
  }

  function freeBalance(
    workerId: string,
    asOf: string,
    horizon = 30,
  ): number | null {
    const bal = latestBalance(workerId, asOf);
    if (bal == null) return null;
    return round2(bal - committedInHorizon(workerId, asOf, horizon));
  }

  function nextCliff(
    workerId: string,
    asOf: string,
    horizon = 35,
  ): Cliff | null {
    const cal = obligationCalendar(workerId, asOf, addDays(asOf, horizon));
    if (cal.length === 0) return null;
    const byDate = new Map<string, number>();
    for (const e of cal) {
      byDate.set(e.date, round2((byDate.get(e.date) ?? 0) + e.amount));
    }
    let bestDate = "";
    let bestAmt = -Infinity;
    for (const [date, amount] of byDate) {
      if (
        amount > bestAmt ||
        (amount === bestAmt && (bestDate === "" || date < bestDate))
      ) {
        bestAmt = amount;
        bestDate = date;
      }
    }
    return {
      date: bestDate,
      amount: round2(bestAmt),
      daysAway: daysBetween(asOf, bestDate),
    };
  }

  function cliffReadiness(
    workerId: string,
    asOf: string,
  ): CliffReadiness | null {
    if (windowDays(asOf) == null) return null;
    const cliff = nextCliff(workerId, asOf, 35);
    if (!cliff) return null;
    const floor = floorDayNet(workerId, asOf);
    const dow = dowWorkProbability(workerId, asOf);
    const bal = latestBalance(workerId, asOf);
    if (floor == null || dow == null || bal == null) return null;

    const dayBeforeCliff = addDays(cliff.date, -1);
    const obligationsBefore = round2(
      obligationCalendar(workerId, asOf, dayBeforeCliff).reduce(
        (s, e) => s + e.amount,
        0,
      ),
    );
    const disc = discretionaryDailyRate(workerId, asOf);
    const availableAtCliff = round2(
      bal - obligationsBefore - disc * cliff.daysAway,
    );
    const gap = round2(cliff.amount - availableAtCliff);
    const shiftsNeeded = gap > 0 ? Math.ceil(gap / floor) : 0;

    let shiftsExpected = 0;
    for (let i = 1; i <= cliff.daysAway; i++) {
      const d = addDays(asOf, i);
      shiftsExpected += dow[dowMonday0(d)];
    }

    return {
      cliffDate: cliff.date,
      cliffAmount: cliff.amount,
      daysAway: cliff.daysAway,
      obligationsBefore,
      availableAtCliff,
      gap,
      shiftsNeeded,
      shiftsExpected: round4(shiftsExpected),
    };
  }

  function todaySplit(workerId: string, date: string): TodaySplit | null {
    const rate = dayRate(workerId, date);
    const floor = floorDayNet(workerId, date);
    if (rate == null || floor == null) return null;

    const dayEarnings = store.getEarningsInRange(workerId, date, date);
    const netEarned = round2(
      dayEarnings.reduce((s, e) => s + e.net_pay_cad, 0),
    );
    const committed = round2(Math.min(netEarned, rate));
    const remainder = round2(netEarned - committed);
    const buffer = round2(
      Math.max(0, Math.min(remainder, round2(netEarned - floor))),
    );
    const yours = round2(remainder - buffer);

    const unpaidFrom = addDays(date, -6);
    const weekEarnings = store.getEarningsInRange(
      workerId,
      unpaidFrom,
      date,
    );
    const earnedNotYetPaid = round2(
      weekEarnings
        .filter((e) => e.paid_same_day === 0)
        .reduce((s, e) => s + e.net_pay_cad, 0),
    );

    return { netEarned, committed, buffer, yours, earnedNotYetPaid };
  }

  function advanceCost(
    amount: number,
    workerId: string,
    asOf: string,
  ): AdvanceCost | null {
    const floor = floorDayNet(workerId, asOf);
    const hours = medianHoursPerShift(workerId, asOf);
    if (floor == null || hours == null || hours === 0) return null;
    const fee = round2(Math.max(1.99, 0.0425 * amount));
    const feePct = round2((fee / amount) * 100);
    const workMinutes = round1(fee / (floor / hours / 60));
    return { amount: round2(amount), fee, feePct, workMinutes };
  }

  function solve(
    workerId: string,
    asOf: string,
    gap: number,
  ): SolveOption[] {
    if (windowDays(asOf) == null) return [];
    const floor = floorDayNet(workerId, asOf);
    const hours = medianHoursPerShift(workerId, asOf);
    const disc = discretionaryDailyRate(workerId, asOf);
    const cliff = nextCliff(workerId, asOf, 35);
    if (floor == null || hours == null || cliff == null) return [];

    const options: SolveOption[] = [];
    const positiveGap = Math.max(0, gap);

    // move
    const due = obligationCalendar(workerId, asOf, cliff.date).slice();
    due.sort((a, b) => {
      if (a.essential !== b.essential) return a.essential - b.essential;
      if (a.autopay !== b.autopay) return b.autopay - a.autopay;
      if (a.amount !== b.amount) return a.amount - b.amount;
      return a.obligationId.localeCompare(b.obligationId);
    });
    for (const o of due) {
      if (o.amount >= positiveGap && positiveGap > 0) {
        options.push({
          kind: "move",
          effort: 1,
          obligationId: o.obligationId,
          amount: o.amount,
          closesGap: true,
        });
      } else if (positiveGap > 0) {
        options.push({
          kind: "move",
          effort: 1,
          obligationId: o.obligationId,
          amount: o.amount,
          closesGap: false,
        });
      }
    }
    // Only keep move options that close the gap per SPEC ("whose deferral … closes the gap")
    const moveClosers = options.filter(
      (o) => o.kind === "move" && o.closesGap,
    );

    const result: SolveOption[] = [...moveClosers];

    if (positiveGap > 0 && disc > 0) {
      result.push({
        kind: "trim",
        effort: 2,
        days: round2(positiveGap / disc),
        dailyRate: disc,
      });
    }

    if (positiveGap > 0 && floor > 0) {
      result.push({
        kind: "earn",
        effort: 3,
        shiftsNeeded: Math.ceil(positiveGap / floor),
        hoursNeeded: round2(positiveGap / (floor / hours)),
      });
    }

    const cost = advanceCost(Math.ceil(positiveGap), workerId, asOf);
    if (cost && positiveGap > 0) {
      result.push({ kind: "advance", effort: 4, cost });
    }

    return result.sort((a, b) => a.effort - b.effort);
  }

  /** Debug/helper: shifts in trailing window. */
  function shiftsInTrailingWindow(workerId: string, asOf: string): number | null {
    const win = trailingWindow(asOf);
    if (!win) return null;
    return store.getEarningsInRange(workerId, win.from, win.to).length;
  }

  return {
    committedMonthly,
    expectedWorkDaysPerMonth,
    dayRate,
    floorDayNet,
    medianHoursPerShift,
    dowWorkProbability,
    latestBalance,
    discretionaryDailyRate,
    obligationCalendar,
    committedInHorizon,
    freeBalance,
    nextCliff,
    cliffReadiness,
    todaySplit,
    advanceCost,
    solve,
    shiftsInTrailingWindow,
  };
}

export type Pace = ReturnType<typeof createPace>;

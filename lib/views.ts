import "server-only";
import {
  openDb,
  getWorker,
  listWorkerIds,
  getObligations,
  getEarningsInRange,
} from "@/lib/db";
import {
  createPace,
  type CalendarEntry,
  type CliffReadiness,
  type SolveOption,
  addDays,
  trailingWindow,
} from "@/lib/pace";
import { createMemoryStore } from "@/lib/store";
import {
  DEFAULT_DATE,
  DEFAULT_WORKER,
} from "@/lib/defaults";

export {
  DEFAULT_DATE,
  DEFAULT_WORKER,
  MIN_PICKER_DATE,
  MAX_PICKER_DATE,
} from "@/lib/defaults";

let _pace: ReturnType<typeof createPace> | null = null;

export function getPace() {
  openDb();
  if (!_pace) _pace = createPace(createMemoryStore());
  return _pace;
}

export function listWorkersForPicker(): {
  workerId: string;
  label: string;
}[] {
  openDb();
  return listWorkerIds().map((id) => {
    const w = getWorker(id);
    return {
      workerId: id,
      label: w ? `${id} · ${w.occupation}` : id,
    };
  });
}

export type TodayView = {
  workerId: string;
  date: string;
  workerLabel: string;
  netEarned: number;
  committed: number;
  buffer: number;
  yours: number;
  earnedNotYetPaid: number;
  committedInHorizon30: number;
  freeBalance30: number;
  dayRate: number | null;
  floorDayNet: number | null;
};

export function loadToday(
  workerId: string = DEFAULT_WORKER,
  date: string = DEFAULT_DATE,
): TodayView | null {
  const pace = getPace();
  const worker = getWorker(workerId);
  if (!worker) return null;

  const split = pace.todaySplit(workerId, date);
  const free = pace.freeBalance(workerId, date, 30);
  if (split == null || free == null) return null;

  return {
    workerId,
    date,
    workerLabel: `${worker.occupation} · ${worker.city}`,
    netEarned: split.netEarned,
    committed: split.committed,
    buffer: split.buffer,
    yours: split.yours,
    earnedNotYetPaid: split.earnedNotYetPaid,
    committedInHorizon30: pace.committedInHorizon(workerId, date, 30),
    freeBalance30: free,
    dayRate: pace.dayRate(workerId, date),
    floorDayNet: pace.floorDayNet(workerId, date),
  };
}

export type PaceChartDay = {
  date: string;
  kind: "earn" | "bill" | "empty";
  amount: number;
  past: boolean;
};

export type PaceView = {
  workerId: string;
  date: string;
  workerLabel: string;
  dayRate: number;
  floorDayNet: number;
  cliff: CliffReadiness;
  calendar: CalendarEntry[];
  chartDays: PaceChartDay[];
  yMax: number;
};

export function loadPace(
  workerId: string = DEFAULT_WORKER,
  date: string = DEFAULT_DATE,
): PaceView | null {
  openDb();
  const pace = getPace();
  const worker = getWorker(workerId);
  if (!worker) return null;

  const dayRate = pace.dayRate(workerId, date);
  const floorDayNet = pace.floorDayNet(workerId, date);
  const cliff = pace.cliffReadiness(workerId, date);
  if (dayRate == null || floorDayNet == null || cliff == null) return null;

  const win = trailingWindow(date);
  if (!win) return null;

  const calendar = pace.obligationCalendar(workerId, date, addDays(date, 35));
  const obligationsByDate = new Map<string, number>();
  for (const e of calendar) {
    obligationsByDate.set(
      e.date,
      (obligationsByDate.get(e.date) ?? 0) + e.amount,
    );
  }

  const storeEarnings = getEarningsInRange(workerId, win.from, win.to);
  const earnByDate = new Map<string, number>();
  for (const e of storeEarnings) {
    earnByDate.set(
      e.work_date,
      (earnByDate.get(e.work_date) ?? 0) + e.net_pay_cad,
    );
  }

  const chartDays: PaceChartDay[] = [];
  for (let d = win.from; d <= win.to; d = addDays(d, 1)) {
    const amt = earnByDate.get(d) ?? 0;
    chartDays.push({
      date: d,
      kind: amt > 0 ? "earn" : "empty",
      amount: amt,
      past: true,
    });
  }
  for (let i = 1; i <= 35; i++) {
    const d = addDays(date, i);
    const amt = obligationsByDate.get(d) ?? 0;
    chartDays.push({
      date: d,
      kind: amt > 0 ? "bill" : "empty",
      amount: amt,
      past: false,
    });
  }

  const yMax = Math.max(
    dayRate,
    floorDayNet,
    ...chartDays.map((d) => d.amount),
    1,
  );

  return {
    workerId,
    date,
    workerLabel: `${worker.occupation} · ${worker.city}`,
    dayRate,
    floorDayNet,
    cliff,
    calendar,
    chartDays,
    yMax,
  };
}

export type SolveView = {
  workerId: string;
  date: string;
  workerLabel: string;
  gap: number;
  cliffDate: string;
  cliffAmount: number;
  options: (SolveOption & { obligationName?: string })[];
  noGap: boolean;
};

export function loadSolve(
  workerId: string = DEFAULT_WORKER,
  date: string = DEFAULT_DATE,
): SolveView | null {
  const pace = getPace();
  const worker = getWorker(workerId);
  if (!worker) return null;

  const cliff = pace.cliffReadiness(workerId, date);
  if (cliff == null) return null;

  const gap = Math.max(0, cliff.gap);
  const options = pace.solve(workerId, date, cliff.gap);
  const obs = getObligations(workerId);
  const nameById = new Map(obs.map((o) => [o.obligation_id, o.name]));

  return {
    workerId,
    date,
    workerLabel: `${worker.occupation} · ${worker.city}`,
    gap,
    cliffDate: cliff.cliffDate,
    cliffAmount: cliff.cliffAmount,
    noGap: cliff.gap <= 0,
    options: options.map((o) =>
      o.kind === "move"
        ? {
            ...o,
            obligationName: nameById.get(o.obligationId) ?? o.obligationId,
          }
        : o,
    ),
  };
}

import "server-only";
import { openDb, getWorker } from "@/lib/db";
import { createPace } from "@/lib/pace";
import { createMemoryStore } from "@/lib/store";

export const DEFAULT_WORKER = "W-0035";
export const DEFAULT_DATE = "2026-04-20";

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

let _pace: ReturnType<typeof createPace> | null = null;

function getPace() {
  openDb();
  if (!_pace) _pace = createPace(createMemoryStore());
  return _pace;
}

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

/**
 * Pace math tests — fixtures.json is the arbiter.
 * Never edit fixtures.json to make these pass.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  closeDb,
  getEarningsInRange,
  listWorkerIds,
  openDb,
} from "./db";
import {
  addDays,
  createPace,
  round2,
  trailingWindow,
  type Pace,
} from "./pace";
import { createMemoryStore } from "./store";

type FixtureCase = {
  workerId: string;
  asOf: string;
  shiftsInTrailingWindow: number;
  usesFloorFallback: boolean;
  committedMonthly: { total: number; essential: number };
  expectedWorkDaysPerMonth: number;
  dayRate: number;
  floorDayNet: number;
  medianHoursPerShift: number;
  dowWorkProbability: number[];
  latestBalance: number;
  discretionaryDailyRate: number;
  committedInHorizon30: number;
  freeBalance30: number;
  nextCliff: { date: string; amount: number; daysAway: number };
  cliffReadiness: {
    cliffDate: string;
    cliffAmount: number;
    daysAway: number;
    obligationsBefore: number;
    availableAtCliff: number;
    gap: number;
    shiftsNeeded: number;
    shiftsExpected: number;
  };
  obligationCalendar35: Array<{
    date: string;
    obligationId: string;
    amount: number;
    essential: number;
    autopay: number;
  }>;
  advanceCost70: {
    amount: number;
    fee: number;
    feePct: number;
    workMinutes: number;
  };
  todaySplit: {
    netEarned: number;
    committed: number;
    buffer: number;
    yours: number;
    earnedNotYetPaid: number;
  };
};

type Fixtures = {
  cases: FixtureCase[];
  population: Record<string, number | string>;
  negativeResult: Record<string, number | string>;
};

const fixtures: Fixtures = JSON.parse(
  readFileSync(path.resolve(__dirname, "../fixtures.json"), "utf8"),
);

const CURRENCY = 0.01;
const RATIO = 1e-4;

function expectClose(
  actual: number | null | undefined,
  expected: number,
  tol: number,
  label: string,
) {
  expect(actual, label).not.toBeNull();
  expect(actual, label).not.toBeUndefined();
  expect(
    Math.abs((actual as number) - expected),
    `${label}: got ${actual}, expected ${expected}`,
  ).toBeLessThanOrEqual(tol);
}

describe("lib/pace against fixtures.json", () => {
  let pace: Pace;

  beforeAll(() => {
    openDb();
    pace = createPace(createMemoryStore());
  });

  afterAll(() => {
    closeDb();
  });

  for (const [idx, c] of fixtures.cases.entries()) {
    describe(`case[${idx}] ${c.workerId} @ ${c.asOf}`, () => {
      it("trailing window + committedMonthly (incl. biweekly)", () => {
        const win = trailingWindow(c.asOf);
        expect(win).not.toBeNull();
        expect(pace.shiftsInTrailingWindow(c.workerId, c.asOf)).toBe(
          c.shiftsInTrailingWindow,
        );
        expect(c.usesFloorFallback).toBe(c.shiftsInTrailingWindow < 5);

        const cm = pace.committedMonthly(c.workerId);
        expectClose(cm.total, c.committedMonthly.total, CURRENCY, "committed.total");
        expectClose(
          cm.essential,
          c.committedMonthly.essential,
          CURRENCY,
          "committed.essential",
        );
      });

      it("dayRate / floor / hours / dow", () => {
        expectClose(
          pace.expectedWorkDaysPerMonth(c.workerId, c.asOf),
          c.expectedWorkDaysPerMonth,
          RATIO,
          "expectedWorkDaysPerMonth",
        );
        expectClose(pace.dayRate(c.workerId, c.asOf), c.dayRate, CURRENCY, "dayRate");
        expectClose(
          pace.floorDayNet(c.workerId, c.asOf),
          c.floorDayNet,
          CURRENCY,
          "floorDayNet",
        );
        expectClose(
          pace.medianHoursPerShift(c.workerId, c.asOf),
          c.medianHoursPerShift,
          CURRENCY,
          "medianHoursPerShift",
        );
        const dow = pace.dowWorkProbability(c.workerId, c.asOf);
        expect(dow).not.toBeNull();
        expect(dow!).toHaveLength(7);
        for (let i = 0; i < 7; i++) {
          expectClose(dow![i], c.dowWorkProbability[i], RATIO, `dow[${i}]`);
        }
      });

      it("balance, discretionary, freeBalance, cliff", () => {
        expectClose(
          pace.latestBalance(c.workerId, c.asOf),
          c.latestBalance,
          CURRENCY,
          "latestBalance",
        );
        expectClose(
          pace.discretionaryDailyRate(c.workerId, c.asOf),
          c.discretionaryDailyRate,
          CURRENCY,
          "discretionaryDailyRate",
        );
        expectClose(
          pace.committedInHorizon(c.workerId, c.asOf, 30),
          c.committedInHorizon30,
          CURRENCY,
          "committedInHorizon30",
        );
        expectClose(
          pace.freeBalance(c.workerId, c.asOf, 30),
          c.freeBalance30,
          CURRENCY,
          "freeBalance30",
        );

        const cliff = pace.nextCliff(c.workerId, c.asOf, 35);
        expect(cliff).not.toBeNull();
        expect(cliff!.date).toBe(c.nextCliff.date);
        expectClose(cliff!.amount, c.nextCliff.amount, CURRENCY, "cliff.amount");
        expect(cliff!.daysAway).toBe(c.nextCliff.daysAway);

        const ready = pace.cliffReadiness(c.workerId, c.asOf);
        expect(ready).not.toBeNull();
        expect(ready!.cliffDate).toBe(c.cliffReadiness.cliffDate);
        expectClose(
          ready!.cliffAmount,
          c.cliffReadiness.cliffAmount,
          CURRENCY,
          "ready.cliffAmount",
        );
        expect(ready!.daysAway).toBe(c.cliffReadiness.daysAway);
        expectClose(
          ready!.obligationsBefore,
          c.cliffReadiness.obligationsBefore,
          CURRENCY,
          "ready.obligationsBefore",
        );
        expectClose(
          ready!.availableAtCliff,
          c.cliffReadiness.availableAtCliff,
          CURRENCY,
          "ready.availableAtCliff",
        );
        expectClose(ready!.gap, c.cliffReadiness.gap, CURRENCY, "ready.gap");
        expect(ready!.shiftsNeeded).toBe(c.cliffReadiness.shiftsNeeded);
        expectClose(
          ready!.shiftsExpected,
          c.cliffReadiness.shiftsExpected,
          RATIO,
          "ready.shiftsExpected",
        );
      });

      it("obligationCalendar(35) matches exactly", () => {
        const cal = pace.obligationCalendar(
          c.workerId,
          c.asOf,
          addDays(c.asOf, 35),
        );
        expect(cal).toHaveLength(c.obligationCalendar35.length);
        for (let i = 0; i < cal.length; i++) {
          const got = cal[i];
          const exp = c.obligationCalendar35[i];
          expect(got.date, `cal[${i}].date`).toBe(exp.date);
          expect(got.obligationId, `cal[${i}].id`).toBe(exp.obligationId);
          expectClose(got.amount, exp.amount, CURRENCY, `cal[${i}].amount`);
          expect(got.essential).toBe(exp.essential);
          expect(got.autopay).toBe(exp.autopay);
        }
      });

      it("advanceCost(70) and todaySplit", () => {
        const ac = pace.advanceCost(70, c.workerId, c.asOf);
        expect(ac).not.toBeNull();
        expectClose(ac!.amount, c.advanceCost70.amount, CURRENCY, "ac.amount");
        expectClose(ac!.fee, c.advanceCost70.fee, CURRENCY, "ac.fee");
        expectClose(ac!.feePct, c.advanceCost70.feePct, CURRENCY, "ac.feePct");
        expectClose(
          ac!.workMinutes,
          c.advanceCost70.workMinutes,
          CURRENCY,
          "ac.workMinutes",
        );

        const split = pace.todaySplit(c.workerId, c.asOf);
        expect(split).not.toBeNull();
        expectClose(split!.netEarned, c.todaySplit.netEarned, CURRENCY, "netEarned");
        expectClose(split!.committed, c.todaySplit.committed, CURRENCY, "committed");
        expectClose(split!.buffer, c.todaySplit.buffer, CURRENCY, "buffer");
        expectClose(split!.yours, c.todaySplit.yours, CURRENCY, "yours");
        expectClose(
          split!.earnedNotYetPaid,
          c.todaySplit.earnedNotYetPaid,
          CURRENCY,
          "earnedNotYetPaid",
        );

        // Invariant
        expectClose(
          round2(split!.committed + split!.buffer + split!.yours),
          split!.netEarned,
          CURRENCY,
          "split sum invariant",
        );
        expect(split!.committed).toBeGreaterThanOrEqual(0);
        expect(split!.buffer).toBeGreaterThanOrEqual(0);
        expect(split!.yours).toBeGreaterThanOrEqual(0);
      });
    });
  }

  it("W-0009 committedMonthly includes biweekly * 26/12 (would fail if dropped)", () => {
    const cm = pace.committedMonthly("W-0009");
    // Face-value monthly only would be 1718+55+14.99 = 1787.99
    expect(cm.total).toBeGreaterThan(1787.99 + 1);
    expectClose(cm.total, 2091.32, CURRENCY, "W-0009 biweekly committed");
  });

  it(
    "todaySplit invariant holds for every worker-day in the dataset",
    () => {
      const workers = listWorkerIds();
      const pairs: { wid: string; date: string }[] = [];
      for (const c of fixtures.cases) {
        pairs.push({ wid: c.workerId, date: c.asOf });
      }
      for (const wid of workers) {
        for (const e of getEarningsInRange(wid, "2026-04-14", "2026-06-30")) {
          pairs.push({ wid, date: e.work_date });
        }
      }

      let checked = 0;
      for (const { wid, date } of pairs) {
        const split = pace.todaySplit(wid, date);
        if (split == null) continue;
        const sum = round2(split.committed + split.buffer + split.yours);
        if (
          Math.abs(sum - split.netEarned) > CURRENCY ||
          split.committed < 0 ||
          split.buffer < 0 ||
          split.yours < 0
        ) {
          throw new Error(
            `invariant failed ${wid}@${date}: committed=${split.committed} buffer=${split.buffer} yours=${split.yours} net=${split.netEarned}`,
          );
        }
        checked += 1;
      }
      expect(checked).toBeGreaterThan(1000);
    },
    60_000,
  );
});

/**
 * Holdout printout — values for worker/date pairs NOT in fixtures.json.
 * No assertions. Does not read fixtures.json. Raw values to 2dp for external check.
 */
import { openDb, closeDb } from "../lib/db";
import { createPace, addDays, round2 } from "../lib/pace";
import { createMemoryStore } from "../lib/store";

const PAIRS: { workerId: string; asOf: string }[] = [
  { workerId: "W-0016", asOf: "2026-05-28" },
  { workerId: "W-0027", asOf: "2026-05-02" },
  { workerId: "W-0100", asOf: "2026-04-20" },
  { workerId: "W-0155", asOf: "2026-06-30" },
  { workerId: "W-0210", asOf: "2026-04-14" },
];

function fmt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "null";
  return round2(n).toFixed(2);
}

function main(): void {
  openDb();
  const pace = createPace(createMemoryStore());

  for (const { workerId, asOf } of PAIRS) {
    const dayRate = pace.dayRate(workerId, asOf);
    const floorDayNet = pace.floorDayNet(workerId, asOf);
    const medianHours = pace.medianHoursPerShift(workerId, asOf);
    const committed = pace.committedMonthly(workerId);
    const latestBalance = pace.latestBalance(workerId, asOf);
    const committed30 = pace.committedInHorizon(workerId, asOf, 30);
    const free30 = pace.freeBalance(workerId, asOf, 30);
    const cliff = pace.nextCliff(workerId, asOf, 35);
    const ready = pace.cliffReadiness(workerId, asOf);
    const calLen = pace.obligationCalendar(
      workerId,
      asOf,
      addDays(asOf, 35),
    ).length;
    const split = pace.todaySplit(workerId, asOf);
    const adv = pace.advanceCost(70, workerId, asOf);

    console.log(`\n=== ${workerId} @ ${asOf} ===`);
    console.log(`dayRate: ${fmt(dayRate)}`);
    console.log(`floorDayNet: ${fmt(floorDayNet)}`);
    console.log(`medianHoursPerShift: ${fmt(medianHours)}`);
    console.log(`committedMonthly.total: ${fmt(committed.total)}`);
    console.log(`latestBalance: ${fmt(latestBalance)}`);
    console.log(`committedInHorizon(30): ${fmt(committed30)}`);
    console.log(`freeBalance(30): ${fmt(free30)}`);
    console.log(
      `nextCliff: { date: ${cliff?.date ?? "null"}, amount: ${fmt(cliff?.amount)}, daysAway: ${cliff?.daysAway ?? "null"} }`,
    );
    console.log(`cliffReadiness.gap: ${fmt(ready?.gap)}`);
    console.log(`cliffReadiness.shiftsNeeded: ${ready?.shiftsNeeded ?? "null"}`);
    console.log(`obligationCalendar(asOf, asOf+35).length: ${calLen}`);
    console.log(
      `todaySplit: { netEarned: ${fmt(split?.netEarned)}, committed: ${fmt(split?.committed)}, buffer: ${fmt(split?.buffer)}, yours: ${fmt(split?.yours)}, earnedNotYetPaid: ${fmt(split?.earnedNotYetPaid)} }`,
    );
    console.log(`advanceCost(70).workMinutes: ${fmt(adv?.workMinutes)}`);
  }

  console.log("");
  closeDb();
}

main();

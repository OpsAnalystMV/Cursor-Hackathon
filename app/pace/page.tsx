import { AppShell } from "../components/AppShell";
import { CliffChart } from "../components/CliffChart";
import { formatDateShort, formatMoney, formatShifts } from "@/lib/format";
import {
  DEFAULT_DATE,
  DEFAULT_WORKER,
  loadPace,
} from "@/lib/views";

type PageProps = {
  searchParams: Promise<{ worker?: string; date?: string }>;
};

export default async function PacePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const workerId = sp.worker?.trim() || DEFAULT_WORKER;
  const date = sp.date?.trim() || DEFAULT_DATE;
  const view = loadPace(workerId, date);

  if (!view) {
    return (
      <AppShell workerId={workerId} date={date}>
        <p className="text-[var(--muted)] leading-relaxed">
          Not enough history for {workerId} on {date}. Need at least 14 days
          from 2026-04-01.
        </p>
      </AppShell>
    );
  }

  const { cliff } = view;
  const gapPositive = cliff.gap > 0;

  return (
    <AppShell workerId={workerId} date={date}>
      <section aria-label="The month ahead" className="space-y-6">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-[1.85rem] leading-snug tracking-tight text-[var(--ink)]">
            The month ahead
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            Same scale for a day of work and a bill cliff — no log, no clip.
          </p>
        </div>

        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)]/70 p-3">
          <CliffChart
            days={view.chartDays}
            dayRate={view.dayRate}
            yMax={view.yMax}
            cliffDate={cliff.cliffDate}
          />
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-sm bg-[var(--earn-bar)]" />
              Days you worked
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-sm bg-[var(--bill-bar)]" />
              Bills due
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-px w-3 border-t border-dashed border-[var(--sea-deep)]" />
              Your number {formatMoney(view.dayRate)}/day
            </span>
          </div>
        </div>

        <div className="space-y-3 border-t border-[var(--line)] pt-5">
          <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
            Biggest cliff
          </h2>
          <p className="text-[1.05rem] leading-relaxed">
            {formatDateShort(cliff.cliffDate)} —{" "}
            <span className="font-semibold">
              {formatMoney(cliff.cliffAmount)}
            </span>
            <span className="text-[var(--muted)]">
              {" "}
              · {cliff.daysAway} days out
            </span>
          </p>

          {gapPositive ? (
            <p className="leading-relaxed text-[var(--danger)]">
              Gap of {formatMoney(cliff.gap)} — about{" "}
              <span className="font-semibold">{cliff.shiftsNeeded}</span>{" "}
              {cliff.shiftsNeeded === 1 ? "shift" : "shifts"} at your floor day
              net.
            </p>
          ) : (
            <p className="leading-relaxed text-[var(--sea-deep)]">
              On arithmetic alone, you’re covered for this cliff
              {cliff.gap < 0
                ? ` with ${formatMoney(Math.abs(cliff.gap))} to spare`
                : ""}
              .
            </p>
          )}

          <p className="text-sm leading-relaxed text-[var(--muted)]">
            On these weekdays historically, you have worked about{" "}
            <span className="font-medium text-[var(--ink)]">
              {formatShifts(cliff.shiftsExpected)}
            </span>{" "}
            of the {cliff.daysAway} days between now and the cliff. That is a
            past rate, not a forecast.
          </p>
        </div>
      </section>
    </AppShell>
  );
}

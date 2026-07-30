import { AppShell } from "../components/AppShell";
import {
  formatDateShort,
  formatHours,
  formatMinutes,
  formatMoney,
} from "@/lib/format";
import {
  DEFAULT_DATE,
  DEFAULT_WORKER,
  loadSolve,
} from "@/lib/views";

type PageProps = {
  searchParams: Promise<{ worker?: string; date?: string }>;
};

export default async function SolvePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const workerId = sp.worker?.trim() || DEFAULT_WORKER;
  const date = sp.date?.trim() || DEFAULT_DATE;
  const view = loadSolve(workerId, date);

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

  return (
    <AppShell workerId={workerId} date={date}>
      <section aria-label="Close the gap" className="space-y-6">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-[1.85rem] leading-snug tracking-tight text-[var(--ink)]">
            Close the gap
          </h1>
          {view.noGap ? (
            <p className="mt-2 text-[var(--muted)] leading-relaxed">
              No gap to the {formatDateShort(view.cliffDate)} cliff
              ({formatMoney(view.cliffAmount)}). Arithmetic says you’re clear.
            </p>
          ) : (
            <p className="mt-2 text-[var(--muted)] leading-relaxed">
              {formatMoney(view.gap)} short of the{" "}
              {formatDateShort(view.cliffDate)} cliff (
              {formatMoney(view.cliffAmount)}). Ranked by effort — advance last.
            </p>
          )}
        </div>

        {!view.noGap && (
          <ol className="space-y-4">
            {view.options.map((opt, i) => {
              if (opt.kind === "move") {
                return (
                  <li
                    key={`move-${opt.obligationId}`}
                    className="border-t border-[var(--line)] pt-4"
                  >
                    <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                      {i + 1}. Move a bill
                    </p>
                    <p className="mt-1 text-[1.05rem] leading-snug">
                      Defer{" "}
                      <span className="font-semibold">{opt.obligationName}</span>{" "}
                      ({formatMoney(opt.amount)}) past the cliff.
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      Closes the gap on paper. Does not create income or cut
                      spending.
                    </p>
                  </li>
                );
              }
              if (opt.kind === "trim") {
                const days =
                  opt.days >= 10
                    ? `${Math.round(opt.days)}`
                    : opt.days.toFixed(1);
                return (
                  <li key="trim" className="border-t border-[var(--line)] pt-4">
                    <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                      {i + 1}. Trim spending
                    </p>
                    <p className="mt-1 text-[1.05rem] leading-snug">
                      Skip about{" "}
                      <span className="font-semibold">{days} days</span> of
                      discretionary spend ({formatMoney(opt.dailyRate)}/day).
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      Saves cash before the cliff. Does not move the bill date.
                    </p>
                  </li>
                );
              }
              if (opt.kind === "earn") {
                return (
                  <li key="earn" className="border-t border-[var(--line)] pt-4">
                    <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                      {i + 1}. Earn it
                    </p>
                    <p className="mt-1 text-[1.05rem] leading-snug">
                      About{" "}
                      <span className="font-semibold">
                        {opt.shiftsNeeded}{" "}
                        {opt.shiftsNeeded === 1 ? "shift" : "shifts"}
                      </span>
                      {" — "}
                      roughly {formatHours(opt.hoursNeeded)} hours at your floor
                      day net.
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      Closes the gap with work. Does not change what’s already
                      due.
                    </p>
                  </li>
                );
              }
              // advance
              return (
                <li
                  key="advance"
                  className="border-t border-[var(--line)] pt-4"
                >
                  <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                    {i + 1}. Advance
                  </p>
                  <p className="mt-1 text-[1.05rem] leading-snug">
                    {formatMoney(opt.cost.fee)} — about{" "}
                    <span className="font-semibold">
                      {formatMinutes(opt.cost.workMinutes)} minutes of work
                    </span>
                    .
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Gets {formatMoney(opt.cost.amount)} now. Does not shrink the
                    cliff — you still owe the bills, plus the fee.
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </AppShell>
  );
}

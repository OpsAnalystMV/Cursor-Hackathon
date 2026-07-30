import { AppShell } from "./components/AppShell";
import { SplitBar } from "./components/SplitBar";
import { formatMoney } from "@/lib/format";
import {
  DEFAULT_DATE,
  DEFAULT_WORKER,
  loadToday,
} from "@/lib/views";

type PageProps = {
  searchParams: Promise<{ worker?: string; date?: string }>;
};

export default async function TodayPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const workerId = sp.worker?.trim() || DEFAULT_WORKER;
  const date = sp.date?.trim() || DEFAULT_DATE;
  const view = loadToday(workerId, date);

  if (!view) {
    return (
      <AppShell workerId={workerId} date={date}>
        <p className="text-[var(--muted)] leading-relaxed">
          Not enough history for {workerId} on {date}. Need at least 14 days
          from 2026-04-01 before trailing-window numbers exist.
        </p>
      </AppShell>
    );
  }

  const didNotWork = view.netEarned === 0;
  const freeNegative = view.freeBalance30 < 0;

  return (
    <AppShell workerId={workerId} date={date}>
      <section aria-label="Today" className="space-y-6">
        <h1 className="font-[family-name:var(--font-display)] text-[1.85rem] leading-snug tracking-tight text-[var(--ink)]">
          {didNotWork
            ? "You didn’t work today."
            : `You cleared ${formatMoney(view.netEarned)} today.`}
        </h1>

        {didNotWork ? (
          <p className="text-[var(--muted)] leading-relaxed">
            Off days are part of the rhythm. What’s already committed doesn’t
            wait for a shift.
          </p>
        ) : (
          <div className="space-y-1 text-[1.05rem] leading-relaxed">
            <p>
              <span className="font-semibold text-[var(--sea-deep)]">
                {formatMoney(view.committed)}
              </span>{" "}
              was already spoken for.
            </p>
            <p>
              <span className="font-semibold text-[var(--yours)]">
                {formatMoney(view.yours)}
              </span>{" "}
              is yours.
            </p>
          </div>
        )}

        <SplitBar
          committed={view.committed}
          buffer={view.buffer}
          yours={view.yours}
        />

        {view.earnedNotYetPaid > 0 && (
          <p className="text-sm leading-relaxed text-[var(--muted)]">
            {formatMoney(view.earnedNotYetPaid)} earned in the last week hasn’t
            landed yet.
            <span className="mt-0.5 block text-xs opacity-80">
              Approx. — shifts not marked same-day paid in the past 7 days.
            </span>
          </p>
        )}

        <div className="space-y-2 border-t border-[var(--line)] pt-5">
          <p className="text-[0.95rem] leading-relaxed text-[var(--ink)]">
            Across the next 30 days,{" "}
            <span className="font-semibold">
              {formatMoney(view.committedInHorizon30)}
            </span>{" "}
            of your balance is already committed.
          </p>
          <p
            className={`text-[0.95rem] leading-relaxed ${
              freeNegative ? "text-[var(--danger)]" : "text-[var(--sea-deep)]"
            }`}
          >
            Free after that:{" "}
            <span className="font-semibold tabular-nums">
              {formatMoney(view.freeBalance30)}
            </span>
            {freeNegative ? " — less than nothing spare." : "."}
          </p>
        </div>
      </section>
    </AppShell>
  );
}

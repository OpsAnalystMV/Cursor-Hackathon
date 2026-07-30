import { SplitBar } from "./components/SplitBar";
import { formatMoney } from "@/lib/format";
import {
  DEFAULT_DATE,
  DEFAULT_WORKER,
  loadToday,
} from "@/lib/today";

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
      <main className="mx-auto min-h-screen max-w-md px-5 py-10">
        <p className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
          Pace
        </p>
        <p className="mt-6 text-[var(--muted)]">
          Not enough history for {workerId} on {date}. Need at least 14 days from
          2026-04-01.
        </p>
      </main>
    );
  }

  const didNotWork = view.netEarned === 0;
  const freeNegative = view.freeBalance30 < 0;

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-8 pb-16">
      <header className="mb-10">
        <p className="font-[family-name:var(--font-display)] text-4xl tracking-tight text-[var(--sea-deep)]">
          Pace
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {view.workerLabel}
          <span className="mx-1.5 text-[var(--line)]">·</span>
          {view.date}
        </p>
      </header>

      <section
        className="rounded-2xl border border-[var(--line)] bg-[color-mix(in_srgb,white_70%,var(--paper))] p-5 shadow-[0_1px_0_rgba(26,42,36,0.04)]"
        aria-label="Today"
      >
        <h1 className="font-[family-name:var(--font-display)] text-[1.75rem] leading-snug tracking-tight text-[var(--ink)]">
          {didNotWork
            ? "You didn’t work today."
            : `You cleared ${formatMoney(view.netEarned)} today.`}
        </h1>

        {didNotWork ? (
          <p className="mt-3 text-[var(--muted)] leading-relaxed">
            Off days are part of the rhythm. What’s already committed doesn’t wait
            for a shift.
          </p>
        ) : (
          <div className="mt-4 space-y-1 text-[1.05rem] leading-relaxed">
            <p>
              <span className="text-[var(--sea-deep)] font-semibold">
                {formatMoney(view.committed)}
              </span>{" "}
              was already spoken for.
            </p>
            <p>
              <span className="text-[var(--yours)] font-semibold">
                {formatMoney(view.yours)}
              </span>{" "}
              is yours.
            </p>
          </div>
        )}

        <div className="mt-6">
          <SplitBar
            committed={view.committed}
            buffer={view.buffer}
            yours={view.yours}
          />
        </div>

        {view.earnedNotYetPaid > 0 && (
          <p className="mt-6 text-sm leading-relaxed text-[var(--muted)]">
            {formatMoney(view.earnedNotYetPaid)} earned in the last week hasn’t
            landed yet.
            <span className="block mt-0.5 text-xs opacity-80">
              Approx. — shifts not marked same-day paid in the past 7 days.
            </span>
          </p>
        )}

        <div className="mt-6 border-t border-[var(--line)] pt-5 space-y-2">
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
            </span>{freeNegative ? " — less than nothing spare." : "."}
          </p>
        </div>
      </section>
    </main>
  );
}

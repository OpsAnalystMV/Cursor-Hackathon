import { Suspense } from "react";
import { PrimaryNav } from "./PrimaryNav";
import { WorkerDatePicker } from "./WorkerDatePicker";
import {
  DEFAULT_DATE,
  DEFAULT_WORKER,
  listWorkersForPicker,
} from "@/lib/views";

type Props = {
  workerId?: string;
  date?: string;
  children: React.ReactNode;
  showPickers?: boolean;
};

export function AppShell({
  workerId = DEFAULT_WORKER,
  date = DEFAULT_DATE,
  children,
  showPickers = true,
}: Props) {
  const workers = showPickers ? listWorkersForPicker() : [];

  return (
    <div className="mx-auto min-h-screen max-w-md px-5 pb-20 pt-6">
      <header className="mb-8 animate-fade-up">
        <p className="font-[family-name:var(--font-display)] text-[2.75rem] leading-none tracking-tight text-[var(--sea-deep)]">
          Pace
        </p>
        <p className="mt-2 max-w-[20rem] text-sm leading-relaxed text-[var(--muted)]">
          What of today is already spoken for.
        </p>

        <PrimaryNav workerId={workerId} date={date} />

        {showPickers && (
          <div className="mt-4">
            <Suspense
              fallback={
                <p className="text-xs text-[var(--muted)]">Loading pickers…</p>
              }
            >
              <WorkerDatePicker
                workers={workers}
                workerId={workerId}
                date={date}
              />
            </Suspense>
          </div>
        )}
      </header>

      <div className="animate-fade-up-delay">{children}</div>
    </div>
  );
}

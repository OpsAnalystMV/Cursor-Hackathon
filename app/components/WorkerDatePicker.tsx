"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { MIN_PICKER_DATE, MAX_PICKER_DATE } from "@/lib/defaults";

type WorkerOption = { workerId: string; label: string };

type Props = {
  workers: WorkerOption[];
  workerId: string;
  date: string;
};

export function WorkerDatePicker({ workers, workerId, date }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function navigate(nextWorker: string, nextDate: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("worker", nextWorker);
    params.set("date", nextDate);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div
      className={`flex flex-col gap-2 sm:flex-row sm:items-center ${
        pending ? "opacity-60" : ""
      }`}
    >
      <label className="flex flex-1 flex-col gap-1 text-xs text-[var(--muted)]">
        Worker
        <select
          className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--sea)]"
          value={workerId}
          onChange={(e) => navigate(e.target.value, date)}
        >
          {workers.map((w) => (
            <option key={w.workerId} value={w.workerId}>
              {w.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
        As of
        <input
          type="date"
          min={MIN_PICKER_DATE}
          max={MAX_PICKER_DATE}
          value={date}
          onChange={(e) => navigate(workerId, e.target.value)}
          className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--sea)]"
        />
      </label>
    </div>
  );
}

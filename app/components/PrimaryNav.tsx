"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Today" },
  { href: "/pace", label: "Pace" },
  { href: "/solve", label: "Solve" },
  { href: "/proof", label: "Proof" },
] as const;

type Props = {
  workerId: string;
  date: string;
};

export function PrimaryNav({ workerId, date }: Props) {
  const pathname = usePathname();
  const qs = `?worker=${encodeURIComponent(workerId)}&date=${encodeURIComponent(date)}`;

  return (
    <nav
      className="mt-6 flex gap-1 border-b border-[var(--line)]"
      aria-label="Primary"
    >
      {NAV.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
        const href = item.href === "/proof" ? "/proof" : `${item.href}${qs}`;
        return (
          <Link
            key={item.href}
            href={href}
            className={`relative -mb-px px-3 py-2 text-sm transition-colors ${
              active
                ? "border-b-2 border-[var(--sea)] font-semibold text-[var(--sea-deep)]"
                : "border-b-2 border-transparent text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

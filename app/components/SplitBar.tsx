type SplitBarProps = {
  committed: number;
  buffer: number;
  yours: number;
};

/** Hand-rolled committed / buffer / yours bar. No chart library. */
export function SplitBar({ committed, buffer, yours }: SplitBarProps) {
  const total = committed + buffer + yours;
  const empty = total <= 0;
  const c = empty ? 0 : (committed / total) * 100;
  const b = empty ? 0 : (buffer / total) * 100;
  const y = empty ? 0 : (yours / total) * 100;

  return (
    <div className="space-y-3">
      <svg
        viewBox="0 0 320 28"
        className="w-full h-7"
        role="img"
        aria-label={
          empty
            ? "No earnings to split today"
            : `Committed ${committed}, buffer ${buffer}, yours ${yours}`
        }
      >
        <rect x="0" y="4" width="320" height="20" rx="4" fill="#d4ccbc" />
        {!empty && (
          <>
            <rect
              x="0"
              y="4"
              width={(320 * c) / 100}
              height="20"
              rx="4"
              fill="#0f6b5c"
            />
            <rect
              x={(320 * c) / 100}
              y="4"
              width={(320 * b) / 100}
              height="20"
              fill="#c4a35a"
            />
            <rect
              x={(320 * (c + b)) / 100}
              y="4"
              width={(320 * y) / 100}
              height="20"
              rx="4"
              fill="#2f6f9f"
            />
          </>
        )}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-[var(--committed)]" />
          Spoken for
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-[var(--buffer)]" />
          Buffer
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-[var(--yours)]" />
          Yours
        </span>
      </div>
    </div>
  );
}

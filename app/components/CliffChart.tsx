import { formatMoney } from "@/lib/format";
import type { PaceChartDay } from "@/lib/views";

type Props = {
  days: PaceChartDay[];
  dayRate: number;
  yMax: number;
  cliffDate: string;
};

/** Obligation cliffs vs trailing earnings — same linear scale, no log, no clip. */
export function CliffChart({ days, dayRate, yMax, cliffDate }: Props) {
  const W = 360;
  const H = 200;
  const padL = 36;
  const padR = 8;
  const padT = 16;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = days.length;
  const gap = 0.35;
  const slot = plotW / Math.max(n, 1);
  const barW = Math.max(1.2, slot * (1 - gap));

  const yScale = (v: number) => padT + plotH - (v / yMax) * plotH;
  const rateY = yScale(dayRate);

  const todayIdx = days.findIndex((d) => !d.past);
  const dividerX =
    todayIdx >= 0 ? padL + todayIdx * slot : padL + plotW * 0.5;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Daily earnings behind you and obligation cliffs ahead, same scale"
    >
      {/* Day-rate reference */}
      <line
        x1={padL}
        x2={W - padR}
        y1={rateY}
        y2={rateY}
        stroke="#084e4b"
        strokeWidth="1.25"
        strokeDasharray="4 3"
      />
      <text
        x={padL + 2}
        y={rateY - 4}
        fill="#084e4b"
        fontSize="9"
        fontFamily="var(--font-body), sans-serif"
      >
        your number
      </text>

      {/* Today divider */}
      <line
        x1={dividerX}
        x2={dividerX}
        y1={padT}
        y2={padT + plotH}
        stroke="#c5d3da"
        strokeWidth="1"
      />
      <text
        x={dividerX + 3}
        y={padT + 10}
        fill="#5a6d76"
        fontSize="8"
        fontFamily="var(--font-body), sans-serif"
      >
        ahead
      </text>

      {days.map((d, i) => {
        if (d.amount <= 0) return null;
        const x = padL + i * slot + (slot - barW) / 2;
        const y = yScale(d.amount);
        const h = padT + plotH - y;
        const isCliff = d.date === cliffDate;
        const fill = d.past
          ? "#7aa8b8"
          : isCliff
            ? "#084e4b"
            : "#0c6e6a";
        return (
          <rect
            key={`${d.date}-${i}`}
            className="chart-bar"
            style={{ animationDelay: `${Math.min(i, 40) * 8}ms` }}
            x={x}
            y={y}
            width={barW}
            height={h}
            fill={fill}
            opacity={d.past ? 0.85 : 1}
          >
            <title>
              {d.date}: {d.amount.toFixed(2)}
              {d.past ? " earned" : " due"}
            </title>
          </rect>
        );
      })}

      {/* Y ticks */}
      <text
        x={2}
        y={padT + 8}
        fill="#5a6d76"
        fontSize="8"
        fontFamily="var(--font-body), sans-serif"
      >
        {formatMoney(yMax)}
      </text>
      <text
        x={2}
        y={padT + plotH}
        fill="#5a6d76"
        fontSize="8"
        fontFamily="var(--font-body), sans-serif"
      >
        $0
      </text>

      <text
        x={padL}
        y={H - 6}
        fill="#5a6d76"
        fontSize="8"
        fontFamily="var(--font-body), sans-serif"
      >
        worked days
      </text>
      <text
        x={W - padR}
        y={H - 6}
        fill="#5a6d76"
        fontSize="8"
        textAnchor="end"
        fontFamily="var(--font-body), sans-serif"
      >
        bills next 35d
      </text>
    </svg>
  );
}

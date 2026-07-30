/** Display currency: whole dollars above $10, two decimals below. */
export function formatMoney(n: number): string {
  const neg = n < 0;
  const abs = Math.abs(n);
  const body =
    abs >= 10
      ? `$${Math.round(abs).toLocaleString("en-US")}`
      : `$${abs.toFixed(2)}`;
  return neg ? `−${body}` : body;
}

export function formatHours(n: number): string {
  if (n >= 10) return `${Math.round(n)}`;
  return n.toFixed(1);
}

export function formatMinutes(n: number): string {
  if (n >= 10) return `${Math.round(n)}`;
  return n.toFixed(1);
}

export function formatShifts(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}

export function formatDateShort(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[m - 1]} ${d}`;
}

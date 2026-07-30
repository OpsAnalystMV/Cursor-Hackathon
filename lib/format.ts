/** Display currency: whole dollars above $10, two decimals below. Never show raw balance. */
export function formatMoney(n: number): string {
  const neg = n < 0;
  const abs = Math.abs(n);
  const body =
    abs >= 10
      ? `$${Math.round(abs).toLocaleString("en-US")}`
      : `$${abs.toFixed(2)}`;
  return neg ? `−${body}` : body;
}

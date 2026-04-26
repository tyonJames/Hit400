/** Formats a number as Zimbabwe-style currency: $20 000.00 */
export function formatMoney(amount: number | null | undefined, symbol = '$'): string {
  if (amount == null) return '—';
  const [integer, decimal] = amount.toFixed(2).split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${symbol}${grouped}.${decimal}`;
}

/** Formats a price range: $20 000.00 – $50 000.00 */
export function formatRange(min: number, max: number, symbol = '$'): string {
  return `${formatMoney(min, symbol)} – ${formatMoney(max, symbol)}`;
}

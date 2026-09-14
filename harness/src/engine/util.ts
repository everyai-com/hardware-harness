export function usd(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function round(n: number, places = 2): number {
  const f = Math.pow(10, places);
  return Math.round(n * f) / f;
}

/** Whole dollars, for prose. "$3,000" rather than "$3,000.00". */
export function usdWhole(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

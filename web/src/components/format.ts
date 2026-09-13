export function usd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function usd2(n: number): string {
  return `$${n.toFixed(2)}`;
}

/** A round, even upper bound for an axis so the midline tick is a whole number: 4 -> 4, 5 -> 6, 7 -> 8, 13 -> 14, 23 -> 26. */
export function niceMax(n: number): number {
  if (n <= 4) return 4;
  const mag = Math.pow(10, Math.floor(Math.log10(n)));
  let top = n;
  for (const m of [1, 2, 2.5, 5, 10]) if (m * mag >= n) { top = m * mag; break; }
  return Number.isInteger(top / 2) ? top : Math.ceil(top / 2) * 2;
}

export function hourLabel(h: number): string {
  const x = h % 12 === 0 ? 12 : h % 12;
  return `${x}${h < 12 ? "am" : "pm"}`;
}

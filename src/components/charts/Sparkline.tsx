/** A 12 to 30 point trend line: 2px, round caps and a faint wash under it. */
export function Sparkline({ values, label }: { values: number[]; label: string }) {
  const W = 160, H = 34, P = 4;
  const max = Math.max(1, ...values);
  const x = (i: number) => P + (i * (W - 2 * P)) / Math.max(1, values.length - 1);
  const y = (v: number) => H - P - ((H - 2 * P) * v) / max;
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const last = values.length - 1;
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} preserveAspectRatio="none">
      <polygon points={`${x(0)},${H - P} ${pts.join(" ")} ${x(last)},${H - P}`} fill="var(--accent)" opacity=".10" />
      <polyline points={pts.join(" ")} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

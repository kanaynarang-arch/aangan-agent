"use client";

import { useState } from "react";
import { niceMax } from "./util";

export interface DayPoint { day: string; calls: number; leads: number }
interface Tip { x: number; y: number; title: string; lines: string[] }

const W = 760, H = 240, L = 34, R = 8, T = 16, B = 30;

const fmt = (iso: string, withWeekday = false) =>
  new Date(`${iso}T12:00:00+05:30`).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", ...(withWeekday ? { weekday: "short" } : {}) });

/** Calls per day, stacked: leads for designers (green) under all other calls (grey), with a 2px gap between the two. */
export function DayChart({ data }: { data: DayPoint[] }) {
  const [tip, setTip] = useState<Tip | null>(null);
  const max = niceMax(Math.max(1, ...data.map((d) => d.calls)));
  const slot = (W - L - R) / data.length;
  const bw = Math.min(20, slot - 3);
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const base = H - B;
  const total = data.reduce((n, d) => n + d.calls, 0);
  const ticks = [0, max / 2, max];

  const show = (d: DayPoint, i: number) => {
    const cx = L + i * slot + slot / 2;
    setTip({
      x: (cx / W) * 100, y: (y(d.calls) / H) * 100, title: fmt(d.day, true),
      lines: [`${d.calls} call${d.calls === 1 ? "" : "s"}`, `${d.leads} became a lead for designers`],
    });
  };

  return (
    <div>
      <div className="chart">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Calls per day over the last ${data.length} days. ${total} calls in total.`}>
          {ticks.map((t) => (
            <g key={t}>
              <line className="grid-l" x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
              <text x={L - 8} y={y(t) + 4} textAnchor="end">{Number.isInteger(t) ? t : t.toFixed(1)}</text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = L + i * slot + slot / 2;
            const hTotal = (base - y(d.calls));
            const hLeads = d.calls ? hTotal * (d.leads / d.calls) : 0;
            const hOther = hTotal - hLeads;
            const gap = hLeads > 0 && hOther > 0 ? 2 : 0;
            const x0 = cx - bw / 2;
            return (
              <g key={d.day}>
                {hLeads > 0 && <rect className="bar" x={x0} y={base - hLeads} width={bw} height={hLeads} fill="var(--green)" rx={hOther > 0 ? 0 : 4} />}
                {hOther > 0 && <path className="bar" fill="var(--mark-grey)" d={`M${x0},${base - hLeads - gap} V${base - hTotal + 4} a4,4 0 0 1 4,-4 h${bw - 8} a4,4 0 0 1 4,4 V${base - hLeads - gap} Z`} />}
                <rect x={L + i * slot} y={T} width={slot} height={H - T - B} fill="transparent" tabIndex={0} role="img"
                  aria-label={`${fmt(d.day)}: ${d.calls} calls, ${d.leads} leads`}
                  onPointerEnter={() => show(d, i)} onFocus={() => show(d, i)} onPointerLeave={() => setTip(null)} onBlur={() => setTip(null)} />
              </g>
            );
          })}
          <line className="axis" x1={L} x2={W - R} y1={base} y2={base} />
          {data.map((d, i) => (i % 7 === (data.length - 1) % 7 ? (
            <text key={d.day} x={L + i * slot + slot / 2} y={H - 9} textAnchor="middle">{fmt(d.day)}</text>
          ) : null))}
        </svg>
        <div className={`tip${tip ? " on" : ""}`} style={tip ? { left: `${tip.x}%`, top: `${tip.y}%`, marginTop: -8 } : undefined} role="status">
          {tip && <><b>{tip.title}</b>{tip.lines.map((l) => <span key={l}>{l}</span>)}</>}
        </div>
      </div>
      <div className="legend" style={{ marginTop: 12 }}>
        <span><i style={{ background: "var(--green)" }} />Became a lead for designers</span>
        <span><i style={{ background: "var(--mark-grey)" }} />Other calls</span>
      </div>
      <details className="tableview">
        <summary>View as a table</summary>
        <div className="scroll">
          <table>
            <thead><tr><th scope="col">Day</th><th scope="col">Calls</th><th scope="col">Leads</th></tr></thead>
            <tbody>
              {data.filter((d) => d.calls > 0).map((d) => <tr key={d.day} className="num"><td>{fmt(d.day, true)}</td><td>{d.calls}</td><td>{d.leads}</td></tr>)}
              {total === 0 && <tr><td colSpan={3} className="muted">No calls in this period.</td></tr>}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

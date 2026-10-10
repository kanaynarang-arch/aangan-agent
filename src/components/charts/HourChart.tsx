"use client";

import { useState } from "react";
import { hourLabel, niceMax } from "./util";

export interface HourPoint { hour: number; calls: number; leads: number }
interface Tip { x: number; y: number; title: string; lines: string[] }

const W = 760, H = 250, L = 34, R = 8, T = 30, B = 30;
const OPEN = 10, CLOSE = 19; // front desk hours, India time

/**
 * Calls by hour of day. The story is the share that arrive while the front desk is closed, so those bars carry the accent
 * and the in-hours bars recede to grey (the "emphasis" form). Hover or focus any bar for its numbers; a table view lists them all.
 */
export function HourChart({ data }: { data: HourPoint[] }) {
  const [tip, setTip] = useState<Tip | null>(null);
  const max = niceMax(Math.max(1, ...data.map((d) => d.calls)));
  const slot = (W - L - R) / 24;
  const bw = Math.min(18, slot - 6);
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const open = (h: number) => h >= OPEN && h < CLOSE;
  const total = data.reduce((n, d) => n + d.calls, 0);
  const after = data.filter((d) => !open(d.hour)).reduce((n, d) => n + d.calls, 0);
  const peakAfter = data.filter((d) => !open(d.hour)).reduce((a, b) => (b.calls > a.calls ? b : a), data[0]);
  const ticks = [0, max / 2, max];

  const show = (d: HourPoint) => {
    const cx = L + d.hour * slot + slot / 2;
    setTip({
      x: (cx / W) * 100, y: (y(d.calls) / H) * 100,
      title: `${hourLabel(d.hour)} to ${hourLabel((d.hour + 1) % 24)}`,
      lines: [`${d.calls} call${d.calls === 1 ? "" : "s"}${d.leads ? `, ${d.leads} became a lead` : ""}`, open(d.hour) ? "Front desk open" : "Front desk closed: the agent answered"],
    });
  };

  return (
    <div>
      <p className="small muted" style={{ margin: "0 0 12px" }} aria-live="polite">
        {total === 0 ? "No calls yet." : <><b style={{ color: "var(--ink)" }}>{after} of {total}</b> calls ({Math.round((after / total) * 100)}%) came in while the front desk was closed. Before the agent, these waited for the next morning.</>}
      </p>
      <div className="chart">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Calls by hour of day. ${after} of ${total} calls arrived outside 10am to 7pm.`}>
          <rect className="band" x={L + OPEN * slot} y={T - 14} width={(CLOSE - OPEN) * slot} height={H - T - B + 14} rx="8" />
          <text className="band-l" x={L + ((OPEN + CLOSE) / 2) * slot} y={T - 1} textAnchor="middle">Front desk open</text>
          {ticks.map((t) => (
            <g key={t}>
              <line className="grid-l" x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
              <text x={L - 8} y={y(t) + 4} textAnchor="end">{Number.isInteger(t) ? t : t.toFixed(1)}</text>
            </g>
          ))}
          {data.map((d) => {
            const cx = L + d.hour * slot + slot / 2;
            const h = Math.max(d.calls ? 4 : 0, (H - T - B) * (d.calls / max));
            const fill = open(d.hour) ? "var(--mark-grey)" : "var(--accent)";
            return (
              <g key={d.hour}>
                {d.calls > 0 && (
                  <path className="bar" fill={fill}
                    d={`M${cx - bw / 2},${H - B} V${H - B - h + 4} a4,4 0 0 1 4,-4 h${bw - 8} a4,4 0 0 1 4,4 V${H - B} Z`} />
                )}
                <rect x={L + d.hour * slot} y={T} width={slot} height={H - T - B} fill="transparent" tabIndex={0}
                  role="img" aria-label={`${hourLabel(d.hour)}: ${d.calls} calls, ${d.leads} leads, ${open(d.hour) ? "front desk open" : "front desk closed"}`}
                  onPointerEnter={() => show(d)} onFocus={() => show(d)} onPointerLeave={() => setTip(null)} onBlur={() => setTip(null)} />
              </g>
            );
          })}
          <line className="axis" x1={L} x2={W - R} y1={H - B} y2={H - B} />
          {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => (
            <text key={h} x={L + h * slot + slot / 2} y={H - 9} textAnchor="middle">{hourLabel(h)}</text>
          ))}
          {peakAfter && peakAfter.calls > 0 && (
            <text x={L + peakAfter.hour * slot + slot / 2} y={y(peakAfter.calls) - 8} textAnchor="middle" style={{ fill: "var(--ink)", fontWeight: 700 }}>{peakAfter.calls}</text>
          )}
        </svg>
        <div className={`tip${tip ? " on" : ""}`} style={tip ? { left: `${tip.x}%`, top: `${tip.y}%`, marginTop: -8 } : undefined} role="status">
          {tip && <><b>{tip.title}</b>{tip.lines.map((l) => <span key={l}>{l}</span>)}</>}
        </div>
      </div>
      <div className="legend" style={{ marginTop: 12 }}>
        <span><i style={{ background: "var(--accent)" }} />Front desk closed (agent answered)</span>
        <span><i style={{ background: "var(--mark-grey)" }} />Front desk open (10am to 7pm)</span>
      </div>
      <details className="tableview">
        <summary>View as a table</summary>
        <div className="scroll">
          <table>
            <thead><tr><th scope="col">Hour</th><th scope="col">Calls</th><th scope="col">Leads</th><th scope="col">Front desk</th></tr></thead>
            <tbody>
              {data.filter((d) => d.calls > 0).map((d) => (
                <tr key={d.hour} className="num"><td>{hourLabel(d.hour)} to {hourLabel((d.hour + 1) % 24)}</td><td>{d.calls}</td><td>{d.leads}</td><td>{open(d.hour) ? "Open" : "Closed"}</td></tr>
              ))}
              {total === 0 && <tr><td colSpan={4} className="muted">No calls yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

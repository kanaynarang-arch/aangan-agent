import type { Metadata } from "next";
import { liveCallCount, pipelineMetrics } from "@/lib/queries";
import { SourceChips, inr, parseSource } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pipeline" };

const TIERS: { key: string; label: string; color: string }[] = [
  { key: "green", label: "Green, qualified", color: "var(--green)" },
  { key: "amber", label: "Amber, needs review", color: "var(--amber)" },
  { key: "red", label: "Red, closed politely", color: "var(--red)" },
  { key: "escalate", label: "Escalated complaints", color: "var(--urgent)" },
  { key: "dropped", label: "Dropped calls", color: "var(--grey)" },
];

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "-");

export default async function Pipeline({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const chosen = parseSource((await searchParams).source);
  // Nikhil's numbers are about real calls: default to live as soon as one exists, otherwise show everything.
  const source = chosen ?? ((await liveCallCount()) > 0 ? "live" : "all");
  const m = await pipelineMetrics(source);
  const tierTotal = TIERS.reduce((n, t) => n + (m.tiers[t.key] ?? 0), 0);
  const green = m.tiers.green ?? 0;

  return (
    <>
      <h1>Pipeline</h1>
      <p className="sub">What the phone agent is handling, what it hands to designers, and what it costs. Updates with every call.</p>
      <p className="note">Before the agent: about 48% of enquiries had no reply within 48 hours and about a third arrived outside 10am to 7pm.</p>
      <SourceChips base="/pipeline" source={source} />
      {m.testCalls > 0 && (
        <p className="note" role="note">
          {source === "test"
            ? "These figures are all test data (sample and practice calls), not real enquiries."
            : `These figures include ${m.testCalls} test call${m.testCalls === 1 ? "" : "s"} (sample and practice data). Choose "Live calls" for real enquiries only.`}
        </p>
      )}

      <div className="grid kpis">
        <div className="panel kpi"><div className="n">{m.received}</div><div className="l">Calls received</div></div>
        <div className="panel kpi"><div className="n">{pct(m.answered5, m.received)}</div><div className="l">Answered within 5 minutes ({m.answered5} of {m.received})</div></div>
        <div className="panel kpi"><div className="n">{m.outside}</div><div className="l">Calls outside 10am to 7pm ({pct(m.outside, m.received)})</div></div>
        <div className="panel kpi"><div className="n">{m.booked}</div><div className="l">Consultations booked</div></div>
        <div className="panel kpi"><div className="n">{green}</div><div className="l">Leads handed to designers</div></div>
        <div className="panel kpi"><div className="n">{green ? inr(m.total / green) : "-"}</div><div className="l">Cost per lead handed over{green ? "" : " (no leads yet)"}</div></div>
      </div>

      <h2>Calls by tier</h2>
      <div className="panel">
        <div className="bar" role="img" aria-label={`Calls by tier: ${TIERS.map((t) => `${m.tiers[t.key] ?? 0} ${t.label}`).join(", ")}`}>
          {tierTotal > 0 && TIERS.map((t) => (m.tiers[t.key] ? <i key={t.key} style={{ width: `${((m.tiers[t.key] ?? 0) / tierTotal) * 100}%`, background: t.color }} /> : null))}
        </div>
        <div className="legend">
          {TIERS.map((t) => (
            <div key={t.key}><span style={{ color: t.color }} aria-hidden="true">●</span> {t.label}<div className="v">{m.tiers[t.key] ?? 0}</div></div>
          ))}
        </div>
        {(m.tiers.pending ?? 0) > 0 && <p className="note">{m.tiers.pending} call(s) still being scored.</p>}
        {m.failed > 0 && <p className="banner err">{m.failed} call(s) failed processing and need a look.</p>}
      </div>

      <h2>Run cost</h2>
      <div className="grid">
        <div className="panel kpi"><div className="n">{inr(m.perCall)}</div><div className="l">Per call (voice + AI scoring)</div></div>
        <div className="panel kpi"><div className="n">{inr(m.voice)}</div><div className="l">Voice, total</div></div>
        <div className="panel kpi"><div className="n">{inr(m.ai)}</div><div className="l">AI scoring, total</div></div>
        <div className="panel kpi"><div className="n">{inr(m.total)}</div><div className="l">Everything so far</div></div>
      </div>
      <div className="panel tablewrap scroll" style={{ marginTop: 12 }}>
        <table>
          <caption className="note" style={{ textAlign: "left", padding: "12px 12px 0" }}>Cost by month (India time)</caption>
          <thead><tr><th scope="col">Month</th><th scope="col">Calls</th><th scope="col">Voice</th><th scope="col">AI scoring</th><th scope="col">Total</th><th scope="col">Per call</th></tr></thead>
          <tbody>
            {m.monthly.length === 0 && <tr><td colSpan={6} className="muted">No calls yet.</td></tr>}
            {m.monthly.map((r) => (
              <tr key={r.month} className="num"><td>{r.month}</td><td>{r.calls}</td><td>{inr(r.voice)}</td><td>{inr(r.ai)}</td><td><b>{inr(r.total)}</b></td><td>{inr(r.calls ? r.total / r.calls : 0)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

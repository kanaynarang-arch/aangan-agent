import type { Metadata } from "next";
import Link from "next/link";
import { liveCallCount, pipelineMetrics, standupSummary, type StandupLead } from "@/lib/queries";
import { SourceChips, TierBadge, inr, parseSource, when } from "@/components/ui";

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

function statusWord(l: StandupLead): string {
  if (l.tier === "escalate") return "Urgent callback";
  if (l.tier === "green") return l.consultation_booked ? "Consultation booked" : "Handed to a designer";
  if (l.review_status === "pending") return "Waiting for a designer";
  return l.review_status === "approved" ? "Approved by a designer" : "Decided by a designer";
}

export default async function Pipeline({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const chosen = parseSource((await searchParams).source);
  // Nikhil's numbers are about real calls: default to live as soon as one exists, otherwise show everything.
  const source = chosen ?? ((await liveCallCount()) > 0 ? "live" : "all");
  const [m, day] = await Promise.all([pipelineMetrics(source), standupSummary(source)]);
  const tierTotal = TIERS.reduce((n, t) => n + (m.tiers[t.key] ?? 0), 0);
  const green = m.tiers.green ?? 0;

  return (
    <>
      <h1>Pipeline</h1>
      <p className="sub">For Nikhil&apos;s morning standup: how fast enquiries are answered, what reaches the designers, and what the agent costs. It updates with every call.</p>
      <p className="note">Before the agent: about 48% of enquiries had no reply within 48 hours and about a third arrived outside 10am to 7pm.</p>
      <SourceChips base="/pipeline" source={source} />
      {m.testCalls > 0 && (
        <p className="note" role="note">
          {source === "test"
            ? "These figures are all test data (sample and practice calls), not real enquiries."
            : `These figures include ${m.testCalls} test call${m.testCalls === 1 ? "" : "s"} (sample and practice data). Choose "Live calls" for real enquiries only.`}
        </p>
      )}

      <h2>How fast enquiries get answered</h2>
      <div className="hero">
        <div className="panel">
          <div className="big">{pct(m.answered5, m.received)}</div>
          <div className="what">answered within 5 minutes</div>
          <div className="muted small num">{m.answered5} of {m.received} calls</div>
          <p className="before"><b>Before:</b> about half of all enquiries got no reply within 48 hours, and a reply inside an hour converts about four times better than one the next day.</p>
        </div>
        <div className="panel">
          <div className="big">{m.outside}</div>
          <div className="what">calls answered outside 10am to 7pm</div>
          <div className="muted small num">{pct(m.outside, m.received)} of calls</div>
          <p className="before"><b>Before:</b> about a third of enquiries arrived out of hours, when the two-person front desk was closed and nobody answered.</p>
        </div>
      </div>

      <h2>Since yesterday</h2>
      <section className="panel" aria-label="The last 24 hours">
        <div className="pills" aria-label="Last 24 hours at a glance">
          <span className="pill"><b>{day.calls}</b> {day.calls === 1 ? "call" : "calls"}</span>
          <span className="pill"><b>{day.leads}</b> {day.leads === 1 ? "lead" : "leads"} for designers</span>
          <span className="pill"><b>{day.waiting}</b> waiting for a designer</span>
          <span className="pill"><b>{day.urgent}</b> urgent or callback</span>
          <span className="pill"><b>{day.booked}</b> {day.booked === 1 ? "consultation" : "consultations"} booked</span>
          <span className="pill"><b>{day.afterHours}</b> after hours</span>
        </div>
        {day.recent.length === 0 ? (
          <p className="muted" style={{ margin: "var(--s-3) 0 0" }}>No leads in the last 24 hours.</p>
        ) : (
          <ul className="standup">
            {day.recent.map((l) => (
              <li key={l.id}>
                <Link className="who" href={`/calls/${l.id}`}>{l.fields?.name ?? l.caller_phone ?? "Unknown caller"}</Link>
                <span className="meta">
                  {[l.fields?.scope, l.fields?.location].filter(Boolean).join(" · ") || "Details not captured"} · {when(l.started_at)}
                  {l.outside_hours ? " · after hours" : ""} · {statusWord(l)}
                </span>
                <span className="badges"><TierBadge tier={l.tier} /></span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <h2>What the system generates</h2>
      <div className="grid kpis">
        <div className="panel kpi"><div className="n">{m.received}</div><div className="l">Calls received</div></div>
        <div className="panel kpi"><div className="n">{green}</div><div className="l">Leads handed to designers</div></div>
        <div className="panel kpi"><div className="n">{m.booked}</div><div className="l">Consultations booked</div></div>
        <div className="panel kpi"><div className="n">{green ? inr(m.total / green) : "-"}</div><div className="l">Cost per lead handed over{green ? "" : " (no leads yet)"}</div></div>
      </div>

      <h2>From call to consultation</h2>
      <div className="panel">
        <ol className="funnel">
          <li>
            <div className="what"><b>{m.received}</b><span>Calls answered</span></div>
            <div className="track" aria-hidden="true"><div className="fill" style={{ width: "100%", background: "var(--accent)" }} /></div>
            <div className="conv">{pct(m.answered5, m.received)} answered within 5 minutes</div>
          </li>
          <li>
            <div className="what"><b>{green}</b><span>Became a lead for a designer</span></div>
            <div className="track" aria-hidden="true"><div className="fill" style={{ width: `${m.received ? Math.max(2, (green / m.received) * 100) : 0}%`, background: "var(--green)" }} /></div>
            <div className="conv">{pct(green, m.received)} of calls</div>
          </li>
          <li>
            <div className="what"><b>{m.booked}</b><span>Consultations booked</span></div>
            <div className="track" aria-hidden="true"><div className="fill" style={{ width: `${m.received ? Math.max(m.booked ? 2 : 0, (m.booked / m.received) * 100) : 0}%`, background: "var(--green)", opacity: 0.7 }} /></div>
            <div className="conv">{pct(m.booked, green)} of leads</div>
          </li>
        </ol>
      </div>

      <h2>Calls by tier</h2>
      <div className="panel">
        <div className="bar" role="img" aria-label={`Calls by tier: ${TIERS.map((t) => `${m.tiers[t.key] ?? 0} ${t.label}`).join(", ")}`}>
          {tierTotal > 0 && TIERS.map((t) => (m.tiers[t.key] ? <i key={t.key} style={{ width: `${((m.tiers[t.key] ?? 0) / tierTotal) * 100}%`, background: t.color }} /> : null))}
        </div>
        <div className="legend">
          {TIERS.map((t) => (
            <div key={t.key}><span style={{ color: t.color }} aria-hidden="true">●</span> {t.label}<div className="v">{m.tiers[t.key] ?? 0}<span className="muted small"> {pct(m.tiers[t.key] ?? 0, tierTotal)}</span></div></div>
          ))}
        </div>
        {(m.tiers.pending ?? 0) > 0 && <p className="note">{m.tiers.pending} call(s) still being scored.</p>}
        {m.failed > 0 && <p className="banner err">{m.failed} call(s) failed processing and need a look.</p>}
      </div>

      <h2>What it costs to run</h2>
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
      <p className="note" style={{ marginTop: 16 }}>Phone calls only for now. WhatsApp and the website form could feed this same pipeline, but they are not connected.</p>
    </>
  );
}

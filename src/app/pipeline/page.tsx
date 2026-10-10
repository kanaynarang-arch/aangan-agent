import type { Metadata } from "next";
import Link from "next/link";
import { dailyCalls, hourlyCalls, liveCallCount, pipelineMetrics, standupSummary, type StandupLead } from "@/lib/queries";
import { initials } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { Sparkline } from "@/components/charts/Sparkline";
import { HourChart } from "@/components/charts/HourChart";
import { DayChart } from "@/components/charts/DayChart";
import { SourceSwitch, TierBadge, inr, parseSource, when } from "@/components/ui";

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
  const [m, day, hours, days] = await Promise.all([pipelineMetrics(source), standupSummary(source), hourlyCalls(source), dailyCalls(source, 30)]);
  const tierTotal = TIERS.reduce((n, t) => n + (m.tiers[t.key] ?? 0), 0);
  const green = m.tiers.green ?? 0;
  const answeredPct = m.received ? Math.round((m.answered5 / m.received) * 100) : 0;
  const callsTrend = days.map((d) => d.calls);
  const leadsTrend = days.map((d) => d.leads);

  return (
    <>
      <header className="pagehead">
        <div>
          <p className="eyebrow">For Nikhil&apos;s standup</p>
          <h1>Pipeline</h1>
          <p className="lede">How fast enquiries are answered, what reaches the designers, and what the agent costs. It updates with every call.</p>
        </div>
        <SourceSwitch base="/pipeline" source={source} />
      </header>
      {m.testCalls > 0 && (
        <p className="note" role="note">
          {source === "test"
            ? "These figures are all test data (sample and practice calls), not real enquiries."
            : `These figures include ${m.testCalls} test call${m.testCalls === 1 ? "" : "s"} (sample and practice data). Choose "Live" for real enquiries only.`}
        </p>
      )}

      <div className="hero">
        <div className="card hero-card">
          <p className="eyebrow">Speed to first reply</p>
          <div className="hero-fig num">{pct(m.answered5, m.received)}</div>
          <div className="hero-label">of enquiries answered within 5 minutes</div>
          <div className="meter" role="img" aria-label={`${answeredPct} percent answered within 5 minutes`}><i style={{ width: `${answeredPct}%` }} /></div>
          <div className="muted small num">{m.answered5} of {m.received} calls</div>
          <p className="before"><b>Before the agent:</b> about half of all enquiries got no reply within 48 hours, and a reply inside an hour converts about four times better than one the next day.</p>
        </div>
        <div className="grid g2">
          <div className="card stat">
            <span className="k"><Icon name="phone" />Calls received</span>
            <span className="v num">{m.received}</span>
            <span className="s">Last 30 days, per day</span>
            <Sparkline values={callsTrend} label={`Calls per day over the last 30 days, ${callsTrend.reduce((a, b) => a + b, 0)} in total`} />
          </div>
          <div className="card stat">
            <span className="k"><Icon name="check" />Leads handed over</span>
            <span className="v num">{green}</span>
            <span className="s">{pct(green, m.received)} of calls</span>
            <Sparkline values={leadsTrend} label={`Leads per day over the last 30 days, ${leadsTrend.reduce((a, b) => a + b, 0)} in total`} />
          </div>
          <div className="card stat">
            <span className="k"><Icon name="calendar" />Consultations booked</span>
            <span className="v num">{m.booked}</span>
            <span className="s">{pct(m.booked, green)} of leads</span>
          </div>
          <div className="card stat">
            <span className="k"><Icon name="moon" />Answered after hours</span>
            <span className="v num">{m.outside}</span>
            <span className="s">{pct(m.outside, m.received)} of calls, outside 10am to 7pm</span>
          </div>
        </div>
      </div>

      <section className="section" aria-labelledby="h-hours">
        <div className="card chart-card">
          <header>
            <div>
              <h2 id="h-hours">When enquiries arrive</h2>
              <p>About a third used to land when the two-person front desk was closed and nobody answered. Now the agent picks up every one.</p>
            </div>
            <div className="legend" aria-label="Legend">
              <span><i style={{ background: "var(--accent)" }} />Outside 10am to 7pm</span>
              <span><i style={{ background: "var(--mark-grey)" }} />Front desk open</span>
            </div>
          </header>
          <HourChart data={hours} />
        </div>
      </section>

      <section className="section" aria-labelledby="h-days">
        <div className="card chart-card">
          <header>
            <div>
              <h2 id="h-days">Calls per day, last 30 days</h2>
              <p>The green part of each bar is the share that became a lead for a designer.</p>
            </div>
            <div className="legend" aria-label="Legend">
              <span><i style={{ background: "var(--green)" }} />Became a lead</span>
              <span><i style={{ background: "var(--mark-grey)" }} />Other calls</span>
            </div>
          </header>
          <DayChart data={days} />
        </div>
      </section>

      <section className="section" aria-labelledby="h-standup">
        <header>
          <div>
            <h2 id="h-standup">Since yesterday</h2>
            <p>The last 24 hours, for the morning standup.</p>
          </div>
        </header>
        <div className="card">
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
                  <span className="avatar" aria-hidden="true">{initials(l.fields?.name, l.caller_phone)}</span>
                  <span>
                    <Link className="who" href={`/calls/${l.id}`}>{l.fields?.name ?? l.caller_phone ?? "Unknown caller"}</Link>
                    <span className="meta">
                      {[l.fields?.scope, l.fields?.location].filter(Boolean).join(" · ") || "Details not captured"} · {when(l.started_at)}
                      {l.outside_hours ? " · after hours" : ""} · {statusWord(l)}
                    </span>
                  </span>
                  <span className="badges"><TierBadge tier={l.tier} /></span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="section" aria-labelledby="h-funnel">
        <div className="split">
          <div className="card">
            <h2 id="h-funnel">From call to consultation</h2>
            <ol className="funnel" style={{ marginTop: "var(--s-5)" }}>
              <li>
                <div className="what"><b>{m.received}</b><span>Calls answered</span></div>
                <div className="track" aria-hidden="true"><div className="fill" style={{ width: "100%", background: "var(--mark-grey)" }} /></div>
                <div className="conv">{pct(m.answered5, m.received)} answered within 5 minutes</div>
              </li>
              <li>
                <div className="what"><b>{green}</b><span>Became a lead for a designer</span></div>
                <div className="track" aria-hidden="true"><div className="fill" style={{ width: `${m.received ? Math.max(green ? 2 : 0, (green / m.received) * 100) : 0}%`, background: "var(--green)" }} /></div>
                <div className="conv">{pct(green, m.received)} of calls</div>
              </li>
              <li>
                <div className="what"><b>{m.booked}</b><span>Consultations booked</span></div>
                <div className="track" aria-hidden="true"><div className="fill" style={{ width: `${m.received ? Math.max(m.booked ? 2 : 0, (m.booked / m.received) * 100) : 0}%`, background: "var(--accent)" }} /></div>
                <div className="conv">{pct(m.booked, green)} of leads</div>
              </li>
            </ol>
          </div>
          <div className="card">
            <h2>Calls by tier</h2>
            <div className="tierbar" style={{ marginTop: "var(--s-5)" }} role="img" aria-label={`Calls by tier: ${TIERS.map((t) => `${m.tiers[t.key] ?? 0} ${t.label}`).join(", ")}`}>
              {tierTotal > 0 && TIERS.map((t) => (m.tiers[t.key] ? <i key={t.key} style={{ width: `${((m.tiers[t.key] ?? 0) / tierTotal) * 100}%`, background: t.color }} /> : null))}
            </div>
            <div className="tierlegend">
              {TIERS.map((t) => (
                <div key={t.key}>
                  <span className="small muted"><span style={{ color: t.color }} aria-hidden="true">●</span> {t.label}</span>
                  <div className="v num">{m.tiers[t.key] ?? 0}<span className="muted small"> {pct(m.tiers[t.key] ?? 0, tierTotal)}</span></div>
                </div>
              ))}
            </div>
            {(m.tiers.pending ?? 0) > 0 && <p className="note">{m.tiers.pending} call(s) still being scored.</p>}
            {m.failed > 0 && <p className="banner err">{m.failed} call(s) failed processing and need a look.</p>}
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="h-cost">
        <header>
          <div>
            <h2 id="h-cost">What it costs to run</h2>
            <p>Voice minutes plus the AI that scores each call, in rupees.</p>
          </div>
        </header>
        <div className="grid g4">
          <div className="card stat"><span className="k">Per call</span><span className="v num">{inr(m.perCall)}</span><span className="s">voice and AI scoring</span></div>
          <div className="card stat"><span className="k">Per lead handed over</span><span className="v num">{green ? inr(m.total / green) : "-"}</span><span className="s">{green ? "all costs divided by green leads" : "no leads yet"}</span></div>
          <div className="card stat"><span className="k">Voice, total</span><span className="v num">{inr(m.voice)}</span></div>
          <div className="card stat"><span className="k">AI scoring, total</span><span className="v num">{inr(m.ai)}</span><span className="s">{inr(m.total)} all in</span></div>
        </div>
        <div className="card tablewrap scroll" style={{ marginTop: "var(--s-4)" }}>
          <table>
            <caption className="note" style={{ textAlign: "left", padding: "var(--s-4) var(--s-3) 0" }}>Cost by month (India time)</caption>
            <thead><tr><th scope="col">Month</th><th scope="col">Calls</th><th scope="col">Voice</th><th scope="col">AI scoring</th><th scope="col">Total</th><th scope="col">Per call</th></tr></thead>
            <tbody>
              {m.monthly.length === 0 && <tr><td colSpan={6} className="muted">No calls yet.</td></tr>}
              {m.monthly.map((r) => (
                <tr key={r.month} className="num"><td>{r.month}</td><td>{r.calls}</td><td>{inr(r.voice)}</td><td>{inr(r.ai)}</td><td><b>{inr(r.total)}</b></td><td>{inr(r.calls ? r.total / r.calls : 0)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note" style={{ marginTop: "var(--s-4)" }}>Phone calls only for now. WhatsApp and the website form could feed this same pipeline, but they are not connected.</p>
      </section>
    </>
  );
}

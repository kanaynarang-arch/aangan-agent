import { pipelineMetrics } from "@/lib/queries";
import { SourceChips, inr, parseSource } from "@/components/ui";

export const dynamic = "force-dynamic";

const TIERS: { key: string; label: string; color: string }[] = [
  { key: "green", label: "Green, qualified", color: "var(--green)" },
  { key: "amber", label: "Amber, needs review", color: "var(--amber)" },
  { key: "red", label: "Red, closed politely", color: "var(--red)" },
  { key: "escalate", label: "Escalated complaints", color: "var(--urgent)" },
  { key: "dropped", label: "Dropped calls", color: "var(--grey)" },
];

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "-");

export default async function Pipeline({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const source = parseSource((await searchParams).source);
  const m = await pipelineMetrics(source);
  const tierTotal = TIERS.reduce((n, t) => n + (m.tiers[t.key] ?? 0), 0);

  return (
    <>
      <h1>Pipeline</h1>
      <p className="sub">What the phone agent is handling and what it costs. Updates with every call.</p>
      <SourceChips base="/pipeline" source={source} />

      <div className="grid">
        <div className="panel kpi"><div className="n">{m.received}</div><div className="l">Calls received</div></div>
        <div className="panel kpi"><div className="n">{pct(m.answered5, m.received)}</div><div className="l">Answered within 5 minutes ({m.answered5} of {m.received})</div></div>
        <div className="panel kpi"><div className="n">{m.outside}</div><div className="l">Calls outside 10am to 7pm ({pct(m.outside, m.received)})</div></div>
        <div className="panel kpi"><div className="n">{m.booked}</div><div className="l">Consultations booked</div></div>
      </div>

      <h2>Calls by tier</h2>
      <div className="panel">
        <div className="bar" role="img" aria-label="Share of calls by tier">
          {TIERS.map((t) => (m.tiers[t.key] ? <i key={t.key} style={{ width: `${((m.tiers[t.key] ?? 0) / tierTotal) * 100}%`, background: t.color }} /> : null))}
        </div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
          {TIERS.map((t) => (
            <div key={t.key}><span style={{ color: t.color }}>●</span> {t.label}<div style={{ fontSize: 24, fontWeight: 700 }}>{m.tiers[t.key] ?? 0}</div></div>
          ))}
        </div>
        {(m.tiers.pending ?? 0) > 0 && <p className="muted small">{m.tiers.pending} call(s) still being scored.</p>}
        {m.failed > 0 && <p className="small" style={{ color: "var(--red)" }}>{m.failed} call(s) failed processing and need a look.</p>}
      </div>

      <h2>Run cost</h2>
      <div className="grid">
        <div className="panel kpi"><div className="n">{inr(m.perCall)}</div><div className="l">Per call (voice + AI scoring)</div></div>
        <div className="panel kpi"><div className="n">{inr(m.voice)}</div><div className="l">Voice, total</div></div>
        <div className="panel kpi"><div className="n">{inr(m.ai)}</div><div className="l">AI scoring, total</div></div>
        <div className="panel kpi"><div className="n">{inr(m.total)}</div><div className="l">Everything so far</div></div>
      </div>
      <div className="panel scroll" style={{ padding: 0, marginTop: 12 }}>
        <table>
          <thead><tr><th>Month</th><th>Calls</th><th>Voice</th><th>AI scoring</th><th>Total</th><th>Per call</th></tr></thead>
          <tbody>
            {m.monthly.length === 0 && <tr><td colSpan={6} className="muted" style={{ padding: 20 }}>No calls yet.</td></tr>}
            {m.monthly.map((r) => (
              <tr key={r.month}><td>{r.month}</td><td>{r.calls}</td><td>{inr(r.voice)}</td><td>{inr(r.ai)}</td><td><b>{inr(r.total)}</b></td><td>{inr(r.calls ? r.total / r.calls : 0)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

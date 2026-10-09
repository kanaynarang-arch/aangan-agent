import Link from "next/link";
import { notFound } from "next/navigation";
import { getCall } from "@/lib/queries";
import { reviewCall } from "@/app/actions";
import { TierBadge, inr, when } from "@/components/ui";

export const dynamic = "force-dynamic";

const CRIT: Record<string, string> = {
  real_project: "1. Real project", service_area: "2. Service area", timeline: "3. Timeline", budget: "4. Budget", decision_maker: "5. Decision-maker",
};
const STATUS_COLOR: Record<string, string> = { met: "var(--green)", unclear: "var(--amber)", failed: "var(--red)" };

export default async function CallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getCall(id);
  if (!data) notFound();
  const { call: c, actions, runs } = data;
  const f = (c.fields ?? {}) as Record<string, any>;
  const flags = (c.flags ?? {}) as Record<string, any>;
  const criteria = (c.criteria ?? null) as Record<string, { status: string; reason: string }> | null;
  const reasons = (c.reasons ?? []) as string[];
  const uncertain = (c.uncertain ?? []) as string[];
  const fieldRows: [string, unknown][] = [
    ["Name", f.name], ["Phone", c.caller_phone ?? f.phone], ["Project type", f.project_type], ["Space", f.business_type],
    ["Location", f.location], ["Carpet area", f.carpet_area_sqft ? `${f.carpet_area_sqft} sq ft` : null], ["Scope", f.scope],
    ["Timeline", f.timeline], ["Decision-maker", f.decision_maker], ["Preferred consultation", f.preferred_consultation],
    ["Asked about price", c.fields ? (f.asked_about_price ? "Yes" : "No") : null], ["Volunteered budget", f.volunteered_budget],
  ];

  return (
    <>
      <p style={{ marginTop: 18 }}><Link href="/" className="muted">← All calls</Link></p>
      <h1>
        {f.name ?? c.caller_phone ?? "Unknown caller"} <TierBadge tier={c.tier} />
        {c.source === "test" && <span className="tag">test{c.fixture_id ? ` ${c.fixture_id}` : ""}</span>}
      </h1>
      <p className="sub">{when(c.started_at)} · {Math.floor(c.duration_seconds / 60)}m {c.duration_seconds % 60}s · {c.outcome ?? c.status}</p>
      {c.error && <p style={{ color: "var(--red)" }}>Error: {c.error}</p>}

      {(flags.asked_about_price || flags.handle_with_care || flags.repeat_caller) && (
        <div className="chips">
          {flags.asked_about_price && <span className="tag flag">Asked about price (no figure quoted)</span>}
          {flags.handle_with_care && <span className="tag flag">Handle with care: {flags.handle_with_care}</span>}
          {flags.repeat_caller && <span className="tag">Repeat caller</span>}
        </div>
      )}

      {c.review_status === "pending" && (
        <div className="panel" style={{ margin: "12px 0", borderColor: "var(--amber)" }}>
          <b>{c.tier === "red" ? "Logged for a designer to check before it is dropped." : "Needs a designer's decision."}</b>
          <div className="muted small">Approve runs the same handoff as a green lead (HubSpot, consultation booking, Telegram). Drop closes it.</div>
          <form action={reviewCall} className="btns">
            <input type="hidden" name="id" value={c.id} />
            <button className="b primary" name="decision" value="approve">Approve and hand off</button>
            <button className="b" name="decision" value="drop">Drop lead</button>
          </form>
        </div>
      )}

      <div className="panel" style={{ margin: "12px 0" }}>
        <h2 style={{ marginTop: 0 }}>Handoff note</h2>
        <p style={{ margin: 0 }}>{c.handoff_summary ?? "Not scored yet."}</p>
        {uncertain.length > 0 && (<><h2>Uncertain, please check</h2><ul className="clean">{uncertain.map((u, i) => <li key={i}>{u}</li>)}</ul></>)}
      </div>

      <div className="two">
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>Extracted fields</h2>
          <dl>{fieldRows.map(([k, v]) => (<><dt key={`k${k}`}>{k}</dt><dd key={`v${k}`}>{v == null || v === "" ? <span className="muted">-</span> : String(v)}</dd></>))}</dl>
        </div>
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>Rubric</h2>
          {criteria && c.tier !== "escalate" ? (
            <dl>{Object.entries(criteria).map(([k, v]) => (<><dt key={`k${k}`}>{CRIT[k] ?? k}</dt><dd key={`v${k}`}><b style={{ color: STATUS_COLOR[v.status] }}>{v.status}</b> <span className="muted small">{v.reason}</span></dd></>))}</dl>
          ) : <p className="muted">Not scored ({c.tier === "escalate" ? "existing-client complaint skips scoring" : "no details to score"}).</p>}
          {reasons.length > 0 && (<><h2>Why this tier</h2><ul className="clean">{reasons.map((r, i) => <li key={i}>{r}</li>)}</ul></>)}
        </div>
      </div>

      <div className="two" style={{ marginTop: 16 }}>
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>What happened next</h2>
          {actions.length === 0 ? <p className="muted">Nothing sent.</p> : (
            <ul className="clean">
              {actions.map((a: any) => (
                <li key={a.id}>
                  <b>{a.channel}</b> <span className="tag">{String(a.status).replace("_", " ")}</span>
                  {a.detail?.kind && <span className="muted small"> {String(a.detail.kind).replace("_", " ")}</span>}
                  {a.detail?.error && <div className="small" style={{ color: "var(--red)" }}>{String(a.detail.error)}</div>}
                  {a.detail?.preview && typeof a.detail.preview === "string" && <details><summary className="small muted">Message</summary><pre className="tx small">{a.detail.preview}</pre></details>}
                </li>
              ))}
            </ul>
          )}
          {c.tier === "red" && <p className="muted small">Red leads are never sent to HubSpot.</p>}
        </div>
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>Cost of this call</h2>
          <dl>
            <dt>Voice</dt><dd>{inr(Number(c.voice_cost_inr), 4)}</dd>
            <dt>Scoring (AI)</dt><dd>{inr(Number(c.ai_cost_inr), 4)}{runs[0] && <span className="muted small"> {runs[0].model}, {runs[0].input_tokens} in / {runs[0].output_tokens} out tokens</span>}</dd>
            <dt>Total</dt><dd><b>{inr(Number(c.voice_cost_inr) + Number(c.ai_cost_inr), 4)}</b></dd>
          </dl>
          {c.recording_url && <p><a href={c.recording_url} target="_blank" rel="noreferrer">Recording</a></p>}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Transcript</h2>
        {c.transcript ? <pre className="tx">{c.transcript}</pre> : <p className="muted">No transcript: nothing was captured for this call.</p>}
      </div>
    </>
  );
}

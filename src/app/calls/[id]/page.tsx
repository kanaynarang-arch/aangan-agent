import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCall, type ActionRecord, type CallRecord } from "@/lib/queries";
import { dashboardUrl } from "@/lib/pipeline";
import { noteForLead } from "@/lib/messages";
import type { Lead } from "@/lib/integrations/types";
import { CopyNote } from "@/components/CopyNote";
import { ReviewPanel } from "@/components/ReviewPanel";
import { TierBadge, actionWords, duration, inr, whenFull } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Call detail" };

const CRIT: Record<string, string> = {
  real_project: "1. Real project", service_area: "2. Service area", timeline: "3. Timeline", budget: "4. Budget", decision_maker: "5. Decision-maker",
};
const STATUS_WORD: Record<string, string> = { met: "Met", unclear: "Unclear", failed: "Failed" };
const STATUS_COLOR: Record<string, string> = { met: "var(--green)", unclear: "var(--amber)", failed: "var(--red)" };
const TIER_NOUN: Record<string, string> = { green: "green", amber: "amber", red: "red", escalate: "escalated", dropped: "dropped" };

/** Plain-words booking status for the summary card, also used in the copyable note. */
function bookingFor(c: CallRecord, actions: ActionRecord[]): { text: string; note: string | null } {
  const cal = actions.find((a) => a.channel === "calcom");
  if (c.consultation_booked) {
    const when = c.consultation_at ? whenFull(c.consultation_at) : "a time to be confirmed";
    return { text: `Booked for ${when}`, note: `booked for ${when}` };
  }
  if (cal?.status === "failed") return { text: "Not booked: schedule it by hand", note: "NOT booked: please schedule manually" };
  if (cal?.status === "skipped_test") return { text: `Not booked (test call). Preferred: ${c.fields?.preferred_consultation ?? "not given"}`, note: null };
  if (cal?.status === "dry_run") return { text: "Not booked (integrations are off)", note: null };
  if (c.tier === "green" || c.review_status === "approved") return { text: "Not booked yet", note: null };
  return { text: "No booking: not a green lead", note: null };
}

function leadFrom(c: CallRecord): Lead {
  const flags = c.flags ?? {};
  return {
    callId: c.id, phone: c.caller_phone, tier: c.tier ?? "amber", fields: c.fields, summary: c.handoff_summary ?? "",
    reasons: c.reasons ?? [], uncertain: c.uncertain ?? [], askedAboutPrice: Boolean(flags.asked_about_price),
    handleWithCare: flags.handle_with_care ?? null, repeatCaller: Boolean(flags.repeat_caller), recordingUrl: c.recording_url,
    durationSeconds: c.duration_seconds, dashboardUrl: dashboardUrl(c.id),
  };
}

export default async function CallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getCall(id);
  if (!data) notFound();
  const { call: c, actions, runs } = data;
  const f = c.fields;
  const flags = c.flags ?? {};
  const reasons = c.reasons ?? [];
  const uncertain = c.uncertain ?? [];
  const scored = c.status === "processed" && c.tier;
  const booking = bookingFor(c, actions);
  const note = scored ? noteForLead(leadFrom(c), booking.note) : null;
  const name = f?.name ?? c.caller_phone ?? "Unknown caller";

  const fieldRows: [string, string | null][] = [
    ["Name", f?.name ?? null], ["Phone", c.caller_phone ?? f?.phone ?? null], ["Project type", f?.project_type ?? null], ["Space", f?.business_type ?? null],
    ["Location", f?.location ?? null], ["Carpet area", f?.carpet_area_sqft ? `${f.carpet_area_sqft.toLocaleString("en-IN")} sq ft` : null],
    ["Scope", f?.scope ?? null], ["Timeline", f?.timeline ?? null], ["Decision-maker", f?.decision_maker ?? null],
    ["Preferred consultation", f?.preferred_consultation ?? null], ["Asked about price", f ? (f.asked_about_price ? "Yes" : "No") : null],
    ["Volunteered budget", f?.volunteered_budget ?? null],
  ];
  const decided = c.review_status === "approved" ? "approved and handed off" : c.review_status === "dropped" ? "dropped" : null;

  return (
    <>
      <Link href="/" className="back">← All calls</Link>
      <h1>{name}</h1>
      <p className="sub num">
        {whenFull(c.started_at)} · {duration(c.duration_seconds)} ·{" "}
        <span className={`tag${c.source === "live" ? " live" : ""}`}>{c.source === "live" ? "Live call" : `Test call${c.fixture_id ? ` ${c.fixture_id}` : ""}`}</span>
      </p>
      {c.error && <p className="banner err" role="alert">This call could not be processed: {c.error}</p>}
      {c.status !== "processed" && !c.error && <p className="banner warn" role="status">Still being processed. Refresh in a minute.</p>}

      <section className="panel summary" aria-label="Summary">
        <div className="head">
          <TierBadge tier={c.tier} large />
          <b>{c.outcome ?? (c.status === "processed" ? "Done" : "Processing")}</b>
        </div>

        {reasons.length > 0 && (
          <>
            <h3 style={{ marginBottom: 0 }}>Why {c.tier ? TIER_NOUN[c.tier] : "this tier"}</h3>
            <ul className="why">{reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
          </>
        )}

        <p className="handoff">{c.handoff_summary ?? "Not scored yet."}</p>

        <dl className="facts">
          <div><dt>Consultation</dt><dd>{booking.text}</dd></div>
          <div>
            <dt>Flags</dt>
            <dd>
              {!flags.asked_about_price && !flags.handle_with_care && !flags.repeat_caller && <span className="muted">None</span>}
              <span className="tags">
                {flags.asked_about_price && <span className="tag flag">Asked about price (no figure quoted)</span>}
                {flags.handle_with_care && <span className="tag flag">Handle with care: {flags.handle_with_care}</span>}
                {flags.repeat_caller && <span className="tag">Repeat caller</span>}
              </span>
            </dd>
          </div>
        </dl>

        {uncertain.length > 0 && (
          <>
            <h3 style={{ marginBottom: 0 }}>Please check</h3>
            <ul className="why">{uncertain.map((u, i) => <li key={i}>{u}</li>)}</ul>
          </>
        )}

        {note && <div style={{ marginTop: "var(--s-4)" }}><CopyNote text={note} /></div>}
      </section>

      {(c.tier === "amber" || c.tier === "red") && (c.review_status === "pending" || decided) && (
        <ReviewPanel id={c.id} pending={c.review_status === "pending"} tier={c.tier} decided={decided} />
      )}

      <div className="two">
        <section className="panel" aria-label="Extracted fields">
          <h2>What the caller told us</h2>
          <dl className="kv">
            {fieldRows.map(([k, v]) => (
              <div key={k} style={{ display: "contents" }}>
                <dt>{k}</dt>
                <dd>{v ? v : <span className="muted">Not captured</span>}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="panel" aria-label="Rubric">
          <h2>Founder&apos;s rubric</h2>
          {c.criteria && c.tier !== "escalate" ? (
            <dl className="kv">
              {/* Postgres returns JSON keys in its own order, so list the five criteria in rubric order. */}
              {Object.keys(CRIT).filter((k) => c.criteria?.[k]).map((k) => {
                const v = c.criteria![k];
                return (
                  <div key={k} style={{ display: "contents" }}>
                    <dt>{CRIT[k]}</dt>
                    <dd><b style={{ color: STATUS_COLOR[v.status] }}>{STATUS_WORD[v.status] ?? v.status}</b> <span className="muted small">{v.reason}</span></dd>
                  </div>
                );
              })}
            </dl>
          ) : (
            <p className="muted">Not scored: {c.tier === "escalate" ? "an existing-client complaint skips scoring" : "there was nothing to score"}.</p>
          )}
        </section>
      </div>

      <div className="two">
        <section className="panel" aria-label="What happened next">
          <h2>What happened next</h2>
          {actions.length === 0 ? (
            <p className="muted">Nothing was sent.</p>
          ) : (
            <ul className="status-list">
              {actions.map((a) => {
                const w = actionWords(a);
                return (
                  <li key={a.id}>
                    <b>{w.service}</b>
                    <span style={{ color: w.tone === "err" ? "var(--red)" : w.tone === "ok" ? "var(--green)" : "var(--muted)" }}>{w.word}</span>
                  </li>
                );
              })}
            </ul>
          )}
          {c.tier === "red" && <p className="muted small">Red leads are never sent to HubSpot.</p>}
        </section>

        <section className="panel" aria-label="Cost">
          <h2>Cost of this call</h2>
          <dl className="kv num">
            <dt>Voice</dt><dd>{inr(Number(c.voice_cost_inr), 2)}</dd>
            <dt>AI scoring</dt><dd>{inr(Number(c.ai_cost_inr), 2)}{runs[0] && <span className="muted small"> · {runs[0].model}</span>}</dd>
            <dt>Total</dt><dd><b>{inr(Number(c.voice_cost_inr) + Number(c.ai_cost_inr), 2)}</b></dd>
          </dl>
        </section>
      </div>

      <section className="panel" style={{ marginTop: "var(--s-4)" }} aria-label="Transcript and recording">
        <h2>Transcript and recording</h2>
        {c.recording_url ? <p><a href={c.recording_url} target="_blank" rel="noreferrer">Open the recording</a></p> : <p className="muted small">No recording for this call.</p>}
        {c.transcript ? <pre className="tx">{c.transcript}</pre> : <p className="muted">No transcript: nothing was captured for this call.</p>}
      </section>
    </>
  );
}

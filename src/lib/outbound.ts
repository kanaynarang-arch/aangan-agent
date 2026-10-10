import { query } from "./db";
import { dashboardUrl, processCall } from "./pipeline";
import { callbackProblemMessage } from "./messages";
import { sendTelegram } from "./integrations/telegram";
import { modeFor, type Lead } from "./integrations/types";
import type { VaniCall } from "./vani";
import { captureSummary } from "./capture";
import { buildCallbackPrompt, callbackGreeting, type CallbackBrief, type CallbackReason } from "./callback-prompt";
import { isOutsideHours } from "./time";
import type { CallRecord } from "./queries";

const BASE = "https://api.vaanivoice.ai/api";
export const MAX_CALLBACKS_PER_CALL = 2;
/** A callback that is still ringing or in conversation blocks another one for this long. */
export const COOLDOWN_MINUTES = 15;

export type CallbackMode = "browser" | "phone";
export interface PriorAttempt { status: string; created_at: string }
export type Eligibility = { ok: true; reason: CallbackReason; phone: string | null } | { ok: false; why: string };

/**
 * Live calls are rung for real when phone callbacks are switched on. Test calls always use the browser rehearsal, because their
 * numbers are made up and a rehearsal rings nobody. With the switch off, everything uses the browser.
 */
export const callbackMode = (source: "live" | "test", env: Record<string, string | undefined> = process.env): CallbackMode =>
  env.VANI_PHONE_CALLBACKS === "true" && source === "live" ? "phone" : "browser";
const DAILY_CAP = 20;

/** "9000000101", "+91 90000 00101", "09000000101" to "+919000000101". Anything else is rejected, never guessed. */
export function toE164(phone: string | null | undefined): string | null {
  const raw = (phone ?? "").trim();
  const d = raw.replace(/\D/g, "");
  if (d.length === 10) return `+91${d}`;
  if (d.length === 11 && d.startsWith("0")) return `+91${d.slice(1)}`;
  if (d.length === 12 && d.startsWith("91")) return `+${d}`;
  if (raw.startsWith("+") && d.length >= 8 && d.length <= 15) return `+${d}`;
  return null;
}

/**
 * Whether the agent may make this callback. A callback exists to turn a dropped call into a lead, so it is only for dropped calls
 * that nobody has followed up. It never rings someone who is already a lead, an unhappy existing client (a senior person calls those),
 * or a call that was itself a callback. Phone mode adds the rules that protect a real person: live callers only, a dialable number,
 * 10am to 7pm India time, no double ringing.
 */
export function callbackEligibility(
  c: Pick<CallRecord, "source" | "tier" | "status" | "caller_phone" | "fields"> & { callback_of?: string | null },
  prior: PriorAttempt[],
  now: Date,
  mode: CallbackMode = "browser",
): Eligibility {
  if (c.status !== "processed" || !c.tier) return { ok: false, why: "This call is still being processed." };
  if (c.callback_of) return { ok: false, why: "This call is itself a callback, so it is not rung again." };
  if (c.tier === "escalate") return { ok: false, why: "An unhappy existing client should hear from a senior person, not the agent." };
  if (c.tier !== "dropped") return { ok: false, why: "This call already produced a lead, so there is nothing to call back for." };
  const reason: CallbackReason = "dropped";
  if (mode === "browser") return { ok: true, reason, phone: toE164(c.caller_phone) };

  if (c.source !== "live") return { ok: false, why: "Test calls are not rung, because their phone numbers are made up." };
  const phone = toE164(c.caller_phone);
  if (!phone) return { ok: false, why: "There is no phone number that can be dialled." };
  if (isOutsideHours(now)) return { ok: false, why: "Callbacks are only placed between 10am and 7pm India time, so nobody is rung at night." };
  if (prior.length >= MAX_CALLBACKS_PER_CALL) return { ok: false, why: `Vani has already tried ${MAX_CALLBACKS_PER_CALL} times. A designer should call this person.` };
  const recent = prior.find((p) => p.status !== "failed" && now.getTime() - new Date(p.created_at).getTime() < COOLDOWN_MINUTES * 60_000);
  if (recent) return { ok: false, why: "Vani rang this person a moment ago. Wait for that call to finish." };
  return { ok: true, reason, phone };
}

/** Turns the stored lead into what the callback agent is told: what is known, and what is left to ask. */
export function briefFor(c: Pick<CallRecord, "fields" | "caller_phone">, reason: CallbackReason): CallbackBrief {
  const cap = captureSummary(c.fields, c.caller_phone);
  const phrase: Record<string, string> = {
    "ask: name": "their name", "ask: phone number": "their phone number (read it back)", "ask: home or commercial": "whether the project is a home or commercial",
    "ask: location": "where the property is (area and city)", "ask: carpet area": "roughly how big it is in carpet area",
    "ask: what they want done": "which rooms or spaces they want done, and whether they want design with execution",
    "ask: when they need it": "when they would like the project ready or work to start", "ask: who decides": "who will take the decision, and whether they will join the consultation",
    "ask: preferred consultation time": "which day and time suit them for a free consultation",
  };
  return {
    name: c.fields?.name?.trim() || null,
    reason,
    known: cap.asked.filter((a) => a.label !== "Phone number").map((a) => `${a.label}: ${a.value}`),
    missing: cap.toCover.map((t) => phrase[t.toLowerCase()]).filter(Boolean),
  };
}

export type StartResult =
  | { ok: false; message: string }
  | { ok: true; mode: "phone"; message: string }
  | { ok: true; mode: "browser"; message: string; session: { token: string; url: string; room: string } };

/** What the agent says and how long it may talk, sent to Vani for this one call only. */
function overrides(brief: CallbackBrief) {
  return {
    persona: { identity: { system_prompt: buildCallbackPrompt(brief), greeting_message: { agent_message: callbackGreeting(brief), interruptible: true, let_user_speak_first: false } } },
    experience: { settings: { call_settings: { max_call_duration: 4, max_duration_enabled: true } } },
  };
}

/** Starts the callback. The attempt is recorded first, so a double click or a retry cannot start two. */
export async function startCallback(callId: string, now = new Date()): Promise<StartResult> {
  const key = process.env.VANI_API_KEY, agent = process.env.VANI_AGENT_ID;
  if (!key || !agent) return { ok: false, message: "Calling is not set up on this server yet." };
  const rows = await query<CallRecord>("select * from calls where id = $1", [callId]);
  const c = rows[0];
  if (!c) return { ok: false, message: "That call no longer exists." };
  const mode = callbackMode(c.source);
  const prior = await query<PriorAttempt>("select status, created_at from outbound_calls where call_id = $1", [callId]);
  const e = callbackEligibility(c, prior, now, mode);
  if (!e.ok) return { ok: false, message: e.why };
  // The dashboard has no login, so cap what anyone with the link can spend on voice minutes in a day.
  const [today] = await query<{ n: string }>("select count(*) as n from outbound_calls where created_at > now() - interval '24 hours'");
  if (Number(today.n) >= DAILY_CAP) return { ok: false, message: `The daily limit of ${DAILY_CAP} callbacks has been reached. Try again tomorrow.` };
  const brief = briefFor(c, e.reason);

  // The cooldown is checked inside the insert itself, so two requests at the same instant (a double click, or the automatic
  // callback and the morning sweep) cannot both ring a real person.
  const guard = mode === "phone"
    ? `where not exists (select 1 from outbound_calls where call_id = $1::uuid and status <> 'failed' and created_at > now() - interval '${COOLDOWN_MINUTES} minutes')`
    : "";
  const [row] = await query<{ id: string }>(
    `insert into outbound_calls (call_id, mode, to_phone, reason) select $1::uuid, $2::text, $3::text, $4::text ${guard} returning id`,
    [callId, mode, e.phone, e.reason],
  );
  if (!row) return { ok: false, message: "Vani rang this person a moment ago. Wait for that call to finish." };
  const fail = async (error: string, message: string) => {
    await query("update outbound_calls set status = 'failed', error = $2 where id = $1", [row.id, error.slice(0, 300)]);
    if (mode === "phone") await tellDesigners(callId, "failed", message);
    return { ok: false as const, message };
  };

  try {
    const body = mode === "phone"
      ? { agent_id: agent, medium: "telephony", contact_number: e.phone, name: brief.name ?? "Aangan enquiry", dnd_check_skipped: false, modify_agent: overrides(brief) }
      : { agent_id: agent, medium: "webrtc", primary_language: "en", secondary_language: "hi", welcome_message: callbackGreeting(brief), welcome_interruptible: true, modify_agent: overrides(brief) };
    const res = await fetch(`${BASE}/trigger-call/`, {
      method: "POST", headers: { "X-API-Key": key, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    type Out = { call_id?: string; token?: string; room_name?: string; connection_url?: string };
    let json: { success?: boolean; message?: string; detail?: string; output?: Out } & Out = {};
    try { json = JSON.parse(text); } catch { /* not json */ }
    const out: Out = json.output ?? json;
    const vaniId = out.call_id ?? out.room_name;
    if (!res.ok || json.success === false || !vaniId) {
      const detail = String(json.message ?? json.detail ?? text.slice(0, 200));
      if (res.status === 401) return fail(`401 ${detail}`, "Vani rejected the API key. It may have expired: create a new one in Vani and update it here.");
      return fail(`${res.status} ${detail}`, `Vani could not start the call: ${detail.slice(0, 160)}`);
    }
    await query("update outbound_calls set vani_call_id = $2 where id = $1", [row.id, vaniId]);
    if (mode === "phone") return { ok: true, mode, message: `Vani is ringing ${e.phone} now. The conversation will appear on this page when it ends.` };
    if (!out.token || !out.connection_url) return fail("webrtc response had no token", "Vani did not return a session to join. Please try again.");
    return { ok: true, mode, message: "Connected. Vani will speak first, as it would on the lead's phone.", session: { token: out.token, url: out.connection_url, room: vaniId } };
  } catch (err) {
    return fail((err as Error).message, "Could not reach Vani. Nothing was started. Please try again.");
  }
}

/**
 * A real callback did not produce a lead, so tell the designers' group to ring the number themselves. Live calls only,
 * and it must never break the callback flow itself.
 */
export async function tellDesigners(callId: string, kind: "failed" | "unanswered", detail?: string): Promise<void> {
  try {
    const [c] = await query<{ source: "live" | "test"; caller_phone: string | null; duration_seconds: number }>("select source, caller_phone, duration_seconds from calls where id = $1", [callId]);
    if (!c || c.source !== "live") return;
    const lead: Lead = {
      callId, phone: c.caller_phone, tier: "dropped", fields: null, summary: "", reasons: [], uncertain: [], askedAboutPrice: false,
      handleWithCare: null, repeatCaller: false, recordingUrl: null, durationSeconds: c.duration_seconds, dashboardUrl: dashboardUrl(callId),
    };
    const r = await sendTelegram(modeFor(c.source), callbackProblemMessage(lead, kind, detail), `callback_${kind}`);
    await query("insert into actions (call_id, channel, status, detail, external_id) values ($1,'telegram',$2,$3,$4)", [callId, r.status, JSON.stringify(r.detail), r.externalId ?? null]);
  } catch (e) {
    console.error("could not tell designers about the callback", callId, (e as Error).message);
  }
}

interface OutboundRow { id: string; call_id: string; mode: CallbackMode; to_phone: string | null }

/**
 * The callback's conversation becomes a new call, linked to the dropped one, and goes through the normal pipeline: scored, tiered and
 * routed like any enquiry. A browser rehearsal is always test data, even on a live lead, so no real person's number or details
 * can reach HubSpot, Telegram or Cal.com from someone playing the caller.
 */
export async function createLeadFromCallback(cb: OutboundRow, call: VaniCall): Promise<string | null> {
  if (!call.transcript || !call.vaniCallId) {
    // Nobody spoke: a real callback that reached no one needs a person.
    if (cb.mode === "phone") await tellDesigners(cb.call_id, "unanswered");
    return null;
  }
  const [orig] = await query<{ source: "live" | "test"; caller_phone: string | null }>("select source, caller_phone from calls where id = $1", [cb.call_id]);
  if (!orig) return null;
  const source = cb.mode === "phone" ? orig.source : "test";
  const phone = cb.mode === "phone" || orig.source === "test" ? orig.caller_phone : null;
  const rows = await query<{ id: string }>(
    `insert into calls (source, vani_call_id, caller_phone, started_at, duration_seconds, recording_url, transcript, outside_hours, callback_of)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict (vani_call_id) do nothing returning id`,
    [source, `callback:${cb.id}`, phone, call.startedAt.toISOString(), call.durationSeconds, call.recordingUrl, call.transcript, isOutsideHours(call.startedAt), cb.call_id],
  );
  if (!rows.length) return null;
  await query("update outbound_calls set lead_call_id = $2 where id = $1", [cb.id, rows[0].id]);
  await processCall(rows[0].id);
  return rows[0].id;
}

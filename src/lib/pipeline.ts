import { RULES, type Tier } from "./rules";
import { query } from "./db";
import { voiceCostInr } from "./cost";
import { runGemini } from "./scoring/gemini";
import { decide } from "./scoring/decide";
import { isDroppedCall } from "./scoring/dropped";
import type { ScoreOutput } from "./scoring/schema";
import { droppedMessage, escalationMessage, handoffMessage, reviewMessage } from "./messages";
import { sendTelegram } from "./integrations/telegram";
import { createContactAndDeal } from "./integrations/hubspot";
import { bookConsultation } from "./integrations/calcom";
import { callDateLabel, isOutsideHours } from "./time";
import { modeFor, type ActionResult, type Lead, type Mode } from "./integrations/types";

export interface CallRow {
  id: string;
  source: "live" | "test";
  caller_phone: string | null;
  started_at: string;
  duration_seconds: number;
  recording_url: string | null;
  transcript: string | null;
  fields: ScoreOutput["fields"] | null;
  tier: Tier | null;
  handoff_summary: string | null;
  uncertain: string[] | null;
  reasons: string[] | null;
  flags: { asked_about_price?: boolean; handle_with_care?: string | null; repeat_caller?: boolean } | null;
  review_status: string;
}


async function logAction(callId: string, a: ActionResult) {
  await query("insert into actions (call_id, channel, status, detail, external_id) values ($1,$2,$3,$4,$5)", [
    callId, a.channel, a.status, JSON.stringify(a.detail), a.externalId ?? null,
  ]);
}

function dashboardUrl(callId: string): string {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const base = process.env.APP_URL ?? (vercel ? `https://${vercel}` : "");
  return `${base}/calls/${callId}`;
}

/** Turn a stored call into scored, routed output. Safe to call twice: processed calls are skipped. */
export async function processCall(callId: string, opts: { force?: boolean } = {}): Promise<void> {
  const rows = await query<CallRow & { status: string; fixture_id: string | null }>("select * from calls where id = $1", [callId]);
  const call = rows[0];
  if (!call) throw new Error(`call ${callId} not found`);
  if (call.status === "processed" && !opts.force) return;
  await query("update calls set status = 'processing', error = null where id = $1", [callId]);

  try {
    const started = new Date(call.started_at);
    // Offline fixtures spend no Vani minutes, so they carry no voice cost.
    const voiceCost = call.fixture_id ? 0 : voiceCostInr(call.duration_seconds);
    const mode = modeFor(call.source);
    let result: ResultShape;

    if (isDroppedCall(call.transcript, call.duration_seconds)) {
      result = {
        tier: "dropped",
        callType: "dropped",
        outcome: "Callback needed",
        summary: "Very short call with no qualifying details. Call the number back.",
        fields: null, criteria: null, reasons: ["Call too short or empty to qualify."], uncertain: [], aiTier: null,
        aiCost: 0, aiRun: null,
      };
    } else {
      const run = await runGemini({ transcript: call.transcript!, callDate: callDateLabel(started), durationSeconds: call.duration_seconds });
      const d = decide(run.output);
      result = {
        tier: d.tier,
        callType: d.tier === "escalate" ? "escalation" : "enquiry",
        outcome: outcomeFor(d.tier),
        summary: run.output.handoff_summary,
        fields: run.output.fields,
        criteria: d.criteria,
        reasons: d.reasons,
        uncertain: d.uncertain,
        aiTier: d.aiTier,
        aiCost: run.costInr,
        aiRun: run,
        handleWithCare: run.output.flags.handle_with_care ? run.output.flags.handle_with_care_reason ?? "Caller frustrated or let down earlier." : null,
      };
    }

    const phone = normalisePhone(call.caller_phone ?? result.fields?.phone ?? null);
    // Caller history lives in the calls table: same number, same source, earlier call.
    const prior = phone
      ? await query("select 1 from calls where caller_phone = $1 and source = $2 and id <> $3 and status = 'processed' and started_at < $4 limit 1", [phone, call.source, callId, call.started_at])
      : [];
    const repeat = prior.length > 0;
    const askedPrice = Boolean(result.fields?.asked_about_price);
    const flags = { asked_about_price: askedPrice, handle_with_care: result.handleWithCare ?? null, repeat_caller: repeat };

    const lead: Lead = {
      callId, phone, tier: result.tier, fields: result.fields, summary: result.summary, reasons: result.reasons, uncertain: result.uncertain,
      askedAboutPrice: askedPrice, handleWithCare: result.handleWithCare ?? null, repeatCaller: repeat,
      recordingUrl: call.recording_url, durationSeconds: call.duration_seconds, dashboardUrl: dashboardUrl(callId),
    };

    await query("delete from actions where call_id = $1", [callId]);
    await query("delete from ai_runs where call_id = $1", [callId]);
    if (result.aiRun) {
      await query("insert into ai_runs (call_id, model, input_tokens, output_tokens, cost_inr, latency_ms) values ($1,$2,$3,$4,$5,$6)", [
        callId, result.aiRun.model, result.aiRun.inputTokens, result.aiRun.outputTokens, result.aiRun.costInr, result.aiRun.latencyMs,
      ]);
    }

    const out = await route(mode, lead, callId);
    const review = result.tier === "amber" || result.tier === "red" ? "pending" : "none";

    await query(
      `update calls set status = 'processed', processed_at = now(), caller_phone = $2, call_type = $3, tier = $4, ai_tier = $5,
         outcome = $6, review_status = $7, fields = $8, criteria = $9, reasons = $10, uncertain = $11, flags = $12,
         handoff_summary = $13, consultation_booked = $14, consultation_at = $15, voice_cost_inr = $16, ai_cost_inr = $17,
         outside_hours = $18, answered_at = coalesce(answered_at, case when $19 then started_at end)
       where id = $1`,
      [
        callId, phone, result.callType, result.tier, result.aiTier, outcomeWithActions(result.outcome, out), review,
        JSON.stringify(result.fields), JSON.stringify(result.criteria), JSON.stringify(result.reasons), JSON.stringify(result.uncertain),
        JSON.stringify(flags), result.summary, out.booked, out.bookedAt, voiceCost, result.aiCost, isOutsideHours(started), call.duration_seconds > 0,
      ],
    );

  } catch (e) {
    await query("update calls set status = 'failed', error = $2 where id = $1", [callId, (e as Error).message.slice(0, 500)]);
    throw e;
  }
}

type ResultShape = {
  tier: Tier; callType: "enquiry" | "escalation" | "dropped"; outcome: string; summary: string;
  fields: ScoreOutput["fields"] | null; criteria: unknown; reasons: string[]; uncertain: string[];
  aiTier: string | null; aiCost: number; aiRun: Awaited<ReturnType<typeof runGemini>> | null; handleWithCare?: string | null;
};

function outcomeFor(t: Tier): string {
  return { green: "Handed to designer", amber: "Needs review", red: "Closed, logged for check", escalate: "Urgent callback", dropped: "Callback needed" }[t];
}

function outcomeWithActions(base: string, out: RouteOut): string {
  return out.failures.length ? `${base} (integration problem: ${out.failures.join(", ")})` : base;
}

interface RouteOut { booked: boolean; bookedAt: string | null; failures: string[] }

/** Send a lead to the outside world according to its tier. Red goes nowhere. */
export async function route(mode: Mode, lead: Lead, callId: string): Promise<RouteOut> {
  const out: RouteOut = { booked: false, bookedAt: null, failures: [] };
  const record = async (a: ActionResult) => {
    await logAction(callId, a);
    if (a.status === "failed") out.failures.push(a.channel);
  };

  if (lead.tier === "green") {
    await record(await createContactAndDeal(mode, lead));
    const booking = await bookConsultation(mode, lead);
    await record(booking);
    if (booking.status === "booked") { out.booked = true; out.bookedAt = booking.startUtc ?? null; }
    const bookingNote =
      booking.status === "booked" ? `booked for ${new Date(booking.startUtc ?? Date.now()).toLocaleString("en-IN", { timeZone: RULES.TIME_ZONE, dateStyle: "medium", timeStyle: "short" })}`
      : booking.status === "failed" ? "NOT booked: please schedule manually" : null;
    await record(await sendTelegram(mode, handoffMessage(lead, bookingNote), "handoff"));
  } else if (lead.tier === "amber") {
    await record(await sendTelegram(mode, reviewMessage(lead), "needs_review"));
  } else if (lead.tier === "escalate") {
    await record(await sendTelegram(mode, escalationMessage(lead), "escalation"));
  } else if (lead.tier === "dropped") {
    await record(await sendTelegram(mode, droppedMessage(lead), "dropped_call"));
  }
  // red: logged for designer verification only; nothing leaves the system.
  return out;
}

export function normalisePhone(p: string | null): string | null {
  if (!p) return null;
  const d = p.replace(/\D/g, "");
  if (d.length < 8) return null;
  return d.length > 10 ? d.slice(-10) : d;
}

/** A designer approves an amber/red lead: run the same outputs as a green lead. */
export async function approveReview(callId: string): Promise<void> {
  const rows = await query<CallRow>("select * from calls where id = $1 and review_status = 'pending'", [callId]);
  const call = rows[0];
  if (!call) return;
  const flags = call.flags ?? {};
  const lead: Lead = {
    callId, phone: call.caller_phone, tier: "green", fields: call.fields, summary: call.handoff_summary ?? "",
    reasons: call.reasons ?? [], originalTier: call.tier === "amber" || call.tier === "red" ? call.tier : undefined,
    uncertain: call.uncertain ?? [], askedAboutPrice: Boolean(flags.asked_about_price), handleWithCare: flags.handle_with_care ?? null,
    repeatCaller: Boolean(flags.repeat_caller), recordingUrl: call.recording_url, durationSeconds: call.duration_seconds, dashboardUrl: dashboardUrl(callId),
  };
  const out = await route(modeFor(call.source), lead, callId);
  await query(
    "update calls set review_status = 'approved', outcome = $2, consultation_booked = $3, consultation_at = $4 where id = $1",
    [callId, out.failures.length ? `Approved by designer (integration problem: ${out.failures.join(", ")})` : "Approved by designer, handed off", out.booked, out.bookedAt],
  );
}

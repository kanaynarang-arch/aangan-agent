import { after } from "next/server";
import { query } from "@/lib/db";
import { isOutsideHours } from "@/lib/time";
import { processCall } from "@/lib/pipeline";
import { isFinalEvent, parseVaniPayload, verifySignature } from "@/lib/vani";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Vani posts here when a call ends. We verify the signature, store the call,
 * answer 200 straight away, then score and route it after the response.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("x-vani-signature") ?? req.headers.get("x-signature") ?? req.headers.get("x-webhook-signature");
  if (!verifySignature(raw, sig, process.env.VANI_WEBHOOK_SECRET)) {
    return Response.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  if (!isFinalEvent(body)) return Response.json({ ok: true, ignored: body.event });

  const call = parseVaniPayload(body);
  // Real phone calls are live. Web (WebRTC) test calls are stored as test data unless explicitly allowed.
  const source = call.isWebCall && process.env.TREAT_WEB_CALLS_AS_LIVE !== "true" ? "test" : "live";
  const explicit = typeof body.source === "string" && body.source === "test" ? "test" : source;

  const rows = await query<{ id: string }>(
    `insert into calls (source, vani_call_id, caller_phone, started_at, duration_seconds, recording_url, transcript, outside_hours)
     values ($1,$2,$3,$4,$5,$6,$7,$8)
     on conflict (vani_call_id) do nothing returning id`,
    [explicit, call.vaniCallId, call.callerPhone, call.startedAt.toISOString(), call.durationSeconds, call.recordingUrl, call.transcript, isOutsideHours(call.startedAt)],
  );
  if (rows.length === 0) return Response.json({ ok: true, duplicate: true });

  const id = rows[0].id;
  after(async () => {
    try {
      await processCall(id);
    } catch (e) {
      console.error("processCall failed", id, (e as Error).message);
    }
  });
  return Response.json({ ok: true, id, source: explicit });
}

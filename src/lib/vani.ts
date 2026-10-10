import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Parsed shape the rest of the app uses, independent of Vani's wire format.
 * Vani's exact payload is mapped here in one place (see parseVaniPayload).
 */
export interface VaniCall {
  vaniCallId: string | null;
  callerPhone: string | null;
  startedAt: Date;
  durationSeconds: number;
  recordingUrl: string | null;
  transcript: string | null;
  /** True for web/WebRTC test calls, false for real phone calls. */
  isWebCall: boolean;
}

/** HMAC-SHA256 over the raw body. Accepts "sha256=<hex>" or bare hex. */
export function verifySignature(rawBody: string, header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const got = header.replace(/^sha256=/i, "").trim();
  const a = Buffer.from(expected);
  const b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function sign(rawBody: string, secret: string): string {
  return "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
}

type Json = Record<string, unknown>;
const pick = (o: Json | undefined, ...keys: string[]): unknown => {
  for (const k of keys) if (o && o[k] != null && o[k] !== "") return o[k];
  return undefined;
};
const obj = (v: unknown): Json | undefined => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : undefined);

/**
 * Vani sends the transcript as one string: "[13:33:14] AGENT: ...\n\n[13:33:19] USER: ...".
 * Normalise to "Agent: ..." / "Caller: ..." lines (also accepts an array of {role, text}).
 */
export function transcriptToText(t: unknown): string | null {
  if (!t) return null;
  if (Array.isArray(t)) {
    return t
      .map((m: Json) => {
        const role = String(pick(m, "role", "speaker", "from") ?? "").toLowerCase();
        const who = /user|caller|customer|human/.test(role) ? "Caller" : "Agent";
        const text = pick(m, "text", "content", "message", "transcript");
        return text ? `${who}: ${text}` : null;
      })
      .filter(Boolean)
      .join("\n");
  }
  if (typeof t !== "string") return null;
  const lines = t
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^(?:\[[^\]]*\]\s*)?(AGENT|ASSISTANT|AI|USER|CALLER|CUSTOMER|HUMAN)\s*:\s*(.*)$/i);
      if (!m) return l;
      return `${/^(agent|assistant|ai)$/i.test(m[1]) ? "Agent" : "Caller"}: ${m[2]}`;
    });
  return lines.length ? lines.join("\n") : null;
}

/** Events other than call_postprocessing carry no transcript; the route acknowledges and ignores them. */
export function isFinalEvent(body: Json): boolean {
  const ev = String(body.event ?? "").toLowerCase();
  return ev === "" || ev === "call_postprocessing";
}

/** Tolerant mapping of a Vani call_postprocessing event into VaniCall. */
export function parseVaniPayload(body: Json): VaniCall {
  const d: Json = obj(body.data) ?? obj(body.call) ?? obj(body.payload) ?? body;
  const callId = String(pick(d, "call_id", "callId", "room_name", "id") ?? pick(body, "call_id") ?? "") || null;
  const ts = pick(body, "timestamp") ?? pick(d, "started_at", "startedAt", "start_time", "created_at");
  let duration = Number(pick(d, "call_duration", "duration_seconds", "durationSeconds", "duration") ?? NaN);
  // call_postprocessing reports milliseconds; call_ended reports seconds. Calls over 3 hours in seconds are not plausible here.
  if (Number.isFinite(duration) && String(body.event ?? "") === "call_postprocessing") duration = duration / 1000;
  if (!Number.isFinite(duration)) duration = 0;
  const when = typeof ts === "string" || typeof ts === "number" ? new Date(ts) : new Date();
  // The event fires after the call ends, so the call began `duration` earlier.
  const startedAt = new Date((Number.isNaN(when.getTime()) ? Date.now() : when.getTime()) - duration * 1000);
  const phone = pick(d, "phone_number", "from", "caller_number", "customer_number", "from_number");
  return {
    vaniCallId: callId,
    callerPhone: phone ? String(phone) : null,
    startedAt,
    durationSeconds: Math.max(0, Math.round(duration)),
    recordingUrl: (pick(d, "recording_url", "recordingUrl", "recording") as string | undefined) ?? null,
    transcript: transcriptToText(pick(d, "transcript", "messages", "conversation")),
    // Only real inbound phone calls are live; web (WebRTC) test calls and anything else are test data.
    isWebCall: !/^inbound/i.test(callId ?? ""),
  };
}

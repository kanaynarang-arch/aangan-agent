import { query } from "./db";
import { startCallback } from "./outbound";

/** Both switches must be on: a phone number is connected in Vani, and the studio wants dropped calls rung back by itself. */
export function autoCallbackEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.VANI_PHONE_CALLBACKS === "true" && env.AUTO_CALLBACK_DROPPED === "true";
}

export interface AutoResult { started: boolean; why: string }

/**
 * Rings back one dropped call, once. Skips anyone who already has a callback, and anyone who has since phoned again themselves
 * (they have been looked after). Outside 10am to 7pm India time the callback rules refuse, and the morning sweep picks it up.
 */
export async function autoCallbackDropped(callId: string): Promise<AutoResult> {
  if (!autoCallbackEnabled()) return { started: false, why: "automatic callbacks are off" };
  const [c] = await query<{ id: string; source: string; tier: string | null; caller_phone: string | null; started_at: string; callback_of: string | null }>("select id, source, tier, caller_phone, started_at, callback_of from calls where id = $1", [callId]);
  if (!c || c.source !== "live" || c.tier !== "dropped" || c.callback_of) return { started: false, why: "not a live dropped call" };
  const tried = await query("select 1 from outbound_calls where call_id = $1 limit 1", [callId]);
  if (tried.length) return { started: false, why: "already tried" };
  if (c.caller_phone) {
    const again = await query("select 1 from calls where source = 'live' and caller_phone = $1 and started_at > $2 and id <> $3 limit 1", [c.caller_phone, c.started_at, callId]);
    if (again.length) return { started: false, why: "the caller phoned again" };
  }
  const r = await startCallback(callId);
  return { started: r.ok, why: r.message };
}

/** Morning sweep: dropped calls from the last 20 hours (this includes the night) that nobody has rung back. */
export async function sweepDroppedCallbacks(limit = 10): Promise<{ checked: number; started: number }> {
  if (!autoCallbackEnabled()) return { checked: 0, started: 0 };
  const rows = await query<{ id: string }>(
    `select id from calls where source = 'live' and tier = 'dropped' and status = 'processed' and callback_of is null and started_at > now() - interval '20 hours'
       and not exists (select 1 from outbound_calls o where o.call_id = calls.id)
     order by started_at limit $1`, [limit]);
  let started = 0;
  for (const r of rows) if ((await autoCallbackDropped(r.id)).started) started++;
  return { checked: rows.length, started };
}

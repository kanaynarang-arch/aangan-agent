import { RULES } from "../rules";
import { fetchJson, previewStatus, type ActionResult, type Lead, type Mode } from "./types";

const BASE = "https://api.cal.com/v2";
const BOOKING_VERSION = "2026-02-25";
const SLOTS_VERSION = "2024-09-04";

export interface BookingOutcome extends ActionResult {
  startUtc?: string;
}

/** "2026-10-12T16:00" read as India time -> UTC ISO. */
export function istLocalToUtcIso(local: string): string | null {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - (5 * 60 + 30) * 60_000;
  return new Date(ms).toISOString();
}

/**
 * Cal.com requires an attendee email and checks that it can receive mail, so a made-up address on a reserved domain is refused.
 * Callers are never asked for one. With `CALCOM_ATTENDEE_EMAIL` set to the studio's own address, each booking uses a plus-address of it
 * (name+lead-<digits>@domain), so Cal.com's confirmations reach the studio and no stranger's inbox. Without it, the synthetic
 * address is used and Cal.com is expected to refuse, which the Telegram note reports as "NOT booked".
 */
export function placeholderEmail(phone: string | null, base: string | undefined = process.env.CALCOM_ATTENDEE_EMAIL): string {
  const digits = (phone ?? "unknown").replace(/\D/g, "") || "unknown";
  const m = (base ?? "").trim().match(/^([^@+\s]+)@([^@\s]+\.[^@\s]+)$/);
  return m ? `${m[1]}+lead-${digits}@${m[2]}` : `lead-${digits}@leads.aangan-studio.example`;
}

export async function bookConsultation(mode: Mode, lead: Lead): Promise<BookingOutcome> {
  const f = lead.fields;
  const preferredUtc = f?.preferred_consultation_iso ? istLocalToUtcIso(f.preferred_consultation_iso) : null;
  const preview = { preferred: f?.preferred_consultation, preferredUtc, attendee: f?.name };
  if (mode !== "live") return { channel: "calcom", status: previewStatus(mode), detail: preview, startUtc: preferredUtc ?? undefined };

  const key = process.env.CALCOM_API_KEY;
  const eventTypeId = Number(process.env.CALCOM_EVENT_TYPE_ID);
  if (!key || !eventTypeId) return { channel: "calcom", status: "failed", detail: { error: "Cal.com env vars missing", ...preview } };

  const auth = { authorization: `Bearer ${key}` };
  const attendee = {
    name: f?.name ?? "Aangan enquiry",
    email: placeholderEmail(lead.phone ?? f?.phone ?? null),
    timeZone: RULES.TIME_ZONE,
    phoneNumber: toE164(lead.phone ?? f?.phone ?? null),
  };

  const tryBook = (startUtc: string) =>
    fetchJson(`${BASE}/bookings`, {
      method: "POST",
      headers: { ...auth, "cal-api-version": BOOKING_VERSION, "content-type": "application/json" },
      body: JSON.stringify({ start: startUtc, eventTypeId, attendee, metadata: { source: "aangan-agent", callId: lead.callId.slice(0, 36) } }),
    });

  try {
    let usedNearest = false;
    const attempts: string[] = [];
    if (preferredUtc && new Date(preferredUtc).getTime() > Date.now()) attempts.push(preferredUtc);
    let r = attempts.length ? await tryBook(attempts[0]) : null;

    if (!r || !r.ok) {
      // Preferred time unavailable or not given: take the nearest open slot at or after it.
      const from = preferredUtc && new Date(preferredUtc).getTime() > Date.now() ? new Date(preferredUtc) : new Date(Date.now() + 24 * 3600_000);
      const to = new Date(from.getTime() + 14 * 24 * 3600_000);
      const s = await fetchJson(
        `${BASE}/slots?eventTypeId=${eventTypeId}&start=${from.toISOString()}&end=${to.toISOString()}&timeZone=${encodeURIComponent(RULES.TIME_ZONE)}`,
        { headers: { ...auth, "cal-api-version": SLOTS_VERSION } },
      );
      const starts = Object.values((s.json?.data ?? {}) as Record<string, { start: string }[]>)
        .flat()
        .map((x) => new Date(x.start).getTime())
        .filter((t) => t >= from.getTime())
        .sort((a, b) => a - b);
      if (starts.length === 0) {
        return { channel: "calcom", status: "failed", detail: { error: "no open slot found", slotsHttp: s.status, ...preview } };
      }
      r = await tryBook(new Date(starts[0]).toISOString());
      usedNearest = true;
    }
    if (!r.ok) return { channel: "calcom", status: "failed", detail: { http: r.status, error: r.json?.error?.message ?? r.json?.message ?? r.text.slice(0, 200), ...preview } };
    const data = (r.json?.data ?? {}) as { uid?: string; start?: string };
    const start = data.start;
    return {
      channel: "calcom",
      status: "booked",
      detail: { bookingUid: data.uid, start, nearestSlotUsed: usedNearest, ...preview },
      externalId: data.uid ? String(data.uid) : undefined,
      startUtc: start,
    };
  } catch (e) {
    return { channel: "calcom", status: "failed", detail: { error: (e as Error).message, ...preview } };
  }
}

function toE164(phone: string | null): string | undefined {
  if (!phone) return undefined;
  const d = phone.replace(/\D/g, "");
  if (d.length === 10) return `+91${d}`;
  if (d.length === 12 && d.startsWith("91")) return `+${d}`;
  return undefined;
}

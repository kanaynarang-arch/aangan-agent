import Link from "next/link";

const LABEL: Record<string, string> = {
  green: "Green", amber: "Amber", red: "Red", escalate: "Escalate", dropped: "Dropped", pending: "Scoring",
};
// A shape per tier so the badge never relies on colour alone (the label text is always shown too).
const GLYPH: Record<string, string> = { green: "✓", amber: "!", red: "✕", escalate: "▲", dropped: "○", pending: "…" };

export function TierBadge({ tier, large = false }: { tier: string | null; large?: boolean }) {
  const t = tier ?? "pending";
  return (
    <span className={`badge t-${t}${large ? " lg" : ""}`}>
      <i aria-hidden="true">{GLYPH[t] ?? "•"}</i>
      {LABEL[t] ?? t}
    </span>
  );
}

/** Rupees with Indian digit grouping, e.g. ₹1,23,456.00. */
export const inr = (n: number, digits = 2) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

const IST = "Asia/Kolkata";

/** "9 Oct, 6:34 pm" in India time. */
export function when(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { timeZone: IST, day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
}

/** "9 Oct 2026, 6:34 pm IST". */
export function whenFull(iso: string): string {
  return `${new Date(iso).toLocaleString("en-IN", { timeZone: IST, day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })} IST`;
}

/** "4 min 12 sec", "45 sec". */
export function duration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return m ? `${m} min ${String(s % 60).padStart(2, "0")} sec` : `${s} sec`;
}

/** A dialable tel: link, or null when the number is too short or odd to dial safely. Indian numbers get +91. */
export function telHref(phone: string | null | undefined): string | null {
  const raw = (phone ?? "").trim();
  const d = raw.replace(/\D/g, "");
  if (d.length === 10) return `tel:+91${d}`;
  if (d.length === 11 && d.startsWith("0")) return `tel:+91${d.slice(1)}`;
  if (d.length === 12 && d.startsWith("91")) return `tel:+${d}`;
  if (raw.startsWith("+") && d.length >= 8 && d.length <= 15) return `tel:+${d}`;
  return null;
}

/** "9000000101" becomes "90000 00101". Anything else is shown as given. */
export function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  return d.length === 10 ? `${d.slice(0, 5)} ${d.slice(5)}` : phone;
}

export type Source = "all" | "live" | "test";
export function parseSource(v: string | string[] | undefined): Source | null {
  return v === "all" || v === "live" || v === "test" ? v : null;
}

/** Build a link that keeps whichever of these params are set. */
export function href(base: string, params: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}

const SOURCE_LABEL: Record<Source, string> = { all: "All calls", live: "Live calls", test: "Test data" };

export function SourceChips({ base, source, keep = {} }: { base: string; source: Source; keep?: Record<string, string | undefined> }) {
  return (
    <nav className="chips" aria-label="Which calls to show">
      <span className="chiplabel">Showing</span>
      {(["all", "live", "test"] as const).map((s) => (
        <Link key={s} className="chip" aria-current={source === s ? "true" : undefined} href={href(base, { ...keep, source: s })}>
          {SOURCE_LABEL[s]}
        </Link>
      ))}
    </nav>
  );
}

/** Plain words for what happened to a lead in each outside service. */
export function actionWords(a: { channel: string; status: string; detail: Record<string, unknown> | null }): { service: string; word: string; tone: "ok" | "muted" | "err" } {
  const service = { hubspot: "HubSpot", telegram: "Telegram", calcom: "Cal.com" }[a.channel] ?? a.channel;
  const kind = String(a.detail?.kind ?? "");
  switch (a.status) {
    case "sent":
      if (a.channel === "hubspot") return { service, word: "Contact and deal created", tone: "ok" };
      if (a.channel === "telegram") return { service, word: kind === "needs_review" ? "Review request posted to the designers' group" : "Note posted to the designers' group", tone: "ok" };
      return { service, word: "Sent", tone: "ok" };
    case "booked": return { service, word: "Consultation booked", tone: "ok" };
    case "skipped_test": return { service, word: "Not sent (test call)", tone: "muted" };
    case "dry_run": return { service, word: "Not sent (integrations are off)", tone: "muted" };
    default: return { service, word: `Failed${a.detail?.error ? `: ${String(a.detail.error)}` : ""}`, tone: "err" };
  }
}

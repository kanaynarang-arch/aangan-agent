import Link from "next/link";

const LABEL: Record<string, string> = {
  green: "Green", amber: "Amber", red: "Red", escalate: "Escalate", dropped: "Dropped", pending: "Scoring",
};

export function TierBadge({ tier }: { tier: string | null }) {
  const t = tier ?? "pending";
  return <span className={`badge t-${t}`}>{LABEL[t] ?? t}</span>;
}

export const inr = (n: number, digits = 2) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

export function when(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
}

export function SourceChips({ base, source }: { base: string; source: string }) {
  return (
    <div className="chips" aria-label="Data source">
      <span className="muted small">Showing</span>
      {(["all", "live", "test"] as const).map((s) => (
        <Link key={s} className={`chip ${source === s ? "on" : ""}`} href={`${base}${base.includes("?") ? "&" : "?"}source=${s}`}>
          {s === "all" ? "All calls" : s === "live" ? "Live calls" : "Test data"}
        </Link>
      ))}
    </div>
  );
}

export function parseSource(v: string | string[] | undefined): "all" | "live" | "test" {
  return v === "live" || v === "test" ? v : "all";
}

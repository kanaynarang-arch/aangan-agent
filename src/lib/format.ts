/** "just now", "12 min ago", "3 h ago", "yesterday", "9 Oct". Calendar days are counted in India time. */
export function ago(iso: string, now = new Date()): string {
  const t = new Date(iso);
  const mins = Math.round((now.getTime() - t.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const day = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const diff = Math.round((Date.parse(day(now)) - Date.parse(day(t))) / 86400000);
  if (diff === 1) return "yesterday";
  return t.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });
}

/** Up to two capital letters for the avatar. Falls back to the last digits of a number, or "?". */
export function initials(name: string | null | undefined, phone?: string | null): string {
  const words = (name ?? "").trim().split(/\s+/).filter((w) => /[A-Za-z]/.test(w));
  if (words.length) return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase();
  const d = (phone ?? "").replace(/\D/g, "");
  return d ? d.slice(-2) : "?";
}

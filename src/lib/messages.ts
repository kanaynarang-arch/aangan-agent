import { RULES } from "./rules";
import type { Lead } from "./integrations/types";

const line = (label: string, v: unknown) => (v == null || v === "" ? null : `${label}: ${v}`);

/** One short line built from the stored rubric reasons: at most three, rule-check overrides only if nothing else. */
export function whyLine(reasons: string[], max = 3, limit = 220): string {
  const clean = (r: string) => r.replace(/^Rule check:\s*/i, "").replace(/\s+/g, " ").trim().replace(/[.\s]+$/, "");
  const main = reasons.filter((r) => !/^Rule check:/i.test(r)).map(clean).filter(Boolean);
  const picks = (main.length ? main : reasons.map(clean).filter(Boolean)).slice(0, max);
  const out = picks.join("; ");
  return out.length > limit ? `${out.slice(0, limit - 1).trimEnd()}…` : out;
}

function whyLines(l: Lead, label: string): string | null {
  const w = whyLine(l.reasons ?? []);
  return w ? `Why ${label}: ${w}` : null;
}

function flagLines(l: Lead): string[] {
  const out: string[] = [];
  if (l.askedAboutPrice) out.push("Asked about price: yes (agent gave the standard answer, no figure quoted)");
  if (l.handleWithCare) out.push(`HANDLE WITH CARE: ${l.handleWithCare}`);
  if (l.repeatCaller) out.push("Repeat caller: has called before");
  return out;
}

export function handoffMessage(l: Lead, booking: string | null): string {
  const f = l.fields;
  return [
    "NEW QUALIFIED LEAD (green)",
    line("Name", f?.name),
    line("Phone", l.phone ?? f?.phone),
    line("Project", [f?.project_type, f?.business_type !== "home" ? f?.business_type : null].filter(Boolean).join(", ")),
    line("Location", f?.location),
    line("Carpet area", f?.carpet_area_sqft ? `${f.carpet_area_sqft} sq ft` : null),
    line("Scope", f?.scope),
    line("Timeline", f?.timeline),
    line("Decision-maker", f?.decision_maker),
    line("Preferred consultation", f?.preferred_consultation),
    line("Consultation", booking),
    whyLines(l, l.originalTier ?? "green"),
    ...flagLines(l),
    l.uncertain.length ? `Uncertain: ${l.uncertain.join("; ")}` : null,
    "",
    l.summary,
    "",
    line("Recording", l.recordingUrl),
    line("Call", l.dashboardUrl),
  ]
    .filter((x) => x !== null)
    .join("\n");
}

export function reviewMessage(l: Lead): string {
  const f = l.fields;
  const red = l.tier === "red";
  return [
    red ? "FOR CHECK (red): closed on the call, logged before it is dropped" : "NEEDS REVIEW (amber): designer to decide",
    line("Name", f?.name),
    line("Phone", l.phone ?? f?.phone),
    line("Location", f?.location),
    line("Scope", f?.scope),
    line("Timeline", f?.timeline),
    whyLines(l, red ? "red" : "amber"),
    ...flagLines(l),
    l.uncertain.length ? `Unclear: ${l.uncertain.join("; ")}` : null,
    "",
    l.summary,
    "",
    line("Verify queue", l.dashboardUrl),
  ]
    .filter((x) => x !== null)
    .join("\n");
}

export function escalationMessage(l: Lead): string {
  return [
    `URGENT: existing client complaint. Senior callback within ${RULES.ESCALATION_CALLBACK_MINUTES} minutes`,
    line("Name", l.fields?.name),
    line("Phone", l.phone ?? l.fields?.phone),
    "",
    l.summary,
    "",
    line("Call", l.dashboardUrl),
  ]
    .filter((x) => x !== null)
    .join("\n");
}

export function droppedMessage(l: Lead): string {
  return [
    "DROPPED CALL: please call back",
    line("Number", l.phone ?? "not captured"),
    `Call lasted ${Math.round(l.durationSeconds)}s with no qualifying details.`,
    line("Call", l.dashboardUrl),
  ]
    .filter((x) => x !== null)
    .join("\n");
}

/** The Telegram text for a lead at its current tier. Used by the "Copy handoff note" button. */
export function noteForLead(l: Lead, booking: string | null): string {
  switch (l.tier) {
    case "green": return handoffMessage(l, booking);
    case "escalate": return escalationMessage(l);
    case "dropped": return droppedMessage(l);
    default: return reviewMessage(l);
  }
}

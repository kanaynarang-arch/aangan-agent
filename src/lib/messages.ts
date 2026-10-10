import { RULES } from "./rules";
import type { Lead } from "./integrations/types";

const line = (label: string, v: unknown) => (v == null || v === "" ? null : `${label}: ${v}`);

/** One short line built from the stored rubric reasons: at most three, rule-check overrides only if nothing else. */
export function whyLine(reasons: string[], max = 3, limit = 160, ruleFirst = false): string {
  const clean = (r: string) => r.replace(/^Rule check:\s*/i, "").replace(/\s+/g, " ").trim().replace(/[.\s]+$/, "");
  const main = reasons.filter((r) => !/^Rule check:/i.test(r)).map(clean).filter(Boolean);
  // For amber and red the rule check is the reason the tier is not green, so it goes first rather than being dropped.
  const rules = ruleFirst ? reasons.filter((r) => /^Rule check:/i.test(r)).map(clean).filter(Boolean) : [];
  const picks = (rules.length ? [...rules, ...main] : main.length ? main : reasons.map(clean).filter(Boolean)).slice(0, max);
  const out = picks.join("; ");
  return out.length > limit ? `${out.slice(0, limit - 1).trimEnd()}…` : out;
}

function whyLines(l: Lead, label: string): string | null {
  const w = whyLine(l.reasons ?? [], 3, 160, label === "amber" || label === "red");
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

/** When Vani is set to ring a dropped call back by itself: straight away in hours, or in the morning sweep. */
export type CallbackPlan = "now" | "morning" | null;

export function droppedMessage(l: Lead, plan: CallbackPlan = null): string {
  const plans: Record<"now" | "morning", string> = {
    now: "Vani is ringing this number back now to take the enquiry. If it works, a lead follows here. Only call yourself if none does.",
    morning: "Vani will ring this number back at about 10am to take the enquiry. If it works, a lead follows here. Only call yourself if none does.",
  };
  return [
    plan ? "DROPPED CALL: Vani is calling back" : "DROPPED CALL: please call back",
    line("Number", l.phone ?? "not captured"),
    `Call lasted ${Math.round(l.durationSeconds)}s with no qualifying details.`,
    plan ? plans[plan] : null,
    line("Call", l.dashboardUrl),
  ]
    .filter((x) => x !== null)
    .join("\n");
}

/** Vani's callback did not produce a lead, so a person has to ring this number. */
export function callbackProblemMessage(l: Lead, kind: "failed" | "unanswered", detail?: string): string {
  return [
    kind === "failed" ? "VANI CALLBACK FAILED: please call back" : "VANI CALLBACK GOT NOTHING: please call back",
    line("Number", l.phone ?? "not captured"),
    kind === "failed"
      ? line("What happened", detail ?? "Vani could not place the call.")
      : "Vani rang back but could not take the enquiry (not picked up, or hung up straight away).",
    line("Dropped call", l.dashboardUrl),
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

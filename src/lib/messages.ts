import { RULES } from "./rules";
import type { Lead } from "./integrations/types";

const line = (label: string, v: unknown) => (v == null || v === "" ? null : `${label}: ${v}`);

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
  return [
    "NEEDS REVIEW (amber): designer to decide",
    line("Name", f?.name),
    line("Phone", l.phone ?? f?.phone),
    line("Location", f?.location),
    line("Scope", f?.scope),
    line("Timeline", f?.timeline),
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

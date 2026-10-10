import type { ScoreOutput } from "./scoring/schema";

type Fields = ScoreOutput["fields"];

export interface Captured {
  /** The nine things the agent is meant to ask. Budget is never asked, so it is not here. */
  asked: { label: string; value: string }[];
  /** What the designer still needs to ask or cover on the first call. */
  toCover: string[];
  answered: number;
  total: number;
}

const has = (v: string | null | undefined) => Boolean(v && v.trim());

/**
 * Splits a call into "already asked, do not ask again" and "still to cover".
 * The brief's pain: the designer's first call is spent re-asking what the front desk already asked.
 */
export function captureSummary(fields: Fields | null, phone: string | null): Captured {
  const f = fields;
  const rows: { label: string; value: string | null }[] = [
    { label: "Name", value: has(f?.name) ? f!.name : null },
    { label: "Phone number", value: has(phone) ? phone : has(f?.phone) ? f!.phone : null },
    { label: "Home or commercial", value: f && f.project_type !== "unclear" ? f.project_type : null },
    { label: "Location", value: has(f?.location) ? f!.location : null },
    { label: "Carpet area", value: f?.carpet_area_sqft ? `${f.carpet_area_sqft.toLocaleString("en-IN")} sq ft` : null },
    { label: "What they want done", value: has(f?.scope) ? f!.scope : null },
    { label: "When they need it", value: has(f?.timeline) ? f!.timeline : null },
    { label: "Who decides", value: has(f?.decision_maker) ? f!.decision_maker : null },
    { label: "Preferred consultation time", value: has(f?.preferred_consultation) ? f!.preferred_consultation : null },
  ];
  const asked = rows.filter((r) => r.value).map((r) => ({ label: r.label, value: r.value as string }));
  const toCover = rows.filter((r) => !r.value).map((r) => `Ask: ${r.label.toLowerCase()}`);
  // Price is for the designer, never the agent.
  if (f?.asked_about_price) toCover.push("Price: the caller asked, and the agent quoted nothing. Cover it at the consultation.");
  return { asked, toCover, answered: asked.length, total: rows.length };
}

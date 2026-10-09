import { RULES, type Tier } from "../rules";
import type { CriteriaKey, ScoreOutput } from "./schema";

export type Status = "met" | "unclear" | "failed";
export type EffectiveCriteria = Record<CriteriaKey, { status: Status; reason: string }>;

export interface Decision {
  tier: Tier;
  aiTier: ScoreOutput["tier"] | null;
  criteria: EffectiveCriteria;
  reasons: string[];
  uncertain: string[];
  /** Notes where deterministic rules overrode the model. */
  overrides: string[];
}

function mentions(text: string | null | undefined, names: readonly string[]): boolean {
  if (!text) return false;
  const t = ` ${text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ")} `;
  return names.some((n) => t.includes(` ${n} `));
}

/**
 * Deterministic rubric. The model proposes criteria statuses; the hard rules in
 * RULES are applied on top, then the tier is derived only from the final statuses.
 */
export function decide(out: ScoreOutput): Decision {
  if (out.call_type === "existing_client_complaint") {
    return {
      tier: "escalate",
      aiTier: null,
      criteria: out.criteria,
      reasons: ["Existing client complaint: scoring skipped, senior callback needed."],
      uncertain: out.uncertain,
      overrides: [],
    };
  }

  const c: EffectiveCriteria = JSON.parse(JSON.stringify(out.criteria));
  const overrides: string[] = [];
  const f = out.fields;
  const force = (k: CriteriaKey, status: Status, reason: string) => {
    if (c[k].status !== status) overrides.push(`${k}: ${c[k].status} -> ${status} (${reason})`);
    c[k] = { status, reason };
  };

  // 1. Real project / in scope
  if (out.intent === "advice_only") force("real_project", "failed", "advice only, no execution");
  if ((RULES.EXCLUDED_BUSINESS_TYPES as readonly string[]).includes(f.business_type)) {
    force("real_project", "failed", `${f.business_type.replace(/_/g, " ")} is out of scope`);
  }
  if (f.project_type === "commercial" && f.carpet_area_sqft != null) {
    if (f.carpet_area_sqft < RULES.COMMERCIAL_MIN_SQFT) {
      force("real_project", "failed", `commercial space of ${f.carpet_area_sqft} sq ft is under the ${RULES.COMMERCIAL_MIN_SQFT} sq ft minimum`);
    } else if (f.carpet_area_sqft > RULES.COMMERCIAL_MAX_SQFT * RULES.COMMERCIAL_MAX_TOLERANCE) {
      force("real_project", "failed", `commercial space of ${f.carpet_area_sqft} sq ft is over the ~${RULES.COMMERCIAL_MAX_SQFT} sq ft limit`);
    }
  }

  // 2. Service area
  if (mentions(f.location, RULES.OUT_OF_AREA)) {
    force("service_area", "failed", `${f.location} is outside Pune and PCMC`);
  } else if (mentions(f.location, RULES.PUNE_PCMC_AREAS)) {
    force("service_area", "met", `${f.location} is in the service area`);
  }

  // 3. Timeline
  const w = f.weeks_until_deadline;
  if (w != null) {
    if (w < RULES.MIN_LEAD_WEEKS) {
      force("timeline", "failed", `needs completion in about ${w} weeks, under the ${RULES.MIN_LEAD_WEEKS}-week minimum`);
    } else if (w < RULES.AMBER_LEAD_WEEKS_MAX) {
      force("timeline", "unclear", `needs completion in about ${w} weeks, tight against ${RULES.MIN_LEAD_WEEKS} to ${RULES.AMBER_LEAD_WEEKS_MAX} weeks`);
    } else {
      force("timeline", "met", `completion in about ${w} weeks is realistic`);
    }
  }

  // 4. Budget: never probed; only a volunteered figure can fail it.
  if (f.volunteered_budget == null && c.budget.status === "failed") {
    force("budget", "unclear", "no budget was volunteered");
  }

  // ---- Tier from final statuses
  const failed = (Object.keys(c) as CriteriaKey[]).filter((k) => c[k].status === "failed");
  const unclearCore = (["real_project", "service_area", "timeline"] as CriteriaKey[]).filter((k) => c[k].status === "unclear");
  const failedCore = failed.filter((k) => k === "real_project" || k === "service_area" || k === "timeline");

  let tier: Tier;
  if (c.budget.status === "failed" || failed.length >= 2) {
    tier = "red";
  } else if (failedCore.length === 1) {
    const onlyTimeline = failedCore[0] === "timeline";
    tier = onlyTimeline && out.later_start_acceptable === "yes" ? "amber" : "red";
  } else if (failed.length === 1 || unclearCore.length > 0) {
    tier = "amber"; // decision-maker failed alone, or 1-3 unclear
  } else {
    tier = "green";
  }

  const uncertain = [...out.uncertain];
  if (tier === "green") {
    if (c.budget.status === "unclear" && !uncertain.some((u) => /budget/i.test(u))) uncertain.push("Budget not discussed (never asked).");
    if (c.decision_maker.status === "unclear" && !uncertain.some((u) => /decision|decide|owner|parent/i.test(u))) {
      uncertain.push(`Decision-maker not fully confirmed: ${c.decision_maker.reason}`);
    }
  }

  const reasons = [...out.reasons];
  for (const o of overrides) reasons.push(`Rule check: ${o}`);

  return { tier, aiTier: out.tier, criteria: c, reasons, uncertain, overrides };
}

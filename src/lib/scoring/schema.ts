import { z } from "zod";

const Status = z.enum(["met", "unclear", "failed"]);
const Criterion = z.object({
  status: Status,
  reason: z.string().describe("One short sentence of evidence from the call."),
});

export const ScoreSchema = z.object({
  call_type: z
    .enum(["enquiry", "existing_client_complaint"])
    .describe(
      "existing_client_complaint = caller is a CURRENT client of a project already under way and is complaining (e.g. designer not replying). Everything else is enquiry, including a prospect chasing an unanswered earlier enquiry.",
    ),
  fields: z.object({
    name: z.string().nullable(),
    phone: z.string().nullable().describe("Digits as the caller gave them, or null."),
    project_type: z.enum(["residential", "commercial", "unclear"]),
    business_type: z
      .enum(["home", "office", "clinic", "studio", "retail", "restaurant_or_hotel", "gym", "other", "unclear"])
      .describe("What the space is. Use home for any residence."),
    location: z.string().nullable().describe("Area and city as stated."),
    carpet_area_sqft: z.number().nullable(),
    scope: z.string().nullable().describe("What they want done, in a short phrase."),
    timeline: z.string().nullable().describe("The caller's own words about timing, short."),
    weeks_until_deadline: z
      .number()
      .nullable()
      .describe(
        "Only if the caller needs the project COMPLETE/READY by a date: whole weeks from the call date to that date (round down). Null if they gave only a start date, possession date, or no deadline.",
      ),
    decision_maker: z.string().nullable().describe("Who decides, and whether they are on the call."),
    preferred_consultation: z.string().nullable().describe("Preferred day/time in the caller's words."),
    preferred_consultation_iso: z
      .string()
      .nullable()
      .describe("Same, as local India time YYYY-MM-DDTHH:mm resolved against the call date, or null if no day/time was given."),
    asked_about_price: z.boolean(),
    volunteered_budget: z.string().nullable().describe("Only if the CALLER volunteered a figure. Else null."),
  }),
  intent: z.enum(["design_and_execution", "advice_only", "unclear"]),
  later_start_acceptable: z
    .enum(["yes", "no", "unknown"])
    .describe("If the timeline fails: would the caller accept or has the call established a later start? yes only if the call shows it."),
  criteria: z.object({
    real_project: Criterion,
    service_area: Criterion,
    timeline: Criterion,
    budget: Criterion,
    decision_maker: Criterion,
  }),
  flags: z.object({
    handle_with_care: z.boolean().describe("Caller is frustrated or was let down (e.g. an earlier enquiry was never followed up)."),
    handle_with_care_reason: z.string().nullable(),
  }),
  tier: z.enum(["green", "amber", "red"]),
  reasons: z.array(z.string()).describe("2 to 5 short reasons for the tier."),
  uncertain: z
    .array(z.string())
    .describe("Anything unconfirmed that the designer should check, e.g. 'decision with parents, caller is the son'."),
  handoff_summary: z
    .string()
    .describe("3 to 5 plain sentences for the designer: who, what, where, size, timing, who decides, preferred slot, and what is uncertain. No prices."),
});

export type ScoreOutput = z.infer<typeof ScoreSchema>;
export type CriteriaKey = keyof ScoreOutput["criteria"];

/** JSON Schema handed to Gemini as the strict response schema. */
export function scoreJsonSchema(): Record<string, unknown> {
  const s = z.toJSONSchema(ScoreSchema) as Record<string, unknown>;
  delete s.$schema;
  return s;
}

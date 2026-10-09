/**
 * Single source of truth for every business rule. Change a value here and the
 * Vani prompt, the scoring prompt and the tier logic all follow.
 * Nothing in this file comes from the internal pricing guide.
 */

export const RULES = {
  // ---- Office hours (front desk), used for the "outside 10am to 7pm" metric
  TIME_ZONE: "Asia/Kolkata",
  OFFICE_OPEN_HOUR: 10,
  OFFICE_CLOSE_HOUR: 19,

  // ---- Timeline (criterion 3)
  // services.md says 6 weeks, qualified.md says 8 to 10. 6 is the hard minimum,
  // 6 up to 10 weeks to a completion deadline is amber (see DECISIONS.md).
  MIN_LEAD_WEEKS: 6,
  AMBER_LEAD_WEEKS_MAX: 10,

  // ---- Commercial scope (criterion 1)
  COMMERCIAL_MIN_SQFT: 500, // from transcript T18
  COMMERCIAL_MAX_SQFT: 3000, // "approximately", so allow a little tolerance
  COMMERCIAL_MAX_TOLERANCE: 1.1,
  EXCLUDED_BUSINESS_TYPES: ["retail", "restaurant_or_hotel", "gym"] as const,

  // ---- Budget (criterion 4). Never asked. Only acted on if volunteered.
  // From the rubric's own example ("1 to 1.5 lakh for a full flat"): a total at or
  // below this, for any design-plus-execution scope, is clearly too low.
  BUDGET_CLEARLY_TOO_LOW_LAKH: 1.5,

  // ---- Service area (criterion 2). Matched case-insensitively on whole words.
  PUNE_PCMC_AREAS: [
    "pune", "pcmc", "pimpri", "chinchwad", "pimpri-chinchwad", "pimple saudagar",
    "pimple nilakh", "ravet", "hinjewadi", "hinjawadi", "kothrud", "baner", "aundh",
    "wakad", "koregaon park", "kalyani nagar", "viman nagar", "hadapsar",
    "magarpatta", "nibm", "kondhwa", "undri", "shivane", "warje", "erandwane",
    "deccan", "kharadi", "nanded city", "balewadi", "bavdhan", "pashan", "sus",
    "wagholi", "yerwada", "mundhwa", "dhanori", "katraj", "sinhagad road",
    "dahanukar colony", "camp", "bibwewadi", "sangvi", "pimple gurav", "akurdi",
  ],
  OUT_OF_AREA: [
    "talegaon", "lonavala", "lonavla", "nashik", "mumbai", "navi mumbai", "thane",
    "nagpur", "kolhapur", "satara", "sangli", "solapur", "aurangabad", "delhi",
    "bengaluru", "bangalore", "hyderabad", "chennai", "goa", "ahmedabad",
  ],

  // ---- Dropped call detection (no Gemini call is spent on these)
  DROPPED_MAX_SECONDS: 45,
  DROPPED_MIN_CALLER_WORDS: 12,

  // ---- Escalation
  ESCALATION_CALLBACK_MINUTES: 15,

  // ---- Service level for the pipeline view
  ANSWER_SLA_SECONDS: 5 * 60,

  // ---- Costs
  VOICE_RATE_INR_PER_MIN: Number(process.env.VOICE_RATE_INR_PER_MIN ?? 5.6),
  USD_TO_INR: Number(process.env.USD_TO_INR ?? 90),
  GEMINI_MODEL: process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite",
  // USD per 1M tokens for the model above (standard tier, thinking billed as output)
  GEMINI_INPUT_USD_PER_M: Number(process.env.GEMINI_INPUT_USD_PER_M ?? 0.25),
  GEMINI_OUTPUT_USD_PER_M: Number(process.env.GEMINI_OUTPUT_USD_PER_M ?? 1.5),

  // ---- Wording
  // The ONLY thing the agent may say about price.
  PRICING_ANSWER:
    "Pricing depends on the site, the materials you choose, and the scope. Your designer will walk you through it in detail at the consultation. I can book that for you right now if you'd like.",
  // From qualified.md
  POLITE_DECLINE:
    "This sounds like it may not be the right fit for us right now, but feel free to reach out if your timeline or scope changes.",
} as const;

export type Tier = "green" | "amber" | "red" | "escalate" | "dropped";

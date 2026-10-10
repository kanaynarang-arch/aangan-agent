import { describe, expect, it } from "vitest";
import { RULES } from "../src/lib/rules";
import { buildCallbackPrompt, callbackGreeting } from "../src/lib/callback-prompt";
import { briefFor, callbackEligibility, toE164, type PriorAttempt } from "../src/lib/outbound";
import type { ScoreOutput } from "../src/lib/scoring/schema";

const MONEY = [/₹\s*[\d,.]+/i, /\b(rs\.?|inr|rupees?)\s*[\d,.]+/i, /[\d,.]+\s*(rs\b|rupees?|lakhs?|lacs?|crores?|cr\b|k\b)/i, /\bper\s*(sq\.?\s*ft|square)/i];

const fields = (over: Partial<ScoreOutput["fields"]> = {}) =>
  ({ name: "Asha", phone: null, project_type: "residential", location: "Baner", carpet_area_sqft: 1200, scope: "2BHK full home", timeline: null, decision_maker: null, preferred_consultation: null, asked_about_price: false, volunteered_budget: null, ...over }) as ScoreOutput["fields"];
const lead = (over: Record<string, unknown> = {}) => ({ source: "live" as const, tier: "green" as const, status: "processed", caller_phone: "9000000101", fields: fields(), ...over });
// 11:00 India time on a weekday, and 22:00 India time.
const DAY = new Date("2026-10-07T05:30:00Z");
const NIGHT = new Date("2026-10-07T16:30:00Z");

describe("phone numbers", () => {
  it("normalises Indian numbers and rejects what it cannot trust", () => {
    expect(toE164("9000000101")).toBe("+919000000101");
    expect(toE164("+91 90000 00101")).toBe("+919000000101");
    expect(toE164("09000000101")).toBe("+919000000101");
    expect(toE164("12345")).toBeNull();
    expect(toE164(null)).toBeNull();
  });
});

describe("who the agent may call back", () => {
  it("works in the browser with no phone number, for live and test calls, at any hour", () => {
    expect(callbackEligibility(lead({ caller_phone: null }), [], NIGHT, "browser").ok).toBe(true);
    expect(callbackEligibility(lead({ source: "test" }), [], DAY, "browser").ok).toBe(true);
  });
  it("never an unhappy existing client, and never a lead closed politely", () => {
    for (const mode of ["browser", "phone"] as const) {
      expect(callbackEligibility(lead({ tier: "escalate" }), [], DAY, mode).ok).toBe(false);
      expect(callbackEligibility(lead({ tier: "red" }), [], DAY, mode).ok).toBe(false);
    }
  });
  it("a dropped call is always worth finishing; a lead with nothing missing is not", () => {
    expect(callbackEligibility(lead({ tier: "dropped", fields: null }), [], DAY, "browser")).toMatchObject({ ok: true, reason: "dropped" });
    const full = fields({ timeline: "3 months", decision_maker: "self", preferred_consultation: "Sat 11am", phone: "9000000101" });
    expect(callbackEligibility(lead({ fields: full }), [], DAY, "browser").ok).toBe(false);
  });
  it("phone mode only rings real callers, during the day, and never twice in a row", () => {
    expect(callbackEligibility(lead({ source: "test" }), [], DAY, "phone").ok).toBe(false);
    expect(callbackEligibility(lead({ caller_phone: "12345" }), [], DAY, "phone").ok).toBe(false);
    expect(callbackEligibility(lead(), [], NIGHT, "phone").ok).toBe(false);
    expect(callbackEligibility(lead(), [], DAY, "phone")).toMatchObject({ ok: true, phone: "+919000000101" });
    const justNow: PriorAttempt[] = [{ status: "requested", created_at: new Date(DAY.getTime() - 5 * 60_000).toISOString() }];
    expect(callbackEligibility(lead(), justNow, DAY, "phone").ok).toBe(false);
    const two: PriorAttempt[] = [1, 2].map((n) => ({ status: "completed", created_at: new Date(DAY.getTime() - n * 3_600_000).toISOString() }));
    expect(callbackEligibility(lead(), two, DAY, "phone").ok).toBe(false);
  });
});

describe("what the callback agent is told", () => {
  const brief = briefFor(lead(), "follow_up");
  it("lists what is known and only what is missing", () => {
    expect(brief.known.join("|")).toContain("Location: Baner");
    expect(brief.missing.join("|")).toContain("who will take the decision");
    expect(brief.missing.join("|")).not.toContain("where the property is");
  });
  it("never contains a price, always the one allowed pricing answer, and never asks for budget", () => {
    const p = buildCallbackPrompt(brief);
    for (const r of MONEY) expect(p, String(r)).not.toMatch(r);
    expect(p).toContain(RULES.PRICING_ANSWER);
    expect(p).toMatch(/Never ask for budget/);
    expect(p).toMatch(/AI assistant/);
    for (const r of MONEY) expect(callbackGreeting(brief)).not.toMatch(r);
  });
});

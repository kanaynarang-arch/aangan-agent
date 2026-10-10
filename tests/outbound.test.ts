import { describe, expect, it } from "vitest";
import { RULES } from "../src/lib/rules";
import { buildCallbackPrompt, callbackGreeting } from "../src/lib/callback-prompt";
import { briefFor, callbackEligibility, callbackMode, toE164, type PriorAttempt } from "../src/lib/outbound";
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
  it("works in the browser with no phone number, for live and test dropped calls, at any hour", () => {
    expect(callbackEligibility(lead({ tier: "dropped", fields: null, caller_phone: null }), [], NIGHT, "browser").ok).toBe(true);
    expect(callbackEligibility(lead({ tier: "dropped", fields: null, source: "test" }), [], DAY, "browser").ok).toBe(true);
  });
  it("only dropped calls: never someone who is already a lead, an unhappy client, a closed enquiry or a callback", () => {
    for (const mode of ["browser", "phone"] as const) {
      for (const tier of ["green", "amber", "red", "escalate"]) expect(callbackEligibility(lead({ tier }), [], DAY, mode).ok, `${mode} ${tier}`).toBe(false);
      expect(callbackEligibility(lead({ tier: "dropped", fields: null, callback_of: "x" }), [], DAY, mode).ok).toBe(false);
    }
  });
  it("phone mode only rings real callers, during the day, and never twice in a row", () => {
    const d = (over: Record<string, unknown> = {}) => lead({ tier: "dropped", fields: null, ...over });
    expect(callbackEligibility(d({ source: "test" }), [], DAY, "phone").ok).toBe(false);
    expect(callbackEligibility(d({ caller_phone: "12345" }), [], DAY, "phone").ok).toBe(false);
    expect(callbackEligibility(d(), [], NIGHT, "phone").ok).toBe(false);
    expect(callbackEligibility(d(), [], DAY, "phone")).toMatchObject({ ok: true, phone: "+919000000101", reason: "dropped" });
    const justNow: PriorAttempt[] = [{ status: "requested", created_at: new Date(DAY.getTime() - 5 * 60_000).toISOString() }];
    expect(callbackEligibility(d(), justNow, DAY, "phone").ok).toBe(false);
    const two: PriorAttempt[] = [1, 2].map((n) => ({ status: "completed", created_at: new Date(DAY.getTime() - n * 3_600_000).toISOString() }));
    expect(callbackEligibility(d(), two, DAY, "phone").ok).toBe(false);
  });
});

describe("what the callback agent is told", () => {
  const brief = briefFor(lead({ fields: fields({ location: "Baner" }) }), "dropped");
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

import { autoCallbackEnabled } from "../src/lib/auto-callback";
describe("automatic callbacks", () => {
  it("need both switches on, so a missing phone number can never trigger a call", () => {
    expect(autoCallbackEnabled({})).toBe(false);
    expect(autoCallbackEnabled({ AUTO_CALLBACK_DROPPED: "true" })).toBe(false);
    expect(autoCallbackEnabled({ VANI_PHONE_CALLBACKS: "true" })).toBe(false);
    expect(autoCallbackEnabled({ VANI_PHONE_CALLBACKS: "true", AUTO_CALLBACK_DROPPED: "true" })).toBe(true);
  });
});

describe("which kind of callback", () => {
  it("live calls are rung when switched on; test calls always rehearse in the browser", () => {
    const on = { VANI_PHONE_CALLBACKS: "true" };
    expect(callbackMode("live", on)).toBe("phone");
    expect(callbackMode("test", on)).toBe("browser");
    expect(callbackMode("live", {})).toBe("browser");
  });
});

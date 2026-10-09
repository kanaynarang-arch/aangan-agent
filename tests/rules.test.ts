import { describe, expect, it } from "vitest";
import { RULES } from "../src/lib/rules";
import { buildVaniPrompt, VANI_GREETING } from "../src/lib/vani-prompt";
import { CASES } from "../fixtures/cases";
import { decide } from "../src/lib/scoring/decide";
import { isDroppedCall } from "../src/lib/scoring/dropped";
import { voiceCostInr, geminiCostInr } from "../src/lib/cost";
import type { ScoreOutput } from "../src/lib/scoring/schema";

/** Any rupee amount, lakh/crore figure, or per-sq-ft rate. */
const MONEY = [
  /₹\s*[\d,.]+/i,
  /\b(rs\.?|inr|rupees?)\s*[\d,.]+/i,
  /[\d,.]+\s*(rs\b|rupees?|lakhs?|lacs?|crores?|cr\b|k\b)/i,
  /\bper\s*(sq\.?\s*ft|square)/i,
  /\/\s*sq\.?\s*ft/i,
];
const hasMoney = (s: string) => MONEY.some((r) => r.test(s));

describe("no prices anywhere the agent speaks", () => {
  it("Vani prompt contains no rupee amount or rate", () => {
    const prompt = buildVaniPrompt();
    for (const r of MONEY) expect(prompt, String(r)).not.toMatch(r);
    expect(hasMoney(VANI_GREETING)).toBe(false);
  });

  it("Vani prompt contains the one allowed pricing answer, verbatim", () => {
    expect(buildVaniPrompt()).toContain(RULES.PRICING_ANSWER);
  });

  it("Vani prompt never tells the agent to ask for budget", () => {
    expect(buildVaniPrompt()).toMatch(/NEVER ask the caller about budget/);
  });

  it("no agent reply in any fixture contains a rupee amount", () => {
    for (const c of CASES) {
      for (const line of (c.transcript ?? "").split("\n")) {
        if (/^\s*agent\s*:/i.test(line)) expect(hasMoney(line), `${c.id}: ${line}`).toBe(false);
      }
    }
  });

  it("the detector itself catches the phrases the agent must never say", () => {
    for (const bad of ["It'll cost around ₹5 lakh", "Our rates start at Rs. 999", "typically 1000 per sq ft", "about 3 lakh"]) {
      expect(hasMoney(bad), bad).toBe(true);
    }
  });
});

function base(): ScoreOutput {
  const ok = () => ({ status: "met" as const, reason: "ok" });
  return {
    call_type: "enquiry",
    fields: {
      name: "A", phone: null, project_type: "residential", business_type: "home", location: "Baner, Pune",
      carpet_area_sqft: 900, scope: "full home", timeline: null, weeks_until_deadline: null, decision_maker: "caller",
      preferred_consultation: null, preferred_consultation_iso: null, asked_about_price: false, volunteered_budget: null,
    },
    intent: "design_and_execution",
    later_start_acceptable: "unknown",
    criteria: { real_project: ok(), service_area: ok(), timeline: ok(), budget: { status: "unclear", reason: "n/a" }, decision_maker: ok() },
    flags: { handle_with_care: false, handle_with_care_reason: null },
    tier: "green", reasons: [], uncertain: [], handoff_summary: "x",
  };
}

describe("tier logic", () => {
  it("green when 1-3 met and 4 unclear", () => expect(decide(base()).tier).toBe("green"));

  it("Nashik is red even if the model said met", () => {
    const o = base(); o.fields.location = "Nashik";
    expect(decide(o).tier).toBe("red");
  });

  it("under-6-week deadline with a later start is amber; without it is red", () => {
    const o = base(); o.fields.weeks_until_deadline = 3; o.later_start_acceptable = "yes";
    expect(decide(o).tier).toBe("amber");
    o.later_start_acceptable = "no";
    expect(decide(o).tier).toBe("red");
  });

  it("6 to 10 week completion deadline is amber, 10+ is green", () => {
    const o = base(); o.fields.weeks_until_deadline = 8;
    expect(decide(o).tier).toBe("amber");
    o.fields.weeks_until_deadline = 14;
    expect(decide(o).tier).toBe("green");
  });

  it("commercial under 500 sq ft and restaurants are red", () => {
    const o = base(); o.fields.project_type = "commercial"; o.fields.business_type = "office"; o.fields.carpet_area_sqft = 180;
    expect(decide(o).tier).toBe("red");
    const r = base(); r.fields.business_type = "restaurant_or_hotel";
    expect(decide(r).tier).toBe("red");
  });

  it("a volunteered budget that is clearly too low is red", () => {
    const o = base(); o.fields.volunteered_budget = "about a lakh"; o.criteria.budget = { status: "failed", reason: "too low" };
    expect(decide(o).tier).toBe("red");
  });

  it("a failed budget with nothing volunteered cannot fail the lead", () => {
    const o = base(); o.criteria.budget = { status: "failed", reason: "guess" };
    expect(decide(o).tier).toBe("green");
  });

  it("two failures is red; unclear 1-3 is amber; unclear 4 and 5 stay green", () => {
    const two = base(); two.criteria.real_project.status = "failed"; two.criteria.timeline.status = "failed";
    expect(decide(two).tier).toBe("red");
    const amber = base(); amber.criteria.service_area.status = "unclear"; amber.fields.location = "somewhere";
    expect(decide(amber).tier).toBe("amber");
    const g = base(); g.criteria.decision_maker.status = "unclear";
    expect(decide(g).tier).toBe("green");
  });

  it("existing-client complaints skip scoring", () => {
    const o = base(); o.call_type = "existing_client_complaint";
    expect(decide(o).tier).toBe("escalate");
  });
});

describe("dropped calls and costs", () => {
  it("flags empty, very short and wordless calls", () => {
    expect(isDroppedCall(null, 0)).toBe(true);
    expect(isDroppedCall("Caller: hello", 20)).toBe(true);
    expect(isDroppedCall("Agent: hi\nCaller: Hi I wanted to enquire about", 72)).toBe(true);
    expect(isDroppedCall(CASES.find((c) => c.id === "T01")!.transcript, 250)).toBe(false);
  });

  it("voice cost follows the real duration and the configured rate", () => {
    expect(voiceCostInr(60)).toBeCloseTo(RULES.VOICE_RATE_INR_PER_MIN, 4);
    expect(voiceCostInr(150)).toBeCloseTo(RULES.VOICE_RATE_INR_PER_MIN * 2.5, 4);
    expect(voiceCostInr(0)).toBe(0);
  });

  it("Gemini cost is tokens times the configured prices", () => {
    const usd = (2000 * RULES.GEMINI_INPUT_USD_PER_M + 500 * RULES.GEMINI_OUTPUT_USD_PER_M) / 1e6;
    expect(geminiCostInr(2000, 500)).toBeCloseTo(usd * RULES.USD_TO_INR, 3);
  });
});

import { parseVaniPayload, isFinalEvent, verifySignature, sign, transcriptToText } from "../src/lib/vani";

describe("Vani webhook parsing", () => {
  const body = {
    event: "call_postprocessing",
    call_id: "webrtc-123",
    timestamp: "2026-10-10T08:00:00+00:00",
    data: {
      call_id: "webrtc-123",
      call_duration: 55150.02,
      recording_url: "https://example.test/rec",
      transcript: "[13:33:14] AGENT: Hello\n\n[13:33:19] USER: Hi there, I want my flat redone",
    },
  };

  it("converts ms duration, labels speakers and derives start time", () => {
    const c = parseVaniPayload(body);
    expect(c.durationSeconds).toBe(55);
    expect(c.transcript).toBe("Agent: Hello\nCaller: Hi there, I want my flat redone");
    expect(c.startedAt.toISOString()).toBe("2026-10-10T07:59:04.849Z");
    expect(c.isWebCall).toBe(true);
  });

  it("only inbound phone calls count as live", () => {
    expect(parseVaniPayload({ ...body, call_id: "inbound-1", data: { ...body.data, call_id: "inbound-1" } }).isWebCall).toBe(false);
  });

  it("ignores non-final events", () => {
    expect(isFinalEvent({ event: "call_started" })).toBe(false);
    expect(isFinalEvent(body)).toBe(true);
  });

  it("verifies HMAC signatures and rejects bad ones", () => {
    const raw = JSON.stringify(body);
    expect(verifySignature(raw, sign(raw, "s3cret"), "s3cret")).toBe(true);
    expect(verifySignature(raw, sign(raw, "other"), "s3cret")).toBe(false);
    expect(verifySignature(raw, null, "s3cret")).toBe(false);
    expect(verifySignature(raw, sign(raw, "s3cret"), undefined)).toBe(false);
  });

  it("accepts array-style transcripts", () => {
    expect(transcriptToText([{ role: "assistant", text: "Hi" }, { role: "user", text: "Hello" }])).toBe("Agent: Hi\nCaller: Hello");
  });
});

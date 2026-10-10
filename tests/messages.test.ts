import { describe, expect, it } from "vitest";
import { handoffMessage, noteForLead, reviewMessage, whyLine } from "../src/lib/messages";
import type { Lead } from "../src/lib/integrations/types";

const lead = (over: Partial<Lead> = {}): Lead => ({
  callId: "c1",
  phone: "9000000001",
  tier: "green",
  fields: {
    name: "Asha", phone: "9000000001", project_type: "residential", business_type: "home", location: "Kothrud, Pune",
    carpet_area_sqft: 1400, scope: "full home redesign", timeline: "by March", weeks_until_deadline: 20,
    decision_maker: "caller and husband", preferred_consultation: "Monday 11am", preferred_consultation_iso: null,
    asked_about_price: true, volunteered_budget: null,
  },
  summary: "Asha wants a full redesign.",
  reasons: [
    "Residential 3BHK in Kothrud, inside Pune.",
    "Design and execution wanted.",
    "March completion is a realistic lead time.",
    "A fourth reason that should not appear.",
    "Rule check: timeline: unclear -> met (about 20 weeks is realistic)",
  ],
  uncertain: ["Budget not discussed (never asked)."],
  askedAboutPrice: true,
  handleWithCare: null,
  repeatCaller: false,
  recordingUrl: "https://example.test/rec",
  durationSeconds: 150,
  dashboardUrl: "https://example.test/calls/c1",
  ...over,
});

describe("whyLine", () => {
  it("joins at most three reasons into one short line", () => {
    const w = whyLine(lead().reasons);
    expect(w).toBe("Residential 3BHK in Kothrud, inside Pune; Design and execution wanted; March completion is a realistic lead time");
    expect(w).not.toMatch(/fourth reason|Rule check/);
  });

  it("falls back to rule checks when there is nothing else, and caps the length", () => {
    expect(whyLine(["Rule check: area: met (Baner is in the service area)"])).toBe("area: met (Baner is in the service area)");
    expect(whyLine(["x".repeat(400)]).length).toBeLessThanOrEqual(220);
    expect(whyLine([])).toBe("");
  });
});

describe("handoff and review notes", () => {
  it("handoff note has the Why green line and keeps every existing line", () => {
    const text = handoffMessage(lead(), "booked for 12 Oct, 11:00 am");
    expect(text).toContain("Why green: Residential 3BHK in Kothrud, inside Pune; Design and execution wanted");
    for (const must of ["NEW QUALIFIED LEAD (green)", "Name: Asha", "Phone: 9000000001", "Location: Kothrud, Pune", "Carpet area: 1400 sq ft",
      "Decision-maker: caller and husband", "Consultation: booked for", "Asked about price: yes", "Uncertain: Budget not discussed",
      "Asha wants a full redesign.", "Recording: https://example.test/rec", "Call: https://example.test/calls/c1"]) {
      expect(text, must).toContain(must);
    }
  });

  it("review note says Why amber, and Why red for a red lead", () => {
    const amber = reviewMessage(lead({ tier: "amber" }));
    expect(amber).toContain("NEEDS REVIEW (amber)");
    expect(amber).toContain("Why amber: ");
    const red = reviewMessage(lead({ tier: "red" }));
    expect(red).toContain("FOR CHECK (red)");
    expect(red).toContain("Why red: ");
  });

  it("an approved amber lead keeps its original tier in the Why label", () => {
    expect(handoffMessage(lead({ originalTier: "amber" }), null)).toContain("Why amber: ");
  });

  it("notes carry no rupee amount or rate", () => {
    const all = [handoffMessage(lead(), null), reviewMessage(lead({ tier: "amber" })), noteForLead(lead({ tier: "dropped" }), null)].join("\n");
    expect(all).not.toMatch(/₹|\brs\.?\s*\d|\d\s*lakh|per\s*sq/i);
  });

  it("noteForLead picks the right note for each tier", () => {
    expect(noteForLead(lead(), null)).toContain("NEW QUALIFIED LEAD");
    expect(noteForLead(lead({ tier: "amber" }), null)).toContain("NEEDS REVIEW");
    expect(noteForLead(lead({ tier: "escalate" }), null)).toContain("URGENT");
    expect(noteForLead(lead({ tier: "dropped" }), null)).toContain("DROPPED CALL");
  });
});

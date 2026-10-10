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
    expect(whyLine(["x".repeat(400)]).length).toBeLessThanOrEqual(160);
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

import { formatPhone, telHref } from "../src/components/ui";

describe("call back links", () => {
  it("builds a +91 tel link for Indian numbers in any common shape", () => {
    expect(telHref("9000000101")).toBe("tel:+919000000101");
    expect(telHref("09000000101")).toBe("tel:+919000000101");
    expect(telHref("919000000101")).toBe("tel:+919000000101");
    expect(telHref("+91 90000 00101")).toBe("tel:+919000000101");
    expect(telHref("+14155550123")).toBe("tel:+14155550123");
  });

  it("refuses numbers that are too short or missing", () => {
    expect(telHref("12345")).toBeNull();
    expect(telHref("")).toBeNull();
    expect(telHref(null)).toBeNull();
  });

  it("formats ten digits as 5 + 5 and leaves anything else alone", () => {
    expect(formatPhone("9000000101")).toBe("90000 00101");
    expect(formatPhone("+14155550123")).toBe("+14155550123");
  });
});

import { ago, initials } from "../src/lib/format";

describe("format helpers", () => {
  const now = new Date("2026-10-10T12:00:00+05:30");
  it("says how long ago in plain words", () => {
    expect(ago("2026-10-10T11:59:40+05:30", now)).toBe("just now");
    expect(ago("2026-10-10T11:48:00+05:30", now)).toBe("12 min ago");
    expect(ago("2026-10-10T09:00:00+05:30", now)).toBe("3 h ago");
    expect(ago("2026-10-09T11:00:00+05:30", now)).toBe("yesterday");
    expect(ago("2026-09-25T09:15:00+05:30", now)).toBe("25 Sept");
  });
  it("builds avatar initials", () => {
    expect(initials("Priya Sharma")).toBe("PS");
    expect(initials("Gopal")).toBe("G");
    expect(initials(null, "9000000101")).toBe("01");
    expect(initials(null, null)).toBe("?");
  });
});

import { callbackProblemMessage, droppedMessage } from "../src/lib/messages";
describe("dropped call and callback alerts", () => {
  const lead: Lead = { callId: "c1", phone: "9000000017", tier: "dropped", fields: null, summary: "", reasons: [], uncertain: [], askedAboutPrice: false, handleWithCare: null, repeatCaller: false, recordingUrl: null, durationSeconds: 12, dashboardUrl: "https://x/calls/c1" };
  it("a plain dropped call asks someone to call back", () => {
    expect(droppedMessage({ ...lead })).toMatch(/please call back/);
  });
  it("says Vani is ringing back, and when, so designers do not ring at the same moment", () => {
    expect(droppedMessage({ ...lead }, "now")).toMatch(/Vani is ringing this number back now/);
    expect(droppedMessage({ ...lead }, "morning")).toMatch(/about 10am/);
    expect(droppedMessage({ ...lead }, "now")).not.toMatch(/please call back/);
  });
  it("a failed or empty callback asks a person to ring, with the number and the link", () => {
    const failed = callbackProblemMessage({ ...lead }, "failed", "Vani could not start the call");
    expect(failed).toMatch(/CALLBACK FAILED: please call back/);
    expect(failed).toContain("9000000017");
    expect(failed).toContain("https://x/calls/c1");
    expect(callbackProblemMessage({ ...lead }, "unanswered")).toMatch(/GOT NOTHING/);
  });
});

import { placeholderEmail } from "../src/lib/integrations/calcom";
describe("Cal.com attendee email", () => {
  it("uses a plus-address of the studio email, so confirmations go to the studio", () => {
    expect(placeholderEmail("90000 00101", "desk@studio.in")).toBe("desk+lead-9000000101@studio.in");
  });
  it("falls back to the reserved address when no studio email is set or it looks wrong", () => {
    expect(placeholderEmail("9000000101", undefined)).toMatch(/@leads\.aangan-studio\.example$/);
    expect(placeholderEmail("9000000101", "not an email")).toMatch(/\.example$/);
  });
});

describe("amber and red say what held them back", () => {
  it("puts the rule check first, so the reason is not hidden behind the good points", () => {
    const reasons = ["Project is a residential home in Pune.", "Timeline of eight weeks is acceptable.", "Rule check: timeline: met -> unclear (needs completion in about 8 weeks, tight against 6 to 10 weeks)"];
    expect(whyLine(reasons, 3, 400, true)).toMatch(/^timeline: met -> unclear/);
    expect(whyLine(reasons, 3, 400, false)).not.toMatch(/unclear/);
  });
});

import { safeHttpUrl } from "../src/components/ui";
describe("recording links", () => {
  it("only follows http and https", () => {
    expect(safeHttpUrl("https://app.vaanivoice.ai/api/stream/x?token=1")).toContain("https://");
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("data:text/html,x")).toBeNull();
    expect(safeHttpUrl(null)).toBeNull();
    expect(safeHttpUrl("not a url")).toBeNull();
  });
});

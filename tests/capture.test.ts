import { describe, expect, it } from "vitest";
import { captureSummary } from "../src/lib/capture";
import type { ScoreOutput } from "../src/lib/scoring/schema";

const full = (): ScoreOutput["fields"] => ({
  name: "Asha", phone: "9000000001", project_type: "residential", business_type: "home", location: "Kothrud, Pune",
  carpet_area_sqft: 1400, scope: "full home", timeline: "by March", weeks_until_deadline: 20, decision_maker: "caller and husband",
  preferred_consultation: "Monday 11am", preferred_consultation_iso: null, asked_about_price: false, volunteered_budget: null,
});

describe("captureSummary", () => {
  it("counts all nine answers when nothing is missing", () => {
    const c = captureSummary(full(), "9000000001");
    expect(c.answered).toBe(9);
    expect(c.total).toBe(9);
    expect(c.toCover).toEqual([]);
  });

  it("lists what is still to ask, and adds the price note when price was asked", () => {
    const f = { ...full(), carpet_area_sqft: null, preferred_consultation: null, asked_about_price: true };
    const c = captureSummary(f, "9000000001");
    expect(c.answered).toBe(7);
    expect(c.toCover).toContain("Ask: carpet area");
    expect(c.toCover).toContain("Ask: preferred consultation time");
    expect(c.toCover.some((t) => /Price: the caller asked/.test(t))).toBe(true);
  });

  it("never lists budget, and treats an unclear project type as not captured", () => {
    const c = captureSummary({ ...full(), project_type: "unclear" }, "9000000001");
    expect(c.toCover).toEqual(["Ask: home or commercial"]);
    expect(JSON.stringify(c)).not.toMatch(/budget/i);
  });

  it("handles a call with nothing captured", () => {
    const c = captureSummary(null, null);
    expect(c.answered).toBe(0);
    expect(c.toCover.length).toBe(9);
  });
});

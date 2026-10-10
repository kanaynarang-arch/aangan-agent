import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("components map", () => {
  const svg = readFileSync("docs/components-map.svg", "utf8");

  it("has exactly the six labels, in order", () => {
    const labels = [...svg.matchAll(/<text class="label"[^>]*>([^<]+)<\/text>/g)].map((m) => m[1]);
    expect(labels).toEqual(["Trigger", "Input", "Context", "Processing", "AI", "Output"]);
  });

  it("has a short caption under every label, and no prices", () => {
    const caps = [...svg.matchAll(/<text class="cap"/g)].length;
    expect(caps).toBeGreaterThanOrEqual(6 * 3);
    expect(svg).not.toMatch(/₹|\blakh|per sq/i);
  });
});

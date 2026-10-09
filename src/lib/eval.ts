import type { Case } from "../../fixtures/cases";
import { runGemini, type GeminiRun } from "./scoring/gemini";
import { decide, type Decision } from "./scoring/decide";
import { isDroppedCall } from "./scoring/dropped";
import { callDateLabel } from "./time";

export interface CaseResult {
  case: Case;
  tier: string;
  decision: Decision | null;
  run: GeminiRun | null;
  checks: { name: string; ok: boolean; detail?: string }[];
  pass: boolean;
}

/** Same scoring path the webhook uses (dropped check, Gemini, deterministic decide), without storage. */
export async function evaluateCase(c: Case): Promise<CaseResult> {
  const startedUtc = new Date(`${c.startedAtLocal}:00+05:30`);
  const checks: CaseResult["checks"] = [];
  let decision: Decision | null = null;
  let run: GeminiRun | null = null;
  let tier: string;

  if (isDroppedCall(c.transcript, c.durationSeconds)) {
    tier = "dropped";
  } else {
    run = await runGemini({ transcript: c.transcript!, callDate: callDateLabel(startedUtc), durationSeconds: c.durationSeconds });
    decision = decide(run.output);
    tier = decision.tier;
  }

  checks.push({ name: `tier ${c.expected.tier}`, ok: tier === c.expected.tier, detail: `got ${tier}` });
  if (c.expected.askedPrice !== undefined) {
    const got = Boolean(run?.output.fields.asked_about_price);
    checks.push({ name: "asked about price flag", ok: got === c.expected.askedPrice, detail: `got ${got}` });
  }
  if (c.expected.handleWithCare !== undefined) {
    const got = Boolean(run?.output.flags.handle_with_care);
    checks.push({ name: "handle with care flag", ok: got === c.expected.handleWithCare, detail: `got ${got}` });
  }
  if (c.expected.uncertain) {
    const joined = (decision?.uncertain ?? []).join(" | ");
    checks.push({ name: `uncertain mentions ${c.expected.uncertain}`, ok: c.expected.uncertain.test(joined), detail: joined.slice(0, 160) });
  }
  return { case: c, tier, decision, run, checks, pass: checks.every((x) => x.ok) };
}

import "dotenv/config";
import { CASES } from "../fixtures/cases";
import { query } from "../src/lib/db";
import { processCall } from "../src/lib/pipeline";
import { isOutsideHours } from "../src/lib/time";

/**
 * Runs every fixture through the real pipeline (same code the webhook uses)
 * and stores the results as source='test' rows, so they show on the dashboard.
 * Test rows never trigger HubSpot, Telegram or Cal.com; the actions table
 * records what would have been sent.
 */
async function main() {
  await query("delete from calls where source = 'test' and fixture_id is not null");
  const ids: Record<string, string> = {};
  for (const c of CASES) {
    const startedAt = new Date(`${c.startedAtLocal}:00+05:30`);
    const r = await query<{ id: string }>(
      `insert into calls (source, fixture_id, caller_phone, started_at, duration_seconds, transcript, expected_tier, outside_hours)
       values ('test', $1, $2, $3, $4, $5, $6, $7) returning id`,
      [c.id, c.phone, startedAt.toISOString(), c.durationSeconds, c.transcript, c.expected.tier, isOutsideHours(startedAt)],
    );
    ids[c.id] = r[0].id;
  }
  // Sequential so repeat-caller detection (T17a before T17) is stable.
  await Promise.all(CASES.map((c) => processCall(ids[c.id])));

  const rows = await query<Record<string, any>>(
    "select fixture_id, tier, expected_tier, flags, uncertain, status, error, ai_cost_inr, voice_cost_inr from calls where source = 'test' and fixture_id is not null order by fixture_id",
  );
  let pass = 0;
  for (const c of CASES) {
    const r = rows.find((x) => x.fixture_id === c.id)!;
    const checks: string[] = [];
    if (r.tier !== c.expected.tier) checks.push(`tier ${r.tier} != ${c.expected.tier}`);
    if (c.expected.askedPrice !== undefined && Boolean(r.flags?.asked_about_price) !== c.expected.askedPrice) checks.push("price flag");
    if (c.expected.handleWithCare !== undefined && Boolean(r.flags?.handle_with_care) !== c.expected.handleWithCare) checks.push("handle-with-care flag");
    if (c.expected.uncertain && !c.expected.uncertain.test((r.uncertain ?? []).join(" | "))) checks.push("uncertainty note");
    if (r.status !== "processed") checks.push(`status ${r.status}: ${r.error}`);
    if (checks.length === 0) pass++;
    console.log(`${checks.length === 0 ? "PASS" : "FAIL"} ${c.id} ${r.tier}${checks.length ? "  <- " + checks.join("; ") : ""}`);
  }
  const ai = rows.reduce((n, r) => n + Number(r.ai_cost_inr), 0);
  console.log(`\n${pass}/${CASES.length} pass. AI cost for this run: Rs ${ai.toFixed(4)}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });

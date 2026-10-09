import "dotenv/config";
import { CASES } from "../fixtures/cases";
import { evaluateCase } from "../src/lib/eval";

async function main() {
  const only = process.argv.slice(2);
  const cases = only.length ? CASES.filter((c) => only.includes(c.id)) : CASES;
  const results = await Promise.all(cases.map(evaluateCase));
  let inT = 0, outT = 0, cost = 0;
  for (const r of results) {
    console.log(`${r.pass ? "PASS" : "FAIL"} ${r.case.id}  expected=${r.case.expected.tier} got=${r.tier}`);
    for (const ch of r.checks.filter((x) => !x.ok)) console.log(`     x ${ch.name}: ${ch.detail}`);
    if (!r.pass && r.decision) console.log("     reasons:", r.decision.reasons.join(" | "));
    if (r.run) { inT += r.run.inputTokens; outT += r.run.outputTokens; cost += r.run.costInr; }
  }
  console.log(`\n${results.filter((r) => r.pass).length}/${results.length} pass. tokens in=${inT} out=${outT} cost=Rs ${cost.toFixed(4)}`);
}
main().catch((e) => { console.error(e.message); process.exit(1); });

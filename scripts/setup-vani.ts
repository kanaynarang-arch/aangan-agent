import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { buildVaniPrompt, VANI_GREETING } from "../src/lib/vani-prompt";

/**
 * Creates (or updates) the Aangan agent in Vani through its API and writes
 * VANI_AGENT_ID to .env. Safe to re-run: it updates the prompt in place.
 * The webhook URL is registered in the Vani dashboard (Developers > Webhooks);
 * the public API does not cover that.
 */
const BASE = "https://api.vaanivoice.ai/api";
const MAX_CALL_MINUTES = Number(process.env.VANI_MAX_CALL_MINUTES ?? 6);

async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "X-API-Key": process.env.VANI_API_KEY!, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: { agent_id?: string } | null = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 300)}`);
  return json;
}

function saveEnv(key: string, value: string) {
  const lines = readFileSync(".env", "utf8").split("\n").filter((l) => l && !l.startsWith(`${key}=`));
  lines.push(`${key}=${value}`);
  writeFileSync(".env", lines.join("\n") + "\n", { mode: 0o600 });
}

async function main() {
  if (!process.env.VANI_API_KEY) throw new Error("VANI_API_KEY is not set");
  let agentId = process.env.VANI_AGENT_ID;

  if (!agentId) {
    const created = await call("POST", "/create-agent", { agent_display_name: "Aangan Studio assistant" });
    agentId = created?.agent_id as string;
    saveEnv("VANI_AGENT_ID", agentId);
    console.log("created agent", agentId);
  } else {
    console.log("updating agent", agentId);
  }

  await call("PATCH", `/agent/${agentId}/persona`, {
    identity: {
      system_prompt: buildVaniPrompt(),
      personality: { tone: "warm", style: "brief and honest" },
      greeting_message: {
        agent_message: VANI_GREETING,
        agent_speech_delay: 1,
        interruptible: true,
        let_user_speak_first: false,
      },
    },
    // English plus Hindi: primary English with automatic language detection.
    senses_capabilities: { language: "en", auto_detect: true },
  });
  console.log("persona set (prompt, greeting, English + Hindi auto-detect)");

  await call("PATCH", `/agent/${agentId}/experience`, {
    settings: {
      call_settings: { max_call_duration: MAX_CALL_MINUTES, max_duration_enabled: true },
      idle_conversation_settings: { pulse_check: true, end_conversation_on_idle: true, idle_call_warning_timeout: 12, idle_call_hangup_timeout: 25 },
    },
  });
  console.log(`call cap set to ${MAX_CALL_MINUTES} minutes`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });

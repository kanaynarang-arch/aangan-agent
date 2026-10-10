import { query } from "./db";
import { RULES, type Tier } from "./rules";
import type { ScoreOutput } from "./scoring/schema";

export type SourceFilter = "all" | "live" | "test";
export type ListFilter = "all" | "verify" | "urgent" | "handed";

export interface CallListItem {
  id: string; source: "live" | "test"; fixture_id: string | null; caller_phone: string | null; started_at: string;
  duration_seconds: number; tier: string | null; status: string; outcome: string | null; review_status: string;
  fields: { name?: string | null; location?: string | null; scope?: string | null } | null;
  flags: CallFlags | null;
  consultation_booked: boolean;
}

export interface CallFlags {
  asked_about_price?: boolean;
  handle_with_care?: string | null;
  repeat_caller?: boolean;
}

/** One row of the calls table, as the detail page reads it. Numeric columns arrive as strings. */
export interface CallRecord {
  id: string;
  source: "live" | "test";
  vani_call_id: string | null;
  fixture_id: string | null;
  caller_phone: string | null;
  started_at: string;
  duration_seconds: number;
  recording_url: string | null;
  transcript: string | null;
  tier: Tier | null;
  ai_tier: string | null;
  status: string;
  outcome: string | null;
  review_status: string;
  fields: ScoreOutput["fields"] | null;
  criteria: Record<string, { status: string; reason: string }> | null;
  reasons: string[] | null;
  uncertain: string[] | null;
  flags: CallFlags | null;
  handoff_summary: string | null;
  consultation_booked: boolean;
  consultation_at: string | null;
  voice_cost_inr: string;
  ai_cost_inr: string;
  error: string | null;
}

export interface ActionRecord {
  id: string;
  channel: "hubspot" | "telegram" | "calcom";
  status: "sent" | "booked" | "skipped_test" | "dry_run" | "failed";
  detail: Record<string, unknown> | null;
  external_id: string | null;
}

export interface AiRunRecord {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_inr: string;
}

const srcClause = (s: SourceFilter, n = 1) => (s === "all" ? { sql: "true", params: [] as unknown[] } : { sql: `source = $${n}`, params: [s] });

export async function listCalls(filter: ListFilter, source: SourceFilter): Promise<CallListItem[]> {
  const src = srcClause(source);
  const where = {
    all: "true",
    verify: "review_status = 'pending'",
    urgent: "tier in ('escalate','dropped')",
    handed: "tier = 'green'",
  }[filter];
  return query<CallListItem>(
    `select id, source, fixture_id, caller_phone, started_at, duration_seconds, tier, status, outcome, review_status, fields, flags, consultation_booked
     from calls where ${where} and ${src.sql} order by started_at desc limit 200`,
    src.params,
  );
}

export async function filterCounts(source: SourceFilter) {
  const src = srcClause(source);
  const r = await query<{ all: string; verify: string; urgent: string; handed: string }>(
    `select count(*) as "all",
       count(*) filter (where review_status = 'pending') as verify,
       count(*) filter (where tier in ('escalate','dropped')) as urgent,
       count(*) filter (where tier = 'green') as handed
     from calls where ${src.sql}`, src.params);
  const x = r[0];
  return { all: +x.all, verify: +x.verify, urgent: +x.urgent, handed: +x.handed };
}

export async function getCall(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await query<CallRecord>("select * from calls where id = $1", [id]);
  if (!rows[0]) return null;
  const actions = await query<ActionRecord>("select * from actions where call_id = $1 order by created_at", [id]);
  const runs = await query<AiRunRecord>("select * from ai_runs where call_id = $1 order by created_at", [id]);
  return { call: rows[0], actions, runs };
}

export async function pipelineMetrics(source: SourceFilter) {
  const src = srcClause(source);
  const [t] = await query<Record<string, string>>(
    `select count(*) as received,
       count(*) filter (where answered_at is not null and extract(epoch from (answered_at - started_at)) <= ${RULES.ANSWER_SLA_SECONDS}) as answered_5,
       count(*) filter (where outside_hours) as outside,
       count(*) filter (where consultation_booked) as booked,
       count(*) filter (where status = 'failed') as failed,
       coalesce(sum(voice_cost_inr),0) as voice, coalesce(sum(ai_cost_inr),0) as ai
     from calls where ${src.sql}`, src.params);
  const tiers = await query<{ tier: string; n: string }>(
    `select coalesce(tier,'pending') as tier, count(*) as n from calls where ${src.sql} group by 1`, src.params);
  const monthly = await query<{ month: string; calls: string; voice: string; ai: string }>(
    `select to_char(started_at at time zone '${RULES.TIME_ZONE}', 'YYYY-MM') as month, count(*) as calls,
       sum(voice_cost_inr) as voice, sum(ai_cost_inr) as ai
     from calls where ${src.sql} group by 1 order by 1 desc limit 12`, src.params);
  const received = +t.received;
  const voice = +t.voice, ai = +t.ai;
  return {
    received, answered5: +t.answered_5, outside: +t.outside, booked: +t.booked, failed: +t.failed,
    voice, ai, total: voice + ai, perCall: received ? (voice + ai) / received : 0,
    tiers: Object.fromEntries(tiers.map((x) => [x.tier, +x.n])) as Record<string, number>,
    monthly: monthly.map((m) => ({ month: m.month, calls: +m.calls, voice: +m.voice, ai: +m.ai, total: +m.voice + +m.ai })),
  };
}

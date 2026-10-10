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

export const TIER_OPTIONS = ["green", "amber", "red", "escalate", "dropped"] as const;
export type TierOption = (typeof TIER_OPTIONS)[number];

export interface ListOptions {
  q?: string;
  tier?: TierOption;
}

/** Escape LIKE wildcards so a search for "100%" or "a_b" matches literally. */
const likeEscape = (v: string) => v.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function listCalls(filter: ListFilter, source: SourceFilter, opts: ListOptions = {}): Promise<CallListItem[]> {
  const params: unknown[] = [];
  const where: string[] = [
    { all: "true", verify: "review_status = 'pending'", urgent: "tier in ('escalate','dropped')", handed: "tier = 'green'" }[filter],
  ];
  if (source !== "all") {
    params.push(source);
    where.push(`source = $${params.length}`);
  }
  if (opts.tier) {
    params.push(opts.tier);
    where.push(`tier = $${params.length}`);
  }
  const q = opts.q?.trim().slice(0, 80);
  if (q) {
    params.push(`%${likeEscape(q)}%`);
    const n = params.length;
    const ors = [`fields->>'name' ilike $${n}`, `fields->>'location' ilike $${n}`, `caller_phone ilike $${n}`];
    const digits = q.replace(/\D/g, "");
    if (digits.length >= 3 && digits.length >= q.replace(/\s/g, "").length - 2) {
      params.push(`%${digits}%`);
      ors.push(`caller_phone ilike $${params.length}`);
    }
    where.push(`(${ors.join(" or ")})`);
  }
  return query<CallListItem>(
    `select id, source, fixture_id, caller_phone, started_at, duration_seconds, tier, status, outcome, review_status, fields, flags, consultation_booked
     from calls where ${where.join(" and ")} order by started_at desc limit 200`,
    params,
  );
}

/** How many live (non-test) calls exist. Decides the Pipeline view's default. */
export async function liveCallCount(): Promise<number> {
  const r = await query<{ n: string }>("select count(*) as n from calls where source = 'live'");
  return Number(r[0]?.n ?? 0);
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
       count(*) filter (where source = 'test') as test_calls,
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
    received, answered5: +t.answered_5, outside: +t.outside, booked: +t.booked, failed: +t.failed, testCalls: +t.test_calls,
    voice, ai, total: voice + ai, perCall: received ? (voice + ai) / received : 0,
    tiers: Object.fromEntries(tiers.map((x) => [x.tier, +x.n])) as Record<string, number>,
    monthly: monthly.map((m) => ({ month: m.month, calls: +m.calls, voice: +m.voice, ai: +m.ai, total: +m.voice + +m.ai })),
  };
}

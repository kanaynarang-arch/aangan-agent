import type { ScoreOutput } from "../scoring/schema";

/** Everything an integration needs to know about a processed lead. */
export interface Lead {
  callId: string;
  phone: string | null;
  tier: "green" | "amber" | "red" | "escalate" | "dropped";
  fields: ScoreOutput["fields"] | null;
  summary: string;
  uncertain: string[];
  askedAboutPrice: boolean;
  handleWithCare: string | null;
  repeatCaller: boolean;
  recordingUrl: string | null;
  durationSeconds: number;
  dashboardUrl: string;
}

export interface ActionResult {
  channel: "hubspot" | "telegram" | "calcom";
  status: "sent" | "booked" | "skipped_test" | "dry_run" | "failed";
  detail: Record<string, unknown>;
  externalId?: string;
}

/** test = source is 'test' (never touches the outside world); dry = flag off; live = real call. */
export type Mode = "test" | "dry" | "live";

export function modeFor(source: "live" | "test"): Mode {
  if (source === "test") return "test";
  return process.env.LIVE_INTEGRATIONS === "true" ? "live" : "dry";
}

export function previewStatus(mode: Mode): "skipped_test" | "dry_run" {
  return mode === "test" ? "skipped_test" : "dry_run";
}

export async function fetchJson(url: string, init: RequestInit & { timeoutMs?: number } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 15000);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* non-JSON body */
    }
    // Third-party JSON: its shape is checked where each field is read.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { ok: res.ok, status: res.status, json: json as Record<string, any> | null, text };
  } finally {
    clearTimeout(t);
  }
}

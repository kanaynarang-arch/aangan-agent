import { timingSafeEqual } from "node:crypto";
import { processCall } from "@/lib/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Runs a stored call through scoring and routing again, for example after a parsing fix. It sends to the outside services
 * exactly as a new call would, so it is guarded by the same secret as the cron sweep and refuses everything without it.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret ?? ""}`;
  if (!secret || got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "id required" }, { status: 400 });
  await processCall(id, { force: true });
  return Response.json({ ok: true, id });
}

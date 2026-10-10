import { timingSafeEqual } from "node:crypto";
import { sweepDroppedCallbacks } from "@/lib/auto-callback";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Vercel Cron calls this each morning with `Authorization: Bearer $CRON_SECRET`. Anyone else is turned away. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret ?? ""}`;
  const ok = Boolean(secret) && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
  if (!ok) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json(await sweepDroppedCallbacks());
}

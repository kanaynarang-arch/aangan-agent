import { fetchJson, previewStatus, type ActionResult, type Mode } from "./types";

export async function sendTelegram(mode: Mode, text: string, kind: string): Promise<ActionResult> {
  if (mode !== "live") return { channel: "telegram", status: previewStatus(mode), detail: { kind, preview: text } };
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { channel: "telegram", status: "failed", detail: { kind, error: "Telegram env vars missing", preview: text } };
  try {
    const r = await fetchJson(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
    if (!r.ok) return { channel: "telegram", status: "failed", detail: { kind, http: r.status, error: r.json?.description ?? "send failed", preview: text } };
    return { channel: "telegram", status: "sent", detail: { kind, preview: text }, externalId: String(r.json?.result?.message_id ?? "") };
  } catch (e) {
    return { channel: "telegram", status: "failed", detail: { kind, error: (e as Error).message, preview: text } };
  }
}

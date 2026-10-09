import { RULES } from "../rules";
import { geminiCostInr } from "../cost";
import { ScoreSchema, scoreJsonSchema, type ScoreOutput } from "./schema";
import { scoringSystemPrompt, scoringUserPrompt } from "./prompt";

export interface GeminiRun {
  output: ScoreOutput;
  model: string;
  inputTokens: number;
  outputTokens: number; // includes thinking tokens, which are billed as output
  costInr: number;
  latencyMs: number;
}

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export async function runGemini(args: {
  transcript: string;
  callDate: string;
  durationSeconds: number;
}): Promise<GeminiRun> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const model = RULES.GEMINI_MODEL;

  const body = {
    systemInstruction: { parts: [{ text: scoringSystemPrompt() }] },
    contents: [{ role: "user", parts: [{ text: scoringUserPrompt(args) }] }],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseJsonSchema: scoreJsonSchema(),
    },
  };

  let lastErr: unknown;
  let inputTokens = 0;
  let outputTokens = 0;
  const started = Date.now();
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${ENDPOINT}/${model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(body),
      });
      if (res.status === 429 || res.status >= 500) throw new Error(`Gemini HTTP ${res.status}`);
      const json = (await res.json()) as GeminiResponse;
      if (!res.ok) throw Object.assign(new Error(`Gemini HTTP ${res.status}: ${json.error?.message ?? ""}`), { fatal: true });
      const u = json.usageMetadata ?? {};
      inputTokens += u.promptTokenCount ?? 0;
      outputTokens += (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0);
      const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      const output = ScoreSchema.parse(JSON.parse(text));
      return {
        output,
        model,
        inputTokens,
        outputTokens,
        costInr: geminiCostInr(inputTokens, outputTokens),
        latencyMs: Date.now() - started,
      };
    } catch (e) {
      lastErr = e;
      if ((e as { fatal?: boolean }).fatal) break;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  throw new Error(`Gemini scoring failed: ${(lastErr as Error)?.message ?? lastErr}`);
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  error?: { message?: string };
}

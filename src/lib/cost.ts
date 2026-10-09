import { RULES } from "./rules";

/** Voice cost from the real call duration, rupees. */
export function voiceCostInr(durationSeconds: number): number {
  return round4((Math.max(0, durationSeconds) / 60) * RULES.VOICE_RATE_INR_PER_MIN);
}

export function geminiCostUsd(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens * RULES.GEMINI_INPUT_USD_PER_M +
      outputTokens * RULES.GEMINI_OUTPUT_USD_PER_M) /
    1_000_000
  );
}

export function geminiCostInr(inputTokens: number, outputTokens: number): number {
  return round4(geminiCostUsd(inputTokens, outputTokens) * RULES.USD_TO_INR);
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

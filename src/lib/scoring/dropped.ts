import { RULES } from "../rules";

/** Callers' spoken words in the transcript (lines starting with "Caller:" or "User:"). */
export function callerWordCount(transcript: string | null): number {
  if (!transcript) return 0;
  let words = 0;
  for (const line of transcript.split("\n")) {
    const m = line.match(/^\s*(caller|user|customer)\s*:\s*(.*)$/i);
    if (m) words += m[2].trim().split(/\s+/).filter(Boolean).length;
  }
  // Transcript without speaker labels: count everything.
  if (words === 0 && !/^\s*\w[\w ]*:/m.test(transcript)) words = transcript.trim().split(/\s+/).filter(Boolean).length;
  return words;
}

/** Very short call, or nothing said that qualifies. No AI call is spent on these. */
export function isDroppedCall(transcript: string | null, durationSeconds: number): boolean {
  if (!transcript || transcript.trim().length === 0) return true;
  // A length of 0 means unknown (some payloads omit it), so judge by what was said instead.
  if (durationSeconds > 0 && durationSeconds < RULES.DROPPED_MAX_SECONDS) return true;
  return callerWordCount(transcript) < RULES.DROPPED_MIN_CALLER_WORDS;
}

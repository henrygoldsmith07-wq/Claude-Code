import type { VoiceTurnMetrics } from "./types";

// ---------------------------------------------------------------------------
// Voice practice metrics.
//
// Hard constraint, enforced by the shape of this module: the only inputs are a
// transcript, its word timings and pause lengths. No audio features — no pitch,
// timbre, formants, energy — are extracted or stored anywhere. That is not an
// oversight to be optimised later; it is what makes it structurally impossible
// for this code to infer accent, gender, age, health or emotional state from a
// user's voice.
//
// What is left is mechanics: pace, fillers, pauses, length, turn share. All
// actionable, all things a person can change on purpose, none of them a
// judgement about the speaker.
// ---------------------------------------------------------------------------

/** Fillers as spoken. "Like" and "so" are contextual and only counted mid-sentence. */
const HARD_FILLERS = ["um", "uh", "erm", "ah", "mm"];
const SOFT_FILLERS = ["like", "you know", "i mean", "basically", "literally", "sort of", "kind of", "right"];

export interface TranscriptWord {
  word: string;
  /** Milliseconds from the start of the turn. */
  startMs: number;
  endMs: number;
}

export const LONG_PAUSE_MS = 1500;

/** Conversational English sits around here; outside it, pace is worth mentioning. */
export const COMFORTABLE_WPM = { min: 120, max: 175, ideal: 150 };

export function analyseTurn(words: TranscriptWord[], durationMs?: number): VoiceTurnMetrics {
  if (words.length === 0) {
    return {
      durationMs: durationMs ?? 0,
      wordCount: 0,
      wordsPerMinute: 0,
      fillerCount: 0,
      fillerWords: [],
      longPauseCount: 0,
      longestPauseMs: 0,
    };
  }

  const first = words[0];
  const last = words[words.length - 1];
  const spanMs = durationMs ?? (first && last ? last.endMs - first.startMs : 0);
  const minutes = Math.max(spanMs, 1) / 60_000;

  let longPauseCount = 0;
  let longestPauseMs = 0;
  for (let i = 1; i < words.length; i += 1) {
    const previous = words[i - 1];
    const current = words[i];
    if (!previous || !current) continue;
    const gap = current.startMs - previous.endMs;
    if (gap > longestPauseMs) longestPauseMs = gap;
    if (gap >= LONG_PAUSE_MS) longPauseCount += 1;
  }

  const found: string[] = [];
  const lower = words.map((item) => item.word.toLowerCase().replace(/[^a-z']/g, ""));
  for (let i = 0; i < lower.length; i += 1) {
    const word = lower[i];
    if (!word) continue;
    if (HARD_FILLERS.includes(word)) {
      found.push(word);
      continue;
    }
    const pair = `${word} ${lower[i + 1] ?? ""}`.trim();
    if (SOFT_FILLERS.includes(pair)) {
      found.push(pair);
      i += 1;
      continue;
    }
    // "like" only counts as a filler away from a sentence boundary.
    if (SOFT_FILLERS.includes(word) && i > 0 && i < lower.length - 1) found.push(word);
  }

  return {
    durationMs: spanMs,
    wordCount: words.length,
    wordsPerMinute: Math.round(words.length / minutes),
    fillerCount: found.length,
    fillerWords: [...new Set(found)],
    longPauseCount,
    longestPauseMs,
  };
}

export interface VoiceFeedback {
  /** Plain observations, each tied to a number the user can check. */
  observations: string[];
  /** At most one thing to change next time. */
  suggestion: string | null;
}

/**
 * Turn metrics into advice. Ranked so only the most useful item is surfaced:
 * being told four things about your voice at once changes none of them.
 */
export function feedbackFor(metrics: VoiceTurnMetrics[]): VoiceFeedback {
  const usable = metrics.filter((item) => item.wordCount >= 8);
  if (usable.length === 0) {
    return { observations: ["Not enough speech yet to say anything useful."], suggestion: null };
  }

  const totalWords = usable.reduce((sum, item) => sum + item.wordCount, 0);
  const totalMinutes = usable.reduce((sum, item) => sum + item.durationMs, 0) / 60_000;
  const wpm = Math.round(totalWords / Math.max(totalMinutes, 0.01));
  const fillers = usable.reduce((sum, item) => sum + item.fillerCount, 0);
  const fillersPer100 = (fillers / totalWords) * 100;
  const longPauses = usable.reduce((sum, item) => sum + item.longPauseCount, 0);
  const averageWords = Math.round(totalWords / usable.length);
  const share = usable[0]?.turnShare;

  const observations = [
    `Around ${wpm} words per minute across ${usable.length} turn${usable.length === 1 ? "" : "s"}.`,
    `${fillers} filler${fillers === 1 ? "" : "s"} (${fillersPer100.toFixed(1)} per 100 words).`,
    `Average reply ${averageWords} words${longPauses > 0 ? `, ${longPauses} pause${longPauses === 1 ? "" : "s"} over 1.5 seconds` : ""}.`,
  ];
  if (share !== undefined) observations.push(`You spoke for about ${Math.round(share * 100)}% of the exchange.`);

  // One suggestion, chosen by which measure is furthest outside a comfortable range.
  const candidates: { severity: number; text: string }[] = [];
  if (wpm > COMFORTABLE_WPM.max) {
    candidates.push({
      severity: (wpm - COMFORTABLE_WPM.max) / 50,
      text: `You are running fast at ${wpm} wpm. Pick the one sentence carrying your point and slow down for that — not the whole turn.`,
    });
  }
  if (wpm < COMFORTABLE_WPM.min) {
    candidates.push({
      severity: (COMFORTABLE_WPM.min - wpm) / 50,
      text: `At ${wpm} wpm you are quite deliberate. That is fine for emphasis; check it is not the whole turn.`,
    });
  }
  if (fillersPer100 > 6) {
    candidates.push({
      severity: (fillersPer100 - 6) / 6,
      text: `Fillers are running at ${fillersPer100.toFixed(1)} per 100 words. The replacement is a pause, not a faster start — try stopping instead of saying "um".`,
    });
  }
  if (averageWords > 90) {
    candidates.push({
      severity: (averageWords - 90) / 60,
      text: `Replies are averaging ${averageWords} words. Landing them with a question would give each turn an ending.`,
    });
  }
  if (averageWords < 8) {
    candidates.push({
      severity: (8 - averageWords) / 8,
      text: `Replies are averaging ${averageWords} words, which leaves the other person doing the work. One extra sentence of substance is usually enough.`,
    });
  }

  const best = candidates.sort((a, b) => b.severity - a.severity)[0];
  return { observations, suggestion: best?.text ?? "Pace, fillers and reply length are all in a comfortable range." };
}

/** Turn share across a conversation, added to each turn's metrics. */
export function withTurnShare(userMetrics: VoiceTurnMetrics[], characterWordCount: number): VoiceTurnMetrics[] {
  const userWords = userMetrics.reduce((sum, item) => sum + item.wordCount, 0);
  const total = userWords + characterWordCount;
  if (total === 0) return userMetrics;
  const share = userWords / total;
  return userMetrics.map((item) => ({ ...item, turnShare: share }));
}

/**
 * Browser speech recognition gives words without timings in some engines. This
 * synthesises plausible timings from the turn duration so the pace figure is
 * still available, and marks nothing else — pauses are reported as unknown
 * rather than invented.
 */
export function wordsFromTranscript(text: string, durationMs: number): TranscriptWord[] {
  const parts = text.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return [];
  const per = durationMs / parts.length;
  return parts.map((word, index) => ({
    word,
    startMs: Math.round(index * per),
    endMs: Math.round((index + 1) * per),
  }));
}

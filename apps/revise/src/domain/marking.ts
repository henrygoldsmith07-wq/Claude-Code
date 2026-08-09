import type { MarkedPart, Question, QuestionPart } from "./types";

// ---------------------------------------------------------------------------
// Offline marking. This is the floor the product stands on: when no AI
// provider is configured, or the network is gone, or the model call fails,
// answers are still marked — deterministically, against the same mark scheme
// an examiner would use. It is keyword/lemma overlap rather than
// comprehension, so it is generous about wording and strict about content,
// and the UI always labels rubric-marked work as such.
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
  "the", "a", "an", "of", "to", "in", "is", "are", "was", "were", "and", "or", "for", "on",
  "at", "by", "with", "as", "that", "this", "it", "its", "be", "from", "will", "can", "has",
  "have", "had", "not", "but", "so", "if", "then", "than", "when", "which", "there", "any",
  "more", "less", "also", "into", "each", "their", "they", "you", "your", "we", "one", "two",
]);

/** Cheap stemmer: enough to make "oxidised"/"oxidise"/"oxidation" agree. */
function stem(word: string): string {
  let w = word;
  for (const suffix of ["ations", "ation", "ising", "izing", "ised", "ized", "ise", "ize", "ing", "ies", "es", "ed", "s"]) {
    if (w.length > suffix.length + 3 && w.endsWith(suffix)) {
      w = w.slice(0, -suffix.length);
      break;
    }
  }
  return w;
}

export function tokenise(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9+\-.^/=²³ ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
      .map(stem),
  );
}

/** 0–1 overlap of a mark-scheme point's content words with the answer. */
export function pointCoverage(point: string, answer: string): number {
  const wanted = [...tokenise(point)];
  if (!wanted.length) return 0;
  const given = tokenise(answer);
  const hits = wanted.filter((w) => given.has(w)).length;
  return hits / wanted.length;
}

/** Numbers in the answer that also appear in the mark scheme earn credit. */
function numericMatch(point: string, answer: string): boolean {
  const nums = point.match(/-?\d+(?:\.\d+)?/g);
  if (!nums?.length) return false;
  return nums.some((n) => answer.includes(n));
}

const CREDIT_THRESHOLD = 0.5;

export function markPart(part: QuestionPart, answer: string): MarkedPart {
  const trimmed = (answer ?? "").trim();
  const credited: string[] = [];
  const missed: string[] = [];

  for (const point of part.markScheme) {
    const covered = pointCoverage(point, trimmed) >= CREDIT_THRESHOLD || numericMatch(point, trimmed);
    (covered ? credited : missed).push(point);
  }

  // Mark-scheme points map onto marks proportionally: a 3-mark part with 4
  // points still awards out of 3.
  const ratio = part.markScheme.length ? credited.length / part.markScheme.length : 0;
  let awarded = Math.round(ratio * part.marks);
  if (!trimmed) awarded = 0;
  // An answer that says almost nothing cannot score full marks however many
  // keywords it happens to contain.
  if (trimmed.split(/\s+/).length < 3 && part.marks > 1) awarded = Math.min(awarded, 1);

  return {
    partId: part.id,
    awarded,
    max: part.marks,
    creditedPoints: credited,
    missedPoints: missed,
    comment: buildComment(awarded, part.marks, missed),
  };
}

function buildComment(awarded: number, max: number, missed: string[]): string {
  if (!missed.length) return "Full marks — every mark-scheme point is there.";
  if (awarded === 0) return `No marks yet. The scheme wants: ${missed.slice(0, 2).join("; ")}.`;
  return `${awarded}/${max}. Still missing: ${missed.slice(0, 2).join("; ")}.`;
}

export function markMcq(question: Question, chosenIndex: number): MarkedPart {
  const part = question.parts[0];
  const correct = chosenIndex === question.correctIndex;
  return {
    partId: part?.id ?? question.id,
    awarded: correct ? question.totalMarks : 0,
    max: question.totalMarks,
    creditedPoints: correct ? [part?.markScheme[0] ?? "Correct option"] : [],
    missedPoints: correct ? [] : [part?.markScheme[0] ?? "Correct option"],
    comment: correct
      ? "Correct."
      : `Not this one — the answer is ${String.fromCharCode(65 + (question.correctIndex ?? 0))}.`,
  };
}

export interface RubricResult {
  marked: MarkedPart[];
  awarded: number;
  max: number;
  feedback: string;
}

export function markQuestion(question: Question, answers: Record<string, string>): RubricResult {
  const marked =
    question.kind === "mcq"
      ? [markMcq(question, Number(answers[question.parts[0]?.id ?? question.id] ?? -1))]
      : question.parts.map((part) => markPart(part, answers[part.id] ?? ""));

  const awarded = marked.reduce((a, m) => a + m.awarded, 0);
  const max = marked.reduce((a, m) => a + m.max, 0);
  return { marked, awarded, max, feedback: examinerSummary(awarded, max, marked) };
}

/** Examiner-voice summary: what was earned, what was dropped, what to do. */
export function examinerSummary(awarded: number, max: number, marked: MarkedPart[]): string {
  const pct = max ? awarded / max : 0;
  const missed = marked.flatMap((m) => m.missedPoints);
  const opening =
    pct === 1
      ? "A complete answer — this would score full marks."
      : pct >= 0.6
        ? "A sound answer that drops marks on detail rather than understanding."
        : pct > 0
          ? "Partly there, but the response is not yet earning most of the available marks."
          : "This response does not yet address what the question is asking for.";

  const detail = missed.length
    ? ` The scheme still wants: ${missed.slice(0, 3).map((m) => `"${m}"`).join(", ")}.`
    : "";
  const advice = missed.length
    ? " Write the missing points explicitly — examiners award the statement, not the implication."
    : " Keep this structure under timed conditions.";

  return `${awarded}/${max}. ${opening}${detail}${advice}`;
}

// Translation quality checks.
//
// A silently bad translation is worse than no translation: the reader has no
// way to tell, and a mangled number or a dropped negation changes what the
// story says. These are the checks that catch the failures a translation model
// actually produces, in rough order of how often we see them:
//
//   1. Passthrough    — the model returned the source unchanged (quota, refusal)
//   2. Number drift   — "50 bps" became "15 bps", or a figure vanished
//   3. Entity loss    — a named actor disappeared from the output
//   4. Truncation     — output far shorter than the source
//   5. Script residue — untranslated source-script fragments left in place
//   6. Meta text      — "Here is the translation:" wrapping the answer
//
// All checks are lexical and deterministic. Back-translation agreement is
// available as an optional round trip, gated behind a caller-supplied
// translate function so this module stays free of network dependencies.

import { extractEntities, scriptOf } from "./entities";

export type QualityFlag =
  | "passthrough"
  | "number-mismatch"
  | "entity-loss"
  | "truncated"
  | "expanded"
  | "script-residue"
  | "meta-text"
  | "empty";

export interface TranslationCheck {
  /** 0..100. Below 60 the translation should not be shown without a caveat. */
  score: number;
  usable: boolean;
  flags: QualityFlag[];
  /** One line per flag, safe to render to a reader. */
  notes: string[];
  detail: {
    lengthRatio: number;
    numbersKept: number;
    numbersTotal: number;
    entitiesKept: number;
    entitiesTotal: number;
  };
}

/** Phrases models prepend when they are answering rather than translating. */
const META_PATTERNS = [
  /^\s*(here('s| is)|voici|hier ist|aqui esta)\b/i,
  /^\s*(sure|certainly|of course)[,!]/i,
  /^\s*translation\s*:/i,
  /^\s*\[?(translated|translation)\]?\s*:/i,
  /\bas an ai\b/i,
  /\bI (cannot|can't) translate\b/i,
];

/**
 * Score a translation against its source.
 *
 * Numbers and entities are the load-bearing content of a news sentence, so they
 * dominate the score: fluent prose that lost the casualty figure is a failure,
 * awkward prose that kept every fact is not.
 */
export function checkTranslation(source: string, translated: string, targetLang = "en"): TranslationCheck {
  const flags: QualityFlag[] = [];
  const notes: string[] = [];
  const src = source.trim();
  const out = translated.trim();

  if (!out) {
    return {
      score: 0, usable: false, flags: ["empty"], notes: ["Translation was empty."],
      detail: { lengthRatio: 0, numbersKept: 0, numbersTotal: 0, entitiesKept: 0, entitiesTotal: 0 },
    };
  }

  let score = 100;

  if (out === src && src.length > 0) {
    flags.push("passthrough");
    notes.push("Output is identical to the source — the translation step did not run.");
    score -= 55;
  }

  for (const p of META_PATTERNS) {
    if (p.test(out)) {
      flags.push("meta-text");
      notes.push("Output contains assistant framing rather than a bare translation.");
      score -= 25;
      break;
    }
  }

  // --- Numbers -------------------------------------------------------------
  // Compare bare digit strings rather than the semantic numerics: locale
  // formatting legitimately differs ("3.25" vs "3,25"), the digits do not.
  const digits = (s: string) => (s.replace(/[.,](?=\d)/g, "").match(/\d+/g) ?? []).map((d) => d.replace(/^0+(?=\d)/, ""));
  const srcNums = digits(src);
  const outNums = new Set(digits(out));
  const numbersKept = srcNums.filter((d) => outNums.has(d)).length;
  if (srcNums.length > 0) {
    const ratio = numbersKept / srcNums.length;
    if (ratio < 1) {
      flags.push("number-mismatch");
      const lost = srcNums.filter((d) => !outNums.has(d));
      notes.push(`Figures changed or dropped in translation: ${lost.slice(0, 3).join(", ")}.`);
      // Steep on purpose: a headline that lost its only figure has lost the
      // claim, so a total miss must land below the usability line on its own.
      score -= Math.round((1 - ratio) * 45);
    }
  }

  // --- Entities ------------------------------------------------------------
  // Canonical ids, so a correctly translated "Kiew" → "Kyiv" counts as kept.
  const srcEnt = extractEntities(src).known;
  const outEnt = new Set(extractEntities(out).known);
  const entitiesKept = srcEnt.filter((e) => outEnt.has(e)).length;
  if (srcEnt.length > 0 && entitiesKept < srcEnt.length) {
    flags.push("entity-loss");
    const lost = srcEnt.filter((e) => !outEnt.has(e));
    notes.push(`Named actors missing from the translation: ${lost.slice(0, 3).join(", ")}.`);
    score -= Math.round(((srcEnt.length - entitiesKept) / srcEnt.length) * 25);
  }

  // --- Length --------------------------------------------------------------
  const lengthRatio = src.length === 0 ? 1 : out.length / src.length;
  if (lengthRatio < 0.45) {
    flags.push("truncated");
    notes.push(`Translation is ${Math.round(lengthRatio * 100)}% the length of the source — likely truncated.`);
    score -= 25;
  } else if (lengthRatio > 2.6) {
    flags.push("expanded");
    notes.push("Translation is far longer than the source — it may contain added commentary.");
    score -= 15;
  }

  // --- Script residue ------------------------------------------------------
  const srcScript = scriptOf(src);
  const outScript = scriptOf(out);
  if (targetLang === "en" && srcScript !== "latin" && outScript === srcScript) {
    flags.push("script-residue");
    notes.push(`Output still contains ${srcScript} text — translation is incomplete.`);
    score -= 30;
  }

  score = Math.max(0, Math.min(100, score));
  return {
    score,
    usable: score >= 60,
    flags,
    notes,
    detail: {
      lengthRatio: Math.round(lengthRatio * 100) / 100,
      numbersKept,
      numbersTotal: srcNums.length,
      entitiesKept,
      entitiesTotal: srcEnt.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Back-translation
// ---------------------------------------------------------------------------

export interface BackTranslationResult {
  /** 0..1 token overlap between the source and the round trip. */
  agreement: number;
  roundTrip: string;
  /** Content words present in the source but absent from the round trip. */
  lostTerms: string[];
  verdict: "consistent" | "drifted" | "inconsistent";
}

/**
 * Round-trip check: translate forward, then back, and compare with the source.
 *
 * Low agreement does not prove the forward translation is wrong — the return
 * leg can be the faulty one — so the verdict is advisory. It is most useful as
 * a sampling check on a small share of traffic, not on every headline; two
 * extra model calls per item is not a per-request cost worth paying.
 */
export async function backTranslationCheck(
  source: string,
  translated: string,
  sourceLang: string,
  translateFn: (text: string, target: string) => Promise<string>,
): Promise<BackTranslationResult> {
  const roundTrip = (await translateFn(translated, sourceLang)).trim();
  const words = (s: string) =>
    new Set(
      s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length >= 4),
    );
  const a = words(source), b = words(roundTrip);
  if (a.size === 0) return { agreement: 1, roundTrip, lostTerms: [], verdict: "consistent" };
  let inter = 0;
  const lost: string[] = [];
  for (const w of a) {
    if (b.has(w)) inter++;
    else lost.push(w);
  }
  const agreement = Math.round((inter / a.size) * 100) / 100;
  return {
    agreement,
    roundTrip,
    lostTerms: lost.slice(0, 6),
    verdict: agreement >= 0.6 ? "consistent" : agreement >= 0.35 ? "drifted" : "inconsistent",
  };
}

/** One-line summary for the methodology panel. */
export function qualitySummary(check: TranslationCheck): string {
  if (check.flags.length === 0) return `Translation checks passed (${check.score}/100): figures and named actors preserved.`;
  return `Translation quality ${check.score}/100 — ${check.notes[0]}`;
}

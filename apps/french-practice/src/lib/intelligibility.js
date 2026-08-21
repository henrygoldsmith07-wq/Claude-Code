// Intelligibility-first pronunciation scoring.
//
// The question this module answers is "would a French person understand you?"
// — not "do you sound Parisian?". Those are different, and conflating them is
// the standard failure of pronunciation scoring: it penalises a Belgian, a
// Québécois and a perfectly comprehensible Welsh accent alike, while
// rewarding a learner who mumbles the right vowel colour.
//
// Three consequences, all deliberate:
//
//   1. Content words count more than function words. Missing «le» costs
//      almost nothing — the listener reconstructs it. Missing «gare» loses
//      the sentence.
//   2. A word that is heard as a *homophone or near-homophone* of the target
//      is intelligible. «J'ai manger» heard for «j'ai mangé» is a spelling
//      artefact of the transcriber, not a pronunciation failure.
//   3. Accent-conformity is reported separately and never folded into the
//      main score, so a learner can see "clear, and audibly not native" as
//      the good outcome it is.

import { PHONEMES } from './phonemeProfile.js';

/** Function words a listener reconstructs for free. */
const FUNCTION_WORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'd', 'l', 'au', 'aux',
  'ce', 'ces', 'cet', 'cette', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses',
  'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles', 'me', 'te', 'se', 'y', 'en',
  'et', 'ou', 'mais', 'donc', 'que', 'qui', 'a', 'à', 'est', 'sont', 'ne', 'pas', 'plus',
  'dans', 'sur', 'pour', 'par', 'avec', 'sans', 'chez', 'si', 'ça', 'c',
]);

export const normalise = (s) => String(s || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z' ]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

export const words = (s) => normalise(s).split(' ').filter(Boolean);

/**
 * Do two French spellings plausibly sound the same? Whisper writes what it
 * hears through French orthography, so «parlé / parler / parlez» all come back
 * for one identical sound. Penalising those as pronunciation errors is simply
 * wrong — they are the *same phonetic output*.
 */
export function soundsSame(a, b) {
  if (a === b) return true;
  const strip = (w) => w
    .replace(/(er|ez|é|ée|és|ées|ait|aient|ais|é)$/u, 'E')
    .replace(/(s|x|t|d|p|z)$/u, '')      // silent final consonants
    .replace(/h/g, '')                   // h is never pronounced
    .replace(/(ph)/g, 'f')
    .replace(/(qu|k|c(?=[^eiy]))/g, 'k')
    .replace(/(c(?=[eiy])|ç)/g, 's')
    .replace(/(ss|sc)/g, 's')
    .replace(/(au|eau|o)/g, 'o')
    .replace(/(ai|ei|è|ê|e)/g, 'E')
    .replace(/(ou)/g, 'U')
    .replace(/(ill)/g, 'j')
    .replace(/(oi)/g, 'wa')
    .replace(/(gn)/g, 'N')
    .replace(/(.)\1/g, '$1');            // double letters are single sounds
  return strip(normalise(a)) === strip(normalise(b));
}

/** Levenshtein, used to grade how far a substitution is from the target. */
export function editDistance(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i += 1) {
    const cur = [i];
    for (let j = 1; j <= n; j += 1) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n];
}

/** 0..1 similarity between two words. */
export const wordSimilarity = (a, b) => {
  const longest = Math.max(a.length, b.length);
  return longest ? 1 - editDistance(a, b) / longest : 1;
};

/**
 * Align target and heard word sequences.
 *
 * This is a full Needleman–Wunsch alignment rather than a greedy walk with
 * one-word lookahead. The greedy version failed on the commonest real input
 * there is: a learner who opens with filler. "Alors euh je voudrais un café"
 * against "Je voudrais un café" shifted every word by two and scored zero on a
 * sentence a French speaker would understand perfectly.
 *
 * Scores: a hit is worth most, a homophone almost as much (same sound,
 * different spelling), and a near-miss substitution earns credit in proportion
 * to how close it is — so the alignment prefers pairing words that resemble
 * each other over silently dropping them.
 */
export function align(targetWords, heardWords) {
  const n = targetWords.length;
  const m = heardWords.length;
  const GAP = -0.6;

  const pairScore = (t, h) => {
    if (t === h) return 1;
    if (soundsSame(t, h)) return 0.95;
    return wordSimilarity(t, h) - 0.5; // negative unless the words genuinely resemble
  };

  // dp[i][j] = best score aligning first i target words with first j heard.
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i += 1) dp[i][0] = dp[i - 1][0] + GAP;
  for (let j = 1; j <= m; j += 1) dp[0][j] = dp[0][j - 1] + GAP;
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      dp[i][j] = Math.max(
        dp[i - 1][j - 1] + pairScore(targetWords[i - 1], heardWords[j - 1]),
        dp[i - 1][j] + GAP,
        dp[i][j - 1] + GAP,
      );
    }
  }

  // Trace back to operations.
  const out = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const t = targetWords[i - 1];
    const h = heardWords[j - 1];
    if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + pairScore(t, h)) {
      if (t === h) out.push({ type: 'hit', target: t, heard: h });
      else if (soundsSame(t, h)) out.push({ type: 'homophone', target: t, heard: h });
      else out.push({ type: 'substitution', target: t, heard: h, similarity: wordSimilarity(t, h) });
      i -= 1; j -= 1;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + GAP) {
      out.push({ type: 'deletion', target: t });
      i -= 1;
    } else {
      out.push({ type: 'insertion', heard: h });
      j -= 1;
    }
  }
  return out.reverse();
}

const isContent = (w) => !FUNCTION_WORDS.has(w) && w.length > 1;

/**
 * The score. Content words carry weight 1, function words 0.35, because that
 * is roughly how much each contributes to a listener reconstructing the
 * sentence. A near-miss substitution earns partial credit — being 80% of the
 * way to «boulangerie» is not the same as saying nothing.
 */
export function intelligibility(target, heard) {
  const t = words(target);
  const h = words(heard);
  if (!t.length) return { score: null, note: 'No target sentence.' };

  const ops = align(t, h);
  let earned = 0;
  let possible = 0;
  const lost = [];

  for (const op of ops) {
    if (op.type === 'insertion') continue; // extra words rarely block meaning
    const wgt = isContent(op.target) ? 1 : 0.35;
    possible += wgt;
    if (op.type === 'hit' || op.type === 'homophone') {
      earned += wgt;
    } else if (op.type === 'substitution') {
      // Partial credit above 0.6 similarity; below that the word is lost.
      const credit = op.similarity >= 0.6 ? op.similarity * 0.8 : 0;
      earned += wgt * credit;
      if (credit < 0.5) lost.push(op);
    } else {
      lost.push(op);
    }
  }

  const score = possible ? Math.round((earned / possible) * 100) : null;
  const contentOps = ops.filter((o) => o.target && isContent(o.target));
  const contentHits = contentOps.filter((o) => o.type === 'hit' || o.type === 'homophone').length;

  return {
    score,
    // Reported separately: how much of it was word-perfect rather than merely
    // understood. This is the accent-conformity signal, and it is never mixed
    // into `score`.
    conformity: ops.length ? Math.round((ops.filter((o) => o.type === 'hit').length / ops.length) * 100) : null,
    contentAccuracy: contentOps.length ? Math.round((contentHits / contentOps.length) * 100) : null,
    ops,
    lost,
    verdict: verdictFor(score),
  };
}

export function verdictFor(score) {
  if (score === null) return null;
  if (score >= 90) return 'Understood easily.';
  if (score >= 75) return 'Understood — a couple of words needed working out.';
  if (score >= 55) return 'Mostly understood; a listener would ask you to repeat once.';
  if (score >= 35) return 'Hard to follow — the key words are not landing.';
  return 'Not intelligible yet. Slow right down and take it word by word.';
}

/**
 * Which French sounds the substitutions point at. Each rule looks at what was
 * *targeted* versus what was *heard* and blames a phoneme contrast — this is
 * grapheme-level inference, not acoustic analysis, so it is reported as a
 * suspicion with a count, never as a measurement.
 */
// Each rule fires only when the contrast is genuinely *present on one side and
// absent on the other*. An earlier version tested each side independently,
// which blamed the u/ou contrast for «boulangerie» → «boulangeri» — both
// contain "ou", so nothing about that vowel went wrong.
const has = (re) => (s) => re.test(s);
const differs = (re) => (t, h) => has(re)(t) !== has(re)(h);

const PHONEME_RULES = [
  { id: 'u-ou', test: (t, h) => differs(/ou/)(t, h) && (/u/.test(t) || /u/.test(h)) },
  { id: 'nasal-an', test: differs(/(an|en)/) },
  { id: 'nasal-on', test: differs(/on/) },
  { id: 'nasal-in', test: differs(/(in|ain|ein|un)/) },
  { id: 'r', test: (t, h) => /r/.test(t) && !/r/.test(h) },
  { id: 'gn', test: differs(/gn/) },
  { id: 'j', test: (t, h) => differs(/(j|ge|gi)/)(t, h) && /(d|ch|sh|z)/.test(h) },
  // A liaison failure shows up as the target's linked pair arriving as two
  // separate words, or the consonant vanishing entirely.
  { id: 'liaison', test: (t, h) => /^(les|des|nous|vous|ils|elles|en|un)$/.test(t) && h !== t },
];

// Below this similarity a substitution is a real mishearing worth attributing;
// above it, the difference is a transcription artefact (a dropped final letter)
// and blaming a phoneme would be noise.
const ATTRIBUTION_CEILING = 0.85;

export function phonemeSuspicions(result) {
  const counts = new Map();
  for (const op of result.ops || []) {
    if (op.type !== 'substitution' && op.type !== 'deletion') continue;
    if (op.type === 'substitution' && (op.similarity ?? 0) >= ATTRIBUTION_CEILING) continue;
    const t = op.target || '';
    const h = op.heard || '';
    for (const rule of PHONEME_RULES) {
      if (rule.test(t, h)) {
        const cur = counts.get(rule.id) || { phonemeId: rule.id, count: 0, examples: [] };
        cur.count += 1;
        if (cur.examples.length < 3) cur.examples.push({ target: t, heard: h || '(nothing)' });
        counts.set(rule.id, cur);
      }
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .map((c) => ({ ...c, ...(PHONEMES.find((p) => p.id === c.phonemeId) || {}) }));
}

/**
 * Feedback a learner can act on: what to fix, in what order, phrased around
 * being understood rather than around sounding native.
 */
export function feedback(target, heard) {
  const result = intelligibility(target, heard);
  const suspicions = phonemeSuspicions(result);
  const notes = [];

  // The "leave it alone" note fires when the message landed intact and the
  // only differences were homophones — same sound, different spelling. That is
  // the signature of an accent, not of an error, and it is precisely the case
  // a conformity-based scorer would wrongly flag as a mistake.
  const homophones = (result.ops || []).filter((o) => o.type === 'homophone').length;
  if (result.score !== null && result.score >= 90 && homophones > 0) {
    notes.push('Clear and easy to follow — the remaining differences are accent, not error. Leave them alone.');
  }
  for (const s of suspicions.slice(0, 2)) {
    notes.push(`${s.label || s.phonemeId}: ${s.tip || 'worth a minimal-pair drill.'} (heard ${s.count}×)`);
  }
  if (result.lost.length) {
    const lostWords = result.lost.map((o) => o.target).filter(Boolean).slice(0, 4);
    if (lostWords.length) notes.push(`Words that did not land: ${lostWords.join(', ')}.`);
  }
  if (!notes.length) notes.push('Nothing to fix on this one.');

  return { ...result, suspicions, notes };
}

// --------------------------------------------------------- benchmark --------

/**
 * The human-labelled benchmark.
 *
 * This harness compares the scorer against ratings from human listeners. It
 * ships EMPTY on purpose: the app has no human ratings yet, and seeding it
 * with invented "sample" data would produce a validation number that means
 * nothing while looking authoritative. `benchmarkStatus` says so plainly
 * until real recordings are labelled.
 *
 * Collection protocol (documented here so the format is not reinvented):
 *   - 40+ learner recordings spanning A1–C1 and at least three L1 backgrounds
 *   - each rated by 3 native listeners on a 1–5 intelligibility scale
 *     ("how much did you understand?"), NOT on accent
 *   - inter-rater agreement reported; items where raters disagree by 2+ are
 *     excluded rather than averaged
 *   - stored as { id, target, transcript, humanMean, raters }
 */
export const HUMAN_BENCHMARK = [];

/**
 * Validate one human-labelled benchmark sample before it may enter the store.
 *
 * Shape follows the collection protocol above: the target text, what the
 * recogniser heard, and the listeners' mean 1–5 intelligibility rating (never
 * an accent rating). Returns null for anything malformed or out of range —
 * invalid rows are dropped, not coerced, so a bulk import cannot smuggle in
 * fabricated labels.
 */
export function makeBenchmarkSample({ id, target, transcript, humanMean, raters, at } = {}) {
  const t = String(target || '').trim();
  const h = String(transcript || '').trim();
  const m = Number(humanMean);
  if (!t || !h) return null;
  if (!Number.isFinite(m) || m < 1 || m > 5) return null;
  const raterList = Array.isArray(raters) ? raters.filter((r) => r && String(r).trim()).map((r) => String(r).trim().slice(0, 80)) : [];
  return {
    id: String(id || `bench-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
    target: t.slice(0, 2000),
    transcript: h.slice(0, 2000),
    humanMean: Math.round(m * 100) / 100,
    ...(raterList.length ? { raters: raterList.slice(0, 10) } : {}),
    at: at && !Number.isNaN(new Date(at).getTime()) ? new Date(at).toISOString() : new Date().toISOString(),
  };
}

/**
 * Combined benchmark view: the (empty by design) in-source array plus any
 * samples ingested at runtime through the validation store. Callers pass
 * this to runBenchmark/benchmarkStatus.
 */
export function mergeBenchmarkItems(stored = [], sourceItems = HUMAN_BENCHMARK) {
  return [...(Array.isArray(sourceItems) ? sourceItems : []), ...(Array.isArray(stored) ? stored : [])];
}

/** Pearson correlation, the headline number for a scorer against humans. */
export function correlation(pairs) {
  const n = pairs.length;
  if (n < 3) return null;
  const xs = pairs.map((p) => p[0]);
  const ys = pairs.map((p) => p[1]);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i += 1) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  const den = Math.sqrt(dx * dy);
  return den ? Math.round((num / den) * 1000) / 1000 : null;
}

/**
 * Run the scorer over labelled items. `humanMean` is on the 1–5 listener
 * scale; it is rescaled to 0–100 for the error figures.
 */
export function runBenchmark(items = HUMAN_BENCHMARK) {
  const usable = items.filter((i) => i && i.target && i.transcript && Number.isFinite(i.humanMean));
  if (!usable.length) {
    return {
      n: 0,
      correlation: null,
      meanAbsoluteError: null,
      status: 'no-data',
      message: 'No human-labelled recordings yet — this scorer is unvalidated. See the collection protocol in intelligibility.js.',
    };
  }
  const pairs = [];
  let absError = 0;
  for (const it of usable) {
    const machine = intelligibility(it.target, it.transcript).score ?? 0;
    const human = ((it.humanMean - 1) / 4) * 100;
    pairs.push([machine, human]);
    absError += Math.abs(machine - human);
  }
  const r = correlation(pairs);
  return {
    n: usable.length,
    correlation: r,
    meanAbsoluteError: Math.round((absError / usable.length) * 10) / 10,
    status: usable.length < 30 ? 'provisional' : 'validated',
    message: usable.length < 30
      ? `Provisional: ${usable.length} labelled items. Treat the correlation as indicative, not established.`
      : `Validated against ${usable.length} human-labelled items.`,
  };
}

/** What the UI should say about how trustworthy the pronunciation score is. */
export function benchmarkStatus(items = HUMAN_BENCHMARK) {
  const b = runBenchmark(items);
  return {
    ...b,
    label: b.status === 'no-data'
      ? 'Unvalidated'
      : b.status === 'provisional'
        ? `Provisional (r=${b.correlation ?? '—'}, n=${b.n})`
        : `Validated (r=${b.correlation}, n=${b.n})`,
  };
}

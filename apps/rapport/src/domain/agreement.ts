// ---------------------------------------------------------------------------
// Inter-rater agreement.
//
// The evaluator's behaviour scores are the product's judgement of a
// conversation, so the question "would an independent rater agree?" is a
// quality gate, not a nicety. This module implements the standard agreement
// statistics over two kinds of rating:
//
//   * categorical — which behaviour was the weakest, or which band a score
//     fell into (Cohen's kappa, Fleiss' kappa, Krippendorff's alpha);
//   * continuous — the 0-1 behaviour scores themselves (mean absolute
//     disagreement, exact-threshold hit rate).
//
// Everything here is pure and deterministic so the harness can run in CI with
// no model and no network: raters are arrays, and agreement is a number.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Categorical agreement
// ---------------------------------------------------------------------------

/** Cohen's kappa for exactly two raters over nominal categories. */
export function cohenKappa(raterA: string[], raterB: string[]): number {
  if (raterA.length !== raterB.length) throw new Error("cohenKappa: raters must rate the same items");
  const n = raterA.length;
  if (n === 0) return 1;
  const categories = [...new Set([...raterA, ...raterB])];
  const count = (arr: string[], value: string) => arr.filter((v) => v === value).length;
  let observed = 0;
  for (let i = 0; i < n; i++) if (raterA[i] === raterB[i]) observed++;
  const pObserved = observed / n;
  let pExpected = 0;
  for (const cat of categories) pExpected += (count(raterA, cat) / n) * (count(raterB, cat) / n);
  if (pExpected === 1) return 1;
  return (pObserved - pExpected) / (1 - pExpected);
}

/** Fleiss' kappa for any number of raters over nominal categories. */
export function fleissKappa(matrix: number[][]): number {
  // matrix[i][j] = number of raters who assigned item i to category j.
  if (matrix.length === 0) return 1;
  const firstRow = matrix[0];
  if (!firstRow) return 1;
  const items = matrix.length;
  const categories = firstRow.length;
  const perItem = matrix.map((row) => row.reduce((a, b) => a + b, 0));
  const nPerItem = perItem.reduce((a, b) => a + b, 0);
  if (nPerItem === 0) return 1;
  // Category marginals over all assignments.
  const p: number[] = [];
  for (let j = 0; j < categories; j++) {
    let col = 0;
    for (let i = 0; i < items; i++) col += matrix[i]?.[j] ?? 0;
    p.push(col / nPerItem);
  }
  const pExpected = p.reduce((a, pj) => a + pj * pj, 0);
  // Observed agreement per item, averaged.
  let pObservedSum = 0;
  let counted = 0;
  for (let i = 0; i < items; i++) {
    const n = perItem[i];
    if (n === undefined || n <= 1) continue;
    let sum = 0;
    for (let j = 0; j < categories; j++) sum += (matrix[i]?.[j] ?? 0) * ((matrix[i]?.[j] ?? 0) - 1);
    pObservedSum += sum / (n * (n - 1));
    counted++;
  }
  if (counted === 0) return 1;
  const pObserved = pObservedSum / counted;
  if (pExpected === 1) return 1;
  return (pObserved - pExpected) / (1 - pExpected);
}

/**
 * Krippendorff's alpha (nominal) from ragged ratings: `items[i]` is the list
 * of category labels item i received, one per rater. Handles differing
 * numbers of raters per item, which the pairwise-fixed matrix formulations do
 * not.
 */
export function krippendorffAlphaNominal(items: string[][]): number {
  const categories = [...new Set(items.flat())];
  const k = categories.length;
  if (k <= 1) return 1;
  const index = new Map(categories.map((cat, i) => [cat, i]));
  // Coincidence matrix: coinc[a][b] = number of rater pairs (across all
  // items) who assigned a and b respectively.
  const coinc = Array.from({ length: k }, () => Array(k).fill(0));
  let pairable = 0;
  for (const item of items) {
    const labels = item.map((cat) => index.get(cat)!);
    for (let i = 0; i < labels.length; i++) {
      const a = labels[i]!;
      for (let j = i + 1; j < labels.length; j++) {
        const b = labels[j]!;
        coinc[a]![b]! += 1;
        coinc[b]![a]! += 1;
        pairable += 1;
      }
    }
  }
  if (pairable === 0) return 1;
  // Observed disagreement: proportion of pairable assignments that differ
  // (nominal: 0 when equal, 1 when different).
  let mismatches = 0;
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) if (i !== j) mismatches += coinc[i]?.[j] ?? 0;
  // Each pair was counted twice (i→j and j→i), so mismatches is 2× the count.
  const pObservedDisagreement = mismatches / (2 * pairable);
  // Expected disagreement from marginal frequencies.
  const totals = coinc.map((row) => row.reduce((a, b) => a + b, 0));
  const grand = totals.reduce((a, b) => a + b, 0);
  const p = totals.map((t) => t / grand);
  const pExpectedDisagreement = 1 - p.reduce((a, pj) => a + pj * pj, 0);
  if (pExpectedDisagreement === 0) return 1;
  return 1 - pObservedDisagreement / pExpectedDisagreement;
}

// ---------------------------------------------------------------------------
// Continuous + exact agreement
// ---------------------------------------------------------------------------

/** Exact agreement: fraction of rater pairs who gave the identical categorical label. 0-1. */
export function exactAgreement(items: string[][]): number {
  let agreed = 0;
  let pairs = 0;
  for (const labels of items) {
    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) {
        if (labels[i] === labels[j]) agreed++;
        pairs++;
      }
    }
  }
  return pairs === 0 ? 1 : agreed / pairs;
}

/**
 * Weighted agreement: like exactAgreement but with partial credit for near-misses.
 * Weight matrix `w[a][b]` in 0-1; 1 = identical, 0 = maximally distant.
 * For ordinal scales (e.g. present/uncertain/absent), near categories get e.g. 0.5.
 */
export function weightedAgreement(items: string[][], categories: string[], weights: number[][]): number {
  if (items.length === 0) return 1;
  const index = new Map(categories.map((c, i) => [c, i]));
  let weighted = 0;
  let pairs = 0;
  for (const labels of items) {
    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) {
        const a = index.get(labels[i]!);
        const b = index.get(labels[j]!);
        if (a === undefined || b === undefined) continue;
        weighted += weights[a]?.[b] ?? (a === b ? 1 : 0);
        pairs++;
      }
    }
  }
  return pairs === 0 ? 1 : weighted / pairs;
}

/** Linear weighted kappa (Cohen's) for ordinal categories. Categories are ordered as given. */
export function weightedKappa(raterA: string[], raterB: string[], categories: string[]): number {
  if (raterA.length !== raterB.length) throw new Error("weightedKappa: raters must rate same items");
  const n = raterA.length;
  if (n === 0) return 1;
  const k = categories.length;
  if (k <= 1) return 1;
  const idx = new Map(categories.map((c, i) => [c, i]));
  // Weight: 1 - |i-j|/(k-1) (linear)
  const weight = (i: number, j: number) => 1 - Math.abs(i - j) / (k - 1);
  // Observed weighted agreement
  let pObserved = 0;
  for (let i = 0; i < n; i++) {
    const a = idx.get(raterA[i]!);
    const b = idx.get(raterB[i]!);
    if (a !== undefined && b !== undefined) pObserved += weight(a, b);
  }
  pObserved /= n;
  // Expected weighted agreement from marginals
  const count = (arr: string[], cat: string) => arr.filter((v) => v === cat).length;
  let pExpected = 0;
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      const pi = count(raterA, categories[i]!) / n;
      const pj = count(raterB, categories[j]!) / n;
      pExpected += pi * pj * weight(i, j);
    }
  }
  if (pExpected === 1) return 1;
  return (pObserved - pExpected) / (1 - pExpected);
}

/** Pearson correlation between two equal-length score arrays. Null if insufficient variance. */
export function pearsonCorrelation(a: number[], b: number[]): number | null {
  if (a.length !== b.length) throw new Error("pearsonCorrelation: arrays must be same length");
  const n = a.length;
  if (n < 2) return null;
  const mean = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
  const ma = mean(a);
  const mb = mean(b);
  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < n; i++) {
    const da = (a[i] ?? 0) - ma;
    const db = (b[i] ?? 0) - mb;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  const den = Math.sqrt(denA * denB);
  if (den === 0) return null;
  return num / den;
}

/** Spearman rank correlation (Pearson on ranks). */
export function spearmanCorrelation(a: number[], b: number[]): number | null {
  if (a.length !== b.length) throw new Error("spearmanCorrelation: arrays must be same length");
  const n = a.length;
  if (n < 2) return null;
  const rank = (arr: number[]): number[] => {
    const sorted = [...arr].map((v, i) => ({ v, i })).sort((x, y) => x.v - y.v);
    const ranks = Array(n).fill(0);
    let idx = 0;
    while (idx < n) {
      let j = idx;
      while (j < n && sorted[j]!.v === sorted[idx]!.v) j++;
      const avg = (idx + j - 1) / 2 + 1; // average rank
      for (let k = idx; k < j; k++) ranks[sorted[k]!.i] = avg;
      idx = j;
    }
    return ranks;
  };
  return pearsonCorrelation(rank(a), rank(b));
}

/** Mean absolute difference over all pairs of raters across all items. 0 = identical. */
export function meanAbsoluteScoreDisagreement(ratings: number[][]): number {
  let total = 0;
  let pairs = 0;
  for (const item of ratings) {
    for (let i = 0; i < item.length; i++) {
      const a = item[i]!;
      for (let j = i + 1; j < item.length; j++) {
        total += Math.abs(a - item[j]!);
        pairs++;
      }
    }
  }
  return pairs === 0 ? 0 : total / pairs;
}

/**
 * Exact-agreement rate at a tolerance: fraction of rater pairs whose scores
 * are within `tolerance` of each other. A 0-1 score with a 0.1 tolerance is
 * "same behaviour band, roughly".
 */
export function scoreAgreementRate(ratings: number[][], tolerance: number): number {
  let agreed = 0;
  let pairs = 0;
  for (const item of ratings) {
    for (let i = 0; i < item.length; i++) {
      const a = item[i]!;
      for (let j = i + 1; j < item.length; j++) {
        // Small epsilon absorbs binary-float noise (e.g. 0.8 − 0.7 > 0.1).
        if (Math.abs(a - item[j]!) <= tolerance + 1e-9) agreed++;
        pairs++;
      }
    }
  }
  return pairs === 0 ? 1 : agreed / pairs;
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export interface RaterItem {
  /** Categorical rating per rater (e.g. "weakest behaviour"). Empty when only scores were given. */
  categorical: string[];
  /** Continuous 0-1 rating per rater (e.g. behaviour score). Empty when only labels were given. */
  scores: number[];
}

export interface BehaviourReliability {
  behaviour: string;
  items: number;
  exactAgreement: number | null;
  weightedAgreement: number | null;
  cohenKappa: number | null;
  meanAbsDisagreement: number | null;
  pearsonR: number | null;
  verdict: string;
}

export interface AgreementReport {
  items: number;
  /** The named metrics, with the ranges a well-calibrated system should land in. */
  cohenKappa: number | null;
  fleissKappa: number | null;
  krippendorffAlpha: number | null;
  meanAbsScoreDisagreement: number | null;
  scoreAgreementRate: number | null;
  exactAgreement: number | null;
  weightedAgreement: number | null;
  pearsonR: number | null;
  spearmanR: number | null;
  /** Per-behaviour reliability — do not hide poor validity behind an overall number. */
  perBehaviour?: BehaviourReliability[];
  /** Plain-language verdict for the benchmark dashboard. */
  verdict: string;
}

/**
 * Build per-behaviour reliability from an extended item type keyed by behaviour.
 * Used for the objective's "how reliably humans can judge each behaviour".
 */
export interface BehaviourRaterItem {
  behaviour: string;
  categorical: string[]; // per rater
  scores: number[]; // per rater
}

export function reliabilityByBehaviour(entries: BehaviourRaterItem[]): BehaviourReliability[] {
  const byBehaviour = new Map<string, BehaviourRaterItem[]>();
  for (const entry of entries) {
    const list = byBehaviour.get(entry.behaviour) ?? [];
    list.push(entry);
    byBehaviour.set(entry.behaviour, list);
  }
  const out: BehaviourReliability[] = [];
  for (const [behaviour, group] of byBehaviour) {
    const categorical = group.filter((g) => g.categorical.length > 0);
    const scored = group.filter((g) => g.scores.length > 0);
    const exact = categorical.length > 0 ? exactAgreement(categorical.map((g) => g.categorical)) : null;
    // For ordinal decisions like present/uncertain/absent, linear weights.
    const weighted = categorical.length > 0
      ? (() => {
          const cats = ["absent", "uncertain", "present"];
          const hasAll = new Set(categorical.flatMap((g) => g.categorical));
          // Only compute weighted if at least two categories present in these cats
          if ([...hasAll].some((c) => cats.includes(c))) {
            const w: number[][] = cats.map((_, i) => cats.map((_, j) => 1 - Math.abs(i - j) / (cats.length - 1)));
            return weightedAgreement(categorical.map((g) => g.categorical), cats, w);
          }
          return null;
        })()
      : null;
    let cohen: number | null = null;
    if (categorical.length > 0) {
      const maxRaters = Math.max(...categorical.map((g) => g.categorical.length));
      let bestOverlap = 0;
      let bestA: string[] = [];
      let bestB: string[] = [];
      for (let i = 0; i < maxRaters; i++) {
        for (let j = i + 1; j < maxRaters; j++) {
          const a: string[] = [];
          const b: string[] = [];
          for (const item of categorical) {
            const ai = item.categorical[i];
            const bj = item.categorical[j];
            if (ai !== undefined && bj !== undefined) {
              a.push(ai);
              b.push(bj);
            }
          }
          if (a.length > bestOverlap) {
            bestOverlap = a.length;
            bestA = a;
            bestB = b;
          }
        }
      }
      if (bestOverlap >= 2) cohen = cohenKappa(bestA, bestB);
    }
    const meanAbs = scored.length > 0 ? meanAbsoluteScoreDisagreement(scored.map((g) => g.scores)) : null;
    let pearson: number | null = null;
    if (scored.length > 0) {
      // Build paired vectors for Pearson: for each item, take first two raters
      const a: number[] = [];
      const b: number[] = [];
      for (const item of scored) {
        if (item.scores.length >= 2) {
          a.push(item.scores[0]!);
          b.push(item.scores[1]!);
        }
      }
      if (a.length >= 2) pearson = pearsonCorrelation(a, b);
    }
    const verdict =
      cohen !== null && meanAbs !== null
        ? cohen >= 0.6 && meanAbs <= 0.15
          ? "reliable — use as reference"
          : cohen >= 0.4 && meanAbs <= 0.25
            ? "moderately reliable — borderline calls expected"
            : "weak — not reliable enough for validation"
        : cohen !== null
          ? cohen >= 0.6
            ? "categorical agreement strong"
            : cohen >= 0.4
              ? "categorical agreement moderate"
              : "categorical agreement weak"
          : meanAbs !== null
            ? meanAbs <= 0.15
              ? "score agreement small"
              : meanAbs <= 0.25
                ? "score agreement moderate"
                : "score agreement large — not reliable"
            : "not enough data";

    out.push({ behaviour, items: group.length, exactAgreement: exact, weightedAgreement: weighted, cohenKappa: cohen, meanAbsDisagreement: meanAbs, pearsonR: pearson, verdict });
  }
  return out.sort((a, b) => {
    // Least reliable first — the point is to surface weakness, not hide it.
    const score = (r: BehaviourReliability) => (r.cohenKappa ?? 1) + (r.meanAbsDisagreement !== null ? (1 - r.meanAbsDisagreement) : 1);
    return score(a) - score(b);
  });
}

/**
 * Aggregate agreement over a human-labelled evaluation set. Returns null
 * metrics for the rating kind that was not collected, so the same harness
 * works for label-only and score-only collections.
 */
export function agreementReport(items: RaterItem[]): AgreementReport {
  const categorical = items.filter((item) => item.categorical.length > 0);
  const scored = items.filter((item) => item.scores.length > 0);

  let cohen: number | null = null;
  if (categorical.length > 0) {
    // Pairwise projection for Cohen's kappa: for each rater pair, collect the
    // labels they both assigned across items, then use the pair with the most
    // overlap (rater counts vary per item).
    const maxRaters = Math.max(...categorical.map((item) => item.categorical.length));
    let bestOverlap = 0;
    let bestA: string[] = [];
    let bestB: string[] = [];
    for (let i = 0; i < maxRaters; i++) {
      for (let j = i + 1; j < maxRaters; j++) {
        const a: string[] = [];
        const b: string[] = [];
        for (const item of categorical) {
          const ai = item.categorical[i];
          const bj = item.categorical[j];
          if (ai !== undefined && bj !== undefined) {
            a.push(ai);
            b.push(bj);
          }
        }
        if (a.length > bestOverlap) {
          bestOverlap = a.length;
          bestA = a;
          bestB = b;
        }
      }
    }
    if (bestOverlap >= 2) cohen = cohenKappa(bestA, bestB);
  }

  let fleiss: number | null = null;
  if (categorical.length > 0) {
    const categories = [...new Set(categorical.flatMap((item) => item.categorical))];
    const matrix = categorical.map((item) => {
      const row = Array(categories.length).fill(0);
      for (const label of item.categorical) row[categories.indexOf(label)]++;
      return row;
    });
    fleiss = fleissKappa(matrix);
  }

  const alpha = categorical.length > 0 ? krippendorffAlphaNominal(categorical.map((item) => item.categorical)) : null;

  const meanAbs = scored.length > 0 ? meanAbsoluteScoreDisagreement(scored.map((item) => item.scores)) : null;
  const scoreRate = scored.length > 0 ? scoreAgreementRate(scored.map((item) => item.scores), 0.1) : null;
  const exact = categorical.length > 0 ? exactAgreement(categorical.map((item) => item.categorical)) : null;
  let weighted: number | null = null;
  if (categorical.length > 0) {
    const cats = ["absent", "uncertain", "present"];
    const w: number[][] = cats.map((_, i) => cats.map((_, j) => 1 - Math.abs(i - j) / (cats.length - 1)));
    // Only compute weighted if at least some items use those labels
    const uses = categorical.some((item) => item.categorical.some((c) => cats.includes(c)));
    if (uses) weighted = weightedAgreement(categorical.map((item) => item.categorical), cats, w);
  }
  let pearson: number | null = null;
  let spearman: number | null = null;
  if (scored.length > 0) {
    const a: number[] = [];
    const b: number[] = [];
    for (const item of scored) if (item.scores.length >= 2) { a.push(item.scores[0]!); b.push(item.scores[1]!); }
    if (a.length >= 2) {
      pearson = pearsonCorrelation(a, b);
      spearman = spearmanCorrelation(a, b);
    }
  }

  const verdicts: string[] = [];
  if (exact !== null) verdicts.push(exact >= 0.8 ? "exact agreement high" : exact >= 0.6 ? "exact agreement moderate" : "exact agreement low");
  if (weighted !== null) verdicts.push(weighted >= 0.75 ? "weighted agreement high" : weighted >= 0.55 ? "weighted agreement moderate" : "weighted agreement low");
  if (cohen !== null) verdicts.push(cohen >= 0.6 ? "categorical agreement is strong" : cohen >= 0.4 ? "categorical agreement is moderate — borderline calls expected" : "categorical agreement is weak — labels are not reliable");
  if (pearson !== null) verdicts.push(Math.abs(pearson) >= 0.6 ? `correlation r=${pearson.toFixed(2)}` : `correlation weak r=${pearson === null ? "n/a" : pearson.toFixed(2)}`);
  if (meanAbs !== null) verdicts.push(meanAbs <= 0.15 ? "score disagreement is small" : meanAbs <= 0.25 ? "score disagreement is moderate" : "score disagreement is large");
  const verdict = verdicts.length ? verdicts.join("; ") : "No ratings collected yet.";

  return { items: items.length, cohenKappa: cohen, fleissKappa: fleiss, krippendorffAlpha: alpha, meanAbsScoreDisagreement: meanAbs, scoreAgreementRate: scoreRate, exactAgreement: exact, weightedAgreement: weighted, pearsonR: pearson, spearmanR: spearman, verdict };
}

/** Categorical banding helper: cut a 0-1 score into 4 bands for label-based agreement. */
export function bandScore(score: number): string {
  if (score >= 0.85) return "high";
  if (score >= 0.6) return "medium";
  if (score >= 0.35) return "low";
  return "very-low";
}

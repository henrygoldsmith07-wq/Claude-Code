/**
 * Multiple-testing protection.
 *
 * Pulse scans many metric pairs at once. Without correction the "insights"
 * page would fill up with noise that looks exactly like signal, which is the
 * single most common failure mode of personal analytics tools. Benjamini-
 * Hochberg is the default: with dozens of exploratory comparisons, controlling
 * the false discovery rate keeps real effects visible where Bonferroni would
 * hide all of them.
 */

export interface AdjustedTest<T> {
  item: T;
  pValue: number;
  adjustedP: number;
  /** Significant after correction at the requested FDR/FWER level. */
  significant: boolean;
  /** Rank of this p-value among the family, 1-based. */
  rank: number;
}

export interface CorrectionSummary {
  method: "benjamini_hochberg" | "holm" | "bonferroni" | "none";
  familySize: number;
  level: number;
  discoveries: number;
  /** Expected number of the discoveries that are false, under BH. */
  expectedFalseDiscoveries: number;
}

export interface CorrectionResult<T> {
  results: AdjustedTest<T>[];
  summary: CorrectionSummary;
}

function order<T>(items: readonly T[], pValues: readonly number[]): number[] {
  return items
    .map((_, i) => i)
    .filter((i) => Number.isFinite(pValues[i]!))
    .sort((a, b) => pValues[a]! - pValues[b]!);
}

/** Benjamini-Hochberg step-up procedure controlling FDR at `level`. */
export function benjaminiHochberg<T>(
  items: readonly T[],
  pValueOf: (item: T) => number,
  level = 0.05,
): CorrectionResult<T> {
  const pValues = items.map(pValueOf);
  const idx = order(items, pValues);
  const m = idx.length;

  const adjusted = new Map<number, number>();
  let running = 1;
  // Walk from the largest p downward, enforcing monotonicity.
  for (let k = m - 1; k >= 0; k -= 1) {
    const i = idx[k]!;
    const value = Math.min(1, (pValues[i]! * m) / (k + 1));
    running = Math.min(running, value);
    adjusted.set(i, running);
  }

  const results: AdjustedTest<T>[] = items.map((item, i) => {
    const p = pValues[i]!;
    const adjustedP = adjusted.get(i) ?? NaN;
    return {
      item,
      pValue: p,
      adjustedP,
      significant: Number.isFinite(adjustedP) && adjustedP <= level,
      rank: idx.indexOf(i) + 1,
    };
  });

  const discoveries = results.filter((r) => r.significant).length;
  return {
    results,
    summary: {
      method: "benjamini_hochberg",
      familySize: m,
      level,
      discoveries,
      expectedFalseDiscoveries: discoveries * level,
    },
  };
}

/** Holm-Bonferroni — controls the family-wise error rate. Used for confirmatory runs. */
export function holmBonferroni<T>(
  items: readonly T[],
  pValueOf: (item: T) => number,
  level = 0.05,
): CorrectionResult<T> {
  const pValues = items.map(pValueOf);
  const idx = order(items, pValues);
  const m = idx.length;

  const adjusted = new Map<number, number>();
  let running = 0;
  for (let k = 0; k < m; k += 1) {
    const i = idx[k]!;
    const value = Math.min(1, pValues[i]! * (m - k));
    running = Math.max(running, value);
    adjusted.set(i, running);
  }

  const results: AdjustedTest<T>[] = items.map((item, i) => {
    const adjustedP = adjusted.get(i) ?? NaN;
    return {
      item,
      pValue: pValues[i]!,
      adjustedP,
      significant: Number.isFinite(adjustedP) && adjustedP <= level,
      rank: idx.indexOf(i) + 1,
    };
  });

  return {
    results,
    summary: {
      method: "holm",
      familySize: m,
      level,
      discoveries: results.filter((r) => r.significant).length,
      expectedFalseDiscoveries: 0,
    },
  };
}

export function bonferroni<T>(
  items: readonly T[],
  pValueOf: (item: T) => number,
  level = 0.05,
): CorrectionResult<T> {
  const m = items.filter((item) => Number.isFinite(pValueOf(item))).length;
  const results: AdjustedTest<T>[] = items.map((item, i) => {
    const p = pValueOf(item);
    const adjustedP = Number.isFinite(p) ? Math.min(1, p * m) : NaN;
    return { item, pValue: p, adjustedP, significant: adjustedP <= level, rank: i + 1 };
  });
  return {
    results,
    summary: {
      method: "bonferroni",
      familySize: m,
      level,
      discoveries: results.filter((r) => r.significant).length,
      expectedFalseDiscoveries: 0,
    },
  };
}

/**
 * How many independent-ish comparisons a scan of `metricCount` metrics
 * implies. Surfaced in the UI so the user can see the size of the search that
 * produced a finding — a result found among 200 comparisons deserves less
 * trust than the same result found among 3.
 */
export function pairwiseFamilySize(metricCount: number, lags = 1): number {
  return ((metricCount * (metricCount - 1)) / 2) * Math.max(1, lags);
}

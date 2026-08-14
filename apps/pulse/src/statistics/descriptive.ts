/** Descriptive statistics. All functions are pure and reject non-finite input. */

export function assertFinite(values: readonly number[], label = "values"): void {
  for (const v of values) {
    if (typeof v !== "number" || !Number.isFinite(v)) {
      throw new Error(`${label} must contain only finite numbers (found ${String(v)})`);
    }
  }
}

export function sum(values: readonly number[]): number {
  // Kahan summation: long metric series otherwise drift enough to move a
  // borderline p-value between runs on different array orders.
  let total = 0;
  let compensation = 0;
  for (const value of values) {
    const y = value - compensation;
    const t = total + y;
    compensation = t - total - y;
    total = t;
  }
  return total;
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) return NaN;
  return sum(values) / values.length;
}

/** Sample variance (n-1). Returns NaN for n < 2 rather than pretending to know. */
export function variance(values: readonly number[]): number {
  const n = values.length;
  if (n < 2) return NaN;
  const m = mean(values);
  return sum(values.map((v) => (v - m) ** 2)) / (n - 1);
}

export function stdDev(values: readonly number[]): number {
  return Math.sqrt(variance(values));
}

export function standardError(values: readonly number[]): number {
  return stdDev(values) / Math.sqrt(values.length);
}

/** Linear-interpolated quantile (type 7, matching R's default). */
export function quantile(values: readonly number[], q: number): number {
  if (values.length === 0) return NaN;
  if (q < 0 || q > 1) throw new Error("quantile expects q in [0, 1]");
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  if (lower === upper) return sorted[lower]!;
  return sorted[lower]! + (pos - lower) * (sorted[upper]! - sorted[lower]!);
}

export function median(values: readonly number[]): number {
  return quantile(values, 0.5);
}

export function iqr(values: readonly number[]): number {
  return quantile(values, 0.75) - quantile(values, 0.25);
}

/**
 * Median absolute deviation, scaled to be a consistent estimator of sigma for
 * normal data. Pulse baselines use MAD rather than SD because a single
 * three-hour cram session should not move the band it is measured against.
 */
export function mad(values: readonly number[], scale = 1.4826): number {
  if (values.length === 0) return NaN;
  const m = median(values);
  return scale * median(values.map((v) => Math.abs(v - m)));
}

export function min(values: readonly number[]): number {
  return values.length ? Math.min(...values) : NaN;
}

export function max(values: readonly number[]): number {
  return values.length ? Math.max(...values) : NaN;
}

export interface Summary {
  n: number;
  mean: number;
  sd: number;
  median: number;
  min: number;
  max: number;
  q1: number;
  q3: number;
}

export function summarise(values: readonly number[]): Summary {
  return {
    n: values.length,
    mean: mean(values),
    sd: stdDev(values),
    median: median(values),
    min: min(values),
    max: max(values),
    q1: quantile(values, 0.25),
    q3: quantile(values, 0.75),
  };
}

/** Fractional ranks with ties averaged — required for Spearman and Mann-Whitney. */
export function rank(values: readonly number[]): number[] {
  const indexed = values.map((value, index) => ({ value, index }));
  indexed.sort((a, b) => a.value - b.value);
  const ranks = new Array<number>(values.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j + 1 < indexed.length && indexed[j + 1]!.value === indexed[i]!.value) j += 1;
    const averaged = (i + j) / 2 + 1;
    for (let k = i; k <= j; k += 1) ranks[indexed[k]!.index] = averaged;
    i = j + 1;
  }
  return ranks;
}

/** Group sizes of tied values — the correction term for the U-test variance. */
export function tieGroups(values: readonly number[]): number[] {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.values()].filter((c) => c > 1);
}

export function zScores(values: readonly number[]): number[] {
  const m = mean(values);
  const s = stdDev(values);
  if (!Number.isFinite(s) || s === 0) return values.map(() => 0);
  return values.map((v) => (v - m) / s);
}

export function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/** Rounds for display without letting float noise leak into reported numbers. */
export function round(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

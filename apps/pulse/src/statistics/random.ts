/**
 * Seeded randomness and resampling.
 *
 * Every stochastic procedure in Pulse (bootstrap intervals, permutation tests,
 * experiment assignment, synthetic users) takes an explicit seed. Two runs on
 * the same data must produce byte-identical output, otherwise a user watching
 * a confidence interval wobble between refreshes has no reason to trust any of
 * it.
 */

export interface Rng {
  next(): number;
  int(maxExclusive: number): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];
}

/** mulberry32 — small, fast, and good enough for resampling. */
export function createRng(seed: number | string): Rng {
  let state = typeof seed === "number" ? seed >>> 0 : hashSeed(seed);
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (maxExclusive) => Math.floor(next() * maxExclusive),
    pick: (items) => items[Math.floor(next() * items.length)]!,
    shuffle<T>(items: readonly T[]): T[] {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j]!, out[i]!];
      }
      return out;
    },
  };
}

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Box-Muller normal deviate. */
export function normalDeviate(rng: Rng, mean = 0, sd = 1): number {
  const u1 = Math.max(1e-12, rng.next());
  const u2 = rng.next();
  return mean + sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

export interface BootstrapResult {
  estimate: number;
  low: number;
  high: number;
  level: number;
  iterations: number;
}

/**
 * Percentile bootstrap CI for an arbitrary statistic.
 *
 * Preferred over a parametric interval when the statistic has no clean
 * sampling distribution (medians, ratios, trimmed means), which covers most of
 * what a session log actually measures.
 */
export function bootstrapCi(
  values: readonly number[],
  statistic: (sample: readonly number[]) => number,
  options: { iterations?: number; level?: number; seed?: number | string } = {},
): BootstrapResult {
  const iterations = options.iterations ?? 2000;
  const level = options.level ?? 0.95;
  const rng = createRng(options.seed ?? "pulse-bootstrap");
  const n = values.length;
  const estimate = statistic(values);

  if (n < 3) return { estimate, low: NaN, high: NaN, level, iterations: 0 };

  const replicates: number[] = [];
  const sample = new Array<number>(n);
  for (let it = 0; it < iterations; it += 1) {
    for (let i = 0; i < n; i += 1) sample[i] = values[rng.int(n)]!;
    const value = statistic(sample);
    if (Number.isFinite(value)) replicates.push(value);
  }
  replicates.sort((a, b) => a - b);
  if (replicates.length < 10) return { estimate, low: NaN, high: NaN, level, iterations: replicates.length };

  const alpha = (1 - level) / 2;
  const at = (q: number): number => replicates[Math.min(replicates.length - 1, Math.max(0, Math.floor(q * (replicates.length - 1))))]!;
  return { estimate, low: at(alpha), high: at(1 - alpha), level, iterations: replicates.length };
}

/**
 * Two-sample permutation test on the difference in means.
 *
 * Makes no distributional assumption at all, which makes it the right
 * arbiter when a t-test and a rank test disagree.
 */
export function permutationTest(
  a: readonly number[],
  b: readonly number[],
  options: { iterations?: number; seed?: number | string } = {},
): { observed: number; pValue: number; iterations: number } {
  const iterations = options.iterations ?? 5000;
  const rng = createRng(options.seed ?? "pulse-permutation");
  const nA = a.length;
  const pooled = [...a, ...b];
  const meanOf = (xs: readonly number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length;
  const observed = meanOf(a) - meanOf(b);

  if (nA < 3 || b.length < 3) return { observed, pValue: NaN, iterations: 0 };

  let atLeastAsExtreme = 0;
  for (let it = 0; it < iterations; it += 1) {
    const shuffled = rng.shuffle(pooled);
    const diff = meanOf(shuffled.slice(0, nA)) - meanOf(shuffled.slice(nA));
    if (Math.abs(diff) >= Math.abs(observed) - 1e-12) atLeastAsExtreme += 1;
  }
  // +1 in both terms: the observed arrangement is itself a valid permutation,
  // which keeps the p-value from ever being exactly zero.
  return { observed, pValue: (atLeastAsExtreme + 1) / (iterations + 1), iterations };
}

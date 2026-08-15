'use strict';

// ---------------------------------------------------------------------------
// Equivalence testing for task success.
//
// RTK's headline claim is "50–90% fewer tool-result tokens with statistically
// equivalent task success". The second half is an *equivalence* claim, and it
// is the one the current evidence cannot support.
//
// `benchmark/agent-live.js` reports "raw 12/14 fixable, RTK 12/14 fixable" and
// asserts "RTK must not lose success vs raw". That is a comparison of two
// counts. It is not a statistical statement, and the natural way to upgrade it
// is wrong in a specific, well-known way:
//
//   Running a significance test, getting p > 0.05, and concluding the arms are
//   equivalent is the classic error. A non-significant result means the data
//   could not distinguish them — which is exactly what you also get from a
//   tiny sample, a noisy metric, or an underpowered design. Absence of evidence
//   of a difference is not evidence of absence of a difference, and with 14
//   cases you are guaranteed the former no matter what is true.
//
// Equivalence has to be tested directly, against a margin chosen in advance:
//
//   H0 (what we assume): RTK is worse than raw by at least Δ
//   H1 (what we must show): the true difference is inside (-Δ, +Δ)
//
// That is TOST — two one-sided tests. Both one-sided tests must reject at α
// for the arms to be called equivalent, which means the burden of proof sits
// on the claim being made rather than on its negation. A small sample now
// *fails* to show equivalence, which is the correct behaviour and the opposite
// of what the p > 0.05 reading would have given.
//
// Δ is a product decision, not a statistical one: how much task success is a
// 70% token reduction actually worth? It must be fixed before looking at the
// data, so it lives here as a named constant with its reasoning attached.
//
// Pure. No I/O. No dependencies.
// ---------------------------------------------------------------------------

/**
 * The equivalence margin, in percentage points of task success.
 *
 * 5 points is a judgement about the product: RTK exists to cut tokens, and a
 * user trading ~70% of tool-result tokens for a 1-in-20 chance of an extra
 * round trip is getting a good deal. A margin of 10 would be easy to "pass"
 * and would let a real regression through; a margin of 1 could not be
 * demonstrated at any sample size this project will ever run.
 *
 * Changing this after seeing results invalidates the claim. If it needs to
 * change, change it here, say why, and re-run everything.
 */
const DEFAULT_MARGIN = 0.05;

/** Two one-sided tests at 0.05 each; the resulting interval is 90%, not 95%. */
const DEFAULT_ALPHA = 0.05;

// ---------------------------------------------------------------------------
// Normal distribution
// ---------------------------------------------------------------------------

/** Abramowitz & Stegun 7.1.26 — enough precision for a p-value we round anyway. */
function erf(x) {
  const sign = x < 0 ? -1 : 1;
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-a * a);
  return sign * y;
}

function normalCdf(z) {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/** Inverse normal CDF (Acklam). Used for sample-size calculations. */
function normalQuantile(p) {
  if (p <= 0 || p >= 1) return p <= 0 ? -Infinity : Infinity;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pLow = 0.02425;
  let q;
  let r;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p <= 1 - pLow) {
    q = p - 0.5;
    r = q * q;
    return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

// ---------------------------------------------------------------------------
// Wilson interval
// ---------------------------------------------------------------------------

/**
 * Wilson score interval for a proportion.
 *
 * Wald (p ± z·√(p(1-p)/n)) is the interval most people reach for and it is
 * badly wrong exactly where this benchmark lives: near 0 or 1, and at small n.
 * At 14/14 successes Wald gives the interval [1, 1] — zero uncertainty from
 * fourteen observations — which would make any equivalence claim built on it
 * meaningless.
 */
function wilsonInterval(successes, n, alpha = DEFAULT_ALPHA) {
  if (n === 0) return { lower: 0, upper: 1, point: 0 };
  const z = normalQuantile(1 - alpha / 2);
  const p = successes / n;
  const denom = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const spread = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return {
    point: p,
    lower: Math.max(0, (centre - spread) / denom),
    upper: Math.min(1, (centre + spread) / denom),
  };
}

// ---------------------------------------------------------------------------
// TOST for paired binary outcomes
// ---------------------------------------------------------------------------

/**
 * Equivalence test for the same tasks run through both arms.
 *
 * The design is paired: every case is attempted with raw output and with RTK
 * output, so the pairs share task difficulty, model and prompt. Treating those
 * as two independent samples throws away that structure and needs far more
 * data for the same conclusion.
 *
 * Only the discordant pairs carry information about the difference:
 *
 *   b = raw succeeded, RTK failed   (RTK cost us this one)
 *   c = raw failed, RTK succeeded   (RTK won this one)
 *
 * Cases where both arms agree tell us the task was easy or impossible, not
 * whether filtering hurt — which is why `n` alone is a poor description of how
 * much evidence a run actually contains.
 */
function tostPaired(pairs, options = {}) {
  const margin = options.margin ?? DEFAULT_MARGIN;
  const alpha = options.alpha ?? DEFAULT_ALPHA;

  let a = 0; // both succeeded
  let b = 0; // raw only
  let c = 0; // rtk only
  let d = 0; // neither
  for (const pair of pairs) {
    if (pair.raw && pair.rtk) a += 1;
    else if (pair.raw && !pair.rtk) b += 1;
    else if (!pair.raw && pair.rtk) c += 1;
    else d += 1;
  }
  const n = a + b + c + d;

  if (n === 0) {
    return {
      n: 0, a, b, c, d, discordant: 0,
      difference: 0, lower: -1, upper: 1,
      equivalent: false, margin, alpha,
      reason: 'No paired observations.',
      note: 'No data: equivalence cannot be shown.',
    };
  }

  // Difference in success rates, RTK minus raw. Negative means RTK is worse.
  const difference = (c - b) / n;

  // Standard error for a paired difference in proportions.
  const variance = (b + c - ((c - b) * (c - b)) / n) / (n * n);
  const se = Math.sqrt(Math.max(variance, 0));
  const z = normalQuantile(1 - alpha);

  // With no discordant pairs the observed difference is exactly zero and the
  // SE is zero, which would divide by zero and report perfect equivalence from
  // any sample size at all. The interval has to come from the sample size
  // instead: the rule-of-three upper bound on an unobserved event.
  const ruleOfThree = 3 / n;
  const halfWidth = se > 0 ? z * se : ruleOfThree;

  const lower = difference - halfWidth;
  const upper = difference + halfWidth;
  const equivalent = lower > -margin && upper < margin;

  // TOST p-value: the larger of the two one-sided tests. Both must clear alpha.
  let pLower;
  let pUpper;
  if (se > 0) {
    pLower = 1 - normalCdf((difference + margin) / se);
    pUpper = normalCdf((difference - margin) / se);
  } else {
    // No discordant pairs: the evidence is entirely in n. Treat the rule-of-
    // three bound as the interval and derive a conservative p from it.
    pLower = ruleOfThree < margin ? 0 : 1;
    pUpper = pLower;
  }
  const p = Math.max(pLower, pUpper);

  const reason = equivalent
    ? null
    : b + c === 0
      ? `No case differed between arms, but ${n} pairs only bound the difference at ±${(ruleOfThree * 100).toFixed(1)} points, which is wider than the ±${(margin * 100).toFixed(0)}-point margin. More cases needed.`
      : upper >= margin && lower <= -margin
        ? `The interval [${(lower * 100).toFixed(1)}, ${(upper * 100).toFixed(1)}] is wider than the margin in both directions — the sample cannot tell equivalence from a real difference.`
        : lower <= -margin
          ? `RTK may be worse by up to ${Math.abs(lower * 100).toFixed(1)} points, beyond the ${(margin * 100).toFixed(0)}-point margin.`
          : `RTK may be better by up to ${(upper * 100).toFixed(1)} points, beyond the margin — equivalence is a two-sided claim.`;

  const note = equivalent
    ? `Equivalent: the difference in task success is within ±${(margin * 100).toFixed(0)} points (90% CI ${(lower * 100).toFixed(1)} to ${(upper * 100).toFixed(1)}, n=${n}).`
    : `Not demonstrated. ${reason}`;

  return { n, a, b, c, d, discordant: b + c, difference, lower, upper, equivalent, margin, alpha, p, reason, note };
}

/**
 * Exact McNemar test — is there a *difference*?
 *
 * Reported alongside TOST and never instead of it. The two answer different
 * questions, and the pair is what stops either being over-read: a run can show
 * no significant difference while also failing to show equivalence, and that
 * combination means "not enough data", which is the most common true state of
 * a benchmark this size.
 */
function mcnemarExact(b, c) {
  const n = b + c;
  if (n === 0) return { p: 1, note: 'No discordant pairs — no evidence of a difference either way.' };
  let tail = 0;
  const k = Math.min(b, c);
  for (let i = 0; i <= k; i += 1) tail += binomialPmf(i, n, 0.5);
  const p = Math.min(1, 2 * tail);
  return {
    p,
    note: p < 0.05
      ? `Significant difference between arms (exact McNemar p=${p.toFixed(4)}, ${b} raw-only vs ${c} RTK-only).`
      : `No significant difference (exact McNemar p=${p.toFixed(4)}). This is not equivalence — see the TOST result.`,
  };
}

function binomialPmf(k, n, p) {
  return Math.exp(logChoose(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p));
}

function logChoose(n, k) {
  return logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1);
}

function logGamma(x) {
  const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j += 1) ser += g[j] / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

// ---------------------------------------------------------------------------
// Sample size
// ---------------------------------------------------------------------------

/**
 * Pairs needed to have a fair chance of demonstrating equivalence.
 *
 * Exists to be run *before* collecting data. The most expensive way to
 * discover a benchmark is too small is to build it, run it and find the
 * interval too wide to conclude anything — which is exactly where the current
 * 14-case set sits.
 */
function requiredPairs(options = {}) {
  const margin = options.margin ?? DEFAULT_MARGIN;
  const alpha = options.alpha ?? DEFAULT_ALPHA;
  const power = options.power ?? 0.8;
  // Expected proportion of pairs where the arms disagree. Discordance is what
  // drives the variance, so assuming it is rare is the optimistic case and the
  // default is deliberately not optimistic.
  const discordance = options.discordance ?? 0.1;

  const zA = normalQuantile(1 - alpha);
  const zB = normalQuantile(power);
  // Variance of the paired difference under the null of no true difference.
  const n = Math.ceil(((zA + zB) ** 2 * discordance) / (margin * margin));
  return {
    pairs: n,
    margin,
    alpha,
    power,
    discordance,
    note: `About ${n} paired cases are needed to show equivalence within ±${(margin * 100).toFixed(0)} points at ${Math.round(power * 100)}% power, assuming the arms disagree on ${(discordance * 100).toFixed(0)}% of cases.`,
  };
}

module.exports = {
  DEFAULT_MARGIN,
  DEFAULT_ALPHA,
  wilsonInterval,
  tostPaired,
  mcnemarExact,
  requiredPairs,
  normalCdf,
  normalQuantile,
};

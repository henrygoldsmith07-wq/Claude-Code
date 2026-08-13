/**
 * Distribution functions, implemented from scratch so that every number Pulse
 * reports is reproducible and reviewable. No statistical dependency means no
 * silent version drift in p-values between releases.
 *
 * Accuracy targets: absolute error < 1e-10 for the CDFs across the ranges we
 * use, verified in tests against published reference values.
 */

const LANCZOS = [
  676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

export function logGamma(x: number): number {
  if (x < 0.5) {
    // Reflection formula keeps the Lanczos series in its accurate range.
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  }
  const z = x - 1;
  let a = 0.99999999999980993;
  for (let i = 0; i < LANCZOS.length; i += 1) a += LANCZOS[i]! / (z + i + 1);
  const t = z + LANCZOS.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}

const EPS = 1e-15;
const TINY = 1e-300;

/** Regularised lower incomplete gamma P(a, x). */
export function gammaP(a: number, x: number): number {
  if (x < 0 || a <= 0) throw new Error("gammaP requires a > 0 and x >= 0");
  if (x === 0) return 0;
  if (x < a + 1) {
    // Series representation converges quickly on this side.
    let ap = a;
    let sum = 1 / a;
    let del = sum;
    for (let n = 0; n < 1000; n += 1) {
      ap += 1;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * EPS) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
  }
  return 1 - gammaQContinuedFraction(a, x);
}

function gammaQContinuedFraction(a: number, x: number): number {
  let b = x + 1 - a;
  let c = 1 / TINY;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= 1000; i += 1) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < TINY) d = TINY;
    c = b + an / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
}

export function erf(x: number): number {
  if (x === 0) return 0;
  const p = gammaP(0.5, x * x);
  return x > 0 ? p : -p;
}

export function erfc(x: number): number {
  return 1 - erf(x);
}

export function normalPdf(z: number): number {
  return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
}

export function normalCdf(z: number, mean = 0, sd = 1): number {
  const x = (z - mean) / sd;
  // erfc form avoids catastrophic cancellation deep in the left tail.
  return 0.5 * erfc(-x / Math.SQRT2);
}

/** Inverse standard normal CDF (Acklam), refined once with Halley's method. */
export function normalQuantile(p: number): number {
  if (p <= 0 || p >= 1) {
    if (p === 0) return -Infinity;
    if (p === 1) return Infinity;
    throw new Error(`normalQuantile expects 0 < p < 1, received ${p}`);
  }
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pLow = 0.02425;
  let x: number;
  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  } else if (p <= 1 - pLow) {
    const q = p - 0.5;
    const r = q * q;
    x = ((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q) /
      (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  }
  const e = normalCdf(x) - p;
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
  return x - u / (1 + (x * u) / 2);
}

/** Regularised incomplete beta I_x(a, b) via the Lentz continued fraction. */
export function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lbeta = logGamma(a + b) - logGamma(a) - logGamma(b);
  const front = Math.exp(lbeta + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return (front * betaContinuedFraction(x, a, b)) / a;
  return 1 - (Math.exp(lbeta + b * Math.log(1 - x) + a * Math.log(x)) * betaContinuedFraction(1 - x, b, a)) / b;
}

function betaContinuedFraction(x: number, a: number, b: number): number {
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < TINY) d = TINY;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 500; m += 1) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** CDF of Student's t with `df` degrees of freedom. */
export function tCdf(t: number, df: number): number {
  if (df <= 0) throw new Error("tCdf requires df > 0");
  if (!Number.isFinite(t)) return t > 0 ? 1 : 0;
  const p = 0.5 * incompleteBeta(df / (df + t * t), df / 2, 0.5);
  return t > 0 ? 1 - p : p;
}

/** Two-sided p-value for a t statistic. */
export function tTwoSidedP(t: number, df: number): number {
  if (!Number.isFinite(t)) return 0;
  return Math.min(1, 2 * (1 - tCdf(Math.abs(t), df)));
}

/** Inverse t CDF by bracketed bisection — slower than a closed form, but robust. */
export function tQuantile(p: number, df: number): number {
  if (p <= 0 || p >= 1) throw new Error(`tQuantile expects 0 < p < 1, received ${p}`);
  if (df > 1e7) return normalQuantile(p);
  let lo = -1e3;
  let hi = 1e3;
  for (let i = 0; i < 300; i += 1) {
    const mid = (lo + hi) / 2;
    if (tCdf(mid, df) < p) lo = mid;
    else hi = mid;
    if (hi - lo < 1e-12) break;
  }
  return (lo + hi) / 2;
}

/** CDF of the chi-square distribution — used by the categorical association test. */
export function chiSquareCdf(x: number, df: number): number {
  if (x <= 0) return 0;
  return gammaP(df / 2, x / 2);
}

export function chiSquareP(x: number, df: number): number {
  return 1 - chiSquareCdf(x, df);
}

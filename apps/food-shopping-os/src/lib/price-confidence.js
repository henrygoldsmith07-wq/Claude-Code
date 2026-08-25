/**
 * Confidence scoring for external prices and uncertainty-aware baskets.
 *
 * External prices (community observations, scraped pages) are never live.
 * This module turns their provenance into a single honest score so the UI
 * can show HIGH vs LOW and the basket can show a range instead of a false
 * exact total.
 */

import { dayStamp, daysUntil, priceHistory } from './kitchen.js';

const round2 = (n) => Math.round(n * 100) / 100;

// shoppingNameKey duplicate to avoid circular import with shopping.js
const shoppingKey = (name) => {
  const raw = String(name || '').toLowerCase().trim().replace(/\s+/g, ' ');
  const words = raw.replace(/&/g, ' and ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean);
  const key = words.map((word) => {
    if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`;
    if (word.endsWith('s') && !word.endsWith('ss') && !word.endsWith('us') && word.length > 3) return word.slice(0, -1);
    return word;
  }).join(' ');
  return key || raw;
};

/** Days ago from today; null when unparseable — matches observed-prices. */
export const priceAgeDays = (observedAt, today = dayStamp()) => {
  if (!observedAt) return null;
  const stamp = String(observedAt).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(stamp)) return null;
  const diff = daysUntil(stamp, today);
  return diff == null ? null : -diff;
};

const normalize = (s) => String(s || '').toLowerCase().trim();

/**
 * Score a single external price.
 *
 * @param {object} price - { price: number, observedAt?: string, barcode?: string|null, store?: string, location?: string }
 * @param {object} opts
 * @param {number} opts.supportingCount - how many raw observations back this cheapest row
 * @param {string|null} opts.requestedStore - store the basket is being priced for, for retailer-match bonus
 * @param {string} opts.today - dayStamp
 * @returns {{ score:number, level:'HIGH'|'MEDIUM'|'LOW', reasons:string[], breakdown:object, age:number|null }}
 */
export function scoreExternalPrice(price = {}, opts = {}) {
  const today = opts.today || dayStamp();
  const supportingCount = Math.max(0, Number(opts.supportingCount) || 0);
  const age = priceAgeDays(price.observedAt, today);
  let score = 50; // baseline for an observed community price
  const reasons = [];
  const breakdown = {};

  // 1. Recency
  if (age == null) {
    score -= 10;
    breakdown.recency = -10;
    reasons.push('date unknown');
  } else if (age < 0) {
    score -= 12;
    breakdown.recency = -12;
    reasons.push('observed date in future');
  } else if (age <= 1) {
    score += 20;
    breakdown.recency = 20;
    reasons.push(age === 0 ? 'observed today' : 'observed yesterday');
  } else if (age <= 3) {
    score += 12;
    breakdown.recency = 12;
    reasons.push(`observed ${age}d ago`);
  } else if (age <= 7) {
    score += 8;
    breakdown.recency = 8;
    reasons.push(`observed ${age}d ago`);
  } else if (age <= 30) {
    breakdown.recency = 0;
    reasons.push(`observed ${age}d ago`);
  } else if (age <= 60) {
    score -= 15;
    breakdown.recency = -15;
    reasons.push(`observed ${age}d ago · ageing`);
  } else {
    score -= 26;
    breakdown.recency = -26;
    reasons.push(`observed ${age}d ago · stale`);
  }

  // 2. Match type — exact barcode vs product-name only
  const isExactBarcode = Boolean(price.barcode && /^\d{8,14}$/.test(String(price.barcode).replace(/\D/g, '')));
  if (isExactBarcode) {
    score += 18;
    breakdown.match = 18;
    reasons.push('exact barcode match');
  } else {
    breakdown.match = 0;
    reasons.push('product-name match only');
  }

  // 3. Supporting observations — 3+ from the same product strengthens the cheapest row
  if (supportingCount >= 4) {
    score += 16;
    breakdown.supporting = 16;
    reasons.push(`${supportingCount} supporting observations`);
  } else if (supportingCount === 3) {
    score += 14;
    breakdown.supporting = 14;
    reasons.push('3 supporting observations');
  } else if (supportingCount === 2) {
    score += 8;
    breakdown.supporting = 8;
    reasons.push('2 supporting observations');
  } else if (supportingCount === 1) {
    breakdown.supporting = 0;
    reasons.push('single observation');
  } else {
    score -= 6;
    breakdown.supporting = -6;
    reasons.push('no supporting observations');
  }

  // 4. Retailer match — when a requested store is known
  const requested = normalize(opts.requestedStore);
  const observedStore = normalize(price.store);
  if (requested && observedStore) {
    if (observedStore === requested) {
      score += 8;
      breakdown.retailer = 8;
      reasons.push('same retailer');
    } else {
      breakdown.retailer = 0;
      reasons.push(`different retailer (${price.store})`);
    }
    // location granularity — if both have location strings and share a token, small bonus
    const locReq = normalize(price.location);
    // Not enough signal to penalise mismatched branches; keep neutral
  } else {
    breakdown.retailer = 0;
  }

  // 5. Source penalty for unverified scraped rows (if ever fed through here)
  if (price.source === 'ai-web-scrape' || price.unverified) {
    score -= 6;
    breakdown.verification = -6;
    reasons.push('unverified scrape');
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const level = score >= 75 ? 'HIGH' : score >= 45 ? 'MEDIUM' : 'LOW';
  const tone = level === 'HIGH' ? 'good' : level === 'MEDIUM' ? 'warn' : 'danger';

  return { score, level, tone, reasons, breakdown, age, isExactBarcode, supportingCount };
}

export function confidenceTone(level) {
  if (level === 'HIGH') return 'good';
  if (level === 'MEDIUM') return 'warn';
  return 'danger';
}

export function confidenceLabel(level) {
  if (level === 'HIGH') return 'High confidence';
  if (level === 'MEDIUM') return 'Medium confidence';
  return 'Low confidence';
}

/**
 * Build a confidence object for a receipt-backed price.
 * Receipts are the strongest source — high base, mildly decayed by age.
 */
export function scoreReceiptPrice(point = {}, opts = {}) {
  const today = opts.today || dayStamp();
  const age = point.date ? priceAgeDays(point.date, today) : null;
  let score = 88;
  const reasons = [];
  if (age == null) {
    reasons.push('recorded shop');
  } else if (age <= 7) {
    score += 7;
    reasons.push(age === 0 ? 'bought today' : `bought ${age}d ago`);
  } else if (age <= 30) {
    score += 2;
    reasons.push(`bought ${age}d ago`);
  } else if (age <= 60) {
    score -= 8;
    reasons.push(`bought ${age}d ago · ageing`);
  } else {
    score -= 18;
    reasons.push(`bought ${age}d ago · stale`);
  }
  if (opts.supportingCount >= 2) {
    score += 5;
    reasons.push(`${opts.supportingCount} purchases`);
  }
  score = Math.max(0, Math.min(100, Math.round(score)));
  const level = score >= 75 ? 'HIGH' : score >= 45 ? 'MEDIUM' : 'LOW';
  return { score, level, tone: confidenceTone(level), reasons, age, isExactBarcode: false, supportingCount: opts.supportingCount || 0 };
}

/**
 * Estimate baskets for every known store with uncertainty.
 * Falls back from receipt to community observation per item.
 *
 * @param {Array} items - shopping list rows
 * @param {object} opts
 * @param {Array} opts.shops - receipt history
 * @param {object} opts.observedByKey - result.byKey from fetchObservedForList (value = {price, observedAt, barcode, store, raw, ...})
 * @param {string} opts.today
 * @returns {Array<{store:string, estimate:number, low:number, high:number, covered:number, of:number, coveragePct:number, level:string, avgScore:number|null, sources:{receipt:number, observed:number}}>}
 */
export function estimateBasket(items = [], priceResolver) {
  if (!Array.isArray(items) || !items.length) {
    return { estimate: 0, low: 0, high: 0, covered: 0, of: 0, coveragePct: 0, avgScore: null, level: 'LOW', pricedItems: [] };
  }
  let estimate = 0;
  let low = 0;
  let high = 0;
  let covered = 0;
  let scoreSum = 0;
  const pricedItems = [];

  for (const item of items) {
    const resolved = typeof priceResolver === 'function' ? priceResolver(item) : null;
    if (!resolved || !(Number(resolved.price) > 0)) continue;
    const lvl = resolved.confidence?.level || 'LOW';
    const range = priceRangeForConfidence(resolved.price, lvl);
    if (!range) continue;
    covered += 1;
    estimate = round2(estimate + range.estimate);
    low = round2(low + range.low);
    high = round2(high + range.high);
    const s = Number(resolved.confidence?.score);
    if (Number.isFinite(s)) scoreSum += s;
    pricedItems.push({ name: item.name, ...resolved, range });
  }

  const of = items.length;
  const coveragePct = of ? Math.round((covered / of) * 100) : 0;
  const avgScore = covered ? Math.round(scoreSum / covered) : null;
  let level = 'LOW';
  if (avgScore != null) {
    if (avgScore >= 75 && coveragePct >= 80) level = 'HIGH';
    else if (avgScore >= 45 && coveragePct >= 60) level = 'MEDIUM';
  }

  return { estimate, low, high, covered, of, coveragePct, avgScore, level, pricedItems };
}

/**
 * Estimate baskets for every known store with uncertainty.
  const shops = opts.shops || [];
  const observedByKey = opts.observedByKey || {};
  const today = opts.today || dayStamp();
  const history = priceHistory(shops);
  const stores = [...new Set(shops.map((s) => s.store).filter(Boolean))];
  // also include stores seen only in community observations so a basket can be estimated even before a receipt
  for (const key of Object.keys(observedByKey)) {
    const entry = observedByKey[key];
    if (entry?.store) stores.push(entry.store);
    if (Array.isArray(entry?.raw)) {
      for (const r of entry.raw) if (r?.store) stores.push(r.store);
    }
  }
  const uniqueStores = [...new Set(stores)];
  if (!uniqueStores.length) return [];

  const priceAt = (entry, store) => {
    const points = (entry.points || []).filter((p) => p.store === store);
    return points.length ? points[points.length - 1] : null;
  };

  return uniqueStores.map((store) => {
    let estimate = 0;
    let low = 0;
    let high = 0;
    let covered = 0;
    let scoreSum = 0;
    let receiptCount = 0;
    let observedCount = 0;

    for (const item of items) {
      const entry = history.find((h) => shoppingKey(h.name) === shoppingKey(item.name));
      const receiptPoint = entry ? priceAt(entry, store) : null;
      if (receiptPoint) {
        const conf = scoreReceiptPrice(receiptPoint, { today, supportingCount: entry.points.length });
        const range = priceRangeForConfidence(receiptPoint.price, conf.level);
        covered += 1;
        estimate = round2(estimate + range.estimate);
        low = round2(low + range.low);
        high = round2(high + range.high);
        scoreSum += conf.score;
        receiptCount += 1;
        continue;
      }
      // fallback to community observed price (cheapest for this ingredient)
      const key = shoppingKey(item.name);
      const obs = observedByKey[key];
      if (obs && Number(obs.price) > 0) {
        const rawLen = Array.isArray(obs.raw) ? obs.raw.length : 1;
        const conf = scoreExternalPrice(
          { price: obs.price, observedAt: obs.observedAt, barcode: obs.barcode || null, store: obs.store, location: obs.location, source: 'observed' },
          { supportingCount: rawLen, requestedStore: store, today }
        );
        const range = priceRangeForConfidence(obs.price, conf.level);
        covered += 1;
        estimate = round2(estimate + range.estimate);
        low = round2(low + range.low);
        high = round2(high + range.high);
        scoreSum += conf.score;
        observedCount += 1;
        continue;
      }
      // no price available for this item at this store — uncovered, does not contribute to range
    }

    const of = items.length;
    const coveragePct = of ? Math.round((covered / of) * 100) : 0;
    const avgScore = covered ? Math.round(scoreSum / covered) : null;
    let level = 'LOW';
    if (avgScore != null) {
      if (avgScore >= 75 && coveragePct >= 80) level = 'HIGH';
      else if (avgScore >= 45 && coveragePct >= 60) level = 'MEDIUM';
    }
    // If nothing covered, range stays 0 — caller should treat as unavailable
    return {
      store,
      estimate,
      low,
      high,
      covered,
      of,
      coveragePct,
      avgScore,
      level,
      sources: { receipt: receiptCount, observed: observedCount },
    };
  }).sort((a, b) => {
    // Prefer higher coverage, then lower estimated total
    if (b.coveragePct !== a.coveragePct) return b.coveragePct - a.coveragePct;
    return a.estimate - b.estimate;
  });
}

/**
 * Price range for a given confidence — wider when less sure.
 * HIGH: ±4%  MEDIUM: ±8%  LOW: ±15%
 */
export function priceRangeForConfidence(price, levelOrScore) {
  if (!(Number(price) > 0)) return null;
  const level = typeof levelOrScore === 'string'
    ? levelOrScore
    : levelOrScore >= 75 ? 'HIGH' : levelOrScore >= 45 ? 'MEDIUM' : 'LOW';
  const spread = level === 'HIGH' ? 0.04 : level === 'MEDIUM' ? 0.08 : 0.15;
  return {
    estimate: round2(price),
    low: round2(price * (1 - spread)),
    high: round2(price * (1 + spread)),
    spreadPct: Math.round(spread * 100),
    level,
  };
}

/**
 * Estimate a basket with uncertainty.
 *
 * @param {Array} items - shopping list items [{name, ...}]
 * @param {Function} priceResolver - (item) => { price:number, confidence:{score,level}, source:'receipt'|'observed'|'none' } | null
 * @returns {Array<{store:string, estimate:number, low:number, high:number, covered:number, of:number, coveragePct:number, level:string, avgScore:number|null, sources:{receipt:number, observed:number}}>}
 */
export function estimateBaskets(items = [], opts = {}) {
  const shops = opts.shops || [];
  const observedByKey = opts.observedByKey || {};
  const today = opts.today || dayStamp();
  const history = priceHistory(shops);
  const stores = [...new Set(shops.map((s) => s.store).filter(Boolean))];
  for (const entry of Object.values(observedByKey)) {
    if (entry?.store) stores.push(entry.store);
    if (Array.isArray(entry?.raw)) for (const r of entry.raw) if (r?.store) stores.push(r.store);
  }
  const uniqueStores = [...new Set(stores)];
  if (!uniqueStores.length || !items.length) return [];

  const priceAt = (entry, store) => {
    const points = (entry.points || []).filter((p) => p.store === store);
    return points.length ? points[points.length - 1] : null;
  };

  const shoppingKey = (name) => {
    const raw = String(name || '').toLowerCase().trim().replace(/\s+/g, ' ');
    const words = raw.replace(/&/g, ' and ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean);
    return words.map((w) => (w.endsWith('s') && !w.endsWith('ss') && w.length > 3 ? w.slice(0, -1) : w)).join(' ') || raw;
  };

  return uniqueStores.map((store) => {
    let estimate = 0; let low = 0; let high = 0; let covered = 0; let scoreSum = 0;
    let receiptCount = 0; let observedCount = 0;
    for (const item of items) {
      const entry = history.find((h) => shoppingKey(h.name) === shoppingKey(item.name));
      const rp = entry ? priceAt(entry, store) : null;
      if (rp) {
        const conf = scoreReceiptPrice(rp, { today, supportingCount: entry.points.length });
        const range = priceRangeForConfidence(rp.price, conf.level);
        covered += 1;
        estimate = round2(estimate + range.estimate);
        low = round2(low + range.low); high = round2(high + range.high);
        scoreSum += conf.score; receiptCount += 1; continue;
      }
      const obs = observedByKey[shoppingKey(item.name)];
      if (obs && Number(obs.price) > 0) {
        const rawLen = Array.isArray(obs.raw) ? obs.raw.length : 1;
        const conf = scoreExternalPrice(
          { price: obs.price, observedAt: obs.observedAt, barcode: null, store: obs.store },
          { supportingCount: rawLen, requestedStore: store, today }
        );
        const range = priceRangeForConfidence(obs.price, conf.level);
        covered += 1;
        estimate = round2(estimate + range.estimate);
        low = round2(low + range.low); high = round2(high + range.high);
        scoreSum += conf.score; observedCount += 1;
      }
    }
    const of = items.length;
    const coveragePct = of ? Math.round((covered / of) * 100) : 0;
    const avgScore = covered ? Math.round(scoreSum / covered) : null;
    let level = 'LOW';
    if (avgScore != null) {
      if (avgScore >= 75 && coveragePct >= 80) level = 'HIGH';
      else if (avgScore >= 45 && coveragePct >= 60) level = 'MEDIUM';
    }
    return { store, estimate, low, high, covered, of, coveragePct, avgScore, level, sources: { receipt: receiptCount, observed: observedCount } };
  }).sort((a, b) => b.coveragePct - a.coveragePct || a.estimate - b.estimate);
}

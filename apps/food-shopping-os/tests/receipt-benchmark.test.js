import { describe, it, expect } from 'vitest';
import { benchmarkReceipts, scoreCase, SEED_CORPUS, evidenceTier } from '../src/lib/receipt-benchmark.js';

describe('frozen corpus — coverage of the claim', () => {
  it('spans nine retailer groups and every condition class', () => {
    const retailers = new Set(SEED_CORPUS.map((c) => c.retailer));
    expect(retailers.size).toBeGreaterThanOrEqual(9);
    for (const condition of ['weighed', 'multiline', 'qty-prefix', 'multibuy', 'coupon',
      'loyalty', 'refund', 'split', 'substitution', 'independent', 'unreadable',
      'long', 'partial', 'fold', 'poor-lighting', 'duplicate', 'abbreviations']) {
      expect(SEED_CORPUS.some((c) => (c.conditions || []).includes(condition))).toBe(true);
    }
  });
});

describe('benchmark metrics — the six headline numbers', () => {
  const report = benchmarkReceipts();

  it('has a growing frozen corpus', () => {
    expect(report.corpusSize).toBeGreaterThanOrEqual(23);
  });

  it('reports every headline metric above 95% on the seed corpus', () => {
    for (const key of ['storeRecognition', 'dateExtraction', 'productLineDetection', 'productMatching', 'priceExtraction', 'basketTotal']) {
      expect(report[key], `${key} should be ≥95`).toBeGreaterThanOrEqual(95);
    }
  });

  it('meets evidence-grade targets on the seed corpus', () => {
    // These are the targets for the synthetic corpus. Real receipts will be lower.
    expect(report.storeRecognition, 'retailer recognition ≥99%').toBeGreaterThanOrEqual(99);
    expect(report.dateExtraction, 'date extraction ≥98%').toBeGreaterThanOrEqual(98);
    expect(report.productLineDetection, 'line detection ≥97%').toBeGreaterThanOrEqual(97);
    expect(report.priceExtraction, 'price extraction ≥98%').toBeGreaterThanOrEqual(98);
    expect(report.basketTotal, 'total extraction ≥99%').toBeGreaterThanOrEqual(99);
    expect(report.rejectionAccuracy, 'rejection accuracy ≥99%').toBeGreaterThanOrEqual(99);
  });

  it('handles discounts, coupons, refunds and substitutions as measured fields', () => {
    expect(report.discountAndCouponAccuracy.loyaltySavedPct).toBeGreaterThanOrEqual(90);
    expect(report.discountAndCouponAccuracy.couponPct).toBe(100);
    expect(report.discountAndCouponAccuracy.refundPct).toBe(100);
    expect(report.byCondition['weighed']).toBeGreaterThan(0);
    expect(report.byRetailer['Ocado']).toBeDefined();
    expect(report.failing).toEqual([]);
  });

  it('rejection accuracy: unreadable receipts are refused, never guessed', () => {
    expect(report.rejectionAccuracy).toBe(100);
  });

  it('a failing case names itself so corrections land where they belong', () => {
    const bad = scoreCase({
      name: 'broken-fixture', retailer: 'X', conditions: [],
      text: 'SHOP\n01/08/2026\nGhost item\n£9.99',
      expect: { store: 'X', date: '2026-08-01', total: 9.99, items: [{ name: 'ghost item', price: 4.5 }] },
    });
    expect(bad.pass).toBe(false);
    // Name matched but the price did not — exactly what the correction UI surfaces.
    expect(bad.matchedItems).toBe(1);
    expect(bad.fields.prices).toBe(false);
  });

  it('tracks corpus composition honestly', () => {
    expect(report.corpusComposition.real).toBe(0);
    expect(report.corpusComposition.synthetic).toBe(report.corpusSize);
  });
});

describe('evidence tiering — convenience until measured otherwise', () => {
  it('labels a purely synthetic corpus as useful-convenience, whatever its score', () => {
    const report = benchmarkReceipts();
    const tier = evidenceTier({ report, realReceipts: 0 });
    expect(tier.tier).toBe('useful-convenience');
    expect(tier.assumption).toMatch(/synthetic layouts only/i);
  });

  it('requires 300+ real receipts across 8+ retailers at 95%+ fields for evidence-grade', () => {
    const strong = {
      storeRecognition: 99.4, dateExtraction: 98.8, productLineDetection: 97.1,
      productMatching: 93.7, priceExtraction: 99.0, basketTotal: 99.7,
      byRetailer: Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`r${i}`, 96])),
    };
    // Product matching at 93.7 sits below the 95% gate — must NOT be evidence-grade.
    expect(evidenceTier({ report: strong, realReceipts: 350 }).tier).toBe('indicative');

    const better = { ...strong, productMatching: 97.2 };
    expect(evidenceTier({ report: better, realReceipts: 350 }).tier).toBe('evidence-grade');
    expect(evidenceTier({ report: better, realReceipts: 120 }).tier).toBe('indicative');
  });
});

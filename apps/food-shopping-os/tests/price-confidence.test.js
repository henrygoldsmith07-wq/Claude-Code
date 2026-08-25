import { describe, it, expect } from 'vitest';
import {
  scoreExternalPrice, priceRangeForConfidence,
  estimateBasket, estimateBaskets,
  confidenceTone, confidenceLabel, scoreReceiptPrice,
} from '../src/lib/price-confidence.js';

describe('scoreExternalPrice', () => {
  const today = '2026-08-23';

  it('HIGH: barcode + yesterday + same retailer + 3 supporting', () => {
    const out = scoreExternalPrice(
      { price: 1.4, observedAt: '2026-08-22', barcode: '5000159407236', store: 'Tesco' },
      { supportingCount: 3, requestedStore: 'Tesco', today },
    );
    expect(out.level).toBe('HIGH');
    expect(out.reasons).toContain('exact barcode match');
    expect(out.reasons).toContain('observed yesterday');
    expect(out.reasons).toContain('3 supporting observations');
    expect(out.reasons).toContain('same retailer');
  });

  it('LOW: name-only + stale + different retailer + no support', () => {
    const out = scoreExternalPrice(
      { price: 1.25, observedAt: '2026-07-07', barcode: null, store: 'Asda' },
      { supportingCount: 0, requestedStore: 'Tesco', today },
    );
    expect(out.level).toBe('LOW');
    expect(out.reasons).toContain('product-name match only');
    expect(out.reasons.some((r) => r.includes('ageing') || r.includes('stale'))).toBe(true);
    expect(out.reasons).toContain('no supporting observations');
  });

  it('MEDIUM: barcode but no date + single obs', () => {
    const out = scoreExternalPrice({ price: 2.2, barcode: '5012345678900' }, { supportingCount: 1, today });
    expect(out.level).toBe('MEDIUM');
    expect(out.reasons).toContain('date unknown');
  });

  it('penalises scraped prices', () => {
    const clean = scoreExternalPrice({ price: 1.4, observedAt: '2026-08-22' }, { today });
    const scrap = scoreExternalPrice({ price: 1.4, observedAt: '2026-08-22', source: 'ai-web-scrape' }, { today });
    expect(scrap.score).toBeLessThan(clean.score);
  });

  it('future dates penalised harder than unknown', () => {
    expect(scoreExternalPrice({ price: 1.5, observedAt: '2026-09-01' }, { today }).score)
      .toBeLessThanOrEqual(scoreExternalPrice({ price: 1.5 }, { today }).score);
  });
});

describe('priceRangeForConfidence', () => {
  it('HIGH ±4%', () => {
    const r = priceRangeForConfidence(10, 'HIGH');
    expect(r.low).toBeCloseTo(9.60, 1);
    expect(r.high).toBeCloseTo(10.40, 1);
  });
  it('LOW ±15%', () => {
    const r = priceRangeForConfidence(10, 'LOW');
    expect(r.low).toBeCloseTo(8.50, 1);
    expect(r.high).toBeCloseTo(11.50, 1);
  });
  it('null for zero/negative', () => {
    expect(priceRangeForConfidence(0, 'HIGH')).toBeNull();
  });
});

describe('estimateBasket — singular with resolver', () => {
  const items = [
    { id: 'a', name: 'Beans' }, { id: 'b', name: 'Rice' }, { id: 'c', name: 'Unknown' },
  ];

  it('shows coverage honestly when only some items priced', () => {
    const resolver = (item) => {
      if (item.name === 'Beans') return { price: 1.4, confidence: { score: 88, level: 'HIGH' } };
      if (item.name === 'Rice') return { price: 2, confidence: { score: 55, level: 'MEDIUM' } };
      return null;
    };
    const out = estimateBasket(items, resolver);
    expect(out.covered).toBe(2);
    expect(out.of).toBe(3);
    expect(out.coveragePct).toBe(67);
    expect(out.high).toBeGreaterThan(out.estimate);
    expect(out.level).toBe('MEDIUM');
  });

  it('HIGH when fully covered with strong confidence', () => {
    const out = estimateBasket(items.slice(0, 2), () => ({ price: 1.5, confidence: { score: 92, level: 'HIGH' } }));
    expect(out.level).toBe('HIGH');
    expect(out.coveragePct).toBe(100);
    expect(out.high - out.estimate).toBeLessThan(0.15); // tight range
  });

  it('empty when nothing resolves', () => {
    const out = estimateBasket(items, () => null);
    expect(out.covered).toBe(0);
    expect(out.estimate).toBe(0);
  });

  it('handles empty list', () => {
    expect(estimateBasket([], () => ({ price: 1 })).estimate).toBe(0);
  });
});

describe('estimateBaskets — multi-store receipt-first + observed-fallback', () => {
  const items = [{ id: 'a', name: 'Heinz Beans 415g' }];
  const shops = [
    { store: 'Tesco', date: '2026-08-22', total: 1.4, items: [{ name: 'Heinz Beans 415g', price: 1.4 }] },
    { store: 'Aldi', date: '2026-06-01', total: 0.89, items: [{ name: 'Heinz Beans 415g', price: 0.89 }] },
  ];

  it('prices from receipts with HIGH confidence for recent shops', () => {
    const baskets = estimateBaskets(items, { shops, observedByKey: {}, today: '2026-08-23' });
    const tesco = baskets.find((b) => b.store === 'Tesco');
    expect(tesco.covered).toBe(1);
    expect(tesco.level).toBe('HIGH');
    expect(tesco.sources.receipt).toBe(1);
    expect(tesco.coveragePct).toBe(100);
  });

  it('sorts by highest coverage first', () => {
    const baskets = estimateBaskets(items, { shops, observedByKey: {}, today: '2026-08-23' });
    for (let i = 1; i < baskets.length; i++) {
      expect(baskets[i].coveragePct).toBeLessThanOrEqual(baskets[i - 1].coveragePct);
    }
  });

  it('returns empty array when no stores exist', () => {
    expect(estimateBaskets(items, { shops: [], observedByKey: {} })).toEqual([]);
  });
});

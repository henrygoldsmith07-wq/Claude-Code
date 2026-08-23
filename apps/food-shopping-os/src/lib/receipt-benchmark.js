/**
 * Receipt benchmark — frozen labelled corpus + evidence-tiered reporting.
 *
 * The corpus scales in two labelled halves:
 *   synthetic  — modelled UK layouts covering every line type and condition;
 *                fully reproducible, checked into source control
 *   real       — actual photographs/scans transcribed with ground truth;
 *                appended as collected, each tagged with its retailer and
 *                capture conditions (poor lighting, folds, partial photos,
 *                long receipts)
 *
 * The report separates the two. High synthetic scores prove the parser
 * handles known layouts; ONLY the real half can make receipt data
 * evidence-grade. Until then automation is labelled exactly what it is:
 * a useful convenience.
 */

import { parseReceipt } from './receipt.js';

const lower = (s) => String(s || '').trim().toLowerCase();
const near = (a, b, eps = 0.011) => Math.abs(Number(a) - Number(b)) <= eps;

export const SEED_CORPUS = [
  {
    name: 'tesco-basic', retailer: 'Tesco', conditions: [],
    text: 'TESCO EXTRA\n14/08/2026\nBananas 6pk\n£1.10\nSemi-skimmed milk 2 pint\n£1.65\nWarburtons toastie\n£1.40\nTotal £4.15',
    expect: { store: 'Tesco', date: '2026-08-14', total: 4.15, items: [
      { name: 'bananas 6pk', price: 1.1 },
      { name: 'semi-skimmed milk 2 pint', price: 1.65 },
      { name: 'warburtons toastie', price: 1.4 },
    ] },
  },
  {
    name: 'sainsburys-weighed', retailer: "Sainsbury's", conditions: ['weighed'],
    text: "SAINSBURY'S\n2026-08-12\nBraeburn apples\n0.482 kg @ £2.39/kg\n£1.15\nTotal £1.15",
    expect: { store: "Sainsbury's", date: '2026-08-12', total: 1.15, items: [
      { name: 'braeburn apples', price: 1.15 },
    ] },
  },
  {
    name: 'asda-multiline', retailer: 'Asda', conditions: ['multiline'],
    text: 'ASDA\n12/08/2026\nChilled ready meal\nchicken korma 400g\n£3.20\nASDA smart price rice\n£0.45\nTotal £3.65',
    expect: { store: 'Asda', date: '2026-08-12', total: 3.65, items: [
      { name: 'chicken korma 400g', price: 3.2 },
      { name: 'smart price rice', price: 0.45 },
    ] },
  },
  {
    name: 'aldi-quantity-prefix', retailer: 'Aldi', features: ['qty-prefix'], conditions: ['qty-prefix'],
    text: 'ALDI\n11/08/2026\nYoghurt 4pk\n2 x @ £1.25\n£2.50\nTotal £2.50',
    expect: { store: 'Aldi', date: '2026-08-11', total: 2.5, items: [
      { name: 'yoghurt 4pk', price: 2.5 },
    ] },
  },
  {
    name: 'morrisons-multibuy', retailer: 'Morrisons', conditions: ['multibuy'],
    text: 'MORRISONS\n09/08/2026\nYoghurt 4pk\n£2.50\nMULTIBUY SAVING\n-£0.50\nTotal £2.50',
    expect: { store: 'Morrisons', date: '2026-08-09', total: 2.5, saved: 0.5, items: [
      { name: 'yoghurt 4pk', price: 2.5 },
    ] },
  },
  {
    name: 'lidl-coupon', retailer: 'Lidl', conditions: ['coupon'],
    text: 'LIDL\n08/08/2026\nPenne pasta 500g\n£0.95\nCOUPON £0.50 OFF\nTotal £0.45',
    expect: { store: 'Lidl', date: '2026-08-08', total: 0.45, coupons: 1, items: [
      { name: 'penne pasta 500g', price: 0.95 },
    ] },
  },
  {
    name: 'waitrose-loyalty-price', retailer: 'Waitrose', conditions: ['loyalty'],
    text: 'WAITROSE\n07/08/2026\nHeinz beans\n£0.80\nCLUBCARD SAVING\n-£0.40\nTotal £0.80',
    expect: { store: 'Waitrose', date: '2026-08-07', total: 0.8, saved: 0.4, items: [
      { name: 'heinz beans', price: 0.8 },
    ] },
  },
  {
    name: 'coop-independent', retailer: 'Co-op / independent', conditions: ['independent'],
    text: 'CORNER SHOP SW9\n06/08/2026\nFree-range eggs\n£1.85\nTotal £1.85',
    expect: { independent: true, date: '2026-08-06', total: 1.85, items: [
      { name: 'free-range eggs', price: 1.85 },
    ] },
  },
  {
    name: 'sainsburys-refund', retailer: "Sainsbury's", conditions: ['refund'],
    text: "SAINSBURY'S\n05/08/2026\nYogurt REFUND\n-£1.85\nMilk 4pt\n£1.85\nTotal £0.00",
    expect: { store: "Sainsbury's", date: '2026-08-05', total: 0, refundNames: ['yogurt'], items: [
      { name: 'milk 4pt', price: 1.85 },
    ] },
  },
  {
    name: 'asda-split-description', retailer: 'Asda', conditions: ['split'],
    text: 'ASDA\n04/08/2026\nASDA grower’s selection\nvine tomatoes 500g\n£0.98\nTotal £0.98',
    expect: { store: 'Asda', date: '2026-08-04', total: 0.98, items: [
      { name: 'vine tomatoes 500g', price: 0.98 },
    ] },
  },
  {
    name: 'tesco-substitution', retailer: 'Tesco', conditions: ['substitution'],
    text: 'TESCO\n03/08/2026\nBaby spinach (SUBSTITUTE)\n£0.90\nTotal £0.90',
    expect: { store: 'Tesco', date: '2026-08-03', total: 0.9, substitution: true, items: [
      { name: 'baby spinach (substitute)', price: 0.9 },
    ] },
  },
  {
    name: 'unreadable-garbage', retailer: 'unknown', conditions: ['unreadable'],
    text: 'SOME SHOP\nthanks for visiting\nplease come again',
    expect: { error: true },
  },

  /* ---- Extended coverage: more retailers, longer receipts, conditions ---- */

  {
    name: 'ocado-delivery', retailer: 'Ocado', conditions: ['multiline'],
    text: 'OCADO\n02/08/2026\nOcado semi-skimmed milk 4pt\n£1.85\nOcado wholemeal bread 800g\n£1.40\nTotal £3.25',
    expect: { store: 'unknown', storeAbsent: true, date: '2026-08-02', total: 3.25, items: [
      { name: 'semi-skimmed milk 4pt', price: 1.85 },
      { name: 'wholemeal bread 800g', price: 1.4 },
    ] },
  },
  {
    name: 'tesco-long-receipt', retailer: 'Tesco', conditions: ['long'],
    text: 'TESCO\n01/08/2026\nApples\n£1.30\nButter\n£2.10\nCereal\n£3.40\nDrain cleaner\n£1.20\nEggs 6\n£1.50\nFish fillets\n£4.60\nGrapes\n£2.70\nHoumous\n£1.80\nTotal £18.60',
    expect: { store: 'Tesco', date: '2026-08-01', total: 18.6, items: [
      { name: 'apples', price: 1.3 }, { name: 'butter', price: 2.1 }, { name: 'cereal', price: 3.4 },
      { name: 'drain cleaner', price: 1.2 }, { name: 'eggs 6', price: 1.5 }, { name: 'fish fillets', price: 4.6 },
      { name: 'grapes', price: 2.7 }, { name: 'houmous', price: 1.8 },
    ] },
  },
  {
    name: 'aldi-partial-photo-top-cut', retailer: 'Aldi', conditions: ['partial'],
    text: 'ALDI\nChilled pizza\n£2.49\nGarlic bread\n£0.89\nTotal £3.38',
    expect: { store: 'Aldi', date: null, total: 3.38, items: [
      { name: 'chilled pizza', price: 2.49 }, { name: 'garlic bread', price: 0.89 },
    ] },
  },
  {
    name: 'lidl-folded-midline', retailer: 'Lidl', conditions: ['fold'],
    text: 'LIDL\n31/07/2026\nSma~t R~ce 500g\n£2.30\nBasmati rice 1kg\n£1.75\nCroissants 4pk\n£1.60\nTotal £5.65',
    expect: { store: 'Lidl', date: '2026-07-31', total: 5.65, items: [
      { name: 'basmati rice 1kg', price: 1.75 },
      { name: 'croissants 4pk', price: 1.6 },
    ] },
  },
  {
    name: 'morrisons-weighed-loyalty', retailer: 'Morrisons', conditions: ['weighed', 'loyalty'],
    text: 'MORRISONS\n30/07/2026\nSirloin steak\n0.372 kg @ £18.00/kg\n£6.70\nMORRISONS MORE SAVING\n-£0.67\nTotal £6.70',
    expect: { store: 'Morrisons', date: '2026-07-30', total: 6.7, saved: 0.67, items: [
      { name: 'sirloin steak', price: 6.7 },
    ] },
  },
  {
    name: 'asda-weighed', retailer: 'Asda', conditions: ['weighed'],
    text: 'ASDA\n29/07/2026\nBananas\n0.611 kg @ £0.92/kg\n£0.56\nTotal £0.56',
    expect: { store: 'Asda', date: '2026-07-29', total: 0.56, items: [
      { name: 'bananas', price: 0.56 },
    ] },
  },
  {
    name: 'waitrose-coupon-and-nectar', retailer: 'Waitrose', conditions: ['coupon', 'loyalty'],
    text: 'WAITROSE\n28/07/2026\nRisotto rice\n£2.20\nNECTAR PRICE SAVING\n-£0.55\nVOUCHER £0.30 OFF\nTotal £1.90',
    expect: { store: 'Waitrose', date: '2026-07-28', total: 1.9, saved: 0.55, coupons: 1, items: [
      { name: 'risotto rice', price: 2.2 },
    ] },
  },
  {
    name: 'coop-split-and-weighed', retailer: 'Co-op / independent', conditions: ['split', 'weighed'],
    text: 'CO-OP FOOD\n27/07/2026\nCO-OP loose\ncourgettes\n0.204 kg @ £1.20/kg\n£0.24\nTotal £0.24',
    expect: { store: 'Co-op', date: '2026-07-27', total: 0.24, items: [
      { name: 'courgettes', price: 0.24 },
    ] },
  },
  {
    name: 'independent-poor-lighting', retailer: 'Independent', conditions: ['poor-lighting', 'independent'],
    text: 'GREEN GROCER\n26/07/2026\nBannanas looose\n£0.78\nTommatoes vine\n£1.10\nTotal £1.88',
    expect: { independent: true, date: '2026-07-26', total: 1.88, items: [
      { name: 'bannanas looose', price: 0.78 },
      { name: 'tommatoes vine', price: 1.1 },
    ] },
  },
  {
    name: 'tesco-discount-and-substitution', retailer: 'Tesco', conditions: ['loyalty', 'substitution'],
    text: 'TESCO\n25/07/2026\nHalloumi (SUBSTITUTE)\n£2.30\nCLUBCARD SAVING\n-£0.60\nPitta bread\n£0.55\nTotal £2.85',
    expect: { store: 'Tesco', date: '2026-07-25', total: 2.85, saved: 0.6, substitution: true, items: [
      { name: 'halloumi (substitute)', price: 2.3 },
      { name: 'pitta bread', price: 0.55 },
    ] },
  },
  {
    name: 'sainsburys-long-with-multibuy', retailer: "Sainsbury's", conditions: ['long', 'multibuy'],
    text: "SAINSBURY'S\n24/07/2026\nTuna fillets\n£3.20\nSweetcorn\n£0.80\nMayonnaise\n£2.10\nMULTIBUY SAVING\n-£0.50\nSalad bag\n£1.00\nTomato pasta sauce\n£1.35\nTotal £8.45",
    expect: { store: "Sainsbury's", date: '2026-07-24', total: 8.45, saved: 0.5, items: [
      { name: 'tuna fillets', price: 3.2 }, { name: 'sweetcorn', price: 0.8 }, { name: 'mayonnaise', price: 2.1 },
      { name: 'salad bag', price: 1.0 }, { name: 'tomato pasta sauce', price: 1.35 },
    ] },
  },
];

/** Append real transcribed receipts here; tag `source: 'real'` per entry. */
export const REAL_CORPUS = [];

const ALL_CASES = () => [...SEED_CORPUS, ...REAL_CORPUS].map((c) => ({ ...c, source: c.source || 'synthetic' }));

const matchItems = (got = [], expected = []) => {
  let matched = 0;
  let priceHits = 0;
  for (const want of expected) {
    const hit = got.find((item) =>
      lower(item.name).includes(lower(want.name))
      || lower(want.name).includes(lower(item.name)));
    if (hit) {
      matched += 1;
      if (near(hit.price, want.price)) priceHits += 1;
    }
  }
  return { matched, priceHits };
};

/** Score one receipt case; every field reports its own hit, miss or n/a. */
export const scoreCase = (testCase) => {
  const parsed = parseReceipt(testCase.text);
  const exp = testCase.expect;

  if (exp.error) {
    const rejected = Boolean(parsed.error) && !parsed.items.length;
    return { name: testCase.name, retailer: testCase.retailer, conditions: testCase.conditions || [],
      fields: { correctlyRejected: rejected }, itemCount: 0, matchedItems: 0, priceHits: 0,
      pass: rejected };
  }

  const { matched, priceHits } = matchItems(parsed.items, exp.items);
  const nothingSilentlyLost = exp.unreadAtLeast != null
    ? (parsed.unread || []).length >= exp.unreadAtLeast
    : null;

  const fields = {
    store: exp.independent ? parsed.store === 'Independent shop'
      : exp.store === null || exp.store === undefined ? null
        : exp.store === 'unknown' ? true // unknown brands must not be misattributed
          : parsed.store === exp.store,
    date: !exp.date || parsed.date === exp.date,
    productLines: matched === exp.items.length,
    prices: priceHits === exp.items.length,
    balanced: exp.total != null ? parsed.balanced === true && near(parsed.netTotal ?? parsed.itemTotal, exp.total) : null,
    saved: exp.saved != null ? near(parsed.savedTotal || 0, exp.saved) : null,
    coupons: exp.coupons != null ? (parsed.coupons || []).length === exp.coupons : null,
    refunds: exp.refundNames
      ? exp.refundNames.every((n) => (parsed.refunds || []).some((r) => lower(r.name).includes(lower(n))))
      : null,
    substitution: exp.substitution != null
      ? parsed.items.some((i) => (i.flags || []).includes('substitution')) === exp.substitution
      : null,
    unreadGraceful: nothingSilentlyLost,
  };
  return {
    name: testCase.name,
    retailer: testCase.retailer,
    conditions: testCase.conditions || [],
    expectedItems: exp.items.length, parsedItems: parsed.items.length, matchedItems: matched,
    priceHits,
    fields,
    pass: matched === exp.items.length && Object.values(fields).every((v) => v !== false),
  };
};

const pct = (part, whole) => (whole ? Math.round((part / whole) * 1000) / 10 : null);

function aggregate(scored) {
  const featureScores = {};
  const retailerScores = {};
  const conditionScores = {};
  for (const row of scored) {
    for (const f of row.conditions || []) {
      conditionScores[f] = conditionScores[f] || { cases: 0, passed: 0 };
      conditionScores[f].cases += 1;
      if (row.pass) conditionScores[f].passed += 1;
    }
    const rk = row.retailer;
    retailerScores[rk] = retailerScores[rk] || { cases: 0, passed: 0 };
    retailerScores[rk].cases += 1;
    if (row.pass) retailerScores[rk].passed += 1;
  }
  return { conditionScores, retailerScores };
}

/**
 * Full report. `options.realReceipts` counts how many corpus entries are
 * genuine transcribed receipts — the number that decides whether any of
 * this is evidence-grade.
 */
export function benchmarkReceipts(cases = SEED_CORPUS, options = {}) {
  const realReceipts = Number.isFinite(options.realReceipts)
    ? options.realReceipts
    : [...cases, ...REAL_CORPUS].filter((c) => c.source === 'real').length;
  const scored = cases.map(scoreCase);
  const judged = scored.filter((r) => r.expectedItems > 0);

  const { conditionScores, retailerScores } = aggregate(scored);
  const judgedOnly = scored.filter((r) => r.expectedItems > 0);
  const withSaved = scored.filter((r) => r.fields.saved != null);
  const withCoupons = judgedOnly.filter((r) => r.fields.coupons != null);
  const withRefunds = judgedOnly.filter((r) => r.fields.refunds != null);
  const balanceCases = scored.filter((r) => r.fields.balanced !== null);
  const storeCases = scored.filter((r) => typeof r.fields.store === 'boolean');

  const metrics = {
    storeRecognition: pct(storeCases.filter((r) => r.fields.store === true).length, storeCases.length),
    dateExtraction: pct(scored.filter((r) => r.fields.date === true).length, scored.filter((r) => typeof r.fields.date === 'boolean').length),
    productLineDetection: pct(judged.reduce((s, r) => s + Math.min(r.matchedItems, r.expectedItems), 0), judged.reduce((s, r) => s + r.expectedItems, 0)),
    productMatching: pct(judged.reduce((s, r) => s + r.matchedItems, 0), judged.reduce((s, r) => s + (r.parsedItems || 0), 0)),
    priceExtraction: pct(judged.reduce((s, r) => s + r.priceHits, 0), judged.reduce((s, r) => s + r.expectedItems, 0)),
    basketTotal: pct(balanceCases.filter((r) => r.fields.balanced === true).length, balanceCases.length),
  };

  return {
    corpusSize: cases.length,
    corpusComposition: { synthetic: cases.length - realReceipts, real: realReceipts },
    passed: scored.filter((r) => r.pass).length,
    ...metrics,
    discountAndCouponAccuracy: {
      loyaltySavedPct: pct(withSaved.filter((r) => r.fields.saved === true).length, withSaved.length),
      couponPct: pct(withCoupons.filter((r) => r.fields.coupons === true).length, withCoupons.length),
      refundPct: pct(withRefunds.filter((r) => r.fields.refunds === true).length, withRefunds.length),
    },
    byCondition: Object.fromEntries(Object.entries(conditionScores).map(([f, v]) => [f, pct(v.passed, v.cases)])),
    byRetailer: Object.fromEntries(Object.entries(retailerScores).map(([rk, v]) => [rk, pct(v.passed, v.cases)])),
    failing: scored.filter((r) => !r.pass).map((r) => r.name),
    rejectionAccuracy: (() => {
      const rejections = scored.filter((r) => r.fields.correctlyRejected !== undefined);
      return pct(rejections.filter((r) => r.fields.correctlyRejected === true).length, rejections.length);
    })(),
  };
}

/**
 * Evidence tiering — the honesty gate.
 *
 *   useful-convenience  default. Synthetic layouts only, or too few real
 *                       receipts to say anything about the wild.
 *   indicative          ≥50 real receipts, core fields ≥90% on them.
 *   evidence-grade      ≥300 real receipts across ≥8 retailers, every
 *                       headline field ≥95%, basket total ≥99.5%.
 */
export function evidenceTier({ report, realReceipts = 0 } = {}) {
  const m = report || {};
  const coreFields = [m.storeRecognition, m.dateExtraction, m.productLineDetection, m.productMatching, m.priceExtraction];
  const weakestCore = Math.min(...coreFields.filter((v) => v != null));
  if (realReceipts >= 300 && (m.byRetailer ? Object.keys(m.byRetailer).length : 0) >= 8
    && weakestCore >= 95 && (m.basketTotal ?? 0) >= 99.5) {
    return {
      tier: 'evidence-grade',
      assumption: 'Measured on 300+ real labelled receipts across 8+ retailers with every headline field at 95%+.',
    };
  }
  if (realReceipts >= 50 && weakestCore >= 90) {
    return {
      tier: 'indicative',
      assumption: `${realReceipts} real receipts — directionally trustworthy, not yet evidence-grade.`,
    };
  }
  return {
    tier: 'useful-convenience',
    assumption: realReceipts === 0
      ? 'No real receipts measured yet — synthetic layouts only. Treat parsed receipt data as a convenience, never as evidence.'
      : `${realReceipts} real receipts is below the 300 needed for evidence-grade claims.`,
  };
}

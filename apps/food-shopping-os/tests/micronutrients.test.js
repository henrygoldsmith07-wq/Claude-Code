import { describe, it, expect } from 'vitest';
import {
  alcoholUnits, buildEntry, buildQuickEntry, dayTotals, hydration, nutrientAlerts,
  nutrientCoverage, nutrientRows, scale, sumMacros,
} from '../src/lib/nutrition.js';
import { estimateRecipeMicros, makeCustomFood, searchFoods } from '../src/lib/foodlog.js';
import { CATALOGUE, FOODS, RESTAURANT_FOODS } from '../src/data/foods.js';
import { NUTRIENTS, NUTRIENT_KEYS, DEFAULT_TARGETS, formatAmount } from '../src/data/nutrients.js';
import { RECIPES } from '../src/data/recipes.js';

const byId = (id) => FOODS.find((f) => f.id === id);

describe('nutrient catalogue', () => {
  it('tracks all 24 asked-for nutrients', () => {
    expect(NUTRIENTS).toHaveLength(24);
    for (const key of ['kcal', 'protein', 'carbs', 'fat', 'fibre', 'sugar', 'satFat', 'transFat',
      'cholesterol', 'sodium', 'potassium', 'calcium', 'iron', 'magnesium', 'zinc', 'vitA', 'vitB',
      'vitC', 'vitD', 'vitE', 'vitK', 'water', 'caffeine', 'alcohol']) {
      expect(NUTRIENT_KEYS, key).toContain(key);
    }
  });

  it('gives every catalogue food a complete profile', () => {
    for (const food of CATALOGUE) {
      for (const key of NUTRIENT_KEYS) {
        expect(typeof food.per100[key], `${food.name}.${key}`).toBe('number');
        expect(Number.isFinite(food.per100[key])).toBe(true);
      }
    }
  });

  it('keeps recognisable nutrients on the foods that are known for them', () => {
    expect(byId('spinach').per100.iron).toBeGreaterThan(2);
    expect(byId('almonds').per100.vitE).toBeGreaterThan(20);
    expect(byId('salmon-fillet').per100.vitD).toBeGreaterThan(10);
    expect(byId('cheddar').per100.calcium).toBeGreaterThan(500);
    expect(byId('sweet-potato').per100.vitA).toBeGreaterThan(500);
    expect(byId('broccoli').per100.vitC).toBeGreaterThan(50);
    expect(byId('dark-chocolate').per100.caffeine).toBeGreaterThan(0);
    expect(byId('lager').per100.alcohol).toBeGreaterThan(3);
    expect(byId('olive-oil').per100.water).toBe(0);
  });

  it('models restaurant dishes from their quoted salt and a food blend', () => {
    const ramen = RESTAURANT_FOODS.find((f) => f.name === 'Chicken Ramen');
    const portion = ramen.servings[0].grams;
    // 4.5 g of salt on the menu → ~1770 mg of sodium in the bowl
    expect((ramen.per100.sodium * portion) / 100).toBeCloseTo(4.5 * 393, -2);
    expect(ramen.per100.water).toBeGreaterThan(40); // it is a soup
    expect(ramen.per100.protein).toBeGreaterThan(0);
  });
});

describe('scaling and totals across every nutrient', () => {
  const oats = byId('porridge-oats');

  it('scales micronutrients with the portion, like calories', () => {
    const half = scale(oats.per100, 50);
    expect(half.magnesium).toBeCloseTo(oats.per100.magnesium / 2, 1);
    expect(half.iron).toBeCloseTo(oats.per100.iron / 2, 2);
    expect(half.vitB).toBeCloseTo(oats.per100.vitB / 2, 1);
  });

  it('sums a day across all of them', () => {
    const day = [
      buildEntry(oats, { grams: 60 }),
      buildEntry(byId('spinach'), { grams: 100 }),
      buildEntry(byId('cappuccino'), { grams: 240 }),
    ];
    const totals = dayTotals(day);
    expect(totals.iron).toBeCloseTo(0.6 * 4.3 + 2.7, 1);
    expect(totals.caffeine).toBeCloseTo(72, 0); // 30 mg/100 ml × 240 ml
    expect(totals.water).toBeGreaterThan(200);
    expect(totals.vitK).toBeGreaterThan(400); // spinach
  });

  it('quick-adds carry energy and macros only', () => {
    const q = buildQuickEntry({ kcal: 500, protein: 20 });
    expect(q.nutrients.kcal).toBe(500);
    expect(q.nutrients.magnesium).toBe(0);
    expect(q.nutrients.sodium).toBe(0);
  });
});

describe('targets, limits and coverage', () => {
  const day = [
    buildEntry(byId('crisps'), { grams: 150 }),
    buildEntry(byId('cheddar'), { grams: 100 }),
    buildEntry(byId('broccoli'), { grams: 200 }),
  ];
  const totals = sumMacros(day);

  it('reads goals as progress and limits as headroom', () => {
    const rows = nutrientRows(totals, DEFAULT_TARGETS);
    const vitC = rows.find((r) => r.key === 'vitC');
    const satFat = rows.find((r) => r.key === 'satFat');
    const sodium = rows.find((r) => r.key === 'sodium');
    expect(vitC.kind).toBe('goal');
    expect(vitC.pct).toBeGreaterThan(100); // 152 mg against an 80 mg target
    expect(vitC.tone).toBe('good');
    expect(satFat.kind).toBe('limit');
    expect(satFat.pct).toBeGreaterThan(100);
    expect(satFat.tone).toBe('danger');
    expect(sodium.pct).toBeLessThan(100); // 1,496 mg — inside the 2,300 mg limit
    expect(sodium.tone).toBe('good');
  });

  it('calls out what is over and what is short', () => {
    const alerts = nutrientAlerts(totals, DEFAULT_TARGETS);
    expect(alerts.over.map((r) => r.key)).toContain('satFat');
    expect(alerts.low.map((r) => r.key)).toContain('vitD');
    expect(alerts.hit.map((r) => r.key)).toContain('vitC');
  });

  it('flags sodium once a salty day pushes past the limit', () => {
    const salty = sumMacros([
      ...day,
      buildEntry(byId('halloumi'), { grams: 200 }),
      buildEntry(RESTAURANT_FOODS.find((f) => f.name === 'Chicken Ramen'), { grams: 700 }),
    ]);
    const alerts = nutrientAlerts(salty, DEFAULT_TARGETS);
    expect(alerts.over.map((r) => r.key)).toContain('sodium');
  });

  it('respects an edited target', () => {
    const rows = nutrientRows(totals, { ...DEFAULT_TARGETS, sodium: 10000 });
    expect(rows.find((r) => r.key === 'sodium').pct).toBeLessThan(100);
  });

  it('reports how much of the day carries micronutrients', () => {
    const mixed = [...day, buildQuickEntry({ kcal: 500 })];
    const cover = nutrientCoverage(mixed);
    expect(cover.pct).toBeLessThan(100);
    expect(cover.pct).toBeGreaterThan(0);
    expect(nutrientCoverage(day).pct).toBe(100);
    expect(nutrientCoverage([]).pct).toBe(100);
  });
});

describe('water, caffeine and alcohol', () => {
  it('adds glasses to the water already in the diary', () => {
    const totals = sumMacros([buildEntry(byId('semi-skimmed-milk'), { grams: 200 })]);
    const h = hydration(totals, 4);
    expect(h.fromGlasses).toBe(1000);
    expect(h.fromDrinks).toBe(178); // 89 ml per 100 ml of milk
    expect(h.total).toBe(1178);
  });

  it('converts alcohol grams into UK units', () => {
    const pint = scale(byId('lager').per100, 568);
    expect(alcoholUnits(pint.alcohol)).toBeCloseTo(2.6, 1);
    expect(alcoholUnits(0)).toBe(0);
  });

  it('formats amounts with their units', () => {
    expect(formatAmount('kcal', 1240.4)).toBe('1,240 kcal');
    expect(formatAmount('iron', 4.27)).toBe('4.3 mg');
    expect(formatAmount('vitB', 62.4)).toBe('62%');
  });
});

describe('user-entered and derived foods', () => {
  it('takes micronutrients off the packet for a custom food', () => {
    const { food } = makeCustomFood({
      name: 'Fortified shake', servingGrams: 500, kcal: 400,
      protein: 30, carbs: 40, fat: 10, calcium: 500, vitD: 5, sodium: 300,
    });
    expect(food.per100.calcium).toBe(100);
    expect(food.per100.vitD).toBe(1);
    expect(food.per100.sodium).toBe(60);
    expect(food.per100.magnesium).toBe(0);
  });

  it('estimates a recipe’s micronutrients from its ingredients', () => {
    const traybake = RECIPES.find((r) => r.id === 'chicken-traybake');
    const micros = estimateRecipeMicros(traybake, CATALOGUE);
    expect(micros.potassium).toBeGreaterThan(0);
    expect(micros.sodium).toBeGreaterThanOrEqual(0);
    expect(NUTRIENT_KEYS.every((k) => typeof micros[k] === 'number')).toBe(true);
  });

  it('still finds foods by name after the profile grew', () => {
    expect(searchFoods('spinach')[0].id).toBe('spinach');
  });
});

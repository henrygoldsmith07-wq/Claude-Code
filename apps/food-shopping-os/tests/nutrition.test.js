import { describe, it, expect } from 'vitest';
import {
  buildEntry, buildQuickEntry, copyEntries, dayTotals, entryMacros, mealForTime,
  remaining, scale, servingOptions, snackSummary, sumMacros, timingInsight,
} from '../src/lib/nutrition.js';
import { FOODS } from '../src/data/foods.js';

const oats = FOODS.find((f) => f.id === 'porridge-oats');
const banana = FOODS.find((f) => f.id === 'banana');

describe('portion scaling', () => {
  it('scales a per-100 profile by weight', () => {
    expect(scale(oats.per100, 100)).toMatchObject({ kcal: 379, protein: 11 });
    expect(scale(oats.per100, 50).kcal).toBe(190);
    expect(scale(oats.per100, 0)).toMatchObject({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it('doubling the portion doubles the calories', () => {
    const one = scale(banana.per100, 118).kcal;
    const two = scale(banana.per100, 236).kcal;
    expect(two).toBe(one * 2);
  });

  it('offers the food’s servings plus 100 g and any weighed amount', () => {
    const options = servingOptions(oats, 73);
    expect(options.some((o) => o.grams === 40)).toBe(true);
    expect(options.some((o) => o.grams === 100)).toBe(true);
    expect(options.some((o) => o.grams === 73 && o.custom)).toBe(true);
  });
});

describe('entries and totals', () => {
  const entries = [
    buildEntry(oats, { grams: 40, meal: 'breakfast', time: '07:30' }),
    buildEntry(banana, { grams: 118, meal: 'snack', time: '10:15' }),
    buildQuickEntry({ kcal: 500, protein: 20, carbs: 50, fat: 15, meal: 'lunch', time: '13:00' }),
  ];

  it('reads weight-based and quick-add entries the same way', () => {
    expect(entryMacros(entries[0]).kcal).toBe(152);
    expect(entryMacros(entries[2]).kcal).toBe(500);
  });

  it('sums a day and breaks it down by meal', () => {
    const totals = dayTotals(entries);
    expect(totals.kcal).toBe(152 + 105 + 500);
    expect(totals.byMeal.breakfast.kcal).toBe(152);
    expect(totals.byMeal.lunch.kcal).toBe(500);
    expect(totals.byMeal.dinner.kcal).toBe(0);
  });

  it('reports what is left against the goals', () => {
    const left = remaining(sumMacros(entries), { kcalGoal: 2200, proteinGoal: 130, carbsGoal: 250, fatGoal: 75 });
    expect(left.kcal).toBe(2200 - 757);
    expect(left.protein).toBeGreaterThan(0);
  });

  it('copies entries onto a new meal with fresh ids', () => {
    const copied = copyEntries(entries.slice(0, 2), { meal: 'dinner' });
    expect(copied).toHaveLength(2);
    expect(copied.every((e) => e.meal === 'dinner')).toBe(true);
    expect(copied[0].id).not.toBe(entries[0].id);
    expect(sumMacros(copied).kcal).toBe(sumMacros(entries.slice(0, 2)).kcal);
  });

  it('defaults a log to the meal the clock is in', () => {
    expect(mealForTime(new Date('2026-07-27T08:00:00'))).toBe('breakfast');
    expect(mealForTime(new Date('2026-07-27T12:30:00'))).toBe('lunch');
    expect(mealForTime(new Date('2026-07-27T19:00:00'))).toBe('dinner');
    expect(mealForTime(new Date('2026-07-27T23:30:00'))).toBe('snack');
    expect(mealForTime(new Date('2026-07-27T16:00:00'))).toBe('snack');
  });
});

describe('timing and snacks', () => {
  const day = [
    buildEntry(oats, { grams: 40, meal: 'breakfast', time: '07:00' }),
    buildEntry(banana, { grams: 118, meal: 'snack', time: '15:00' }),
    buildQuickEntry({ kcal: 400, meal: 'dinner', time: '21:00' }),
  ];

  it('describes the eating window and late-evening share', () => {
    const t = timingInsight(day);
    expect(t.first).toBe('07:00');
    expect(t.last).toBe('21:00');
    expect(t.windowLabel).toBe('14h 0m');
    expect(t.latePct).toBe(Math.round((400 / (152 + 105 + 400)) * 100));
    expect(t.longestGapMins).toBe(8 * 60); // 07:00 → 15:00
  });

  it('is null for an empty day', () => {
    expect(timingInsight([])).toBeNull();
  });

  it('summarises snacking as a share of the day', () => {
    const s = snackSummary(day);
    expect(s.count).toBe(1);
    expect(s.kcal).toBe(105);
    expect(s.pctOfDay).toBe(Math.round((105 / 657) * 100));
  });
});

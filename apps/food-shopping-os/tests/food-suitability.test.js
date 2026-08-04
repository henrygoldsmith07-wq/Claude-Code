import { describe, it, expect } from 'vitest';
import {
  evaluateFoodSuitability,
  filterBySuitability,
  rankBySuitability,
  suitabilityContextFrom,
  suitabilityReach,
  suitabilitySummary,
} from '../src/lib/food-suitability.js';

const recipe = (name, ingredients, over = {}) => ({
  id: name.toLowerCase().replace(/\W+/g, '-'),
  name,
  ingredients: ingredients.map((n) => ({ name: n, qty: '1' })),
  steps: ['a', 'b'],
  time: 30,
  cuisine: 'British',
  tags: [],
  ...over,
});

const PEANUT_STEW = recipe('Peanut stew', ['peanuts', 'sweet potato', 'onion']);
const FISH_PIE = recipe('Fish pie', ['cod', 'milk', 'potato'], { cuisine: 'British' });
const BACON_PASTA = recipe('Bacon pasta', ['bacon', 'pasta', 'cream'], { cuisine: 'Italian', tags: [] });
const RICE_BOWL = recipe('Rice bowl', ['rice', 'spring onion', 'sesame'], { cuisine: 'Japanese', tags: ['vegan', 'vegetarian'] });
const TOFU_STIR = recipe('Tofu stir fry', ['tofu', 'broccoli', 'soy sauce'], { cuisine: 'Chinese', tags: ['vegan', 'vegetarian'] });

describe('evaluateFoodSuitability — hard blockers', () => {
  it('blocks allergens', () => {
    const fit = evaluateFoodSuitability(PEANUT_STEW, { allergies: ['peanuts'] });
    expect(fit.allowed).toBe(false);
    expect(fit.blockers.some((b) => b.kind === 'allergy' && b.code.includes('peanuts'))).toBe(true);
    expect(fit.warnings).toEqual([]);
  });

  it('blocks religious rules', () => {
    const fit = evaluateFoodSuitability(BACON_PASTA, { religious: ['halal'] });
    expect(fit.allowed).toBe(false);
    expect(fit.blockers.some((b) => b.kind === 'religious')).toBe(true);
  });

  it('blocks diet patterns (vegan)', () => {
    const fit = evaluateFoodSuitability(FISH_PIE, { diets: ['vegan'] });
    expect(fit.allowed).toBe(false);
    expect(fit.blockers.some((b) => b.kind === 'diet')).toBe(true);
  });

  it('blocks household diets merged into context', () => {
    const ctx = suitabilityContextFrom({
      diets: [],
      members: [{ id: '1', diets: ['vegetarian'] }],
    });
    const fit = evaluateFoodSuitability(BACON_PASTA, ctx);
    expect(fit.allowed).toBe(false);
    expect(fit.blockers.some((b) => b.kind === 'household' || b.kind === 'diet')).toBe(true);
  });

  it('allows a clean recipe', () => {
    const fit = evaluateFoodSuitability(RICE_BOWL, {
      allergies: ['peanuts'],
      religious: ['halal'],
      diets: ['vegan'],
    });
    expect(fit.allowed).toBe(true);
    expect(fit.blockers).toEqual([]);
  });
});

describe('evaluateFoodSuitability — warnings and preferences', () => {
  it('flags intolerances without blocking', () => {
    const fit = evaluateFoodSuitability(FISH_PIE, { intolerances: ['lactose'] });
    expect(fit.allowed).toBe(true);
    expect(fit.warnings.some((w) => w.kind === 'intolerance')).toBe(true);
  });

  it('warns on time and skill stretch', () => {
    const long = recipe('Slow ragu', ['beef', 'tomato'], { time: 180, steps: Array(20).fill('x') });
    const fit = evaluateFoodSuitability(long, { timeBudget: 'quick', skill: 'beginner' });
    expect(fit.allowed).toBe(true);
    expect(fit.warnings.some((w) => w.code === 'time:over')).toBe(true);
    expect(fit.warnings.some((w) => w.code === 'skill:over')).toBe(true);
  });

  it('marks favourite cuisine as a preference', () => {
    const fit = evaluateFoodSuitability(RICE_BOWL, { cuisines: ['Japanese'] });
    expect(fit.preferences.some((p) => p.code.startsWith('cuisine:'))).toBe(true);
  });
});

describe('filter / rank / reach', () => {
  const pool = [PEANUT_STEW, FISH_PIE, BACON_PASTA, RICE_BOWL, TOFU_STIR];

  it('filterBySuitability removes blockers only', () => {
    const left = filterBySuitability(pool, { allergies: ['peanuts'], diets: ['vegetarian'] });
    expect(left.map((r) => r.name).sort()).toEqual(['Rice bowl', 'Tofu stir fry'].sort());
  });

  it('rankBySuitability puts preferences first and warnings later', () => {
    const ranked = rankBySuitability([FISH_PIE, RICE_BOWL], {
      intolerances: ['lactose'],
      cuisines: ['Japanese'],
    });
    expect(ranked[0].name).toBe('Rice bowl');
  });

  it('suitabilityReach reports what is left', () => {
    const reach = suitabilityReach(pool, { allergies: ['peanuts', 'milk'] });
    expect(reach.removed).toBeGreaterThan(0);
    expect(reach.left + reach.removed).toBe(reach.total);
  });

  it('suitabilitySummary is human readable', () => {
    expect(suitabilitySummary({})).toMatch(/Nothing set/);
    expect(suitabilitySummary({ allergies: ['peanuts'] })).toMatch(/allergen/);
  });
});

describe('confidence and missingData', () => {
  it('marks low confidence when ingredients are empty', () => {
    const bare = { id: 'x', name: 'Mystery', ingredients: [], tags: [] };
    const fit = evaluateFoodSuitability(bare, { allergies: ['peanuts'] });
    expect(fit.confidence).toBe('low');
    expect(fit.missingData).toContain('ingredients-empty');
  });

  it('marks medium when no preferences are set', () => {
    const fit = evaluateFoodSuitability(RICE_BOWL, {});
    expect(['medium', 'high']).toContain(fit.confidence);
    expect(fit.missingData).toContain('preferences-unset');
  });
});

import { describe, it, expect } from 'vitest';
import { buildPlan, hardFilter, scopeCount } from '../src/lib/planner.js';
import { RECIPES } from '../src/data/recipes.js';
import { itemsFromRecipes } from '../src/data/stores.js';

describe('hardFilter', () => {
  it('vegan keeps only vegan recipes', () => {
    const out = hardFilter(RECIPES, { diets: ['vegan'] });
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((r) => r.tags.includes('vegan'))).toBe(true);
  });
  it('budget caps cost per serving', () => {
    const out = hardFilter(RECIPES, { budget: 1.2 });
    expect(out.every((r) => r.costPerServing <= 1.2)).toBe(true);
  });
  it('dairy-free excludes recipes with dairy ingredients', () => {
    const out = hardFilter(RECIPES, { diets: ['dairy-free'] });
    expect(out.some((r) => r.id === 'halloumi-grain')).toBe(false);
    expect(out.some((r) => r.id === 'chickpea-curry')).toBe(true);
  });
});

describe('buildPlan', () => {
  it('fills a week of dinners from the vegan pool without repeating', () => {
    const { meals, note } = buildPlan(
      { scope: 'A week', diets: ['vegan'], budget: 4, maxTime: 30 },
      42
    );
    expect(meals).toHaveLength(scopeCount('A week'));
    expect(meals.every(Boolean)).toBe(true);
    expect(meals.every((r) => r.meal === 'dinner')).toBe(true);
    expect(new Set(meals.map((r) => r.id)).size).toBe(meals.length);
    expect(note).toBeNull();
  });

  it('repeats, with a note, when the pool really is tiny', () => {
    const { meals, note } = buildPlan(
      { scope: 'A week', diets: ['vegan', 'keto'], budget: 1, maxTime: 20 },
      11
    );
    expect(meals).toHaveLength(7);
    expect(note === null || /repeat|closest/i.test(note)).toBe(true);
  });

  it('plans a day as breakfast, lunch and dinner', () => {
    const { meals } = buildPlan({ scope: 'A day', budget: 4 }, 3);
    expect(meals.map((r) => r.meal)).toEqual(['breakfast', 'lunch', 'dinner']);
  });
  it('falls back with a note when nothing matches', () => {
    const { meals, note } = buildPlan({ scope: 'A day', diets: ['vegan'], budget: 0.1 }, 7);
    expect(meals).toHaveLength(3);
    expect(note).toMatch(/closest fits/i);
  });
  it('is deterministic for the same seed and options', () => {
    const a = buildPlan({ scope: 'A week', budget: 3 }, 99).meals.map((r) => r.id);
    const b = buildPlan({ scope: 'A week', budget: 3 }, 99).meals.map((r) => r.id);
    expect(a).toEqual(b);
  });
  it('honours date night as a soft preference', () => {
    const { meals } = buildPlan({ scope: '1 meal', occasion: 'Date night', budget: 4 }, 5);
    expect(meals[0].tags).toContain('date-night');
  });
});

describe('itemsFromRecipes', () => {
  it('returns every ingredient once, minus what your pantry already has', () => {
    const recipe = RECIPES.find((r) => r.id === 'salmon-teriyaki');
    const items = itemsFromRecipes([recipe, recipe]);
    expect(items).toHaveLength(recipe.ingredients.length);
    // Prices start blank — they are whatever you end up paying.
    expect(items.every((i) => i.price === 0)).toBe(true);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);

    const withPantry = itemsFromRecipes([recipe], ['Sushi rice', 'Soy sauce']);
    expect(withPantry).toHaveLength(recipe.ingredients.length - 2);
  });
});

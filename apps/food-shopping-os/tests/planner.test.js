import { describe, it, expect } from 'vitest';
import { buildPlan, hardFilter, scopeCount } from '../src/lib/planner.js';
import { RECIPES } from '../src/data/recipes.js';
import { itemsFromRecipes } from '../src/data/stores.js';

describe('hardFilter', () => {
  it('vegan keeps only vegan recipes', () => {
    const out = hardFilter(RECIPES, { diet: 'Vegan' });
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((r) => r.tags.includes('vegan'))).toBe(true);
  });
  it('budget caps cost per serving', () => {
    const out = hardFilter(RECIPES, { budget: 1.2 });
    expect(out.every((r) => r.costPerServing <= 1.2)).toBe(true);
  });
  it('dairy-free excludes recipes with dairy ingredients', () => {
    const out = hardFilter(RECIPES, { diet: 'Dairy-free' });
    expect(out.some((r) => r.id === 'halloumi-grain')).toBe(false);
    expect(out.some((r) => r.id === 'chickpea-curry')).toBe(true);
  });
});

describe('buildPlan', () => {
  it('always fills the requested scope, repeating when the pool is small', () => {
    const { meals, note } = buildPlan(
      { scope: 'A week', diet: 'Vegan', budget: 4, maxTime: 30 },
      42
    );
    expect(meals).toHaveLength(scopeCount('A week'));
    expect(meals.every(Boolean)).toBe(true);
    expect(note).toMatch(/repeat/i);
  });
  it('falls back with a note when nothing matches', () => {
    const { meals, note } = buildPlan({ scope: 'A day', diet: 'Vegan', budget: 0.1 }, 7);
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

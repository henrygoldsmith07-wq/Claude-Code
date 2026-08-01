import { describe, expect, it } from 'vitest';
import { buildTasteDeck, buildTasteProfile, tasteScore } from '../src/lib/taste.js';
import { buildPlan } from '../src/lib/planner.js';
import { fallbackImage, imagePrompt, recipeFallbackImage, recipeImage, RECIPE_IMAGES } from '../src/data/recipe-images.js';
import { RECIPES } from '../src/data/recipes.js';

const recipe = (id, cuisine, tags = []) => ({
  id,
  name: id,
  meal: 'dinner',
  cuisine,
  tags,
  servings: 2,
  time: 20,
  kcal: 450,
  protein: 25,
  costPerServing: 1.5,
  ingredients: [{ name: 'Ingredient' }],
});

describe('recipe taste matching', () => {
  const indian = recipe('indian', 'Indian', ['curry', 'vegan']);
  const italian = recipe('italian', 'Italian', ['pasta', 'vegetarian']);
  const mexican = recipe('mexican', 'Mexican', ['spicy', 'vegan']);

  it('learns cuisines and tags from likes, loves and skips', () => {
    const profile = buildTasteProfile(
      [indian, italian, mexican],
      { indian: 'love', italian: 'nope', mexican: 'like' },
    );

    expect(profile.rated).toBe(3);
    expect(profile.topCuisines[0]).toBe('Indian');
    expect(tasteScore(indian, profile)).toBeGreaterThan(tasteScore(italian, profile));
  });

  it('builds a varied deck without recipes already judged', () => {
    const deck = buildTasteDeck([indian, italian, mexican], { indian: 'love' });
    expect(deck.map((item) => item.id)).toEqual(['italian', 'mexican']);
  });

  it('uses learnt tastes as a soft AI planning preference', () => {
    const indianRecipes = Array.from({ length: 7 }, (_, index) => recipe(`indian-${index}`, 'Indian', ['curry']));
    const italianRecipes = Array.from({ length: 7 }, (_, index) => recipe(`italian-${index}`, 'Italian', ['pasta']));
    const profile = buildTasteProfile(
      [...indianRecipes, ...italianRecipes],
      { 'indian-0': 'love', 'italian-0': 'nope' },
    );
    const plan = buildPlan(
      { scope: 'A week', budget: 4, recipes: [...indianRecipes, ...italianRecipes], taste: profile },
      12,
    );

    expect(plan.meals).toHaveLength(7);
    expect(plan.meals.every((item) => item.cuisine === 'Indian')).toBe(true);
  });
});

describe('recipe imagery', () => {
  it('gives every recipe its own picture rather than one of eight', () => {
    const images = new Set(RECIPES.map((item) => recipeImage(item)));
    expect(images.size).toBe(RECIPES.length);
  });

  it('keeps generated image seeds within the provider range', () => {
    const invalid = RECIPES.filter((recipe) => {
      const seed = Number(new URL(recipeImage(recipe)).searchParams.get('seed'));
      return !Number.isInteger(seed) || seed < 0 || seed > 2147483647;
    });
    expect(invalid).toEqual([]);
  });

  it('includes the name and a hero ingredient in every catalogue prompt', () => {
    const missing = RECIPES.filter((item) => {
      const prompt = imagePrompt(item).toLowerCase();
      const firstIngredient = String(item.ingredients?.[0]?.name || item.ingredients?.[0] || '').trim().toLowerCase();
      return !prompt.includes(String(item.name).toLowerCase())
        || (firstIngredient && !prompt.includes(firstIngredient));
    });

    expect(missing).toEqual([]);
  });

  it('has a distinct recipe-aware local fallback for every catalogue recipe', () => {
    const fallbacks = new Set(RECIPES.map((item) => recipeFallbackImage(item)));
    expect(fallbacks.size).toBe(RECIPES.length);
    expect([...fallbacks].every((src) => src.startsWith('data:image/svg+xml'))).toBe(true);
  });

  it('describes the actual dish in the prompt', () => {
    const prompt = imagePrompt({
      name: 'Teriyaki Salmon Bowls',
      cuisine: 'Japanese',
      meal: 'dinner',
      ingredients: [{ name: 'Salmon fillet' }, { name: 'Rice' }, { name: 'Sesame oil' }],
    });

    expect(prompt).toContain('Teriyaki Salmon Bowls');
    expect(prompt).toContain('japanese dinner');
    expect(prompt).toContain('made with salmon fillet, rice, sesame oil');
  });

  it('resolves the same recipe to the same picture every time', () => {
    const recipe = { id: 'r-1', name: 'Coconut Chickpea Curry' };
    expect(recipeImage(recipe)).toBe(recipeImage({ ...recipe }));
  });

  it('falls back to a bundled picture when there is nothing to generate from', () => {
    const bundled = new Set(Object.values(RECIPE_IMAGES));
    expect(bundled.has(recipeImage({ id: 'nameless' }))).toBe(true);
    expect(bundled.has(fallbackImage({ id: 'mine', name: 'My own dish' }))).toBe(true);
    expect(RECIPES.every((item) => bundled.has(fallbackImage(item)))).toBe(true);
  });
});

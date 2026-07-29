import { describe, expect, it } from 'vitest';
import { buildTasteDeck, buildTasteProfile, tasteScore } from '../src/lib/taste.js';
import { buildPlan } from '../src/lib/planner.js';
import { recipeImage, RECIPE_IMAGES } from '../src/data/recipe-images.js';
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

describe('recipe photography', () => {
  it('gives every bundled and personal recipe a local image', () => {
    const knownImages = new Set(Object.values(RECIPE_IMAGES));
    expect(RECIPES.every((item) => knownImages.has(recipeImage(item)))).toBe(true);
    expect(knownImages.has(recipeImage({ id: 'mine-anything', name: 'My own dish' }))).toBe(true);
  });
});

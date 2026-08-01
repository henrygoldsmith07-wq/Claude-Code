import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { buildTasteDeck, buildTasteProfile, tasteScore } from '../src/lib/taste.js';
import { buildPlan } from '../src/lib/planner.js';
import {
  fallbackImage,
  imagePrompt,
  recipeFallbackImage,
  recipeImage,
  recipePhotoImage,
  RECIPE_PHOTOS,
  RECIPE_IMAGES,
} from '../src/data/recipe-images.js';
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
  it('uses bundled free photos for every catalogue recipe', () => {
    const images = RECIPES.map((item) => recipeImage(item));
    expect(images.every((src) => src.startsWith('/recipe-images/'))).toBe(true);
    expect(new Set(images).size).toBeGreaterThan(1);
  });

  it('does not send recipe cards to an external image generator', () => {
    expect(RECIPES.every((item) => !/^https?:\/\//.test(recipeImage(item)))).toBe(true);
  });

  it('gives every catalogue recipe a local photo', () => {
    const missing = RECIPES.filter((item) => !recipePhotoImage(item).startsWith('/recipe-images/'));
    expect(missing).toEqual([]);
  });

  it('ships every local photo used by the catalogue', () => {
    const paths = [...new Set(RECIPES.map(recipePhotoImage))];
    const missing = paths.filter((src) => !existsSync(path.resolve(process.cwd(), 'public', src.slice(1))));
    expect(missing).toEqual([]);
  });

  it('precaches every local photo for offline recipe browsing', () => {
    const serviceWorker = readFileSync(path.resolve(process.cwd(), 'public/sw.js'), 'utf8');
    const paths = [...new Set(RECIPES.map(recipePhotoImage))];
    const missing = paths.filter((src) => !serviceWorker.includes(`'${src}'`));
    expect(missing).toEqual([]);
  });

  it('keeps common dishes on a matching family photo', () => {
    expect(recipePhotoImage({ name: 'Leeks & lentils soup', meal: 'lunch' })).toBe(RECIPE_PHOTOS.soup);
    expect(recipePhotoImage({ name: 'Smoky Three-Bean Chilli', meal: 'dinner' })).toBe(RECIPE_PHOTOS.chilli);
    expect(recipePhotoImage({ name: 'Chicken breast Thai green curry', meal: 'dinner', ingredients: [{ name: 'Red chilli' }] })).toBe(RECIPE_PHOTOS.curry);
    expect(recipePhotoImage({ name: 'Eggs & spinach on wholemeal toast', meal: 'breakfast' })).toBe(RECIPE_PHOTOS.eggsToast);
    expect(recipePhotoImage({ name: 'Salmon fillet & broccoli traybake', meal: 'dinner' })).toBe(RECIPE_PHOTOS.salmon);
    expect(recipePhotoImage({ name: 'Chicken breast wrap with herby yogurt', meal: 'lunch' })).toBe(RECIPE_PHOTOS.sandwich);
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

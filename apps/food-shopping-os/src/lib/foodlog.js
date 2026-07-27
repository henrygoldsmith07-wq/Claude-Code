/**
 * Capture layer for the food diary: search, barcode lookup, voice parsing,
 * photo recognition and recipe import.
 *
 * The app is offline-first with no backend, so the "AI" surfaces (photo,
 * barcode camera) resolve against the bundled catalogue deterministically —
 * same input, same result — while the text-driven ones (voice, recipe paste)
 * do real parsing on whatever the user actually typed or said.
 */

import { CATALOGUE, FOODS } from '../data/foods.js';
import { RECIPES } from '../data/recipes.js';
import { buildEntry, recipeAsFood, timeStamp, mealForTime } from './nutrition.js';

const norm = (str) => String(str || '').toLowerCase().trim();

/* ---------- Search ---------- */

/** Score a food against a query: name start > name contains > brand > tag. */
const score = (food, q) => {
  const name = norm(food.name);
  const brand = norm(food.brand);
  if (name === q) return 100;
  if (name.startsWith(q)) return 80;
  if (name.includes(q)) return 60;
  if (brand.includes(q)) return 40;
  if ((food.tags || []).some((t) => norm(t).includes(q))) return 25;
  return 0;
};

/**
 * Rank the catalogue against a query. Every word must match something, so
 * "pret chicken" narrows instead of returning every chicken in the database.
 */
export const searchFoods = (query, catalogue = CATALOGUE, limit = 40) => {
  const q = norm(query);
  if (!q) return catalogue.slice(0, limit);
  const words = q.split(/\s+/).filter(Boolean);
  return catalogue
    .map((food) => {
      const scores = words.map((w) => score(food, w));
      return scores.some((sc) => sc === 0) ? null : { food, total: scores.reduce((a, b) => a + b, 0) };
    })
    .filter(Boolean)
    .sort((a, b) => b.total - a.total || a.food.name.localeCompare(b.food.name))
    .slice(0, limit)
    .map((r) => r.food);
};

export const foodById = (id, catalogue = CATALOGUE) => catalogue.find((f) => f.id === id) || null;

/* ---------- Barcode ---------- */

export const isBarcode = (code) => /^\d{8}$|^\d{12,13}$/.test(String(code || '').trim());

export const lookupBarcode = (code, catalogue = CATALOGUE) => {
  const c = String(code || '').trim();
  return catalogue.find((f) => f.barcode === c) || null;
};

/** Barcodes the demo scanner can "see" through the camera. */
export const SCANNABLE = FOODS.filter((f) => f.barcode);

/** Deterministic pick so a given scan session resolves the same way twice. */
export const scanAt = (n) => SCANNABLE[Math.abs(Math.trunc(n)) % SCANNABLE.length];

/* ---------- Voice logging ---------- */

const WORD_NUMBERS = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  half: 0.5, 'a half': 0.5, couple: 2, few: 3,
};

const UNIT_WORDS = {
  g: 1, gram: 1, grams: 1, gramme: 1, grammes: 1,
  kg: 1000, kilo: 1000, kilos: 1000, kilogram: 1000,
  ml: 1, millilitre: 1, millilitres: 1, l: 1000, litre: 1000, litres: 1000,
  oz: 28.35, ounce: 28.35, ounces: 28.35,
};

const PORTION_WORDS = ['slice', 'slices', 'scoop', 'scoops', 'bowl', 'bowls', 'glass', 'glasses',
  'cup', 'cups', 'piece', 'pieces', 'handful', 'handfuls', 'tbsp', 'tsp', 'spoon', 'spoons',
  'pot', 'pots', 'bar', 'bars', 'tin', 'tins', 'can', 'cans', 'pint', 'pints', 'portion', 'portions',
  'serving', 'servings', 'square', 'squares', 'bag', 'bags', 'punnet'];

const STOPWORDS = new Set(['of', 'some', 'the', 'my', 'i', 'had', 'ate', 'have', 'eaten',
  'just', 'and', 'with', 'a', 'an', 'plus', 'then', 'today', 'this', 'morning', 'evening']);

const MEAL_WORDS = {
  breakfast: 'breakfast', brunch: 'breakfast', lunch: 'lunch', dinner: 'dinner',
  tea: 'dinner', supper: 'dinner', snack: 'snack', snacks: 'snack', snacking: 'snack',
};

/** Pull "for lunch" (etc.) out of the sentence, returning meal + the rest. */
const extractMeal = (text) => {
  let meal = null;
  const cleaned = norm(text).replace(/\bfor\s+(breakfast|brunch|lunch|dinner|tea|supper|snacks?)\b/g, (_, word) => {
    meal = MEAL_WORDS[word];
    return ' ';
  });
  return { meal, text: cleaned };
};

const splitChunks = (text) =>
  text
    .split(/,| and | plus | then | with /)
    .map((c) => c.trim())
    .filter(Boolean);

/** Parse one phrase → quantity, unit and the food words that remain. */
export const parsePhrase = (phrase) => {
  const words = norm(phrase).replace(/[.!?]/g, '').split(/\s+/).filter(Boolean);
  let qty = null;
  let grams = null;
  let portionWord = null;
  const rest = [];

  for (let i = 0; i < words.length; i += 1) {
    const w = words[i];
    const numeric = /^\d+(\.\d+)?$/.test(w) ? Number(w) : null;
    // "300g" / "250ml" written without a space
    const glued = w.match(/^(\d+(?:\.\d+)?)(g|kg|ml|l|oz)$/);

    if (glued) {
      grams = Number(glued[1]) * UNIT_WORDS[glued[2]];
      qty = qty ?? 1;
      continue;
    }
    if (numeric !== null) { qty = numeric; continue; }
    if (WORD_NUMBERS[w] !== undefined && qty === null && rest.length === 0) { qty = WORD_NUMBERS[w]; continue; }
    if (UNIT_WORDS[w] !== undefined && qty !== null && grams === null) {
      grams = qty * UNIT_WORDS[w];
      continue;
    }
    if (PORTION_WORDS.includes(w) && !portionWord) { portionWord = w; continue; }
    if (STOPWORDS.has(w)) continue;
    rest.push(w);
  }

  return { qty: qty ?? 1, grams, portionWord, query: rest.join(' ').trim() };
};

/**
 * Turn a spoken sentence into draft log entries.
 * "two slices of toast and a banana for breakfast" → 2 matched entries.
 */
export const parseVoiceLog = (text, catalogue = CATALOGUE, now = new Date()) => {
  const { meal: spokenMeal, text: body } = extractMeal(text);
  const meal = spokenMeal || mealForTime(now);
  const items = splitChunks(body).map((chunk) => {
    const { qty, grams, portionWord, query } = parsePhrase(chunk);
    if (!query) return null;
    const food = searchFoods(query, catalogue, 1)[0] || null;
    const serving = food?.servings?.[0];
    const weight = grams ?? (serving ? serving.grams * qty : null);
    return {
      text: chunk.trim(),
      query,
      qty,
      portionWord,
      food,
      grams: weight,
      entry: food
        ? buildEntry(food, {
            grams: weight,
            meal,
            time: timeStamp(now),
            source: 'voice',
            servingLabel: grams
              ? `${weight} ${food.unit || 'g'}`
              : qty === 1 ? serving?.label : `${qty} × ${serving?.label}`,
          })
        : null,
    };
  }).filter(Boolean);

  return { meal, items, matched: items.filter((i) => i.entry).length };
};

/* ---------- Photo recognition (on-device demo) ---------- */

const hash = (str) => {
  let h = 7;
  for (let i = 0; i < String(str).length; i += 1) h = (h * 31 + String(str).charCodeAt(i)) % 1e9;
  return h;
};

/** Plausible plates, so the demo never "recognises" a nonsense combination. */
const PLATES = [
  ['chicken-breast', 'white-rice', 'broccoli'],
  ['porridge-oats', 'banana', 'semi-skimmed-milk'],
  ['wholemeal-bread', 'egg', 'avocado'],
  ['salmon-fillet', 'potato', 'spinach'],
  ['pasta', 'cheddar', 'olive-oil'],
  ['greek-yogurt', 'granola', 'blueberries'],
  ['tortilla-wrap', 'chicken-breast', 'hummus'],
  ['tofu', 'brown-rice', 'broccoli'],
];

/**
 * Recognise a plate from a photo. Seeded by the file (name + size) so the same
 * picture always returns the same reading.
 */
export const recognisePlate = (seed, catalogue = CATALOGUE, now = new Date()) => {
  const h = hash(seed);
  const plate = PLATES[h % PLATES.length];
  const meal = mealForTime(now);
  return plate.map((id, i) => {
    const food = foodById(id, catalogue) || foodById(id, CATALOGUE);
    const serving = food.servings[0];
    // Vary the estimated portion a little, the way a real estimator would.
    const factor = [1, 0.85, 1.25][(h + i) % 3];
    const grams = Math.round(serving.grams * factor);
    return {
      food,
      confidence: 68 + ((h >> (i * 3)) % 30),
      grams,
      entry: buildEntry(food, { grams, meal, time: timeStamp(now), source: 'photo', servingLabel: `${grams} ${food.unit}` }),
    };
  });
};

/* ---------- Recipe import ---------- */

const QTY_LINE = /^\s*(?:[-*•]\s*)?(\d+(?:[.,]\d+)?|½|¼|¾)?\s*(kg|g|ml|l|tbsp|tsp|cups?|cloves?|tins?|cans?|handfuls?|slices?)?\s*(?:of\s+)?(.+?)\s*$/i;
const FRACTIONS = { '½': 0.5, '¼': 0.25, '¾': 0.75 };
const GRAMS_PER = { kg: 1000, g: 1, l: 1000, ml: 1, tbsp: 15, tsp: 5, cup: 240, cups: 240, clove: 5, cloves: 5, tin: 240, tins: 240, can: 240, cans: 240, handful: 30, handfuls: 30, slice: 36, slices: 36 };

/** Parse one pasted ingredient line into a weight + a catalogue match. */
export const parseIngredientLine = (line, catalogue = CATALOGUE) => {
  const m = String(line).match(QTY_LINE);
  if (!m) return null;
  const [, rawQty, rawUnit, rawName] = m;
  const name = rawName.replace(/\(.*?\)/g, '').replace(/,.*$/, '').trim();
  if (!name || name.length < 2) return null;
  const qty = rawQty ? (FRACTIONS[rawQty] ?? Number(String(rawQty).replace(',', '.'))) : 1;
  const unit = (rawUnit || '').toLowerCase();
  const food = searchFoods(name, catalogue, 1)[0] || null;
  const perUnit = GRAMS_PER[unit];
  const grams = perUnit ? qty * perUnit : (food?.servings?.[0]?.grams || 100) * qty;
  return { line: String(line).trim(), name, qty, unit, grams: Math.round(grams), food };
};

/**
 * Import a pasted recipe: title, servings and ingredient lines, with nutrition
 * estimated per serving from whatever ingredients we can match.
 */
export const importRecipeText = (text, catalogue = CATALOGUE) => {
  const lines = String(text).split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return null;
  const title = lines[0].replace(/^#+\s*/, '').slice(0, 80);
  const servingsLine = lines.find((l) => /serves|servings|makes/i.test(l));
  const servings = Math.max(1, Number(servingsLine?.match(/(\d+)/)?.[1]) || 4);
  const ingredientLines = lines
    .slice(1)
    .filter((l) => l !== servingsLine && !/^(method|steps?|instructions?|directions?)\b/i.test(l))
    .filter((l) => l.length < 90);

  const ingredients = ingredientLines.map((l) => parseIngredientLine(l, catalogue)).filter(Boolean);
  const matched = ingredients.filter((i) => i.food);
  const total = matched.reduce((acc, i) => {
    const k = i.grams / 100;
    acc.kcal += i.food.per100.kcal * k;
    acc.protein += i.food.per100.protein * k;
    acc.carbs += i.food.per100.carbs * k;
    acc.fat += i.food.per100.fat * k;
    acc.fibre += (i.food.per100.fibre || 0) * k;
    return acc;
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 });

  const grams = Math.max(1, matched.reduce((g, i) => g + i.grams, 0)) / servings;
  const perServing = Object.fromEntries(
    Object.entries(total).map(([k, v]) => [k, Math.round((v / servings) * 10) / 10]),
  );

  return {
    title,
    servings,
    ingredients,
    matchedCount: matched.length,
    perServing: { ...perServing, kcal: Math.round(perServing.kcal) },
    food: {
      id: `import--${Date.now().toString(36)}`,
      name: title,
      brand: 'Imported recipe',
      emoji: '🍽️',
      unit: 'g',
      source: 'custom',
      tags: ['imported'],
      per100: {
        kcal: Math.round((perServing.kcal / grams) * 100),
        protein: Math.round((perServing.protein / grams) * 1000) / 10,
        carbs: Math.round((perServing.carbs / grams) * 1000) / 10,
        fat: Math.round((perServing.fat / grams) * 1000) / 10,
        fibre: Math.round((perServing.fibre / grams) * 1000) / 10,
      },
      servings: [
        { label: '1 serving', grams: Math.round(grams) },
        { label: 'Half serving', grams: Math.round(grams / 2) },
      ],
    },
  };
};

/**
 * Import from a URL. There is no network in this offline app, so a link
 * resolves deterministically to one of the bundled recipes — labelled as a
 * demo in the UI rather than pretending to have fetched the page.
 */
export const importRecipeUrl = (url) => {
  const clean = String(url).trim();
  if (!/^https?:\/\/.+\..+/.test(clean)) return null;
  const domain = clean.replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '');
  const recipe = RECIPES[hash(clean) % RECIPES.length];
  return {
    domain,
    url: clean,
    recipe,
    title: recipe.name,
    servings: recipe.servings,
    perServing: { kcal: recipe.kcal, protein: recipe.protein, carbs: recipe.carbs, fat: recipe.fat, fibre: recipe.fibre || 0 },
    ingredients: recipe.ingredients.map((i) => ({ line: `${i.qty} ${i.name}`, name: i.name, food: null })),
    food: recipeAsFood(recipe),
  };
};

/* ---------- Custom foods ---------- */

/** Validate + normalise the custom-food form at the boundary. */
export const makeCustomFood = (draft) => {
  const name = String(draft.name || '').trim();
  const servingGrams = Number(draft.servingGrams);
  const rawKcal = String(draft.kcal ?? '').trim();
  const kcal = Number(rawKcal);
  const errors = [];
  if (name.length < 2) errors.push('Give it a name');
  if (!(servingGrams > 0)) errors.push('Serving size must be greater than 0');
  if (rawKcal === '' || !(kcal >= 0)) errors.push('Calories must be a number');
  if (errors.length) return { errors, food: null };

  const num = (v) => Math.max(0, Number(v) || 0);
  const k = 100 / servingGrams;
  return {
    errors: [],
    food: {
      id: `custom--${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
      name,
      brand: String(draft.brand || '').trim() || 'My food',
      emoji: '🍽️',
      unit: draft.unit === 'ml' ? 'ml' : 'g',
      source: 'custom',
      tags: ['mine'],
      per100: {
        kcal: Math.round(num(kcal) * k),
        protein: Math.round(num(draft.protein) * k * 10) / 10,
        carbs: Math.round(num(draft.carbs) * k * 10) / 10,
        fat: Math.round(num(draft.fat) * k * 10) / 10,
        fibre: Math.round(num(draft.fibre) * k * 10) / 10,
      },
      servings: [
        { label: `1 serving (${servingGrams} ${draft.unit === 'ml' ? 'ml' : 'g'})`, grams: servingGrams },
        { label: `Half serving`, grams: servingGrams / 2 },
      ],
    },
  };
};

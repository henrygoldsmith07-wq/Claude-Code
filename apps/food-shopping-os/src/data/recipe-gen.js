/**
 * Recipe generation.
 *
 * Rather than 600 hand-written recipes with 600 sets of invented nutrition,
 * dishes are composed from the building blocks in `recipe-parts.js` — and
 * their calories, macros, cost and scores are computed from what is in them.
 * Change a component's data once and every dish using it stays correct.
 *
 * Each template lists the component axes it varies over; the generator walks
 * those combinations in order and takes as many as the template asks for.
 */

import {
  BASES, BREAKFAST_BASES, EXTRAS, FRUITS, PROTEINS, SAUCES, TOPPINGS, VEG,
} from './recipe-parts.js';

const low = (s) => s.toLowerCase();
const sentence = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const round1 = (n) => Math.round(n * 10) / 10;

/**
 * A readable amount: spoons for the small stuff, grams for everything else.
 * Amounts are for the whole dish, so they scale with how many it serves;
 * nutrition and cost stay per serving.
 */
const qtyLabel = (p, servings = 1) => {
  if (p.grams <= 5) return servings > 1 ? `${servings} tsp` : '1 tsp';
  if (p.grams <= 20 && p.tags.some((t) => ['fat', 'sweet', 'spice', 'sauce', 'aromatic'].includes(t))) {
    return servings > 1 ? `${servings} tbsp` : '1 tbsp';
  }
  return `${p.grams * servings} g`;
};

/** Nutrition and cost per serving, with ingredients for `servings` of them. */
export const compose = (parts, servings = 1) => {
  const totals = parts.reduce((acc, p) => {
    const k = p.grams / 100;
    acc.kcal += p.per100.kcal * k;
    acc.protein += p.per100.protein * k;
    acc.carbs += p.per100.carbs * k;
    acc.fat += p.per100.fat * k;
    acc.fibre += (p.per100.fibre || 0) * k;
    acc.cost += (p.price || 0) * k;
    return acc;
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0, cost: 0 });

  return {
    kcal: Math.round(totals.kcal),
    protein: Math.round(totals.protein),
    carbs: Math.round(totals.carbs),
    fat: Math.round(totals.fat),
    fibre: round1(totals.fibre),
    costPerServing: Math.max(0.35, Math.round(totals.cost * 100) / 100),
    ingredients: parts.map((p) => ({ name: p.name, qty: qtyLabel(p, servings) })),
  };
};

/* ---------- Derived scores (no invented ratings) ---------- */

const has = (parts, tag) => parts.some((p) => p.tags.includes(tag));

const scores = (parts, n) => {
  const per100kcal = n.kcal ? (100 / n.kcal) : 0;
  const health = Math.max(20, Math.min(98, Math.round(
    55
    + n.fibre * 3
    + (n.protein * per100kcal) * 1.2
    - (n.fat * per100kcal) * 1.5
    + (has(parts, 'veg') ? 8 : 0)
    + (has(parts, 'green') ? 5 : 0)
    + (has(parts, 'wholegrain') ? 4 : 0)
    - (has(parts, 'sweet') ? 4 : 0),
  )));
  const protein = Math.max(10, Math.min(99, Math.round(n.protein * per100kcal * 14)));
  const env = Math.max(15, Math.min(99, Math.round(
    92
    - (has(parts, 'red-meat') ? 55 : 0)
    - (has(parts, 'meat') ? 20 : 0)
    - (has(parts, 'fish') ? 14 : 0)
    - (has(parts, 'dairy') ? 10 : 0)
    - (has(parts, 'egg') ? 6 : 0),
  )));
  return { healthScore: health, proteinScore: protein, envScore: env };
};

/** Diet tags are read off the components, so filters can trust them. */
const dietTags = (parts) => {
  const animal = ['meat', 'red-meat', 'poultry', 'fish', 'seafood'];
  const tags = [];
  const anyAnimal = parts.some((p) => p.tags.some((t) => animal.includes(t)));
  // Vegan rules out dairy, eggs and honey too; vegetarian only meat and fish.
  const anyAnimalProduct = has(parts, 'dairy') || has(parts, 'egg') || has(parts, 'honey');
  if (!anyAnimal && !anyAnimalProduct) tags.push('vegan', 'vegetarian');
  else if (!anyAnimal) tags.push('vegetarian');
  return tags;
};

/* ---------- Templates ---------- */

const pick = (obj, keys) => keys.map((k) => obj[k]);
const all = (obj) => Object.values(obj);

const T = (config) => config;

export const TEMPLATES = [
  /* ---------- Breakfast ---------- */
  T({
    meal: 'breakfast', take: 60, emoji: '🥣', cuisine: 'British', time: 10, prep: 5,
    axes: [all(FRUITS), all(TOPPINGS), [EXTRAS.milk, EXTRAS.oatmilk]],
    name: ([fruit, top, milk]) => `${fruit.name} & ${low(top.name)} porridge${milk === EXTRAS.oatmilk ? ' with oat milk' : ''}`,
    parts: ([fruit, top, milk]) => [BREAKFAST_BASES.oats, milk, fruit, top],
    tags: ['breakfast', 'quick'],
    steps: ([fruit, top]) => [
      { text: 'Tip the oats and milk into a pan over medium heat.' },
      { text: 'Stir until thick and creamy.', timerMins: 5 },
      { text: `Fold through the ${low(fruit.name)} and top with ${low(top.name)}.` },
    ],
  }),
  T({
    meal: 'breakfast', take: 40, emoji: '🫐', cuisine: 'British', time: 5, prep: 5,
    axes: [all(FRUITS), all(TOPPINGS), [EXTRAS.milk, EXTRAS.oatmilk]],
    name: ([fruit, top, milk]) => `${fruit.name} overnight oats with ${low(top.name)}${milk === EXTRAS.oatmilk ? ' & oat milk' : ''}`,
    parts: ([fruit, top, milk]) => [BREAKFAST_BASES.oats, milk, fruit, top],
    tags: ['breakfast', 'meal-prep', 'quick'],
    steps: ([fruit, top]) => [
      { text: 'Stir the oats and milk together in a jar.' },
      { text: `Ripple through the ${low(fruit.name)} and ${low(top.name)}.` },
      { text: 'Lid on, fridge overnight. Eat cold or warmed.' },
    ],
  }),
  T({
    meal: 'breakfast', take: 40, emoji: '🍦', cuisine: 'British', time: 5, prep: 5,
    axes: [all(FRUITS), all(TOPPINGS), [BREAKFAST_BASES.yogurt, BREAKFAST_BASES.coconutyog]],
    name: ([fruit, top, base]) => `${fruit.name} ${base === BREAKFAST_BASES.coconutyog ? 'coconut ' : ''}yogurt bowl with ${low(top.name)}`,
    parts: ([fruit, top, base]) => [base, fruit, top],
    tags: ['breakfast', 'quick', 'high-protein'],
    steps: ([fruit, top]) => [
      { text: 'Spoon the yogurt into a bowl and level it out.' },
      { text: `Pile on the ${low(fruit.name)} and scatter over the ${low(top.name)}.` },
    ],
  }),
  T({
    meal: 'breakfast', take: 25, emoji: '🍳', cuisine: 'British', time: 15, prep: 5,
    axes: [all(VEG), pick(BREAKFAST_BASES, ['toast', 'bagel'])],
    name: ([veg, base]) => `Eggs & ${low(veg.name)} on ${low(base.name)}`,
    parts: ([veg, base]) => [BREAKFAST_BASES.eggs, veg, base, EXTRAS.oil],
    tags: ['breakfast', 'high-protein', 'quick'],
    steps: ([veg, base]) => [
      { text: `Wilt the ${low(veg.name)} in a hot pan with the oil.`, timerMins: 3 },
      { text: 'Crack in the eggs and cook to your liking.', timerMins: 4 },
      { text: `Pile onto toasted ${low(base.name)} and season well.` },
    ],
  }),
  T({
    meal: 'breakfast', take: 20, emoji: '🥞', cuisine: 'American', time: 15, prep: 5,
    axes: [all(FRUITS), pick(TOPPINGS, ['peanut', 'honey', 'maple', 'choc', 'seeds', 'protein'])],
    name: ([fruit, top]) => `${fruit.name} protein pancakes`,
    parts: ([fruit, top]) => [BREAKFAST_BASES.pancakes, EXTRAS.milk, fruit, top],
    tags: ['breakfast', 'high-protein'],
    steps: ([fruit, top]) => [
      { text: 'Whisk the mix with the milk into a thick batter.' },
      { text: 'Fry small pancakes in batches, flipping once bubbles form.', timerMins: 8 },
      { text: `Stack with the ${low(fruit.name)} and ${low(top.name)}.` },
    ],
  }),
  T({
    meal: 'breakfast', take: 15, emoji: '🥤', cuisine: 'British', time: 5, prep: 5,
    axes: [all(FRUITS), pick(TOPPINGS, ['protein', 'peanut', 'seeds', 'chia', 'almond', 'coconutflakes']), [EXTRAS.milk, EXTRAS.oatmilk]],
    name: ([fruit, top, milk]) => `${fruit.name} & ${low(top.name)} smoothie bowl${milk === EXTRAS.oatmilk ? ' with oat milk' : ''}`,
    parts: ([fruit, top, milk]) => [BREAKFAST_BASES.oats, milk, fruit, top],
    tags: ['breakfast', 'quick'],
    steps: ([fruit]) => [
      { text: `Blend the ${low(fruit.name)} with the milk and oats until thick.` },
      { text: 'Pour into a bowl and add the toppings.' },
    ],
  }),

  /* ---------- Lunch ---------- */
  T({
    meal: 'lunch', take: 80, emoji: '🥗', cuisine: 'Mediterranean', time: 20, prep: 10,
    axes: [
      pick(PROTEINS, ['chicken', 'salmon', 'tofu', 'chickpeas', 'halloumi', 'feta', 'prawns', 'lentils', 'eggs', 'tempeh']),
      pick(BASES, ['quinoa', 'couscous', 'bulgur', 'brown', 'rice']),
      pick(SAUCES, ['tahini', 'pesto', 'harissa', 'yogurt']),
    ],
    name: ([p, b, s]) => `${p.name} & ${low(b.name)} bowl with ${low(s.name)}`,
    parts: ([p, b, s]) => [p, b, VEG.spinach, VEG.tomatoes, s, EXTRAS.lemon],
    tags: ['lunch', 'meal-prep'],
    steps: ([p, b, s]) => [
      { text: `Cook the ${low(b.name)} and let it steam dry.`, timerMins: 12 },
      { text: `Sear the ${low(p.name)} until golden and cooked through.`, timerMins: 8 },
      { text: `Build the bowl with the greens and tomatoes, spoon over the ${low(s.name)}.` },
    ],
  }),
  T({
    meal: 'lunch', take: 40, emoji: '🌯', cuisine: 'Mexican', time: 15, prep: 10,
    axes: [
      pick(PROTEINS, ['chicken', 'beef', 'tofu', 'blackbeans', 'halloumi', 'prawns', 'chickpeas', 'turkey']),
      pick(SAUCES, ['salsa', 'yogurt', 'harissa', 'satay', 'chimichurri']),
    ],
    name: ([p, s]) => `${p.name} wrap with ${low(s.name)}`,
    parts: ([p, s]) => [p, BASES.tortilla, VEG.peppers, VEG.spinach, s],
    tags: ['lunch', 'quick'],
    steps: ([p, s]) => [
      { text: `Cook the ${low(p.name)} with the peppers over a high heat.`, timerMins: 8 },
      { text: 'Warm the wraps.' },
      { text: `Fill, spoon over the ${low(s.name)}, roll tightly and slice.` },
    ],
  }),
  T({
    meal: 'lunch', take: 35, emoji: '🥬', cuisine: 'Mediterranean', time: 12, prep: 12,
    axes: [
      pick(PROTEINS, ['chicken', 'tuna', 'feta', 'halloumi', 'chickpeas', 'eggs', 'prawns']),
      pick(VEG, ['tomatoes', 'peppers', 'cabbage', 'asparagus', 'courgette']),
    ],
    name: ([p, v]) => `${p.name} & ${low(v.name)} salad`,
    parts: ([p, v]) => [p, v, VEG.spinach, SAUCES.tahini, EXTRAS.lemon, EXTRAS.oil],
    tags: ['lunch', 'quick', 'healthy'],
    steps: ([p, v]) => [
      { text: `Prepare the ${low(p.name)} — griddle, poach or drain as it needs.`, timerMins: 8 },
      { text: `Toss the leaves, ${low(v.name)} and dressing together.` },
      { text: 'Top, season, and finish with lemon.' },
    ],
  }),
  T({
    meal: 'lunch', take: 25, emoji: '🍜', cuisine: 'British', time: 30, prep: 10,
    axes: [
      pick(VEG, ['butternut', 'leek', 'carrots', 'cauliflower', 'mushrooms', 'peas', 'broccoli', 'tomatoes']),
      pick(PROTEINS, ['lentils', 'butterbeans', 'chickpeas']),
    ],
    name: ([v, p]) => `${v.name} & ${low(p.name)} soup`,
    parts: ([v, p]) => [v, p, EXTRAS.onion, EXTRAS.garlic, EXTRAS.stock, EXTRAS.oil],
    tags: ['lunch', 'batch', 'freezer', 'one-pot'],
    steps: ([v, p]) => [
      { text: 'Soften the onion and garlic in the oil.', timerMins: 6 },
      { text: `Add the ${low(v.name)}, ${low(p.name)} and stock, then simmer.`, timerMins: 20 },
      { text: 'Blitz smooth or leave chunky, and season well.' },
    ],
  }),
  T({
    meal: 'lunch', take: 20, emoji: '🥪', cuisine: 'British', time: 10, prep: 8,
    axes: [
      pick(PROTEINS, ['tuna', 'chicken', 'halloumi', 'eggs', 'feta']),
      pick(SAUCES, ['pesto', 'yogurt', 'harissa', 'salsa']),
    ],
    name: ([p, s]) => `${p.name} sourdough sandwich with ${low(s.name)}`,
    parts: ([p, s]) => [p, BASES.sourdough, VEG.tomatoes, VEG.spinach, s],
    tags: ['lunch', 'quick', 'budget'],
    steps: ([p, s]) => [
      { text: 'Toast the sourdough if you like it crisp.' },
      { text: `Mix the ${low(p.name)} with the ${low(s.name)}.` },
      { text: 'Layer up with the tomatoes and leaves, then press together.' },
    ],
  }),

  /* ---------- Dinner ---------- */
  T({
    meal: 'dinner', take: 30, emoji: '🍗', cuisine: 'British', time: 45, prep: 10,
    axes: [
      pick(PROTEINS, ['chicken', 'thigh', 'salmon', 'cod', 'halloumi', 'tofu']),
      pick(VEG, ['broccoli', 'peppers', 'courgette', 'butternut', 'carrots']),
    ],
    name: ([p, v]) => `${p.name} & ${low(v.name)} traybake`,
    parts: ([p, v]) => [p, v, BASES.potato, EXTRAS.oil, EXTRAS.garlic, EXTRAS.herbs],
    tags: ['dinner', 'one-pot', 'family'],
    steps: ([p, v]) => [
      { text: 'Heat the oven to 200°C fan.' },
      { text: `Toss the potatoes and ${low(v.name)} with oil, garlic and herbs.` },
      { text: `Nestle in the ${low(p.name)} and roast until golden.`, timerMins: 35 },
    ],
  }),
  T({
    meal: 'dinner', take: 26, emoji: '🍛', cuisine: 'Indian', time: 30, prep: 10,
    axes: [
      pick(PROTEINS, ['chicken', 'chickpeas', 'paneer', 'tofu', 'prawns', 'lentils']),
      pick(SAUCES, ['tikka', 'korma', 'coconut', 'katsu']),
    ],
    name: ([p, s]) => `${p.name} ${low(s.name).replace(' sauce', '')}`,
    parts: ([p, s]) => [p, s, BASES.rice, VEG.spinach, EXTRAS.onion, EXTRAS.ginger],
    tags: ['dinner', 'one-pot', 'family'],
    steps: ([p, s]) => [
      { text: 'Soften the onion and ginger in a wide pan.', timerMins: 6 },
      { text: `Add the ${low(p.name)} and colour it all over.`, timerMins: 5 },
      { text: `Pour in the ${low(s.name)} and simmer until thick.`, timerMins: 15 },
      { text: 'Fold the spinach through and serve over rice.' },
    ],
  }),
  T({
    meal: 'dinner', take: 24, emoji: '🥡', cuisine: 'Chinese', time: 20, prep: 10,
    axes: [
      pick(PROTEINS, ['chicken', 'beef', 'tofu', 'prawns', 'tempeh', 'pork']),
      pick(SAUCES, ['soy', 'blackbean', 'satay', 'teriyaki']),
    ],
    name: ([p, s]) => `${p.name} stir-fry with ${low(s.name)}`,
    parts: ([p, s]) => [p, s, BASES.noodles, VEG.peppers, VEG.greenbeans, EXTRAS.ginger],
    tags: ['dinner', 'quick'],
    steps: ([p, s]) => [
      { text: 'Get the wok as hot as it will go.' },
      { text: `Sear the ${low(p.name)}, then lift it out.`, timerMins: 5 },
      { text: 'Fry the vegetables hard for two minutes.', timerMins: 2 },
      { text: `Return everything with the noodles and ${low(s.name)}, toss and serve.` },
    ],
  }),
  T({
    meal: 'dinner', take: 24, emoji: '🍝', cuisine: 'Italian', time: 25, prep: 10,
    axes: [
      pick(SAUCES, ['tomato', 'pesto', 'chimichurri', 'lemonherb']),
      pick(PROTEINS, ['beef', 'chicken', 'lentils', 'prawns', 'feta', 'tofu']),
    ],
    name: ([s, p]) => `${p.name} pasta with ${low(s.name)}`,
    parts: ([s, p]) => [BASES.pasta, p, s, VEG.tomatoes, EXTRAS.garlic, EXTRAS.parmesan],
    tags: ['dinner', 'quick', 'family'],
    steps: ([s, p]) => [
      { text: 'Get the pasta on in well-salted water.', timerMins: 10 },
      { text: `Cook the ${low(p.name)} with the garlic until done.`, timerMins: 8 },
      { text: `Stir in the ${low(s.name)} and a splash of pasta water.` },
      { text: 'Toss everything together and finish with parmesan.' },
    ],
  }),
  T({
    meal: 'dinner', take: 20, emoji: '🌶️', cuisine: 'Mexican', time: 40, prep: 10,
    axes: [
      pick(PROTEINS, ['beef', 'turkey', 'blackbeans', 'lentils', 'butterbeans']),
      pick(VEG, ['peppers', 'aubergine', 'mushrooms', 'carrots']),
    ],
    name: ([p, v]) => `${p.name} & ${low(v.name)} chilli`,
    parts: ([p, v]) => [p, v, SAUCES.tomato, BASES.rice, EXTRAS.onion, EXTRAS.chilli],
    tags: ['dinner', 'batch', 'freezer', 'one-pot', 'family'],
    steps: ([p, v]) => [
      { text: 'Sweat the onion, chilli and vegetables until soft.', timerMins: 8 },
      { text: `Brown the ${low(p.name)} and toast the spices for a minute.`, timerMins: 5 },
      { text: 'Add the tomato sauce and simmer low and slow.', timerMins: 25 },
      { text: 'Season, rest five minutes and serve over rice.' },
    ],
  }),
  T({
    meal: 'dinner', take: 24, emoji: '🍱', cuisine: 'Japanese', time: 25, prep: 10,
    axes: [
      pick(PROTEINS, ['salmon', 'tuna', 'chicken', 'tofu', 'prawns', 'tempeh']),
      pick(SAUCES, ['teriyaki', 'soy', 'katsu', 'satay']),
    ],
    name: ([p, s]) => `${low(s.name).replace(' glaze', '').replace(' sauce', '')} ${low(p.name)} rice bowl`,
    parts: ([p, s]) => [p, s, BASES.rice, VEG.broccoli, VEG.cabbage, EXTRAS.ginger],
    tags: ['dinner', 'quick', 'high-protein'],
    steps: ([p, s]) => [
      { text: 'Rinse and cook the rice; steam the greens above it.', timerMins: 12 },
      { text: `Sear the ${low(p.name)} until just cooked.`, timerMins: 6 },
      { text: `Add the ${low(s.name)} and let it bubble to a shine.`, timerMins: 2 },
      { text: 'Build the bowl and spoon the pan juices over.' },
    ],
  }),
  T({
    meal: 'dinner', take: 15, emoji: '🌮', cuisine: 'Mexican', time: 20, prep: 10,
    axes: [
      pick(PROTEINS, ['chicken', 'beef', 'blackbeans', 'prawns', 'tofu']),
      pick(SAUCES, ['salsa', 'chimichurri', 'harissa']),
    ],
    name: ([p, s]) => `${p.name} tacos with ${low(s.name)}`,
    parts: ([p, s]) => [p, s, BASES.tortilla, VEG.cabbage, VEG.tomatoes, EXTRAS.lemon],
    tags: ['dinner', 'quick', 'family'],
    steps: ([p, s]) => [
      { text: `Season and cook the ${low(p.name)} hard and fast.`, timerMins: 8 },
      { text: 'Shred the cabbage and dress it with lime.' },
      { text: `Warm the tortillas, then build with the ${low(s.name)}.` },
    ],
  }),
  T({
    meal: 'dinner', take: 20, emoji: '🍲', cuisine: 'British', time: 50, prep: 15,
    axes: [
      pick(PROTEINS, ['lamb', 'beef', 'thigh', 'butterbeans', 'lentils']),
      pick(VEG, ['carrots', 'leek', 'mushrooms', 'peas']),
    ],
    name: ([p, v]) => `Slow ${low(p.name)} & ${low(v.name)} stew`,
    parts: ([p, v]) => [p, v, BASES.potato, SAUCES.gravy, EXTRAS.onion, EXTRAS.stock],
    tags: ['dinner', 'batch', 'one-pot', 'comfort', 'freezer'],
    steps: ([p, v]) => [
      { text: `Brown the ${low(p.name)} in batches and set aside.`, timerMins: 8 },
      { text: 'Soften the onion and vegetables in the same pan.', timerMins: 8 },
      { text: 'Return everything with the stock and gravy, then simmer.', timerMins: 35 },
      { text: 'Season and serve with the potatoes.' },
    ],
  }),
  T({
    meal: 'dinner', take: 20, emoji: '🍄', cuisine: 'Italian', time: 35, prep: 10,
    axes: [
      pick(VEG, ['mushrooms', 'asparagus', 'peas', 'butternut', 'courgette']),
      pick(PROTEINS, ['chicken', 'prawns', 'feta', 'halloumi']),
    ],
    name: ([v, p]) => `${v.name} risotto with ${low(p.name)}`,
    parts: ([v, p]) => [BASES.rice, v, p, EXTRAS.stock, EXTRAS.onion, EXTRAS.parmesan],
    tags: ['dinner', 'comfort', 'one-pot'],
    steps: ([v, p]) => [
      { text: `Fry the ${low(v.name)} hard until golden; set aside.`, timerMins: 6 },
      { text: 'Soften the onion, then toast the rice for a minute.', timerMins: 4 },
      { text: 'Add hot stock a ladle at a time, stirring, until creamy.', timerMins: 18 },
      { text: `Beat in the parmesan and fold through the ${low(p.name)}.` },
    ],
  }),
  T({
    meal: 'dinner', take: 20, emoji: '🍜', cuisine: 'Japanese', time: 25, prep: 10,
    axes: [
      pick(PROTEINS, ['chicken', 'prawns', 'tofu', 'pork', 'eggs']),
      pick(VEG, ['cabbage', 'mushrooms', 'greenbeans', 'spinach']),
    ],
    name: ([p, v]) => `${p.name} & ${low(v.name)} ramen`,
    parts: ([p, v]) => [p, v, BASES.ricenoodles, EXTRAS.stock, SAUCES.soy, EXTRAS.ginger],
    tags: ['dinner', 'quick', 'one-pot'],
    steps: ([p, v]) => [
      { text: 'Bring the stock, soy and ginger to a gentle simmer.', timerMins: 8 },
      { text: `Poach the ${low(p.name)} in the broth until cooked.`, timerMins: 6 },
      { text: 'Add the noodles and greens for the last two minutes.', timerMins: 2 },
      { text: 'Ladle into deep bowls and serve immediately.' },
    ],
  }),
];

/* ---------- Generation ---------- */

/**
 * Walk the cartesian product diagonally rather than odometer-style, so the
 * first dishes out of a template vary every axis — ten berry variants in a row
 * is a worse list than berries, banana, apple with different toppings.
 */
const combos = (axes) => {
  const indexes = axes.reduce(
    (acc, axis) => acc.flatMap((prefix) => axis.map((_, i) => [...prefix, i])),
    [[]],
  );
  const weight = (tuple) => tuple.reduce((sum, i) => sum + i, 0);
  return indexes
    .sort((a, b) => weight(a) - weight(b) || a.join().localeCompare(b.join()))
    .map((tuple) => tuple.map((i, axis) => axes[axis][i]));
};

/** How many dishes each meal gets. */
export const PER_MEAL = 200;

const buildOne = (tpl, combo) => {
  const name = sentence(tpl.name(combo));
  const parts = tpl.parts(combo);
  const servings = tpl.meal === 'dinner' ? 2 : 1;
  const n = compose(parts, servings);
  const tags = [...new Set([
    ...tpl.tags,
    ...dietTags(parts),
    ...(tpl.time <= 25 ? ['quick'] : []),
    ...(n.protein >= 30 ? ['high-protein'] : []),
    ...(n.costPerServing <= 1.5 ? ['budget'] : []),
    ...(n.kcal <= 450 ? ['light'] : []),
  ])];

  return {
    id: slug(name),
    name,
    emoji: tpl.emoji,
    meal: tpl.meal,
    cuisine: tpl.cuisine,
    tags,
    time: tpl.time,
    prep: tpl.prep,
    difficulty: tpl.time <= 20 ? 'Easy' : tpl.time <= 40 ? 'Medium' : 'Easy',
    servings,
    ...n,
    ...scores(parts, n),
    steps: tpl.steps(combo),
  };
};

/**
 * Fill each meal to its quota, cycling the templates so a meal is a spread of
 * dish types rather than 200 variations of the first one. Names are unique.
 */
export const generateRecipes = (perMeal = PER_MEAL) => {
  const out = [];
  const seen = new Set();

  for (const meal of ['breakfast', 'lunch', 'dinner']) {
    const queues = TEMPLATES
      .filter((t) => t.meal === meal)
      .map((tpl) => ({ tpl, rows: combos(tpl.axes), i: 0 }));

    let made = 0;
    let exhausted = false;
    while (made < perMeal && !exhausted) {
      exhausted = true;
      for (const q of queues) {
        if (made >= perMeal) break;
        // One dish per template per pass, skipping names already taken.
        while (q.i < q.rows.length) {
          const recipe = buildOne(q.tpl, q.rows[q.i]);
          q.i += 1;
          if (seen.has(recipe.id)) continue;
          seen.add(recipe.id);
          out.push(recipe);
          made += 1;
          exhausted = false;
          break;
        }
      }
    }
  }
  return out;
};

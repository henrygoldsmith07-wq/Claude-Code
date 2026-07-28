/**
 * Recipe templates: the shapes a dish can take.
 *
 * A template names the component axes it varies over and how to word the
 * result. The generator in `recipe-gen.js` walks those axes; nothing here
 * invents a number — every figure a dish ends up with is computed from the
 * components in `recipe-parts.js`.
 */

import {
  BASES, BREAKFAST_BASES, EXTRAS, FRUITS, PROTEINS, SAUCES, TOPPINGS, VEG,
} from './recipe-parts.js';

const low = (s) => s.toLowerCase();
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

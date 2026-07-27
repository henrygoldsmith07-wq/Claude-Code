/**
 * Store profiles, the current shopping list, and price-intelligence history.
 * Price history arrays are pence-per-unit over the last 12 weeks (oldest first).
 */
export const STORES = [
  {
    id: 'tesco', name: 'Tesco', tone: '#2a78d6', initial: 'T',
    basketIndex: 100, rating: 4.2, loyalty: 'Clubcard', points: 482,
    hours: '6am – midnight', delivery: 'Today from 4pm',
    offers: [
      { item: 'Chicken thighs 1kg', deal: 'Clubcard £3.50', was: 4.75 },
      { item: 'Pasta 500g', deal: '3 for £2', was: 2.85 },
      { item: 'Berries 300g', deal: '½ price £1.75', was: 3.5 },
    ],
  },
  {
    id: 'aldi', name: 'Aldi', tone: '#1baf7a', initial: 'A',
    basketIndex: 82, rating: 4.5, loyalty: null, points: 0,
    hours: '8am – 10pm', delivery: 'Click & collect',
    offers: [
      { item: 'Super 6 veg', deal: 'From 39p', was: null },
      { item: 'Beef mince 500g', deal: '£2.89', was: 3.29 },
    ],
  },
  {
    id: 'sainsburys', name: "Sainsbury's", tone: '#eb6834', initial: 'S',
    basketIndex: 104, rating: 4.1, loyalty: 'Nectar', points: 1210,
    hours: '7am – 11pm', delivery: 'Tomorrow 8am',
    offers: [
      { item: 'Salmon 2 fillets', deal: 'Nectar £3.75', was: 4.5 },
      { item: 'Halloumi 225g', deal: '2 for £4', was: 5.0 },
    ],
  },
  {
    id: 'lidl', name: 'Lidl', tone: '#eda100', initial: 'L',
    basketIndex: 83, rating: 4.4, loyalty: 'Lidl Plus', points: 96,
    hours: '8am – 10pm', delivery: 'In store only',
    offers: [
      { item: 'Bakery croissant', deal: '49p', was: 0.65 },
      { item: 'Greek yogurt 1kg', deal: '£1.65', was: 1.95 },
    ],
  },
  {
    id: 'asda', name: 'Asda', tone: '#4a3aa7', initial: 'a',
    basketIndex: 91, rating: 4.0, loyalty: 'Rewards', points: 310,
    hours: '7am – 11pm', delivery: 'Tomorrow 10am',
    offers: [
      { item: 'Rice 5kg', deal: 'Rollback £5.48', was: 6.75 },
      { item: 'Stir-fry veg', deal: '2 for £3', was: 3.6 },
    ],
  },
];

/** This week's shopping list, grouped by aisle in walking order. */
export const RECIPE_AISLE = 'From recipes';
export const AISLE_ORDER = ['Fruit & veg', 'Bakery', 'Meat & fish', 'Dairy & eggs', 'World foods', 'Tins & dry', 'Frozen', 'Household', RECIPE_AISLE];

export const SHOPPING_LIST = [
  { id: 's1', name: 'Lemons', emoji: '🍋', aisle: 'Fruit & veg', qty: '2', price: 0.6, cheapest: 'Aldi', alt: { store: 'Tesco', price: 0.75 } },
  { id: 's2', name: 'Peppers', emoji: '🫑', aisle: 'Fruit & veg', qty: '3 pack', price: 1.45, cheapest: 'Lidl', alt: { store: 'Tesco', price: 1.75 }, sale: true },
  { id: 's3', name: 'Spinach', emoji: '🥬', aisle: 'Fruit & veg', qty: '240g', price: 1.15, cheapest: 'Aldi', alt: { store: "Sainsbury's", price: 1.5 } },
  { id: 's4', name: 'Bananas', emoji: '🍌', aisle: 'Fruit & veg', qty: '6', price: 0.85, cheapest: 'Aldi', alt: { store: 'Asda', price: 0.9 } },
  { id: 's5', name: 'Ginger', emoji: '🫚', aisle: 'Fruit & veg', qty: '1 root', price: 0.55, cheapest: 'Lidl', alt: { store: 'Tesco', price: 0.7 } },
  { id: 's6', name: 'Sourdough loaf', emoji: '🍞', aisle: 'Bakery', qty: '1', price: 2.35, cheapest: 'Lidl', alt: { store: "Sainsbury's", price: 3.2 } },
  { id: 's7', name: 'Chicken breast', emoji: '🍗', aisle: 'Meat & fish', qty: '500g', price: 3.35, cheapest: 'Aldi', alt: { store: 'Tesco', price: 3.85 } },
  { id: 's8', name: 'Salmon fillets', emoji: '🐟', aisle: 'Meat & fish', qty: '2', price: 3.75, cheapest: "Sainsbury's", alt: { store: 'Tesco', price: 4.25 }, sale: true },
  { id: 's9', name: 'Whole milk', emoji: '🥛', aisle: 'Dairy & eggs', qty: '2L', price: 1.45, cheapest: 'Aldi', alt: { store: 'Tesco', price: 1.45 } },
  { id: 's10', name: 'Halloumi', emoji: '🧀', aisle: 'Dairy & eggs', qty: '225g', price: 2.0, cheapest: "Sainsbury's", alt: { store: 'Lidl', price: 2.19 }, sale: true },
  { id: 's11', name: 'Soured cream', emoji: '🥣', aisle: 'Dairy & eggs', qty: '150ml', price: 0.95, cheapest: 'Asda', alt: { store: 'Tesco', price: 1.1 } },
  { id: 's12', name: 'Tofu (firm)', emoji: '⬜', aisle: 'World foods', qty: '280g', price: 1.75, cheapest: 'Asda', alt: { store: "Sainsbury's", price: 2.3 } },
  { id: 's13', name: 'Curry paste', emoji: '🥫', aisle: 'World foods', qty: '1 jar', price: 1.85, cheapest: 'Asda', alt: { store: 'Tesco', price: 2.2 } },
  { id: 's14', name: 'Soy sauce', emoji: '🍶', aisle: 'World foods', qty: '150ml', price: 1.55, cheapest: 'Aldi', alt: { store: 'Tesco', price: 1.9 } },
  { id: 's15', name: 'Chopped tomatoes', emoji: '🥫', aisle: 'Tins & dry', qty: '4 tins', price: 1.8, cheapest: 'Aldi', alt: { store: 'Asda', price: 2.0 } },
  { id: 's16', name: 'Arborio rice', emoji: '🍚', aisle: 'Tins & dry', qty: '500g', price: 1.95, cheapest: 'Lidl', alt: { store: "Sainsbury's", price: 2.5 } },
  { id: 's17', name: 'Stir-fry veg mix', emoji: '🥦', aisle: 'Frozen', qty: '640g', price: 1.5, cheapest: 'Asda', alt: { store: 'Tesco', price: 1.8 }, sale: true },
  { id: 's18', name: 'Washing-up liquid', emoji: '🧴', aisle: 'Household', qty: '1', price: 1.1, cheapest: 'Aldi', alt: { store: 'Tesco', price: 1.4 } },
];

export const fullList = (extras = []) => [...SHOPPING_LIST, ...extras];
export const totalOf = (items) => items.reduce((s, i) => s + i.price, 0);
export const checkedTotalOf = (items, checked) =>
  items.filter((i) => checked.includes(i.id)).reduce((s, i) => s + i.price, 0);

/** Turn recipes' missing (non-pantry) ingredients into shopping items with a rough price estimate. */
export const itemsFromRecipes = (recipes) => {
  const seen = new Set();
  const out = [];
  for (const r of recipes) {
    const perItem = Math.max(0.4, (r.costPerServing * r.servings) / r.ingredients.length);
    for (const ing of r.ingredients) {
      if (ing.pantry || seen.has(ing.name.toLowerCase())) continue;
      seen.add(ing.name.toLowerCase());
      out.push({
        id: `x-${ing.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name: ing.name,
        emoji: r.emoji,
        aisle: RECIPE_AISLE,
        qty: ing.qty,
        price: Math.round(perItem * 100) / 100,
        cheapest: 'Aldi',
      });
    }
  }
  return out;
};

/** 12 weeks of prices (pence) for tracked staples + AI buy/wait advice. */
export const PRICE_HISTORY = [
  {
    id: 'milk', name: 'Milk (2L)', emoji: '🥛', unit: 'p',
    points: [149, 149, 152, 155, 155, 152, 149, 147, 145, 145, 145, 143],
    advice: { verdict: 'buy', text: 'Near a 6-month low — stock up if you can freeze it.' },
  },
  {
    id: 'chicken', name: 'Chicken breast (kg)', emoji: '🍗', unit: 'p',
    points: [619, 625, 640, 655, 670, 682, 690, 699, 705, 712, 718, 725],
    advice: { verdict: 'wait', text: 'Rising 5 weeks straight. Aldi drops thigh prices next week — wait.' },
  },
  {
    id: 'eggs', name: 'Eggs (dozen)', emoji: '🥚', unit: 'p',
    points: [310, 305, 298, 296, 290, 288, 285, 282, 280, 278, 275, 272],
    advice: { verdict: 'buy', text: 'Lowest price in six months — buy extra, they keep 3+ weeks.' },
  },
  {
    id: 'rice', name: 'Rice (1kg)', emoji: '🍚', unit: 'p',
    points: [165, 165, 168, 172, 178, 185, 182, 179, 176, 174, 172, 170],
    advice: { verdict: 'hold', text: 'Drifting down from the spring spike. No rush either way.' },
  },
  {
    id: 'pasta', name: 'Pasta (500g)', emoji: '🍝', unit: 'p',
    points: [95, 95, 92, 90, 89, 88, 90, 92, 95, 99, 104, 108],
    advice: { verdict: 'wait', text: 'Tesco 3-for-£2 returns Thursday — wait two days.' },
  },
  {
    id: 'bread', name: 'Bread (800g)', emoji: '🍞', unit: 'p',
    points: [125, 128, 130, 130, 132, 135, 135, 138, 136, 134, 133, 132],
    advice: { verdict: 'hold', text: 'Stable. Freeze half a loaf to cut waste instead.' },
  },
];

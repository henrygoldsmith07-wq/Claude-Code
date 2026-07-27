/**
 * Smart pantry inventory. `expiryDays` is days from "today" so the demo
 * always has believable expiring/fresh items.
 */
export const LOCATIONS = ['Fridge', 'Freezer', 'Cupboard', 'Pantry', 'Garage', 'Wine rack'];

export const PANTRY = [
  { id: 'p1', name: 'Chicken thighs', emoji: '🍗', cat: 'Fresh', location: 'Fridge', qty: '8 pcs', cost: 4.5, store: 'Aldi', expiryDays: 2 },
  { id: 'p2', name: 'Whole milk', emoji: '🥛', cat: 'Fresh', location: 'Fridge', qty: '2L', cost: 1.45, store: 'Tesco', expiryDays: 3 },
  { id: 'p3', name: 'Greek yogurt', emoji: '🍦', cat: 'Fresh', location: 'Fridge', qty: '500g', cost: 1.85, store: 'Lidl', expiryDays: 5 },
  { id: 'p4', name: 'Eggs', emoji: '🥚', cat: 'Fresh', location: 'Fridge', qty: '9 of 12', cost: 2.4, store: 'Tesco', expiryDays: 9 },
  { id: 'p5', name: 'Cheddar', emoji: '🧀', cat: 'Fresh', location: 'Fridge', qty: '280g', cost: 3.1, store: "Sainsbury's", expiryDays: 14 },
  { id: 'p6', name: 'Spinach', emoji: '🥬', cat: 'Fresh', location: 'Fridge', qty: '120g', cost: 1.0, store: 'Aldi', expiryDays: 1 },
  { id: 'p7', name: 'Cherry tomatoes', emoji: '🍅', cat: 'Fresh', location: 'Fridge', qty: '150g', cost: 0.95, store: 'Lidl', expiryDays: 2 },
  { id: 'p8', name: 'Frozen berries', emoji: '🫐', cat: 'Frozen', location: 'Freezer', qty: '400g', cost: 2.2, store: 'Tesco', expiryDays: 120 },
  { id: 'p9', name: 'Peas', emoji: '🟢', cat: 'Frozen', location: 'Freezer', qty: '800g', cost: 1.3, store: 'Asda', expiryDays: 200 },
  { id: 'p10', name: 'Beef ragù (batch)', emoji: '🍝', cat: 'Frozen', location: 'Freezer', qty: '3 portions', cost: 6.9, store: 'Home-made', expiryDays: 60 },
  { id: 'p11', name: 'Basmati rice', emoji: '🍚', cat: 'Baking & dry', location: 'Cupboard', qty: '2.3kg', cost: 3.5, store: 'Asda', expiryDays: 400 },
  { id: 'p12', name: 'Penne', emoji: '🍜', cat: 'Baking & dry', location: 'Cupboard', qty: '900g', cost: 1.2, store: 'Aldi', expiryDays: 500 },
  { id: 'p13', name: 'Chopped tomatoes', emoji: '🥫', cat: 'Tins & jars', location: 'Cupboard', qty: '5 tins', cost: 2.75, store: 'Lidl', expiryDays: 600 },
  { id: 'p14', name: 'Chickpeas', emoji: '🥫', cat: 'Tins & jars', location: 'Cupboard', qty: '3 tins', cost: 1.8, store: 'Aldi', expiryDays: 540 },
  { id: 'p15', name: 'Coconut milk', emoji: '🥥', cat: 'Tins & jars', location: 'Cupboard', qty: '2 tins', cost: 1.9, store: 'Tesco', expiryDays: 300 },
  { id: 'p16', name: 'Olive oil', emoji: '🫒', cat: 'Sauces & oils', location: 'Cupboard', qty: '600ml', cost: 4.75, store: "Sainsbury's", expiryDays: 250 },
  { id: 'p17', name: 'Soy sauce', emoji: '🍶', cat: 'Sauces & oils', location: 'Cupboard', qty: '140ml', cost: 1.6, store: 'Asda', expiryDays: 320 },
  { id: 'p18', name: 'Smoked paprika', emoji: '🌶️', cat: 'Herbs & spices', location: 'Pantry', qty: '45g', cost: 0.9, store: 'Aldi', expiryDays: 400 },
  { id: 'p19', name: 'Cumin', emoji: '🫙', cat: 'Herbs & spices', location: 'Pantry', qty: '38g', cost: 0.9, store: 'Aldi', expiryDays: 380 },
  { id: 'p20', name: 'Oats', emoji: '🌾', cat: 'Baking & dry', location: 'Pantry', qty: '1.1kg', cost: 1.35, store: 'Lidl', expiryDays: 200 },
  { id: 'p21', name: 'Protein powder', emoji: '💪', cat: 'Supplements', location: 'Pantry', qty: '640g', cost: 18.0, store: 'Online', expiryDays: 180 },
  { id: 'p22', name: 'Sparkling water', emoji: '💧', cat: 'Drinks', location: 'Garage', qty: '9 cans', cost: 3.0, store: 'Asda', expiryDays: 365 },
  { id: 'p23', name: 'Rioja', emoji: '🍷', cat: 'Drinks', location: 'Wine rack', qty: '2 bottles', cost: 13.0, store: "Sainsbury's", expiryDays: 900 },
  { id: 'p24', name: 'Sourdough', emoji: '🍞', cat: 'Fresh', location: 'Cupboard', qty: '3/4 loaf', cost: 2.2, store: 'Bakery', expiryDays: 2 },
  { id: 'p25', name: 'Bananas', emoji: '🍌', cat: 'Fresh', location: 'Pantry', qty: '4', cost: 0.78, store: 'Tesco', expiryDays: 3 },
];

export const pantryValue = () => PANTRY.reduce((sum, p) => sum + p.cost, 0);
export const expiringSoon = () => PANTRY.filter((p) => p.expiryDays <= 3).sort((a, b) => a.expiryDays - b.expiryDays);

/** Items considered "running low" for the dashboard + auto shopping suggestions. */
export const RUNNING_LOW = [
  { name: 'Soy sauce', emoji: '🍶', left: '140ml' },
  { name: 'Cumin', emoji: '🫙', left: '38g' },
  { name: 'Eggs', emoji: '🥚', left: '9 left' },
  { name: 'Olive oil', emoji: '🫒', left: '600ml' },
];

/** Leftovers logged after cooking; surfaced on Home as "use today". */
export const LEFTOVERS = [
  { name: 'Beef ragù', emoji: '🍝', portions: 1, note: 'Fridge — eat today' },
  { name: 'Cooked rice', emoji: '🍚', portions: 2, note: 'Great for egg-fried rice' },
];

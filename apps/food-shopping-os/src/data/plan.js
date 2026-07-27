/**
 * Default weekly meal plan, gamification catalogue, analytics series,
 * and the AI-suggestion copy used across the dashboard.
 */
export const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** recipe ids per day; null = eating out / leftovers */
export const DEFAULT_PLAN = {
  Mon: { breakfast: 'overnight-oats', lunch: 'halloumi-grain', dinner: 'chicken-traybake' },
  Tue: { breakfast: 'protein-pancakes', lunch: null, dinner: 'chickpea-curry' },
  Wed: { breakfast: 'overnight-oats', lunch: 'shakshuka', dinner: 'salmon-teriyaki' },
  Thu: { breakfast: 'overnight-oats', lunch: 'halloumi-grain', dinner: 'airfryer-fajitas' },
  Fri: { breakfast: 'protein-pancakes', lunch: null, dinner: 'katsu-curry' },
  Sat: { breakfast: 'shakshuka', lunch: 'tofu-stirfry', dinner: 'slowcooker-ragu' },
  Sun: { breakfast: null, lunch: 'mushroom-risotto', dinner: 'veg-chilli' },
};

/** Sunday batch-cook checklist; "done" derives from defaults ∪ recipes actually cooked. */
export const PREP_BATCH = [
  { id: 'slowcooker-ragu', name: 'Ragù' },
  { id: 'veg-chilli', name: 'Chilli' },
  { id: 'overnight-oats', name: 'Overnight oats' },
  { id: 'chickpea-curry', name: 'Curry base' },
  { id: 'airfryer-fajitas', name: 'Fajita mix' },
];
export const PREP_DEFAULT_DONE = ['slowcooker-ragu', 'veg-chilli', 'overnight-oats'];

export const PLANNER_GOALS = ['Balanced', 'Weight loss', 'Muscle gain', 'Family friendly', 'Sustainable'];
export const PLANNER_DIETS = ['None', 'Vegetarian', 'Vegan', 'Dairy-free', 'Gluten-free', 'Halal'];
export const PLANNER_SCOPES = ['1 meal', 'A day', 'A week'];
export const PLANNER_OCCASIONS = ['Everyday', 'Meal prep', 'Date night', 'Party', 'BBQ', 'Camping', 'Student'];

export const BADGES = [
  { id: 'first-cook', emoji: '🍳', name: 'First Flame', desc: 'Cook your first recipe', earned: true },
  { id: 'streak-7', emoji: '🔥', name: 'Week of Fire', desc: '7-day cooking streak', earned: true },
  { id: 'budget-4', emoji: '💷', name: 'Budget Boss', desc: '4 weeks under budget', earned: true },
  { id: 'no-waste', emoji: '♻️', name: 'Zero Hero', desc: 'A week with no food waste', earned: true },
  { id: 'world-tour', emoji: '🌍', name: 'World Tour', desc: 'Cook 6 different cuisines', earned: false, progress: 4, of: 6 },
  { id: 'batch-king', emoji: '🧊', name: 'Batch Chef', desc: 'Freeze 10 batch portions', earned: false, progress: 7, of: 10 },
  { id: 'green-plate', emoji: '🌱', name: 'Green Plate', desc: '10 plant-based dinners', earned: false, progress: 6, of: 10 },
  { id: 'master-chef', emoji: '👨‍🍳', name: 'Master Chef', desc: 'Reach level 20', earned: false, progress: 8, of: 20 },
];

export const WEEKLY_CHALLENGE = {
  emoji: '🥕',
  name: 'Root Veg Week',
  desc: 'Cook 3 meals starring root vegetables',
  progress: 2,
  of: 3,
  reward: 150,
};

/** Monthly grocery spend, last 6 months (July = current, in progress). */
export const SPEND_HISTORY = [
  { month: 'Feb', spend: 342 },
  { month: 'Mar', spend: 318 },
  { month: 'Apr', spend: 301 },
  { month: 'May', spend: 296 },
  { month: 'Jun', spend: 274 },
  { month: 'Jul', spend: 187 },
];

/** kcal eaten per day this week (today = index 6 so far). */
export const KCAL_WEEK = [1980, 2150, 1875, 2050, 2210, 1930, 1240];

export const CUISINE_SPLIT = [
  { name: 'Italian', pct: 26 },
  { name: 'Indian', pct: 21 },
  { name: 'British', pct: 18 },
  { name: 'Mexican', pct: 14 },
  { name: 'Japanese', pct: 12 },
  { name: 'Other', pct: 9 },
];

export const ANALYTICS_STATS = [
  { label: 'Avg meal cost', value: '£1.72', sub: 'down 14% vs June' },
  { label: 'Money saved', value: '£38.40', sub: 'this month, via swaps & offers' },
  { label: 'Food waste', value: '210g', sub: 'last week — best ever' },
  { label: 'Carbon footprint', value: '31kg CO₂e', sub: '18% below UK average' },
];

export const AI_SUGGESTIONS = [
  { emoji: '🌦️', title: 'Rainy Tuesday calls for comfort', text: 'It’s 14°C and wet — your Garlic Mushroom Risotto fits and you have 6 of 7 ingredients.', recipeId: 'mushroom-risotto' },
  { emoji: '🍓', title: 'Strawberries are in season', text: 'British strawberries are at their cheapest right now — 40% below January prices.' },
  { emoji: '👧', title: 'Family request', text: 'Maya asked for fajitas again — they’re planned for Thursday and everything is on your list.', recipeId: 'airfryer-fajitas' },
  { emoji: '🥬', title: 'Use your spinach today', text: 'It expires tomorrow. Coconut Chickpea Curry would use the whole bag.', recipeId: 'chickpea-curry' },
];

export const INTEGRATIONS = [
  { emoji: '🛒', name: 'Tesco delivery', desc: 'Send your list to a basket', on: true },
  { emoji: '⌚', name: 'Fitness tracker', desc: 'Sync calories burned', on: true },
  { emoji: '🧊', name: 'Smart fridge', desc: 'Auto-update pantry', on: false },
  { emoji: '🗓️', name: 'Calendar', desc: 'Plan around busy evenings', on: true },
  { emoji: '🗣️', name: 'Voice assistant', desc: '“Add milk to my list”', on: false },
  { emoji: '⚖️', name: 'Smart scales', desc: 'Log portions automatically', on: false },
];

/**
 * Everything the app derives from what you actually did: pantry freshness,
 * what a shop cost, how prices moved, what the week's plan looks like, and
 * which achievements you've genuinely earned.
 *
 * No figure in the app is stored twice — each one is computed here from the
 * pantry, the shopping list, recorded shops, the plan and the food diary.
 */

import { RECIPES } from '../data/recipes.js';
import { BADGES } from '../data/plan.js';

export const dayStamp = (date = new Date()) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

const DAY_MS = 86400000;

export const addDays = (stamp, n) => dayStamp(new Date(`${stamp}T12:00:00`).getTime() + n * DAY_MS);

/** Days from today until a date; negative once it's in the past. */
export const daysUntil = (stamp, today = dayStamp()) =>
  stamp ? Math.round((new Date(`${stamp}T12:00:00`) - new Date(`${today}T12:00:00`)) / DAY_MS) : null;

/** Monday-first week containing `stamp`. */
export const weekStart = (stamp = dayStamp()) => {
  const d = new Date(`${stamp}T12:00:00`);
  const shift = (d.getDay() + 6) % 7; // Sunday = 6
  return dayStamp(d.getTime() - shift * DAY_MS);
};

export const weekDates = (stamp = dayStamp()) => {
  const start = weekStart(stamp);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
};

/* ---------- Pantry ---------- */

export const pantryValue = (pantry = []) =>
  Math.round(pantry.reduce((sum, p) => sum + (Number(p.cost) || 0), 0) * 100) / 100;

/** Items with an expiry date, soonest first — the ones worth cooking next. */
export const expiringSoon = (pantry = [], within = 3, today = dayStamp()) =>
  pantry
    .filter((p) => p.expiry && daysUntil(p.expiry, today) <= within)
    .sort((a, b) => daysUntil(a.expiry, today) - daysUntil(b.expiry, today));

export const runningLow = (pantry = []) => pantry.filter((p) => p.low);

export const leftovers = (pantry = []) => pantry.filter((p) => p.cat === 'Leftovers');

const money = (value) => Math.round(value * 100) / 100;

const groupedInventory = (pantry, field, fallback) => {
  const groups = new Map();
  pantry.forEach((item) => {
    const label = String(item[field] || fallback);
    const row = groups.get(label) || { label, count: 0, value: 0 };
    row.count += 1;
    row.value += Number(item.cost) || 0;
    groups.set(label, row);
  });
  return [...groups.values()]
    .map((row) => ({ ...row, value: money(row.value) }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
};

/** A live pantry summary; all figures are derived from inventory rows. */
export const pantryAnalytics = (pantry = [], today = dayStamp()) => ({
  total: pantry.length,
  value: pantryValue(pantry),
  dated: pantry.filter((item) => item.expiry).length,
  useSoon: expiringSoon(pantry, 3, today).length,
  low: runningLow(pantry).length,
  byLocation: groupedInventory(pantry, 'location', 'Unassigned'),
  byCategory: groupedInventory(pantry, 'cat', 'Other'),
});

const inventoryName = (value) => String(value || '')
  .trim().toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ');

/**
 * Remove stocked rows used by a completed recipe. A row is an inventory unit,
 * so matching consumes that row; quantities are deliberately not guessed from
 * free-text amounts such as "half a bag".
 */
export const consumePantryIngredients = (pantry = [], ingredients = []) => {
  const remaining = [...pantry];
  const used = [];
  ingredients.forEach((ingredient) => {
    const wanted = inventoryName(ingredient.name);
    if (!wanted) return;
    const index = remaining.findIndex((item) => {
      const stocked = inventoryName(item.name);
      return stocked === wanted
        || (Math.min(stocked.length, wanted.length) >= 4 && (stocked.includes(wanted) || wanted.includes(stocked)));
    });
    if (index >= 0) used.push(...remaining.splice(index, 1));
  });
  return { pantry: remaining, used };
};

const encodeUtf8 = (value) => btoa(unescape(encodeURIComponent(value)));
const decodeUtf8 = (value) => decodeURIComponent(escape(atob(value)));

/** Portable snapshot generated locally for the user to send without an upload. */
export const pantryShareCode = (pantry = []) =>
  `FORQ-PANTRY-1.${encodeUtf8(JSON.stringify(pantry.map((item) => ({
    name: String(item.name || '').trim(),
    emoji: item.emoji || '',
    qty: String(item.qty || ''),
    cost: Number(item.cost) || 0,
    location: String(item.location || 'Pantry'),
    cat: String(item.cat || 'Other'),
    store: String(item.store || ''),
    expiry: item.expiry || null,
    low: Boolean(item.low),
  }))))}`;

export const pantryFromShareCode = (code) => {
  try {
    const text = String(code || '').trim();
    if (!text.startsWith('FORQ-PANTRY-1.')) throw new Error();
    const rows = JSON.parse(decodeUtf8(text.slice('FORQ-PANTRY-1.'.length)));
    if (!Array.isArray(rows) || rows.length > 500 || rows.some((item) => !item || typeof item.name !== 'string')) throw new Error();
    return rows.filter((item) => item.name.trim()).map((item) => ({
      ...item,
      name: item.name.trim().slice(0, 120),
      qty: String(item.qty || '').slice(0, 60),
      cost: Math.max(0, Number(item.cost) || 0),
      expiry: /^\d{4}-\d{2}-\d{2}$/.test(item.expiry || '') ? item.expiry : null,
      low: Boolean(item.low),
    }));
  } catch {
    throw new Error('That pantry code is invalid or damaged.');
  }
};

/** Recipes that use something about to go off, best match first. */
export const recipesUsing = (pantry = [], limit = 3, today = dayStamp()) => {
  const names = expiringSoon(pantry, 3, today).map((p) => p.name.toLowerCase());
  if (!names.length) return [];
  return RECIPES
    .map((r) => ({
      recipe: r,
      hits: r.ingredients.filter((i) => names.some((n) => i.name.toLowerCase().includes(n) || n.includes(i.name.toLowerCase()))).length,
    }))
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, limit);
};

/* ---------- Shops and spending ---------- */

export const shopsInWeek = (shops = [], stamp = dayStamp()) => {
  const start = weekStart(stamp);
  const end = addDays(start, 7);
  return shops.filter((s) => s.date >= start && s.date < end);
};

export const spentInWeek = (shops = [], stamp = dayStamp()) =>
  Math.round(shopsInWeek(shops, stamp).reduce((sum, s) => sum + (Number(s.total) || 0), 0) * 100) / 100;

export const spentInMonth = (shops = [], stamp = dayStamp()) => {
  const month = String(stamp).slice(0, 7);
  return Math.round(
    shops.filter((shop) => String(shop.date).slice(0, 7) === month)
      .reduce((sum, shop) => sum + (Number(shop.total) || 0), 0) * 100,
  ) / 100;
};

/** Monthly totals, oldest first — the profile's spending chart. */
export const spendByMonth = (shops = [], months = 6, today = dayStamp()) => {
  const out = [];
  const base = new Date(`${today}T12:00:00`);
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const spend = shops
      .filter((s) => s.date.slice(0, 7) === key)
      .reduce((sum, s) => sum + (Number(s.total) || 0), 0);
    out.push({ key, label: d.toLocaleDateString('en-GB', { month: 'short' }), spend: Math.round(spend * 100) / 100 });
  }
  return out;
};

/** Weeks (most recent first) where recorded spend stayed inside the budget. */
export const budgetWeeks = (shops = [], weeklyBudget = 0, today = dayStamp()) => {
  if (!weeklyBudget) return 0;
  let streak = 0;
  for (let i = 1; i <= 12; i += 1) {
    const stamp = addDays(weekStart(today), -7 * i);
    const week = shopsInWeek(shops, stamp);
    if (!week.length) break;
    if (spentInWeek(shops, stamp) > weeklyBudget) break;
    streak += 1;
  }
  return streak;
};

/**
 * What you have actually paid for a thing, over time. Only names bought more
 * than once show a trend — everything else is a single data point, and says so.
 */
export const priceHistory = (shops = []) => {
  const byName = new Map();
  for (const shop of [...shops].sort((a, b) => a.date.localeCompare(b.date))) {
    for (const item of shop.items || []) {
      const price = Number(item.price) || 0;
      if (!price) continue;
      const key = item.name.trim().toLowerCase();
      if (!byName.has(key)) byName.set(key, { name: item.name.trim(), emoji: item.emoji, points: [] });
      byName.get(key).points.push({ date: shop.date, price, store: shop.store });
    }
  }
  return [...byName.values()]
    .map((entry) => {
      const prices = entry.points.map((p) => p.price);
      const latest = prices[prices.length - 1];
      const previous = prices.length > 1 ? prices[prices.length - 2] : null;
      const best = Math.min(...prices);
      return {
        ...entry,
        prices,
        latest,
        previous,
        change: previous === null ? null : Math.round((latest - previous) * 100) / 100,
        best,
        bestStore: entry.points.find((p) => p.price === best)?.store || null,
        times: prices.length,
      };
    })
    .sort((a, b) => b.times - a.times || a.name.localeCompare(b.name));
};

/** Like-for-like movement across products bought at least twice. */
export const groceryInflation = (shops = []) => {
  const comparable = priceHistory(shops).filter((item) => item.points.length > 1);
  const baseline = Math.round(comparable.reduce((sum, item) => sum + item.points[0].price, 0) * 100) / 100;
  const current = Math.round(comparable.reduce((sum, item) => sum + item.latest, 0) * 100) / 100;
  return {
    items: comparable.length,
    baseline,
    current,
    change: Math.round((current - baseline) * 100) / 100,
    percent: baseline ? Math.round(((current - baseline) / baseline) * 1000) / 10 : null,
  };
};

export const savingsSummary = (shops = []) => ({
  saved: Math.round(shops.reduce((sum, shop) => sum + (Number(shop.saved) || 0), 0) * 100) / 100,
  trips: shops.filter((shop) => Number(shop.saved) > 0).length,
});

/* ---------- Plan ---------- */

export const planForDay = (plan = {}, stamp = dayStamp()) => plan[stamp] || {};

export const planCost = (slots = {}) =>
  Math.round(
    Object.values(slots)
      .map((id) => RECIPES.find((r) => r.id === id))
      .filter(Boolean)
      .reduce((sum, r) => sum + r.costPerServing, 0) * 100,
  ) / 100;

export const plannedMeals = (plan = {}) =>
  Object.values(plan).reduce((n, slots) => n + Object.values(slots).filter(Boolean).length, 0);

/* ---------- Achievements ---------- */

export const levelFrom = (xp, per = 160) => Math.floor(Math.max(0, xp) / per) + 1;

/**
 * Consecutive days ending today (or yesterday, so an evening cook still counts
 * tomorrow morning) — used for both the cooking streak and logging streaks.
 */
export const streakFrom = (days = [], today = dayStamp()) => {
  const set = new Set(days);
  let cursor = set.has(today) ? today : addDays(today, -1);
  if (!set.has(cursor)) return 0;
  let streak = 0;
  while (set.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
};

const PLANT_TAGS = ['vegan', 'vegetarian'];

/** Real counters behind the badges. */
export const kitchenStats = (
  { cooked = [], log = {}, shops = [], weeklyBudget = 0, xp = 0, plan = {}, myRecipes = [] },
  today = dayStamp(),
) => {
  const recipes = cooked.map((c) => RECIPES.find((r) => r.id === c.recipeId)).filter(Boolean);
  return {
    recipesCooked: cooked.length,
    cuisines: new Set(recipes.map((r) => r.cuisine)).size,
    plantMeals: recipes.filter((r) => r.tags.some((t) => PLANT_TAGS.includes(t))).length,
    streak: streakFrom(cooked.map((c) => c.date), today),
    loggedDays: Object.values(log).filter((entries) => entries.length).length,
    budgetWeeks: budgetWeeks(shops, weeklyBudget, today),
    level: levelFrom(xp),
    shops: shops.length,
    plannedMeals: Object.values(plan).reduce((n, day) => n + Object.keys(day).length, 0),
    ownRecipes: myRecipes.length,
    entriesLogged: Object.values(log).reduce((n, day) => n + day.length, 0),
  };
};

export const badgeProgress = (stats) =>
  BADGES.map((b) => {
    const progress = Math.min(stats[b.metric] || 0, b.of);
    return { ...b, progress, earned: progress >= b.of };
  });

/** Which cuisines you actually cook, as a share of everything cooked. */
export const cuisineSplit = (cooked = []) => {
  const counts = new Map();
  for (const entry of cooked) {
    const recipe = RECIPES.find((r) => r.id === entry.recipeId);
    if (!recipe) continue;
    counts.set(recipe.cuisine, (counts.get(recipe.cuisine) || 0) + 1);
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  if (!total) return [];
  return [...counts.entries()]
    .map(([name, n]) => ({ name, count: n, pct: Math.round((n / total) * 100) }))
    .sort((a, b) => b.count - a.count);
};

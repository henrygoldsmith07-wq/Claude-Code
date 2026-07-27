import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { INTEGRATIONS } from '../data/plan.js';
import { CATALOGUE } from '../data/foods.js';
import { seedLog, SEED_TEMPLATES } from '../data/log-seed.js';
import { buildEntry, copyEntries, dayTotals, recipeAsFood } from './nutrition.js';

const KEY = 'forq-state-v1';

/* ---------- Pure helpers (exported for tests) ---------- */
export const XP_PER_LEVEL = 160;
export const levelFromXp = (xp) => Math.floor(Math.max(0, xp) / XP_PER_LEVEL) + 1;
export const xpIntoLevel = (xp) => Math.max(0, xp) % XP_PER_LEVEL;

export const todayStamp = () => new Date().toISOString().slice(0, 10);

/**
 * New calendar day → zero the daily trackers, keep everything long-lived.
 * Nutrition needs no resetting: it is derived from `log[day]`, so a new day
 * simply starts with an empty diary.
 */
export const rolloverDay = (state, today = todayStamp()) =>
  state.day === today ? state : { ...state, day: today, water: 0, cookedToday: false };

/** A logged entry, re-read as a catalogue food (recents survive edits). */
export const foodFromEntry = (e) => ({
  id: e.foodId,
  name: e.name,
  brand: e.brand,
  emoji: e.emoji,
  unit: e.unit || 'g',
  per100: e.per100,
  source: 'recent',
  tags: [],
  servings: [{ label: e.servingLabel || `${e.grams} ${e.unit || 'g'}`, grams: e.grams }],
});

/** Most recently logged foods, newest first, one row per food. */
export const recentFoodsFrom = (log = {}, catalogue = CATALOGUE, limit = 24) => {
  const days = Object.keys(log).sort().reverse();
  const seen = new Map();
  for (const day of days) {
    for (const e of [...(log[day] || [])].reverse()) {
      if (!e.foodId || seen.has(e.foodId)) continue;
      const food = catalogue.find((f) => f.id === e.foodId) || (e.per100 ? foodFromEntry(e) : null);
      if (food) seen.set(e.foodId, food);
      if (seen.size >= limit) return [...seen.values()];
    }
  }
  return [...seen.values()];
};

const ACCENT_IDS = ['mono', 'forest', 'ocean', 'wine', 'honey'];

const DEFAULTS = {
  theme: 'light',
  accent: 'mono',
  name: 'Henry',
  day: todayStamp(),
  weeklyBudget: 65,
  spentBase: 41.2, // spent earlier this week, before the current trip
  water: 4,
  checked: [], // shopping list item ids ticked off
  extraItems: [], // items added from recipes/planner: {id,name,emoji,aisle,qty,price,cheapest}
  xp: 1240,
  streak: 12,
  cookedToday: false,
  budgetStreak: 4,
  wasteStreak: 2,
  cooked: [], // recipe ids completed via cooking mode
  favourites: ['salmon-teriyaki', 'slowcooker-ragu', 'chickpea-curry'],
  integrations: Object.fromEntries(INTEGRATIONS.map((i) => [i.name, i.on])),
  /* ---- food diary ---- */
  log: seedLog(), // { 'YYYY-MM-DD': entry[] }
  favouriteFoods: ['porridge-oats', 'chicken-breast', 'greek-yogurt'],
  customFoods: [],
  mealTemplates: SEED_TEMPLATES,
  kcalGoal: 2200,
  proteinGoal: 130,
  carbsGoal: 250,
  fatGoal: 75,
};

const load = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || '{}');
    const state = {
      ...DEFAULTS,
      ...stored,
      integrations: { ...DEFAULTS.integrations, ...(stored.integrations || {}) },
      log: stored.log || DEFAULTS.log,
    };
    if (!ACCENT_IDS.includes(state.accent)) state.accent = DEFAULTS.accent;
    return rolloverDay(state);
  } catch {
    return DEFAULTS;
  }
};

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, setState] = useState(load);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    document.documentElement.dataset.theme = state.theme;
    document.documentElement.dataset.accent = state.accent;
  }, [state.theme, state.accent]);

  const api = useMemo(() => {
    const set = (patch) => setState((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }));

    /** Append entries to a day's diary; +4 XP each, because logging is the habit. */
    const addEntries = (entries, date) =>
      set((s) => {
        const day = date || s.day;
        if (!entries.length) return {};
        return {
          log: { ...s.log, [day]: [...(s.log[day] || []), ...entries] },
          xp: s.xp + 4 * entries.length,
        };
      });

    return {
      set,
      toggleTheme: () => set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),
      setAccent: (accent) => set({ accent }),
      addWater: (d) => set((s) => ({ water: Math.max(0, Math.min(8, s.water + d)) })),
      toggleChecked: (id) =>
        set((s) => ({
          checked: s.checked.includes(id) ? s.checked.filter((x) => x !== id) : [...s.checked, id],
        })),
      toggleFavourite: (id) =>
        set((s) => ({
          favourites: s.favourites.includes(id)
            ? s.favourites.filter((x) => x !== id)
            : [...s.favourites, id],
        })),
      toggleIntegration: (name) =>
        set((s) => ({ integrations: { ...s.integrations, [name]: !s.integrations[name] } })),
      /** Append shopping items, skipping names already on the list. */
      addToList: (items) =>
        set((s) => {
          const have = new Set(s.extraItems.map((i) => i.name.toLowerCase()));
          const fresh = items.filter((i) => !have.has(i.name.toLowerCase()));
          return fresh.length ? { extraItems: [...s.extraItems, ...fresh] } : {};
        }),

      /* ---------- Food diary ---------- */
      logEntries: addEntries,
      logEntry: (entry, date) => addEntries([entry], date),
      updateEntry: (id, patch, date) =>
        set((s) => {
          const day = date || s.day;
          return {
            log: {
              ...s.log,
              [day]: (s.log[day] || []).map((e) => (e.id === id ? { ...e, ...patch } : e)),
            },
          };
        }),
      removeEntry: (id, date) =>
        set((s) => {
          const day = date || s.day;
          return { log: { ...s.log, [day]: (s.log[day] || []).filter((e) => e.id !== id) } };
        }),
      /** Copy a past meal onto today (or any other day/slot). */
      copyMeal: ({ fromDate, fromMeal, toMeal, toDate }) =>
        set((s) => {
          const source = (s.log[fromDate] || []).filter((e) => e.meal === fromMeal);
          if (!source.length) return {};
          const day = toDate || s.day;
          const copied = copyEntries(source, { meal: toMeal || fromMeal });
          return { log: { ...s.log, [day]: [...(s.log[day] || []), ...copied] }, xp: s.xp + 6 };
        }),
      saveTemplate: (name, meal, entries) =>
        set((s) => ({
          mealTemplates: [
            ...s.mealTemplates,
            {
              id: `tpl-${Date.now().toString(36)}`,
              name: name || `${meal} template`,
              meal,
              entries: entries.map((e) => ({ ...e, time: '00:00' })),
            },
          ],
        })),
      deleteTemplate: (id) => set((s) => ({ mealTemplates: s.mealTemplates.filter((t) => t.id !== id) })),
      applyTemplate: (id, meal) =>
        set((s) => {
          const tpl = s.mealTemplates.find((t) => t.id === id);
          if (!tpl) return {};
          const copied = copyEntries(tpl.entries, { meal: meal || tpl.meal, time: undefined }).map((e) => ({
            ...e,
            time: new Date().toTimeString().slice(0, 5),
            source: 'template',
          }));
          return { log: { ...s.log, [s.day]: [...(s.log[s.day] || []), ...copied] }, xp: s.xp + 6 };
        }),
      addCustomFood: (food) => set((s) => ({ customFoods: [...s.customFoods, food] })),
      removeCustomFood: (id) => set((s) => ({ customFoods: s.customFoods.filter((f) => f.id !== id) })),
      toggleFavouriteFood: (id) =>
        set((s) => ({
          favouriteFoods: s.favouriteFoods.includes(id)
            ? s.favouriteFoods.filter((x) => x !== id)
            : [...s.favouriteFoods, id],
        })),

      completeRecipe: (recipe) =>
        set((s) => {
          const entry = buildEntry(recipeAsFood(recipe), { source: 'recipe' });
          return {
            cooked: s.cooked.includes(recipe.id) ? s.cooked : [...s.cooked, recipe.id],
            xp: s.xp + 60,
            streak: s.cookedToday ? s.streak : s.streak + 1,
            cookedToday: true,
            log: { ...s.log, [s.day]: [...(s.log[s.day] || []), entry] },
          };
        }),
    };
  }, []);

  /* Nutrition is always derived from the diary — never stored twice. */
  const derived = useMemo(() => {
    const catalogue = [...CATALOGUE, ...state.customFoods];
    const entries = state.log[state.day] || [];
    const totals = dayTotals(entries);
    return {
      catalogue,
      entries,
      totals,
      kcalToday: totals.kcal,
      proteinToday: totals.protein,
      carbsToday: totals.carbs,
      fatToday: totals.fat,
      fibreToday: totals.fibre,
      recentFoods: recentFoodsFrom(state.log, catalogue),
      entriesFor: (date) => state.log[date] || [],
      kcalFor: (date) => dayTotals(state.log[date] || []).kcal,
    };
  }, [state.log, state.day, state.customFoods]);

  const value = useMemo(() => ({ ...state, ...derived, ...api }), [state, derived, api]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp outside AppProvider');
  return ctx;
};

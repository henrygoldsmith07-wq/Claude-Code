import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { CATALOGUE } from '../data/foods.js';
import { DEFAULT_TARGETS, GLASS_ML } from '../data/nutrients.js';
import { guessAisle } from '../data/stores.js';
import { buildEntry, copyEntries, dayTotals, hydration, nutrientCoverage } from './nutrition.js';
import { recipeFood, searchFoods } from './foodlog.js';
import {
  dayStamp, kitchenStats, levelFrom, pantryValue, spentInWeek, streakFrom,
} from './kitchen.js';
import {
  defaultWeeklyKcal, goalSummary, resolveMaintenance, targetsFor, weekProgress,
} from './goals.js';

export const STORAGE_KEY = 'forq-state-v2';
const KEY = STORAGE_KEY;

/* ---------- Pure helpers (exported for tests) ---------- */
export const XP_PER_LEVEL = 160;
export const levelFromXp = (xp) => levelFrom(xp, XP_PER_LEVEL);
export const xpIntoLevel = (xp) => Math.max(0, xp) % XP_PER_LEVEL;

export const todayStamp = dayStamp;

/**
 * New calendar day → zero the trackers that only mean anything today. The
 * diary, pantry, list and history are all keyed by date, so they carry over
 * untouched and a new day simply starts empty.
 */
export const rolloverDay = (state, today = todayStamp()) =>
  state.day === today ? state : { ...state, day: today, water: 0, waterExtraMl: 0 };

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

const uid = (prefix) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** An emoji for a typed-in item, borrowed from the food catalogue when it matches. */
const emojiFor = (name) => searchFoods(name, CATALOGUE, 1)[0]?.emoji || '🍽️';

/**
 * A brand new kitchen: nothing pre-filled, nothing pretended. Every number in
 * the app grows from what the user logs, buys, cooks and plans.
 */
export const EMPTY_STATE = {
  onboarded: false,
  theme: 'light',
  accent: 'mono',
  name: '',
  day: todayStamp(),
  /* goals — what you're aiming at, and how you want to eat */
  goal: 'maintain',
  diets: [], // dietary pattern ids: keto, vegan, gluten-free…
  body: { sex: 'unspecified', age: null, heightCm: null, weightKg: null, activity: 'light' },
  maintenanceKcal: 0, // typed in when body stats aren't given
  targetMode: 'auto', // 'auto' follows the goal; 'custom' is yours to set
  weeklyKcal: 0, // 0 = seven times the daily target
  /* budget & shopping */
  weeklyBudget: 0,
  household: 1,
  shoppingList: [], // {id,name,emoji,aisle,qty,price,checked}
  shops: [], // recorded trips {id,date,store,total,items[]}
  /* kitchen */
  pantry: [], // {id,name,emoji,cat,location,qty,cost,store,expiry,low}
  plan: {}, // { 'YYYY-MM-DD': {breakfast,lunch,dinner} }
  favourites: [], // recipe ids
  cooked: [], // [{recipeId, date}]
  /* food diary */
  log: {}, // { 'YYYY-MM-DD': entry[] }
  favouriteFoods: [],
  customFoods: [],
  mealTemplates: [],
  targets: DEFAULT_TARGETS,
  water: 0,
  waterExtraMl: 0,
  /* progress */
  xp: 0,
};

const load = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || '{}');
    const state = {
      ...EMPTY_STATE,
      ...stored,
      targets: { ...DEFAULT_TARGETS, ...(stored.targets || {}) },
    };
    if (!ACCENT_IDS.includes(state.accent)) state.accent = EMPTY_STATE.accent;
    return rolloverDay(state);
  } catch {
    return { ...EMPTY_STATE };
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
      reset: () => setState({ ...EMPTY_STATE, day: todayStamp() }),
      finishOnboarding: (profile) => set({ ...profile, onboarded: true }),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),
      setAccent: (accent) => set({ accent }),
      addWater: (d) => set((s) => ({ water: Math.max(0, Math.min(8, s.water + d)) })),
      addWaterMl: (ml) => set((s) => ({ waterExtraMl: Math.max(0, s.waterExtraMl + ml) })),
      /** Editing a target by hand is a decision — it switches you to custom mode. */
      setTarget: (key, value) =>
        set((s) => ({
          targets: { ...s.targets, [key]: Math.max(0, Number(value) || 0) },
          targetMode: ['kcal', 'protein', 'carbs', 'fat'].includes(key) ? 'custom' : s.targetMode,
        })),
      resetTargets: () => set((s) => ({ targets: targetsFor({ ...s, targets: DEFAULT_TARGETS }), targetMode: 'auto' })),

      /* ---------- Goals ---------- */
      /** Changing the goal re-derives the targets, unless you've taken them over. */
      setGoal: (goal) =>
        set((s) => {
          const next = { ...s, goal };
          return { goal, targets: s.targetMode === 'auto' ? targetsFor(next) : s.targets };
        }),
      toggleDiet: (id) =>
        set((s) => {
          const diets = s.diets.includes(id) ? s.diets.filter((d) => d !== id) : [...s.diets, id];
          const next = { ...s, diets };
          return { diets, targets: s.targetMode === 'auto' ? targetsFor(next) : s.targets };
        }),
      setBody: (patch) =>
        set((s) => {
          const body = { ...s.body, ...patch };
          const next = { ...s, body };
          return { body, targets: s.targetMode === 'auto' ? targetsFor(next) : s.targets };
        }),
      setMaintenance: (kcal) =>
        set((s) => {
          const maintenanceKcal = Math.max(0, Number(kcal) || 0);
          const next = { ...s, maintenanceKcal };
          return { maintenanceKcal, targets: s.targetMode === 'auto' ? targetsFor(next) : s.targets };
        }),
      setTargetMode: (targetMode) =>
        set((s) => ({
          targetMode,
          targets: targetMode === 'auto' ? targetsFor(s) : s.targets,
        })),
      setWeeklyKcal: (kcal) => set({ weeklyKcal: Math.max(0, Number(kcal) || 0) }),
      toggleFavourite: (id) =>
        set((s) => ({
          favourites: s.favourites.includes(id)
            ? s.favourites.filter((x) => x !== id)
            : [...s.favourites, id],
        })),

      /* ---------- Pantry ---------- */
      addPantryItem: (item) =>
        set((s) => ({
          pantry: [...s.pantry, {
            id: uid('p'),
            emoji: emojiFor(item.name),
            low: false,
            addedAt: s.day,
            ...item,
            cost: Number(item.cost) || 0,
          }],
        })),
      updatePantryItem: (id, patch) =>
        set((s) => ({ pantry: s.pantry.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      removePantryItem: (id) => set((s) => ({ pantry: s.pantry.filter((p) => p.id !== id) })),
      togglePantryLow: (id) =>
        set((s) => ({ pantry: s.pantry.map((p) => (p.id === id ? { ...p, low: !p.low } : p)) })),

      /* ---------- Shopping ---------- */
      addToList: (items) =>
        set((s) => {
          const have = new Set(s.shoppingList.map((i) => i.name.toLowerCase()));
          const fresh = (Array.isArray(items) ? items : [items])
            .filter((i) => i.name && !have.has(i.name.toLowerCase()))
            .map((i) => ({
              id: i.id || uid('s'),
              checked: false,
              price: Number(i.price) || 0,
              qty: i.qty || '',
              aisle: i.aisle || guessAisle(i.name),
              emoji: i.emoji || emojiFor(i.name),
              ...i,
            }));
          return fresh.length ? { shoppingList: [...s.shoppingList, ...fresh] } : {};
        }),
      updateListItem: (id, patch) =>
        set((s) => ({ shoppingList: s.shoppingList.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),
      removeListItem: (id) => set((s) => ({ shoppingList: s.shoppingList.filter((i) => i.id !== id) })),
      toggleChecked: (id) =>
        set((s) => ({
          shoppingList: s.shoppingList.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)),
        })),
      clearChecked: () => set((s) => ({ shoppingList: s.shoppingList.filter((i) => !i.checked) })),

      /**
       * Record a shop: the ticked items leave the list, the trip joins your
       * spending history, and anything you bought can land in the pantry.
       */
      recordShop: ({ store, total, toPantry = false, location = 'Cupboard' }) =>
        set((s) => {
          const bought = s.shoppingList.filter((i) => i.checked);
          if (!bought.length) return {};
          const shop = {
            id: uid('h'),
            date: s.day,
            store: store || 'Unnamed shop',
            total: Math.round((Number(total) || 0) * 100) / 100,
            items: bought.map(({ name, price, qty, emoji }) => ({ name, price: Number(price) || 0, qty, emoji })),
          };
          return {
            shops: [...s.shops, shop],
            shoppingList: s.shoppingList.filter((i) => !i.checked),
            xp: s.xp + 10,
            pantry: toPantry
              ? [...s.pantry, ...bought.map((i) => ({
                  id: uid('p'),
                  name: i.name,
                  emoji: i.emoji,
                  cat: 'Fresh',
                  location,
                  qty: i.qty || '',
                  cost: Number(i.price) || 0,
                  store: shop.store,
                  expiry: null,
                  low: false,
                  addedAt: s.day,
                }))]
              : s.pantry,
          };
        }),

      /* ---------- Plan ---------- */
      setPlanSlot: (date, slot, recipeId) =>
        set((s) => {
          const day = { ...(s.plan[date] || {}) };
          if (recipeId) day[slot] = recipeId;
          else delete day[slot];
          const plan = { ...s.plan };
          if (Object.keys(day).length) plan[date] = day;
          else delete plan[date];
          return { plan };
        }),
      clearPlanWeek: (dates) =>
        set((s) => {
          const plan = { ...s.plan };
          for (const d of dates) delete plan[d];
          return { plan };
        }),

      /* ---------- Food diary ---------- */
      logEntries: addEntries,
      logEntry: (entry, date) => addEntries([entry], date),
      updateEntry: (id, patch, date) =>
        set((s) => {
          const day = date || s.day;
          return {
            log: { ...s.log, [day]: (s.log[day] || []).map((e) => (e.id === id ? { ...e, ...patch } : e)) },
          };
        }),
      removeEntry: (id, date) =>
        set((s) => {
          const day = date || s.day;
          return { log: { ...s.log, [day]: (s.log[day] || []).filter((e) => e.id !== id) } };
        }),
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
          mealTemplates: [...s.mealTemplates, {
            id: uid('tpl'),
            name: name || `${meal} template`,
            meal,
            entries: entries.map((e) => ({ ...e, time: '00:00' })),
          }],
        })),
      deleteTemplate: (id) => set((s) => ({ mealTemplates: s.mealTemplates.filter((t) => t.id !== id) })),
      applyTemplate: (id, meal) =>
        set((s) => {
          const tpl = s.mealTemplates.find((t) => t.id === id);
          if (!tpl) return {};
          const copied = copyEntries(tpl.entries, { meal: meal || tpl.meal }).map((e) => ({
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

      /** Finishing cooking mode: history, XP, and the meal logged to the diary. */
      completeRecipe: (recipe) =>
        set((s) => {
          const entry = buildEntry(recipeFood(recipe, [...CATALOGUE, ...s.customFoods]), { source: 'recipe' });
          return {
            cooked: [...s.cooked, { recipeId: recipe.id, date: s.day }],
            xp: s.xp + 60,
            log: { ...s.log, [s.day]: [...(s.log[s.day] || []), entry] },
          };
        }),
    };
  }, []);

  /* Everything below is derived — the app never stores a number twice. */
  const derived = useMemo(() => {
    const catalogue = [...CATALOGUE, ...state.customFoods];
    const entries = state.log[state.day] || [];
    const totals = dayTotals(entries);
    const glasses = state.water + state.waterExtraMl / GLASS_ML;
    const cookedDays = state.cooked.map((c) => c.date);
    return {
      catalogue,
      entries,
      totals,
      kcalToday: totals.kcal,
      proteinToday: totals.protein,
      carbsToday: totals.carbs,
      fatToday: totals.fat,
      fibreToday: totals.fibre,
      kcalGoal: state.targets.kcal,
      proteinGoal: state.targets.protein,
      carbsGoal: state.targets.carbs,
      fatGoal: state.targets.fat,
      coverage: nutrientCoverage(entries),
      hydration: hydration(totals, glasses),
      /* goals */
      maintenanceKcalResolved: resolveMaintenance(state),
      goalSummary: goalSummary(state),
      weeklyKcalTarget: state.weeklyKcal || defaultWeeklyKcal(state.targets.kcal),
      week: weekProgress(state.log, {
        weeklyKcal: state.weeklyKcal || defaultWeeklyKcal(state.targets.kcal),
        today: state.day,
      }),
      recentFoods: recentFoodsFrom(state.log, catalogue),
      entriesFor: (date) => state.log[date] || [],
      kcalFor: (date) => dayTotals(state.log[date] || []).kcal,
      /* kitchen */
      streak: streakFrom(cookedDays, state.day),
      cookedToday: cookedDays.includes(state.day),
      cookedIds: state.cooked.map((c) => c.recipeId),
      pantryValue: pantryValue(state.pantry),
      spentThisWeek: spentInWeek(state.shops, state.day),
      stats: kitchenStats(state, state.day),
    };
  }, [state]);

  const value = useMemo(() => ({ ...state, ...derived, ...api }), [state, derived, api]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp outside AppProvider');
  return ctx;
};

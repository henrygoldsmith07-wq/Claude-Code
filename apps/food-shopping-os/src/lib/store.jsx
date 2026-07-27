import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { INTEGRATIONS } from '../data/plan.js';

const KEY = 'forq-state-v1';

/* ---------- Pure helpers (exported for tests) ---------- */
export const XP_PER_LEVEL = 160;
export const levelFromXp = (xp) => Math.floor(Math.max(0, xp) / XP_PER_LEVEL) + 1;
export const xpIntoLevel = (xp) => Math.max(0, xp) % XP_PER_LEVEL;

export const todayStamp = () => new Date().toISOString().slice(0, 10);

/** New calendar day → zero the daily trackers, keep everything long-lived. */
export const rolloverDay = (state, today = todayStamp()) =>
  state.day === today
    ? state
    : {
        ...state,
        day: today,
        water: 0,
        kcalToday: 0,
        proteinToday: 0,
        carbsToday: 0,
        fatToday: 0,
        cookedToday: false,
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
  kcalToday: 1240,
  kcalGoal: 2200,
  proteinToday: 68,
  proteinGoal: 130,
  carbsToday: 142,
  carbsGoal: 250,
  fatToday: 41,
  fatGoal: 75,
};

const load = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || '{}');
    const state = {
      ...DEFAULTS,
      ...stored,
      integrations: { ...DEFAULTS.integrations, ...(stored.integrations || {}) },
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
      completeRecipe: (recipe) =>
        set((s) => ({
          cooked: s.cooked.includes(recipe.id) ? s.cooked : [...s.cooked, recipe.id],
          xp: s.xp + 60,
          streak: s.cookedToday ? s.streak : s.streak + 1,
          cookedToday: true,
          kcalToday: s.kcalToday + recipe.kcal,
          proteinToday: s.proteinToday + recipe.protein,
          carbsToday: s.carbsToday + recipe.carbs,
          fatToday: s.fatToday + recipe.fat,
        })),
    };
  }, []);

  const value = useMemo(() => ({ ...state, ...api }), [state, api]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp outside AppProvider');
  return ctx;
};

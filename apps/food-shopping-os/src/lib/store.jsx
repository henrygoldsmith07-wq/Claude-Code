import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const KEY = 'forq-state-v1';

const ACCENT_IDS = ['mono', 'forest', 'ocean', 'wine', 'honey'];

const DEFAULTS = {
  theme: 'light',
  accent: 'mono',
  name: 'Henry',
  weeklyBudget: 65,
  water: 4, // glasses of 8
  checked: [], // shopping list item ids ticked off
  xp: 1240,
  level: 8,
  streak: 12,
  budgetStreak: 4,
  wasteStreak: 2,
  cooked: [], // recipe ids completed via cooking mode
  favourites: ['salmon-teriyaki', 'slowcooker-ragu', 'chickpea-curry'],
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
    const state = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
    if (!ACCENT_IDS.includes(state.accent)) state.accent = DEFAULTS.accent;
    return state;
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
      completeRecipe: (recipe) =>
        set((s) => {
          const xp = s.xp + 60;
          return {
            cooked: s.cooked.includes(recipe.id) ? s.cooked : [...s.cooked, recipe.id],
            xp,
            level: 8 + Math.floor((xp - 1240) / 400),
            kcalToday: s.kcalToday + recipe.kcal,
            proteinToday: s.proteinToday + recipe.protein,
            carbsToday: s.carbsToday + recipe.carbs,
            fatToday: s.fatToday + recipe.fat,
          };
        }),
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

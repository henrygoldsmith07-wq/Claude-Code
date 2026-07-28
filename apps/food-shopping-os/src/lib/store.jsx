import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { CATALOGUE } from '../data/foods.js';
import { DEFAULT_TARGETS, GLASS_ML } from '../data/nutrients.js';
import { guessAisle } from '../data/stores.js';
import { setMyRecipes } from '../data/recipes.js';
import {
  aisleFor, basketProjection, mergeItems, rememberAisle, restockSuggestions, routeFromTicks,
  wasteSummary,
} from './shopping.js';
import { buildEntry, copyEntries, dayTotals, hydration, nutrientCoverage } from './nutrition.js';
import { recipeFood, searchFoods } from './foodlog.js';
import {
  dayStamp, kitchenStats, levelFrom, pantryValue, spentInWeek, streakFrom,
} from './kitchen.js';
import {
  defaultWeeklyKcal, goalSummary, resolveMaintenance, targetsFor, weekProgress,
} from './goals.js';
import {
  applyEntries, clearDates, LEFTOVER_CAT, leftoverEntry, leftoverItems, leftoverPortions, moveMeal,
} from './mealplan.js';
import { progressSummary } from './progress.js';
import { bodySummary, cycleSummary, sleepSummary, stressSummary, vitalSummary } from './health.js';
import { activityAdjustment, weekSummary } from './exercise.js';
import { healthActions, seedMeasurements } from './health-actions.js';

export { PHOTO_LIMIT } from './health-actions.js';

import {
  ACCENT_IDS, emojiFor, EMPTY_STATE, recentFoodsFrom, rolloverDay, STORAGE_KEY, todayStamp, uid,
} from './state.js';

export {
  EMPTY_STATE, foodFromEntry, levelFromXp, recentFoodsFrom, rolloverDay, STORAGE_KEY,
  todayStamp, XP_PER_LEVEL, xpIntoLevel,
} from './state.js';

const KEY = STORAGE_KEY;

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

  // Your recipes join the book's lookup, so a plan slot or a cook history entry
  // pointing at one of yours resolves like any other dish.
  setMyRecipes(state.myRecipes);

  const api = useMemo(() => {
    const set = (patch) => setState((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }));

    const addEntries = (entries, date) =>
      set((s) => {
        const day = date || s.day;
        if (!entries.length) return {};
        return {
          log: { ...s.log, [day]: [...(s.log[day] || []), ...entries] },
        };
      });

    return {
      set,
      reset: () => setState({ ...EMPTY_STATE, day: todayStamp() }),
      finishOnboarding: (profile) =>
        set((s) => ({
          ...profile,
          onboarded: true,
          measurements: seedMeasurements(profile.body, s.day, s.measurements),
        })),
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
      /* ---------- Your own recipes ---------- */
      /** Keep a dish: generated, imported from a link, or sent by someone. */
      saveRecipe: (recipe) =>
        set((s) => {
          const id = s.myRecipes.some((r) => r.id === recipe.id) ? `${recipe.id}-${s.myRecipes.length + 1}` : recipe.id;
          return { myRecipes: [...s.myRecipes, { ...recipe, id, savedAt: s.day }] };
        }),
      removeRecipe: (id) =>
        set((s) => ({
          myRecipes: s.myRecipes.filter((r) => r.id !== id),
          favourites: s.favourites.filter((f) => f !== id),
        })),
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
          const fresh = mergeItems(Array.isArray(items) ? items : [items])
            .filter((i) => i.name && !have.has(i.name.toLowerCase()))
            .map((i) => ({
              id: i.id || uid('s'),
              checked: false,
              price: Number(i.price) || 0,
              qty: i.qty || '',
              emoji: i.emoji || emojiFor(i.name),
              ...i,
              // What you filed it under last time wins over the name guess.
              aisle: aisleFor(i.name, s.aisleMemory) === guessAisle(i.name)
                ? (i.aisle || guessAisle(i.name))
                : aisleFor(i.name, s.aisleMemory),
            }));
          return fresh.length ? { shoppingList: [...s.shoppingList, ...fresh] } : {};
        }),
      /** Moving an item to another aisle teaches the list where it lives. */
      setItemAisle: (id, aisle) =>
        set((s) => {
          const item = s.shoppingList.find((i) => i.id === id);
          if (!item) return {};
          return {
            shoppingList: s.shoppingList.map((i) => (i.id === id ? { ...i, aisle } : i)),
            aisleMemory: rememberAisle(s.aisleMemory, item.name, aisle),
          };
        }),
      updateListItem: (id, patch) =>
        set((s) => ({ shoppingList: s.shoppingList.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),
      removeListItem: (id) => set((s) => ({ shoppingList: s.shoppingList.filter((i) => i.id !== id) })),
      /** When you tick it matters: the order becomes this shop's route. */
      toggleChecked: (id) =>
        set((s) => ({
          shoppingList: s.shoppingList.map((i) => (i.id === id
            ? { ...i, checked: !i.checked, checkedAt: i.checked ? null : Date.now() }
            : i)),
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
          // The order you ticked things off is this shop's layout, learned.
          const route = routeFromTicks(bought);
          return {
            shops: [...s.shops, shop],
            shoppingList: s.shoppingList.filter((i) => !i.checked),
            storeRoutes: route.length > 1 ? { ...s.storeRoutes, [shop.store]: route } : s.storeRoutes,
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

      /* ---------- Offers you were given ---------- */
      /** Offers are yours: typed in from a voucher, an email or a shelf edge. */
      addOffer: (offer) =>
        set((s) => {
          const label = String(offer.label || '').trim();
          const match = String(offer.match || '').trim();
          if (label.length < 2 || !match) return {};
          return {
            offers: [...s.offers, {
              id: uid('o'),
              label,
              match,
              kind: ['money', 'percent', 'multibuy'].includes(offer.kind) ? offer.kind : 'money',
              value: Math.max(0, Number(offer.value) || 0),
              store: String(offer.store || '').trim(),
              addedAt: s.day,
            }],
          };
        }),
      removeOffer: (id) => set((s) => ({ offers: s.offers.filter((o) => o.id !== id) })),

      /* ---------- Waste ---------- */
      /** Binning something records what it cost, so the waste figure is real. */
      binPantryItem: (id) =>
        set((s) => {
          const item = s.pantry.find((p) => p.id === id);
          if (!item) return {};
          return {
            pantry: s.pantry.filter((p) => p.id !== id),
            waste: [...s.waste, { name: item.name, cost: Number(item.cost) || 0, date: s.day }],
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
      clearPlanWeek: (dates) => set((s) => ({ plan: clearDates(s.plan, dates) })),
      /** Drag a meal to another day or slot; an occupied target swaps back. */
      moveMealSlot: (from, to) => set((s) => ({ plan: moveMeal(s.plan, from, to) })),
      /** Drop a whole generated plan in at once: [{date, slot, recipeId}]. */
      applyPlanEntries: (entries) => set((s) => ({ plan: applyEntries(s.plan, entries) })),

      /* ---------- Family ---------- */
      addMember: (member) =>
        set((s) => ({
          members: [...s.members, {
            id: uid('m'),
            name: member.name?.trim() || `Person ${s.members.length + 1}`,
            portions: Math.max(0.5, Number(member.portions) || 1),
            diets: member.diets || [],
          }],
        })),
      updateMember: (id, patch) =>
        set((s) => ({ members: s.members.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
      removeMember: (id) => set((s) => ({ members: s.members.filter((m) => m.id !== id) })),
      toggleMemberDiet: (id, diet) =>
        set((s) => ({
          members: s.members.map((m) => (m.id === id
            ? { ...m, diets: m.diets.includes(diet) ? m.diets.filter((d) => d !== diet) : [...m.diets, diet] }
            : m)),
        })),

      /* ---------- Leftovers ---------- */
      /** Portions cooked but not eaten go in the fridge, dated. */
      saveLeftovers: (recipe, portions) =>
        set((s) => (portions > 0
          ? { pantry: [...s.pantry, { id: uid('p'), low: false, ...leftoverEntry(recipe, portions, s.day) }] }
          : {})),
      /** Eat one portion; the item leaves the pantry when the last one goes. */
      useLeftover: (id) =>
        set((s) => ({
          pantry: s.pantry
            .map((p) => {
              if (p.id !== id) return p;
              const portions = (Number(p.portions) || 1) - 1;
              return { ...p, portions, qty: `${portions} portion${portions === 1 ? '' : 's'}` };
            })
            .filter((p) => p.cat !== LEFTOVER_CAT || (Number(p.portions) || 0) > 0),
        })),

      /* ---------- Health and exercise (see health-actions.js) ---------- */
      ...healthActions(set),

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
          return { log: { ...s.log, [day]: [...(s.log[day] || []), ...copied] } };
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
          return { log: { ...s.log, [s.day]: [...(s.log[s.day] || []), ...copied] } };
        }),
      addCustomFood: (food) => set((s) => ({ customFoods: [...s.customFoods, food] })),
      removeCustomFood: (id) => set((s) => ({ customFoods: s.customFoods.filter((f) => f.id !== id) })),
      toggleFavouriteFood: (id) =>
        set((s) => ({
          favouriteFoods: s.favouriteFoods.includes(id)
            ? s.favouriteFoods.filter((x) => x !== id)
            : [...s.favouriteFoods, id],
        })),

      /**
       * Finishing cooking mode: history, XP, and the meal logged to the diary.
       * Portions you cooked but didn't eat go to the fridge as leftovers.
       */
      completeRecipe: (recipe, { leftovers = 0 } = {}) =>
        set((s) => {
          const entry = buildEntry(recipeFood(recipe, [...CATALOGUE, ...s.customFoods]), { source: 'recipe' });
          return {
            cooked: [...s.cooked, { recipeId: recipe.id, date: s.day }],
            log: { ...s.log, [s.day]: [...(s.log[s.day] || []), entry] },
            pantry: leftovers > 0
              ? [...s.pantry, { id: uid('p'), low: false, ...leftoverEntry(recipe, leftovers, s.day) }]
              : s.pantry,
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
    const progress = progressSummary(state, state.day);
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
      /* family — how many portions a meal has to stretch to, and everyone's diets */
      portions: state.members.length
        ? Math.round(state.members.reduce((n, m) => n + (Number(m.portions) || 1), 0) * 10) / 10
        : state.household || 1,
      planDiets: [...new Set([...state.diets, ...state.members.flatMap((m) => m.diets || [])])],
      /* leftovers */
      leftovers: leftoverItems(state.pantry),
      leftoverPortions: leftoverPortions(state.pantry),
      /* health and training, read back the same way as everything else */
      body_: bodySummary(state, state.day),
      vitalsSummary: vitalSummary(state.vitals),
      sleepSummary: sleepSummary(state.sleep, { today: state.day }),
      stressSummary: stressSummary(state.stress, { today: state.day }),
      cycle: cycleSummary(state.cycles, state.day),
      training: weekSummary(state.workouts, state.day),
      activity: activityAdjustment(state, state.day),
      /* the game layer — all counted from the records above, never banked */
      game: progress,
      xp: progress.xp,
      level: progress.level,
      /* kitchen */
      streak: streakFrom(cookedDays, state.day),
      cookedToday: cookedDays.includes(state.day),
      cookedIds: state.cooked.map((c) => c.recipeId),
      pantryValue: pantryValue(state.pantry),
      spentThisWeek: spentInWeek(state.shops, state.day),
      /* shopping */
      basket: basketProjection(state.shoppingList, {
        budget: state.weeklyBudget,
        spent: spentInWeek(state.shops, state.day),
        offers: state.offers,
      }),
      restock: restockSuggestions(state.shops, state.pantry, state.shoppingList),
      wasted: wasteSummary(state.waste),
      stats: kitchenStats({ ...state, xp: progress.xp }, state.day),
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

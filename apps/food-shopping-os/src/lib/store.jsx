import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CATALOGUE } from '../data/foods.js';
import { DEFAULT_TARGETS } from '../data/nutrients.js';
import { guessAisle } from '../data/stores.js';
import { setMyRecipes } from '../data/recipes.js';
import {
  aisleFor, applyOffers, mergeItems, rememberAisle, routeFromTicks,
} from './shopping.js';
import { buildEntry, copyEntries } from './nutrition.js';
import { recipeFood } from './foodlog.js';
import { targetsFor } from './goals.js';
import { applyEntries, clearDates, LEFTOVER_CAT, leftoverEntry, moveMeal } from './mealplan.js';
import { deriveApp } from './derive.js';
import { consumePantryIngredients } from './kitchen.js';
import { healthActions, seedMeasurements } from './health-actions.js';
import { reminderActions } from './reminder-actions.js';
import { advancedActions, preferenceActions } from './preference-actions.js';
import { householdActions } from './household-actions.js';
import { smartActions } from './smart-actions.js';
import { DEFAULT_PERMISSIONS, householdPermission } from './household.js';
import { dueBetween, dueNow, reminderContext } from './reminders.js';

export { PHOTO_LIMIT } from './health-actions.js';

import {
  ACCENT_IDS, emojiFor, EMPTY_STATE, rolloverDay, STORAGE_KEY, todayStamp, uid,
} from './state.js';

export {
  EMPTY_STATE, foodFromEntry, levelFromXp, recentFoodsFrom, rolloverDay, STORAGE_KEY,
  todayStamp, XP_PER_LEVEL, xpIntoLevel,
} from './state.js';

const KEY = STORAGE_KEY;

const hydrate = (stored = {}) => {
  const state = {
    ...EMPTY_STATE,
    ...stored,
    members: (stored.members || []).map((member) => ({
      ...member,
      role: member.role === 'child' ? 'child' : 'adult',
      permissions: { ...DEFAULT_PERMISSIONS, ...(member.permissions || {}) },
      notifications: member.notifications !== false,
    })),
    targets: { ...DEFAULT_TARGETS, ...(stored.targets || {}) },
  };
  if (!ACCENT_IDS.includes(state.accent)) state.accent = EMPTY_STATE.accent;
  return rolloverDay(state);
};

const load = () => {
  try {
    return hydrate(JSON.parse(localStorage.getItem(KEY) || '{}'));
  } catch {
    return { ...EMPTY_STATE };
  }
};

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, setState] = useState(load);
  const applyingRemote = useRef(false);
  // Reminders are due at a time, not at a state change, so the clock has to
  // move on its own. A minute is finer than any reminder needs.
  const [tick, setTick] = useState(() => Date.now());
  // Where the catch-up starts: read once, so it doesn't slide as you look at it.
  const [seenFrom] = useState(() => state.lastSeenAt);

  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  /* Every write stamps the moment the app was last in front of you, which is
     what the next visit measures "while you were away" from. It's written on
     the way out rather than held in state, so the heartbeat can't re-render
     every screen once a minute. */
  useEffect(() => {
    if (applyingRemote.current) {
      applyingRemote.current = false;
      return;
    }
    localStorage.setItem(KEY, JSON.stringify({ ...state, lastSeenAt: Date.now() }));
  }, [state, tick]);

  useEffect(() => {
    const sync = (event) => {
      if (event.key !== KEY || !event.newValue) return;
      try {
        applyingRemote.current = true;
        setState(hydrate(JSON.parse(event.newValue)));
      } catch {
        // Ignore incomplete writes from another tab.
      }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  // Leaving is the most accurate moment to stamp, and there may be no render
  // left after it — so this one writes directly.
  const latest = useRef(state);
  latest.current = state;
  useEffect(() => {
    const mark = () => localStorage.setItem(KEY, JSON.stringify({ ...latest.current, lastSeenAt: Date.now() }));
    const onHide = () => { if (document.visibilityState === 'hidden') mark(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', mark);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', mark);
    };
  }, []);

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
          if (!householdPermission(s, 'recipes')) return {};
          const id = s.myRecipes.some((r) => r.id === recipe.id) ? `${recipe.id}-${s.myRecipes.length + 1}` : recipe.id;
          return { myRecipes: [...s.myRecipes, { ...recipe, id, savedAt: s.day }] };
        }),
      removeRecipe: (id) =>
        set((s) => (householdPermission(s, 'recipes') ? {
          myRecipes: s.myRecipes.filter((r) => r.id !== id),
          favourites: s.favourites.filter((f) => f !== id),
        } : {})),
      toggleFavourite: (id) =>
        set((s) => (householdPermission(s, 'recipes') ? {
          favourites: s.favourites.includes(id)
            ? s.favourites.filter((x) => x !== id)
            : [...s.favourites, id],
        } : {})),

      /* ---------- Pantry ---------- */
      addPantryItem: (item) =>
        set((s) => (householdPermission(s, 'pantry') ? {
          pantry: [...s.pantry, {
            id: uid('p'),
            emoji: emojiFor(item.name),
            low: false,
            addedAt: s.day,
            ...item,
            cost: Number(item.cost) || 0,
          }],
        } : {})),
      updatePantryItem: (id, patch) =>
        set((s) => (householdPermission(s, 'pantry') ? { pantry: s.pantry.map((p) => (p.id === id ? { ...p, ...patch } : p)) } : {})),
      removePantryItem: (id) => set((s) => (householdPermission(s, 'pantry') ? { pantry: s.pantry.filter((p) => p.id !== id) } : {})),
      importPantry: (items) =>
        set((s) => {
          if (!householdPermission(s, 'pantry')) return {};
          const keyFor = (item) => `${String(item.name).trim().toLowerCase()}|${String(item.location || '').toLowerCase()}`;
          const have = new Set(s.pantry.map(keyFor));
          const fresh = items.filter((item) => !have.has(keyFor(item))).map((item) => ({
            ...item,
            id: uid('p'),
            emoji: item.emoji || emojiFor(item.name),
            addedAt: s.day,
          }));
          return fresh.length ? { pantry: [...s.pantry, ...fresh] } : {};
        }),
      togglePantryLow: (id) =>
        set((s) => (householdPermission(s, 'pantry') ? { pantry: s.pantry.map((p) => (p.id === id ? { ...p, low: !p.low } : p)) } : {})),

      /* ---------- Shopping ---------- */
      addToList: (items) =>
        set((s) => {
          if (!householdPermission(s, 'shopping')) return {};
          const keyFor = (name) => String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
          const have = new Set(s.shoppingList.map((i) => keyFor(i.name)));
          const quantities = new Map();
          [...s.shops].reverse().forEach((shop) => shop.items.forEach((item) => {
            const key = keyFor(item.name);
            if (!quantities.has(key) && item.qty) quantities.set(key, item.qty);
          }));
          const fresh = mergeItems(Array.isArray(items) ? items : [items])
            .filter((i) => i.name && !have.has(keyFor(i.name)))
            .map((i) => ({
              id: i.id || uid('s'),
              checked: false,
              price: Number(i.price) || 0,
              qty: i.qty || quantities.get(keyFor(i.name)) || '',
              note: String(i.note || '').trim(),
              priority: i.priority === 'high' ? 'high' : 'normal',
              emoji: i.emoji || emojiFor(i.name),
              ...i,
              // What you filed it under last time wins over the name guess.
              aisle: aisleFor(i.name, s.aisleMemory) === guessAisle(i.name)
                ? (i.aisle || guessAisle(i.name))
                : aisleFor(i.name, s.aisleMemory),
            }));
          return fresh.length ? { shoppingList: [...s.shoppingList, ...fresh] } : {};
        }),
      repeatLastShop: () =>
        set((s) => {
          const last = s.shops.at(-1);
          if (!last?.items?.length) return {};
          const have = new Set(s.shoppingList.map((i) => String(i.name).trim().toLowerCase()));
          const items = last.items.filter((i) => i.name && !have.has(String(i.name).trim().toLowerCase()))
            .map((i) => ({ id: uid('s'), name: i.name, qty: i.qty || '', price: Number(i.price) || 0,
              emoji: i.emoji || emojiFor(i.name), aisle: aisleFor(i.name, s.aisleMemory), checked: false,
              note: '', priority: 'normal' }));
          return items.length ? { shoppingList: [...s.shoppingList, ...items] } : {};
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
          const shopStore = store || 'Unnamed shop';
          const { saved } = applyOffers(bought, s.offers, { store: shopStore, today: s.day });
          const shop = {
            id: uid('h'),
            date: s.day,
            store: shopStore,
            total: Math.round((Number(total) || 0) * 100) / 100,
            saved,
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
              expiry: /^\d{4}-\d{2}-\d{2}$/.test(offer.expiry || '') ? offer.expiry : null,
              addedAt: s.day,
            }],
          };
        }),
      removeOffer: (id) => set((s) => ({ offers: s.offers.filter((o) => o.id !== id) })),
      addPriceAlert: ({ name, target }) =>
        set((s) => {
          const label = String(name || '').trim();
          const price = Math.max(0, Number(target) || 0);
          if (label.length < 2 || !price) return {};
          return { priceAlerts: [...s.priceAlerts, { id: uid('pa'), name: label, target: price }] };
        }),
      removePriceAlert: (id) =>
        set((s) => ({ priceAlerts: s.priceAlerts.filter((alert) => alert.id !== id) })),

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

      /* ---------- Household ---------- */
      ...householdActions(set, uid),

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

      /* ---------- Reminders (see reminder-actions.js) ---------- */
      ...reminderActions(set),
      ...smartActions(set),

      /* ---------- Preferences and advanced (see preference-actions.js) ---------- */
      ...preferenceActions(set),
      ...advancedActions(set, uid),

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
          const consumed = s.autoUsePantry
            ? consumePantryIngredients(s.pantry, recipe.ingredients)
            : { pantry: s.pantry };
          return {
            cooked: [...s.cooked, { recipeId: recipe.id, date: s.day }],
            log: { ...s.log, [s.day]: [...(s.log[s.day] || []), entry] },
            pantry: leftovers > 0
              ? [...consumed.pantry, { id: uid('p'), low: false, ...leftoverEntry(recipe, leftovers, s.day) }]
              : consumed.pantry,
          };
        }),
    };
  }, []);

  /* Everything below is derived — the app never stores a number twice. */
  const derived = useMemo(() => deriveApp(state), [state]);

  /* Reminders answer to the clock as well as to your data, so they're derived
     against the tick rather than only against state changes. */
  const alerts = useMemo(() => {
    const now = new Date(tick);
    const due = dueNow(state.reminders, { now, done: state.reminderDone });
    return {
      remindersDue: due,
      // What came due while the app was shut. It can't notify you then — no
      // server to wake it — so the least it can do is not pretend otherwise.
      remindersMissed: dueBetween(state.reminders, seenFrom, tick, state.reminderDone)
        .filter((m) => !due.some((d) => d.reminder.id === m.reminder.id && d.stamp === m.stamp && d.time === m.time)),
      now,
    };
  }, [state.reminders, state.reminderDone, seenFrom, tick]);

  const value = useMemo(() => ({
    ...state,
    ...derived,
    ...alerts,
    reminderLine: (kind) => reminderContext(kind, { ...state, ...derived }),
    ...api,
  }), [state, derived, alerts, api]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp outside AppProvider');
  return ctx;
};

/**
 * The shopping list, made smarter by what you have actually done.
 *
 * Nothing here talks to a supermarket — there is no backend and no price feed.
 * Every "smart" behaviour is derived from your own history: the aisle you last
 * filed something under, the prices you typed in as you shopped, the order you
 * ticked things off in each shop, the offers you told it about. Where your
 * history can't answer, it says so instead of guessing.
 */

import { AISLE_ORDER, guessAisle } from '../data/stores.js';
import { priceHistory } from './kitchen.js';

const key = (name) => String(name || '').trim().toLowerCase();
const round2 = (n) => Math.round(n * 100) / 100;

/* ---------- Aisles that learn ---------- */

/**
 * Where an item goes: what you filed it under last time, otherwise the guess
 * from its name. Correcting an aisle once is meant to stick.
 */
export const aisleFor = (name, memory = {}) => memory[key(name)] || guessAisle(name);

export const rememberAisle = (memory = {}, name, aisle) =>
  (aisle ? { ...memory, [key(name)]: aisle } : memory);

/** Re-file a list with everything you've taught it since. */
export const refile = (items = [], memory = {}) =>
  items.map((i) => (memory[key(i.name)] ? { ...i, aisle: memory[key(i.name)] } : i));

/**
 * The order to walk the aisles in: the route you actually took last time you
 * shopped here, then anything new, in the standard order.
 */
export const routeFor = (store, routes = {}) => {
  const learned = routes[store] || [];
  return [...learned, ...AISLE_ORDER.filter((a) => !learned.includes(a))];
};

/** Group a list by aisle, in the route order for the store you're going to. */
export const groupForStore = (items = [], { store = null, routes = {}, memory = {} } = {}) => {
  const order = routeFor(store, routes);
  const map = new Map(order.map((a) => [a, []]));
  for (const item of refile(items, memory)) {
    const aisle = map.has(item.aisle) ? item.aisle : 'Other';
    map.get(aisle).push(item);
  }
  return [...map.entries()].filter(([, list]) => list.length);
};

/** The aisle sequence you ticked items off in — your route through that shop. */
export const routeFromTicks = (items = []) => {
  const ticked = items
    .filter((i) => i.checked && i.checkedAt)
    .sort((a, b) => a.checkedAt - b.checkedAt);
  const seen = [];
  for (const item of ticked) {
    const aisle = item.aisle || 'Other';
    if (!seen.includes(aisle)) seen.push(aisle);
  }
  return seen;
};

/* ---------- Price comparison, from your own receipts ---------- */

/** The cheapest you have ever paid for something, and where. */
export const cheapestFor = (name, history = []) => {
  const entry = history.find((h) => key(h.name) === key(name));
  if (!entry) return null;
  return { price: entry.best, store: entry.bestStore, times: entry.times, latest: entry.latest };
};

/** What you last paid for something at one particular shop. */
const priceAt = (entry, store) => {
  const points = entry.points.filter((p) => p.store === store);
  return points.length ? points[points.length - 1].price : null;
};

/**
 * What this list would cost at each shop you've been to, using the prices you
 * recorded there. `covered` is how many items that shop can actually price —
 * a total built from two known prices is not a comparison, and says so.
 */
export const compareStores = (items = [], shops = []) => {
  const history = priceHistory(shops);
  const stores = [...new Set(shops.map((s) => s.store))];
  return stores
    .map((store) => {
      let total = 0;
      let covered = 0;
      for (const item of items) {
        const entry = history.find((h) => key(h.name) === key(item.name));
        const price = entry ? priceAt(entry, store) : null;
        if (price === null) continue;
        covered += 1;
        total += price;
      }
      return { store, total: round2(total), covered, of: items.length };
    })
    .filter((row) => row.covered > 0)
    .sort((a, b) => b.covered - a.covered || a.total - b.total);
};

/** Items on the list you have bought cheaper somewhere else. */
export const savingsAvailable = (items = [], shops = []) => {
  const history = priceHistory(shops);
  return items
    .map((item) => {
      const best = cheapestFor(item.name, history);
      if (!best || !item.price || best.price >= item.price) return null;
      return { name: item.name, paying: item.price, best: best.price, store: best.store, saving: round2(item.price - best.price) };
    })
    .filter(Boolean)
    .sort((a, b) => b.saving - a.saving);
};

export const priceAlertMatches = (alerts = [], shops = []) => {
  const history = priceHistory(shops);
  return alerts.map((alert) => {
    const item = history.find((entry) => key(entry.name) === key(alert.name));
    const latestByStore = new Map();
    item?.points.forEach((point) => latestByStore.set(point.store, point));
    const bestCurrent = [...latestByStore.values()].sort((a, b) => a.price - b.price)[0] || null;
    const latest = bestCurrent?.price ?? null;
    return {
      ...alert,
      latest,
      hit: latest !== null && latest <= Number(alert.target),
      store: bestCurrent?.store || null,
    };
  });
};

/* ---------- Offers you told it about ---------- */

export const OFFER_KINDS = [
  { id: 'money', label: '£ off', hint: '£1.00 off' },
  { id: 'percent', label: '% off', hint: '25% off' },
  { id: 'multibuy', label: 'Multibuy', hint: '3 for 2' },
];

const matches = (item, offer) => {
  const term = key(offer.match || offer.label);
  return term ? key(item.name).includes(term) : false;
};

/**
 * Apply the offers you've entered to a list. Only your own offers exist here —
 * the app has no deals feed and never invents one.
 */
export const applyOffers = (items = [], offers = [], { store = '', today = '' } = {}) => {
  const lines = [];
  let saved = 0;
  for (const offer of offers) {
    if (offer.store && store && key(offer.store) !== key(store)) continue;
    if (offer.expiry && today && offer.expiry < today) continue;
    const hits = items.filter((i) => matches(i, offer));
    if (!hits.length) continue;
    const spend = hits.reduce((sum, i) => sum + (Number(i.price) || 0), 0);
    let off = 0;
    if (offer.kind === 'money') off = Math.min(spend, Number(offer.value) || 0);
    else if (offer.kind === 'percent') off = spend * (Math.min(100, Number(offer.value) || 0) / 100);
    else if (offer.kind === 'multibuy') {
      // "3 for 2": every third matching item is free, cheapest first.
      const group = Math.max(2, Number(offer.value) || 3);
      const prices = hits.map((i) => Number(i.price) || 0).sort((a, b) => a - b);
      const free = Math.floor(prices.length / group);
      off = prices.slice(0, free).reduce((sum, p) => sum + p, 0);
    }
    off = round2(off);
    if (off <= 0 && offer.kind !== 'multibuy') continue;
    saved += off;
    lines.push({ offer, items: hits.map((i) => i.name), saved: off });
  }
  return { lines, saved: round2(saved) };
};

/* ---------- What the basket does to your budget ---------- */

/**
 * The list against your week: what it comes to, what your own offers take off,
 * and what that leaves of the budget after what you've already spent.
 */
export const basketProjection = (items = [], {
  budget = 0, spent = 0, offers = [], store = '', today = '',
} = {}) => {
  const priced = items.filter((i) => Number(i.price) > 0);
  const total = round2(items.reduce((sum, i) => sum + (Number(i.price) || 0), 0));
  const { lines, saved } = applyOffers(items, offers, { store, today });
  const projected = round2(Math.max(0, total - saved));
  return {
    total,
    saved,
    projected,
    offers: lines,
    priced: priced.length,
    unpriced: items.length - priced.length,
    budget,
    spent: round2(spent),
    left: budget ? round2(budget - spent - projected) : null,
    over: budget > 0 && spent + projected > budget,
  };
};

/* ---------- Pantry: what's going off, what ran out ---------- */

export const EXPIRY_BUCKETS = [
  { id: 'gone', label: 'Past its date', within: -1 },
  { id: 'today', label: 'Today or tomorrow', within: 1 },
  { id: 'soon', label: 'Within three days', within: 3 },
  { id: 'week', label: 'This week', within: 7 },
];

/** Pantry items grouped by how urgent they are, soonest first. */
export const expiryBuckets = (pantry = [], daysUntil) => {
  const dated = pantry.filter((p) => p.expiry).map((p) => ({ item: p, days: daysUntil(p.expiry) }));
  return EXPIRY_BUCKETS
    .map((bucket, i) => {
      const from = i === 0 ? -Infinity : EXPIRY_BUCKETS[i - 1].within;
      return {
        ...bucket,
        items: dated
          .filter((d) => d.days > from && d.days <= bucket.within)
          .sort((a, b) => a.days - b.days),
      };
    })
    .filter((b) => b.items.length);
};

/** What throwing food away has cost you, from the items you binned. */
export const wasteSummary = (waste = []) => ({
  count: waste.length,
  cost: round2(waste.reduce((sum, w) => sum + (Number(w.cost) || 0), 0)),
  worst: [...waste].sort((a, b) => (b.cost || 0) - (a.cost || 0))[0] || null,
});

/**
 * Things you buy again and again but haven't got in — read off your own
 * receipts, never a generic "people also buy" list.
 */
export const restockSuggestions = (shops = [], pantry = [], list = [], limit = 6) => {
  const have = new Set([...pantry.map((p) => key(p.name)), ...list.map((i) => key(i.name))]);
  const counts = new Map();
  for (const shop of shops) {
    for (const item of shop.items || []) {
      const k = key(item.name);
      if (have.has(k)) continue;
      const found = counts.get(k) || { name: item.name, emoji: item.emoji, times: 0, last: shop.date };
      found.times += 1;
      found.last = shop.date > found.last ? shop.date : found.last;
      counts.set(k, found);
    }
  }
  return [...counts.values()]
    .filter((c) => c.times >= 2)
    .sort((a, b) => b.times - a.times || b.last.localeCompare(a.last))
    .slice(0, limit);
};

/* ---------- Meals to shopping ---------- */

/**
 * Merge duplicate ingredient lines into one item, keeping every dish that
 * wanted it — one "Chicken breast" on the list, not four.
 */
export const mergeItems = (items = []) => {
  const merged = new Map();
  for (const item of items) {
    const k = key(item.name);
    const found = merged.get(k);
    if (!found) {
      merged.set(k, { ...item, forRecipes: item.fromRecipe ? [item.fromRecipe] : [] });
      continue;
    }
    if (item.fromRecipe && !found.forRecipes.includes(item.fromRecipe)) found.forRecipes.push(item.fromRecipe);
    found.qty = [found.qty, item.qty].filter(Boolean).join(' + ');
  }
  return [...merged.values()].map((item) => ({
    ...item,
    fromRecipe: item.forRecipes.length > 1 ? `${item.forRecipes.length} meals` : item.fromRecipe,
  }));
};

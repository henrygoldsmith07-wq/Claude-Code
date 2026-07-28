/**
 * The store's preference actions.
 *
 * Each list is a set of known ids — an unknown one is dropped rather than
 * stored, because a preference the filters don't recognise is a rule you think
 * you set and the app has never heard of.
 */

import {
  allergenBy, CUISINES, DEFAULT_UNITS, DEFAULT_WIDGETS, intoleranceBy, religiousBy, skillBy,
  timeBudgetBy, UNIT_CHOICES, WIDGETS,
} from '../data/preferences.js';

const toggleIn = (list = [], id, valid) => {
  if (!valid(id)) return list;
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
};

const unitKeys = Object.fromEntries(UNIT_CHOICES.map((c) => [c.key, c.options.map(([id]) => id)]));

export const preferenceActions = (set) => ({
  /** An allergy is a hard line: adding one immediately removes recipes. */
  toggleAllergy: (id) => set((s) => ({ allergies: toggleIn(s.allergies, id, (x) => Boolean(allergenBy[x])) })),
  toggleIntolerance: (id) => set((s) => ({ intolerances: toggleIn(s.intolerances, id, (x) => Boolean(intoleranceBy[x])) })),
  toggleReligious: (id) => set((s) => ({ religious: toggleIn(s.religious, id, (x) => Boolean(religiousBy[x])) })),
  toggleCuisine: (name) => set((s) => ({ cuisines: toggleIn(s.cuisines, name, (x) => CUISINES.includes(x)) })),

  setSkill: (id) => set((s) => (skillBy[id] ? { skill: id } : s.skill && {})),
  setTimeBudget: (id) => set((s) => (timeBudgetBy[id] ? { timeBudget: id } : s.timeBudget && {})),

  /** One unit at a time; anything unrecognised leaves the setting alone. */
  setUnit: (key, value) =>
    set((s) => ((unitKeys[key] || []).includes(value)
      ? { units: { ...s.units, [key]: value } }
      : {})),
  resetUnits: () => set({ units: { ...DEFAULT_UNITS } }),

  /** Home layout: which cards, in what order. Null means the default. */
  toggleWidget: (id) =>
    set((s) => {
      const widget = WIDGETS.find((w) => w.id === id);
      if (!widget || widget.fixed) return {}; // the rings are the point of Home
      const current = s.widgets || DEFAULT_WIDGETS;
      return { widgets: current.includes(id) ? current.filter((w) => w !== id) : [...current, id] };
    }),
  moveWidget: (id, by) =>
    set((s) => {
      const current = [...(s.widgets || DEFAULT_WIDGETS)];
      const from = current.indexOf(id);
      const to = from + by;
      if (from < 0 || to < 0 || to >= current.length) return {};
      current.splice(to, 0, current.splice(from, 1)[0]);
      return { widgets: current };
    }),
  resetWidgets: () => set({ widgets: null }),
});

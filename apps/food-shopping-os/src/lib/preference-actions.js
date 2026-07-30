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
import { applyProductMode, PRODUCT_MODE_IDS } from '../data/productModes.js';
import {
  ALL_ENABLED_TOOLS,
  DEFAULT_ENABLED_TOOLS,
  normaliseEnabledTools,
  OPTIONAL_TOOL_IDS,
} from '../data/optionalTools.js';
import { moveBefore } from './utils.js';

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
  moveWidgetTo: (id, beforeId) =>
    set((s) => {
      const current = [...(s.widgets || DEFAULT_WIDGETS)];
      const widgets = moveBefore(current, id, beforeId, (widgetId) => widgetId);
      return widgets === current ? {} : { widgets };
    }),
  resetWidgets: () => set({ widgets: null }),

  /**
   * Change product mode after setup. Re-applies widgets and advanced-tool
   * visibility for the new mode; does not wipe diary or plan data.
   * Everything mode also enables all optional tools; other modes leave
   * enabledTools alone so progressive disclosure is not wiped by a mode change.
   */
  setProductMode: (modeId) =>
    set((s) => {
      if (!PRODUCT_MODE_IDS.includes(modeId)) return {};
      const next = applyProductMode(modeId, {
        entryGoal: undefined, // let mode set entryGoal
      });
      const patch = {
        productMode: next.productMode,
        entryGoal: next.entryGoal,
        widgets: next.widgets,
        advancedToolsVisible: next.advancedToolsVisible,
      };
      if (modeId === 'everything') {
        patch.enabledTools = [...ALL_ENABLED_TOOLS];
      }
      return patch;
    }),

  /** Progressive disclosure — turn a secondary capability on or off. */
  toggleOptionalTool: (id) =>
    set((s) => {
      if (!OPTIONAL_TOOL_IDS.includes(id)) return {};
      const current = normaliseEnabledTools(s.enabledTools);
      const turningOn = !current.includes(id);
      const enabledTools = turningOn
        ? [...current, id]
        : current.filter((toolId) => toolId !== id);
      if (id === 'cycle') {
        return { enabledTools, trackCycle: turningOn };
      }
      return { enabledTools };
    }),
  setOptionalTool: (id, on) =>
    set((s) => {
      if (!OPTIONAL_TOOL_IDS.includes(id)) return {};
      const current = normaliseEnabledTools(s.enabledTools);
      const has = current.includes(id);
      if (on && has) return {};
      if (!on && !has) return {};
      const enabledTools = on
        ? [...current, id]
        : current.filter((toolId) => toolId !== id);
      if (id === 'cycle') return { enabledTools, trackCycle: Boolean(on) };
      return { enabledTools };
    }),
  resetOptionalTools: () => set({ enabledTools: [...DEFAULT_ENABLED_TOOLS], trackCycle: false }),
});

/* ---------- Advanced: things measured or imported elsewhere ---------- */

/**
 * These all record something that happened outside the app — a lab result, a
 * sensor's export, a fast you started. Each is bounded on the way in, and none
 * of them is ever generated.
 */
export const advancedActions = (set, uid) => ({
  /** One blood panel, as your report printed it. */
  addBloods: ({ date, values, lab, note }) =>
    set((s) => {
      const clean = Object.fromEntries(
        Object.entries(values || {})
          .map(([key, value]) => [key, Number(value)])
          .filter(([, value]) => Number.isFinite(value) && value >= 0),
      );
      if (!Object.keys(clean).length) return {};
      return {
        bloods: [...s.bloods, {
          id: uid('bl'),
          date: date || s.day,
          values: clean,
          lab: String(lab || '').slice(0, 40),
          note: String(note || '').slice(0, 120),
        }].sort((a, b) => a.date.localeCompare(b.date)),
      };
    }),
  removeBloods: (id) => set((s) => ({ bloods: s.bloods.filter((b) => b.id !== id) })),

  /** A CGM export replaces the days it covers rather than doubling them up. */
  importGlucose: (readings = []) =>
    set((s) => {
      if (!readings.length) return {};
      const covered = new Set(readings.map((r) => r.date));
      const kept = s.glucose.filter((r) => !covered.has(r.date));
      return { glucose: [...kept, ...readings].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)) };
    }),
  clearGlucose: () => set({ glucose: [] }),

  /** A fast you're in has to be one you started — the app won't infer it. */
  startFast: (plan, hours) => set({ fast: { startedAt: Date.now(), plan, hours: Number(hours) || null } }),
  endFast: () => set({ fast: null }),
  setFastPlan: (plan) => set({ fastPlan: plan }),
});

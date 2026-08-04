/**
 * Turning goals into numbers.
 *
 * A body goal sets the energy delta and the protein/fat priorities; dietary
 * patterns then cap, floor or reshape what's left. The result is a plain
 * {kcal, protein, carbs, fat} target that the diary measures against — and
 * that the user can overwrite at any point by switching to custom mode.
 *
 * Recipe / food *exclusion* by diet pattern is now owned by the central
 * food-suitability engine. The helpers below remain for macro targets and as
 * thin wrappers so existing tests keep working.
 */

import {
  ACTIVITY_LEVELS, DIET_PATTERNS, KCAL_PER_G, activityLevel, bodyGoal, dietPattern,
} from '../data/goals.js';
import { DEFAULT_TARGETS } from '../data/nutrients.js';
import { weekDates } from './kitchen.js';
import { caffeineLimitMg, isUnderEighteen, youthGoal, youthKcalFactor } from './youth.js';
import { assessTarget, floorFor, MAX_DEFICIT_PCT, MAX_SURPLUS_PCT } from './target-safety.js';
import {
  evaluateFoodSuitability,
  filterBySuitability,
  rankBySuitability,
  suitabilityContextFrom,
} from './food-suitability.js';

const round = (n) => Math.round(n);
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

/* ---------- Maintenance energy ---------- */

/**
 * Mifflin-St Jeor. Without a stated sex we take the midpoint of the two
 * constants rather than assuming one.
 */
export const bmr = ({ weightKg, heightCm, age, sex = 'unspecified' }) => {
  if (!weightKg || !heightCm || !age) return null;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const offset = sex === 'male' ? 5 : sex === 'female' ? -161 : -78;
  return Math.max(0, round(base + offset));
};

/** BMR × activity — the calories that hold your weight steady. */
export const maintenanceFrom = (stats = {}) => {
  const base = bmr(stats);
  if (!base) return null;
  return round(base * activityLevel(stats.activity).factor);
};

/**
 * The maintenance figure to plan from: computed from body stats when they're
 * there, otherwise whatever the user typed in.
 */
export const resolveMaintenance = (state = {}) =>
  maintenanceFrom(state.body || {}) || Math.max(0, Number(state.maintenanceKcal) || 0) || null;

/* ---------- Macro targets ---------- */

const kcalOf = ({ protein = 0, carbs = 0, fat = 0 }) =>
  protein * KCAL_PER_G.protein + carbs * KCAL_PER_G.carbs + fat * KCAL_PER_G.fat;

/**
 * Fill the calories protein hasn't claimed with fat and carbs, honouring a
 * carb cap and a fat floor. Whatever a cap refuses, the other macro absorbs.
 */
const balance = (kcal, protein, { carbCap = Infinity, fatFloorPct = 0, fatPct = 0.3 }) => {
  const left = Math.max(0, kcal - protein * KCAL_PER_G.protein);
  let fatKcal = Math.min(left, Math.max(kcal * fatFloorPct, kcal * fatPct));
  let carbs = (left - fatKcal) / KCAL_PER_G.carbs;

  if (carbs > carbCap) {
    carbs = carbCap;
    fatKcal = left - carbs * KCAL_PER_G.carbs;
  }
  return { fat: Math.max(0, fatKcal / KCAL_PER_G.fat), carbs: Math.max(0, carbs) };
};

const clampedKcal = ({ base, factor, sex, bmrKcal }) => {
  const held = clamp(factor, 1 - MAX_DEFICIT_PCT, 1 + MAX_SURPLUS_PCT);
  return Math.max(floorFor({ sex, bmrKcal, maintenanceKcal: base }), round(base * held));
};

export const computeTargets = ({
  goal = 'maintain',
  diets = [],
  maintenanceKcal = null,
  weightKg = null,
  sex = 'unspecified',
  bmrKcal = null,
  fallbackKcal = DEFAULT_TARGETS.kcal,
  youth = false,
  safety = null,
} = {}) => {
  const g = bodyGoal(safety ? safety.appliedGoal : youth ? youthGoal(goal) : goal);
  const kcalFactor = youth ? youthKcalFactor(g.kcalFactor) : g.kcalFactor;
  const patterns = diets.map(dietPattern).filter(Boolean);

  const base = maintenanceKcal || fallbackKcal;
  const kcal = safety

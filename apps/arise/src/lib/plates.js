// plates.js — deterministic barbell loadability helpers.
// Plate denominations are treated as available pairs. The calculator never
// invents a load: it returns the nearest achievable total and the per-side
// stack used to get there.

export const DEFAULT_PLATE_DENOMINATIONS_KG = [1.25, 2.5, 5, 10, 15, 20, 25];

const SCALE = 100;

function units(value){
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number * SCALE) : 0;
}

function normaliseConfig(config = {}){
  const input = config || {};
  const barWeightKg = Math.max(0, Number(input.barWeightKg ?? 20) || 0);
  const source = Array.isArray(input.platesKg) ? input.platesKg : DEFAULT_PLATE_DENOMINATIONS_KG;
  const platesKg = [...new Set(source.map(value=> Number(typeof value === 'object' ? value.kg : value))
    .filter(value=> Number.isFinite(value) && value > 0)
    .map(value=> Math.round(value * SCALE) / SCALE))].sort((a, b)=> a - b);
  return { barWeightKg, platesKg };
}

function betterStack(candidate, current){
  if(!current) return candidate;
  if(candidate.length !== current.length) return candidate.length < current.length ? candidate : current;
  // Stable tie-break: use the heavier plates first so the display is easy to
  // scan and the result does not depend on input ordering.
  const a = candidate.slice().sort((x, y)=> y - x);
  const b = current.slice().sort((x, y)=> y - x);
  for(let i = 0; i < a.length; i++) if(a[i] !== b[i]) return a[i] > b[i] ? candidate : current;
  return current;
}

function buildStacks(plateUnits, maxUnits){
  const best = Array(maxUnits + 1).fill(null);
  best[0] = [];
  for(let total = 1; total <= maxUnits; total++){
    for(const plate of plateUnits){
      if(total < plate || !best[total - plate]) continue;
      const candidate = [...best[total - plate], plate / SCALE];
      best[total] = betterStack(candidate, best[total]);
    }
  }
  return best;
}

export function nearestLoadToPlates(targetKg, config = {}){
  const target = Number(targetKg);
  if(!Number.isFinite(target) || target < 0) return null;
  const { barWeightKg, platesKg } = normaliseConfig(config);
  const targetPerSideKg = Math.max(0, (target - barWeightKg) / 2);
  const targetPerSideUnits = Math.round(targetPerSideKg * SCALE);
  const plateUnits = platesKg.map(units).filter(Boolean);
  const largest = Math.max(0, ...plateUnits);
  // One extra largest plate beyond the target is enough to resolve the
  // nearest overshoot while keeping the dynamic programme bounded.
  const maxUnits = Math.max(targetPerSideUnits, largest) + largest;
  const stacks = buildStacks(plateUnits, maxUnits);

  let bestUnits = 0;
  let bestError = Math.abs(targetPerSideUnits);
  for(let total = 1; total <= maxUnits; total++){
    const stack = stacks[total];
    if(!stack) continue;
    const error = Math.abs(total - targetPerSideUnits);
    if(error < bestError || (error === bestError && total < bestUnits)){
      bestUnits = total;
      bestError = error;
    }
  }
  const bestStack = bestUnits ? stacks[bestUnits] || [] : [];
  const loadKg = Math.round((barWeightKg + (bestUnits / SCALE) * 2) * SCALE) / SCALE;
  const deltaKg = Math.round((loadKg - target) * SCALE) / SCALE;
  return {
    targetKg: Math.round(target * SCALE) / SCALE,
    loadKg,
    deltaKg,
    exact: deltaKg === 0,
    direction: deltaKg === 0 ? 'exact' : deltaKg > 0 ? 'over' : 'under',
    barWeightKg,
    platesPerSide: bestStack.slice().sort((a, b)=> b - a),
    platesKg,
  };
}

export function formatPlateStack(stack = []){
  return stack.length ? stack.map(value=> `${value}kg`).join(' + ') : 'no plates';
}

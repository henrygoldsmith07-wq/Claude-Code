// substitutions.js — equipment/muscle/pattern/difficulty-aware substitution.
// Uses movement pattern + muscle + difficulty, plus history-driven performance.
// When history is supplied, prefers variants user has progressed on.

import { EXERCISES, EXERCISE_BY_ID } from "./data.js";

const PATTERN = {
  "push-up": "horizontal-push", "bench-press-barbell": "horizontal-push", "bench-press-dumbbell": "horizontal-push", "chest-press-machine": "horizontal-push", "incline-push-up": "horizontal-push", "incline-dumbbell-press": "horizontal-push",
  "pull-up": "vertical-pull", "lat-pulldown": "vertical-pull", "cable-row": "horizontal-pull", "band-row": "horizontal-pull", "dumbbell-row": "horizontal-pull",
  "bodyweight-squat": "squat", "goblet-squat": "squat", "barbell-squat": "squat", "split-squat": "squat", "bulgarian-split-squat": "squat", "lunge": "lunge",
  "romanian-deadlift": "hinge", "hip-thrust": "hip-extension", "glute-bridge": "hip-extension", "kettlebell-swing": "hinge",
  "overhead-press-dumbbell": "vertical-push", "pike-push-up": "vertical-push", "lateral-raise": "isolation-shoulder", "band-lateral-raise": "isolation-shoulder",
  "bicep-curl": "isolation-arm", "band-curl": "isolation-arm", "tricep-dip-bench": "isolation-arm", "face-pull": "isolation-shoulder",
  "plank": "core-isometric", "dead-bug": "core-control", "hanging-knee-raise": "core-flexion", "leg-raise": "core-flexion", "farmer-carry": "carry",
  "run-easy": "cardio", "brisk-walk": "cardio", "cycle": "cardio", "jump-rope": "cardio", "burpee": "conditioning",
};
const DIFF = { Beginner: 1, Intermediate: 2, Advanced: 3 };

function patternScore(a, b){
  if(!a || !b) return 0;
  if(a===b) return 3;
  const near = new Set(["squat|lunge","horizontal-push|vertical-push","horizontal-pull|vertical-pull","hinge|hip-extension","core-isometric|core-control"]);
  const key = [a,b].sort().join("|");
  if(near.has(key)) return 1.5;
  return 0;
}

export function scoreSubstitution(target, candidate, opts={}){
  let s=0;
  if(target.muscle===candidate.muscle) s+=3;
  const overlap = target.equipment.filter(e=> candidate.equipment.includes(e)).length;
  s += overlap * 0.6;
  s += patternScore(PATTERN[target.id], PATTERN[candidate.id]);
  const d = Math.abs((DIFF[target.level]||2) - (DIFF[candidate.level]||2)); if(d===0) s+=1; else if(d===1) s+=0.3;
  // unilateral match
  const tUni = !!(target.unilateral || isUnilateral(target.id));
  const cUni = !!(candidate.unilateral || isUnilateral(candidate.id));
  if(tUni === cUni) s+=0.5;
  // prefer candidates user has performed well on
  if(opts.historyCounts && opts.historyCounts[candidate.id]) s += Math.min(1, opts.historyCounts[candidate.id]/5);
  if(target.id===candidate.id) s-=10;
  return s;
}

export function rankedSubstitutions(targetId, availableEquipment=null, limit=4, history=null){
  const target = EXERCISE_BY_ID[targetId]; if(!target) return [];
  const has = availableEquipment ? new Set(availableEquipment) : null;
  let pool = EXERCISES.filter(e=> e.id!==targetId);
  if(has) pool = pool.filter(e=> e.equipment.every(eq=> has.has(eq)) || (e.equipment.length===1 && e.equipment[0]==="bodyweight"));
  let historyCounts=null;
  if(history){
    historyCounts={};
    for(const h of history) for(const b of h.blocks||[]) historyCounts[b.exerciseId]=(historyCounts[b.exerciseId]||0)+1;
  }
  const ranked = pool.map(c=> ({ ex: c, score: scoreSubstitution(target, c, { historyCounts }) })).sort((a,b)=> b.score - a.score).slice(0, limit).map(r=> r.ex);
  const declared = (target.substitution||[]).map(id=> EXERCISE_BY_ID[id]).filter(Boolean).filter(c=> !has || c.equipment.every(eq=> has.has(eq)) || (c.equipment.length===1 && c.equipment[0]==="bodyweight"));
  const merged = [...declared];
  for(const ex of ranked) if(!merged.some(m=> m.id===ex.id)) merged.push(ex);
  return merged.slice(0, limit);
}

// Convenience: substitution based on historical user performance (prefers high-volume variants)
export function substitutionByPerformance(targetId, history, availableEquipment=null){
  return rankedSubstitutions(targetId, availableEquipment, 4, history);
}

function isUnilateral(id){ return /lunge|split|single|unilateral|bulgarian/i.test(id || ""); }

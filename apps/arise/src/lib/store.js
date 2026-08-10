const KEY = 'arise.store.v1';

const DEFAULT = {
  version: 1,
  onboarding: null, // { goal, equipment:[], location, level, daysPerWeek }
  activeSchedule: null, // { programId, startDateISO, sessions:[{id,dateISO,status,blocks,...}] }
  history: [], // completed sessions: { id, dateISO, programId, week, day, title, blocks:[{exerciseId, sets:[{reps,weightKg,rpe}]}] }
  preferences: { units: 'kg', theme: null }, // theme: null follows OS
};

export function loadStore(){
  try{
    const raw = localStorage.getItem(KEY);
    if(!raw) return structuredClone(DEFAULT);
    let j = JSON.parse(raw);
    // migrations: keep simple — if version missing, reset schedule but keep onboarding.
    j = runMigrations(j);
    if(!j.history) j.history=[];
    return { ...structuredClone(DEFAULT), ...j };
  }catch{ return structuredClone(DEFAULT); }
}

export function saveStore(s){
  try{ localStorage.setItem(KEY, JSON.stringify(s)); }catch{}
}

export function clearStore(){ try{ localStorage.removeItem(KEY);}catch{} }

export function runMigrations(raw){
  // versioned migrations; keep history intact when adding fields.
  let j=raw;
  if(!j.version || j.version < 1) j = { ...j, version: 1 };
  if(j.version === 1){
    // v1 -> v2: add preferences.syncEnabled default false + normalize history blocks
    if(!j.preferences) j.preferences={ units:'kg', theme:null, syncEnabled:false };
    else if(j.preferences.syncEnabled==null) j.preferences={ ...j.preferences, syncEnabled:false };
    j.version = 2;
  }
  if(j.version === 2){
    // v2 preserves history; readiness will live in preferences or a light readiness.log key later
    j.version = 2;
  }
  return j;
}

// Hevy-style helpers ported from the standalone Life OS fitness module
// (vendor/life-os-scrape) — previous-session lookup and PR helpers.
// Life OS used an eval-based Web Worker for sorting; Arise uses safe in-thread
// helpers instead (see docs in vendor/life-os-scrape/README.md).

/** Last logged sets for an exercise, most recent first. Used in SessionRunner to
 *  show "Last: 20kg ×8" so progressive overload is obvious. */
export function lastExerciseSets(history, exerciseId){
  for(let i = history.length - 1; i >= 0; i--){
    const sess = history[i];
    const block = (sess.blocks || []).find(b => b.exerciseId === exerciseId);
    if(block?.sets?.length) return { dateISO: sess.dateISO, title: sess.title, sets: block.sets };
  }
  return null;
}

/** New PRs hit by a just-saved session vs prior history (Epley 1RM). */
export function prsHitBySession(session, priorHistory){
  const priorBest = new Map();
  for(const h of priorHistory) for(const b of h.blocks || []) for(const s of b.sets || []){
    const w = Number(s.weightKg), r = Number(String(s.reps).match(/\d+/)?.[0] || s.reps);
    if(!(w > 0 && r > 0)) continue;
    const e1rm = w * (1 + r / 30);
    const prev = priorBest.get(b.exerciseId);
    if(!prev || e1rm > prev.e1rm) priorBest.set(b.exerciseId, { e1rm });
  }
  const hits = [];
  for(const b of session.blocks || []) for(const s of b.sets || []){
    const w = Number(s.weightKg), r = Number(String(s.reps).match(/\d+/)?.[0] || s.reps);
    if(!(w > 0 && r > 0)) continue;
    const e1rm = w * (1 + r / 30);
    const prev = priorBest.get(b.exerciseId)?.e1rm || 0;
    if(e1rm > prev + 0.5) hits.push({ exerciseId: b.exerciseId, e1rm: Math.round(e1rm), weight: w, reps: r });
  }
  // dedupe to best per exercise
  const best = new Map();
  for(const h of hits){
    const cur = best.get(h.exerciseId);
    if(!cur || h.e1rm > cur.e1rm) best.set(h.exerciseId, h);
  }
  return [...best.values()].sort((a,b) => b.e1rm - a.e1rm);
}

// Helpers for history-derived stats
export function totalVolumeKg(history){
  let total=0;
  for(const sess of history) for(const b of (sess.blocks||[])) for(const set of (b.sets||[])){
    const reps = Number(set.reps)||0;
    const w = Number(set.weightKg)||0;
    total += reps * w;
  }
  return Math.round(total);
}

export function streakDays(history){
  if(!history.length) return 0;
  const dates = [...new Set(history.map(h=>h.dateISO))].sort();
  let streak=1;
  for(let i=dates.length-1;i>0;i--){
    const a=new Date(dates[i]+'T00:00:00'), b=new Date(dates[i-1]+'T00:00:00');
    const diff = (a-b)/86400000;
    if(diff===1) streak++; else if(diff>1) break;
  }
  return streak;
}

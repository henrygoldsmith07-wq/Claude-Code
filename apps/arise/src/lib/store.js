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
    const j = JSON.parse(raw);
    // migrations: keep simple — if version missing, reset schedule but keep onboarding.
    if(!j.version) return { ...structuredClone(DEFAULT), onboarding: j.onboarding || null };
    return { ...structuredClone(DEFAULT), ...j };
  }catch{ return structuredClone(DEFAULT); }
}

export function saveStore(s){
  try{ localStorage.setItem(KEY, JSON.stringify(s)); }catch{}
}

export function clearStore(){ try{ localStorage.removeItem(KEY);}catch{} }

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

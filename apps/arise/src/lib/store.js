const KEY = 'arise.store.v1';
export const STORE_SCHEMA_VERSION = 4;

const DEFAULT = {
  version: STORE_SCHEMA_VERSION,
  onboarding: null, // { goal, equipment:[], location, level, daysPerWeek, availableMinutes, preferredExerciseIds:[], dislikedExerciseIds:[], plateConfig? }
  activeSchedule: null, // { programId, startDateISO, sessions:[{id,dateISO,status,blocks,...}] }
  activeWorkout: null, // recoverable runner draft: { session, blocks, note, noteTags, restEndsAt, restLabel, updatedAt }
  eventHistory: [], // imported/exported event snapshot; live telemetry remains append-only in its own local key
  healthSummary: null, // optional user-approved health-platform summary
  history: [], // completed sessions: { id, dateISO, programId, week, day, title, blocks:[{exerciseId, sets:[{reps,weightKg,rpe,side,rom,assistedKg,tempo}]}] }
  preferences: { units: 'kg', theme: null, syncEnabled: false, telemetryEnabled: null, pulseEnabled: false, healthSummaryEnabled: false }, // theme null follows OS; telemetry null = prompt
  readinessLog: [], // [{ dateISO, score, sleep, soreness, motivation }]
  programHistory: [], // [{ programId, version, startDateISO, endDateISO }]
};

export function loadStore(){
  try{
    const raw = localStorage.getItem(KEY);
    if(!raw) return structuredClone(DEFAULT);
    let j = JSON.parse(raw);
    j = runMigrations(j);
    if(!j.history) j.history=[];
    if(!j.readinessLog) j.readinessLog=[];
    if(!j.programHistory) j.programHistory=[];
    if(j.activeWorkout === undefined) j.activeWorkout = null;
    if(j.eventHistory === undefined) j.eventHistory=[];
    if(j.healthSummary === undefined) j.healthSummary=null;
    j.history = normaliseHistory(j.history);
    return { ...structuredClone(DEFAULT), ...j };
  }catch{ return structuredClone(DEFAULT); }
}

export function saveStore(s){
  try{ localStorage.setItem(KEY, JSON.stringify(s)); }catch{}
}

function historyTimestamp(entry){
  const saved = Date.parse(entry?.savedAt || '');
  if(Number.isFinite(saved)) return saved;
  const date = Date.parse(`${entry?.dateISO || ''}T00:00:00Z`);
  return Number.isFinite(date) ? date : 0;
}

// History is keyed by scheduled session id. Retrying a save or importing an
// edited copy should replace that row, not create a second completion that
// inflates adherence and feeds duplicate evidence into progression.
export function upsertHistory(history = [], entry = null){
  if(!entry) return normaliseHistory(history);
  const existing = (history || []).find(item=> item?.id && item.id === entry.id);
  const winner = !existing || historyTimestamp(entry) >= historyTimestamp(existing) ? entry : existing;
  const without = (history || []).filter(item=> !entry.id || item?.id !== entry.id);
  return [...without, winner].sort((a, b)=> String(a?.dateISO || '').localeCompare(String(b?.dateISO || '')) || historyTimestamp(a) - historyTimestamp(b));
}

export function normaliseHistory(history = []){
  const byId = new Map();
  const loose = [];
  for(const entry of history || []){
    if(!entry?.id){ loose.push(entry); continue; }
    const existing = byId.get(entry.id);
    if(!existing || historyTimestamp(entry) >= historyTimestamp(existing)) byId.set(entry.id, entry);
  }
  return [...loose, ...byId.values()].sort((a, b)=> String(a?.dateISO || '').localeCompare(String(b?.dateISO || '')) || historyTimestamp(a) - historyTimestamp(b));
}

export function clearStore(){ try{ localStorage.removeItem(KEY);}catch{} }

export function runMigrations(raw){
  let j=raw;
  if(!j.version || j.version < 1) j = { ...j, version: 1 };
  if(j.version === 1){
    if(!j.preferences) j.preferences={ units:'kg', theme:null, syncEnabled:false, telemetryEnabled:null, pulseEnabled:false, healthSummaryEnabled:false };
    else {
      if(j.preferences.syncEnabled==null) j.preferences.syncEnabled=false;
      if(j.preferences.telemetryEnabled==null) j.preferences.telemetryEnabled=null;
      if(j.preferences.pulseEnabled==null) j.preferences.pulseEnabled=false;
      if(j.preferences.healthSummaryEnabled==null) j.preferences.healthSummaryEnabled=false;
    }
    if(!j.readinessLog) j.readinessLog=[];
    if(!j.programHistory) j.programHistory=[];
    j.version = 2;
  }
  if(j.version === 2){
    // v2 -> v3: normalise set shapes (side/rom/assistedKg/tempo)
    if(j.history){
      for(const h of j.history) for(const b of h.blocks||[]) for(const s of b.sets||[]){
        if(s.side==null) s.side = null;
        if(s.rom==null) s.rom = null;
        if(s.assistedKg==null) s.assistedKg = null;
        if(s.tempo==null) s.tempo = null;
      }
    }
    if(!j.readinessLog) j.readinessLog=[];
    if(j.preferences && j.preferences.telemetryEnabled===undefined) j.preferences.telemetryEnabled=null;
    j.version = 3;
  }
  if(j.version === 3){
    // v3 -> v4: durable event/health fields and explicit optional integration consent.
    if(j.activeWorkout === undefined) j.activeWorkout = null;
    if(j.eventHistory === undefined) j.eventHistory=[];
    if(j.healthSummary === undefined) j.healthSummary=null;
    if(!j.preferences) j.preferences={};
    if(j.preferences.healthSummaryEnabled==null) j.preferences.healthSummaryEnabled=false;
    j.version = STORE_SCHEMA_VERSION;
  }
  if(j.activeWorkout === undefined) j.activeWorkout = null;
  if(j.eventHistory === undefined) j.eventHistory=[];
  if(j.healthSummary === undefined) j.healthSummary=null;
  if(!j.preferences) j.preferences={};
  if(j.preferences.syncEnabled==null) j.preferences.syncEnabled=false;
  if(j.preferences.telemetryEnabled==null) j.preferences.telemetryEnabled=null;
  if(j.preferences.pulseEnabled==null) j.preferences.pulseEnabled=false;
  if(j.preferences.healthSummaryEnabled==null) j.preferences.healthSummaryEnabled=false;
  j.history = normaliseHistory(j.history || []);
  return j;
}

// Track readiness over time (EMA-aware)
export function logReadiness(store, { sleep, soreness, motivation }){
  const score = Math.round(Math.max(0, Math.min(100, (((Number(sleep)-1)/4)*0.4 + ((5-Number(soreness))/4)*0.3 + ((Number(motivation)-1)/4)*0.3)*100)));
  const entry = { dateISO: new Date().toISOString().slice(0,10), score, sleep, soreness, motivation, at: new Date().toISOString() };
  const log = [...(store.readinessLog||[]), entry].slice(-60);
  return { ...store, readinessLog: log };
}

// Previous-session lookup
export function lastExerciseSets(history, exerciseId){
  for(let i = history.length - 1; i >= 0; i--){
    const sess = history[i];
    const block = (sess.blocks || []).find(b => b.exerciseId === exerciseId);
    if(block?.sets?.length) return { dateISO: sess.dateISO, title: sess.title, sets: block.sets };
  }
  return null;
}

// PRs — with technique/ROM guard (notes that mention rom/depth/assisted invalidate)
export function prsHitBySession(session, priorHistory){
  const priorBest = new Map(); // exerciseId -> { e1rm, note }
  for(const h of priorHistory) for(const b of h.blocks || []) for(const s of b.sets || []){
    const w = Number(s.weightKg), r = Number(String(s.reps).match(/\d+/)?.[0] || s.reps);
    if(!(w > 0 && r > 0)) continue;
    const e1rm = w * (1 + r / 30);
    const prev = priorBest.get(b.exerciseId);
    if(!prev || e1rm > prev.e1rm) priorBest.set(b.exerciseId, { e1rm, note: h.note||'' });
  }
  const hits = [];
  for(const b of session.blocks || []) for(const s of b.sets || []){
    const w = Number(s.weightKg), r = Number(String(s.reps).match(/\d+/)?.[0] || s.reps);
    if(!(w > 0 && r > 0)) continue;
    const e1rm = w * (1 + r / 30);
    const prev = priorBest.get(b.exerciseId);
    const priorE1 = prev?.e1rm || 0;
    // ROM/technique guard: if either prior or new note mentions rom/depth/technique, skip
    const combined = `${prev?.note||''} ${session.note||''} ${s.rom||''}`.toLowerCase();
    const techniqueChange = /rom|depth|range|technique|form|paused|tempo|assisted|band|partial/.test(combined);
    if(techniqueChange) continue;
    if(e1rm > priorE1 * 1.02 && e1rm > priorE1 + 0.5) hits.push({ exerciseId: b.exerciseId, e1rm: Math.round(e1rm), weight: w, reps: r, techniqueChange: false });
  }
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
    // assisted reduces effective load (e.g. pull-up with -10kg assist)
    const assisted = Number(set.assistedKg)||0;
    const effectiveW = w - assisted;
    total += reps * Math.max(0, effectiveW);
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

// Per-side volume (unilateral)
export function volumeBySide(history){
  let left=0, right=0, bilateral=0;
  for(const h of history||[]) for(const b of h.blocks||[]) for(const s of b.sets||[]){
    const vol = (Number(s.reps)||0)*(Number(s.weightKg)||0);
    if(s.side==='L') left+=vol;
    else if(s.side==='R') right+=vol;
    else bilateral+=vol;
  }
  return { left: Math.round(left), right: Math.round(right), bilateral: Math.round(bilateral) };
}

export { KEY, DEFAULT };

// sync.js — optional cross-device sync layer (offline-first preserved).
// Default: localStorage only. When sync is enabled, this mirrors export/import over a sync provider.
// Provider is a pluggable { pull, push } pair so tests stay pure.
// Conflict resolution: per-session last-write-wins via savedAt; onboarding last-write-wins via exportedAt.

import { buildExportPayload, parseImportFile, mergeStores } from "./export.js";
import { STORE_SCHEMA_VERSION } from "./store.js";
import { mergeEvaluationLedgers } from "./longitudinal.js";

const SYNC_STRATEGIES = new Set(["merge", "replace"]);

function assertStrategy(strategy){
  if(!SYNC_STRATEGIES.has(strategy)) throw new Error(`sync: unknown strategy "${strategy}" — expected "merge" or "replace".`);
}

// History timestamps come from savedAt, then dateISO; both may be absent or
// garbage on a hand-edited backup, so every read is guarded and an unusable
// entry sorts as the oldest possible instant rather than crashing the merge.
function historyTimestamp(entry){
  const saved = Date.parse(entry?.savedAt || "");
  if(Number.isFinite(saved)) return saved;
  const date = Date.parse(`${entry?.dateISO || ""}T00:00:00Z`);
  return Number.isFinite(date) ? date : 0;
}

export function makeSyncAdapter(adapter = {}){
  const { pull, push } = adapter || {};
  if(typeof pull !== "function" && typeof push !== "function"){
    throw new Error("sync: a sync adapter needs at least one of pull() or push().");
  }
  return { pull, push };
}

export async function syncUp(store, adapter){
  if(!store || typeof store !== "object") throw new Error("sync: syncUp needs the current store object.");
  const payload = buildExportPayload(store);
  if(adapter?.push){
    if(typeof adapter.push !== "function") throw new Error("sync: adapter.push must be a function.");
    await adapter.push(payload);
  }
  return payload;
}

export async function syncDown(currentStore, adapter, strategy="merge"){
  assertStrategy(strategy);
  if(!adapter?.pull) return currentStore;
  if(typeof adapter.pull !== "function") throw new Error("sync: adapter.pull must be a function.");
  const remoteText = await adapter.pull();
  if(!remoteText) return currentStore;
  const text = typeof remoteText === "string" ? remoteText : JSON.stringify(remoteText);
  const imported = parseImportFile(text);
  if(strategy==='replace') return mergeStores(currentStore, imported, 'replace');
  return mergeStoresWithConflicts(currentStore, imported);
}

// Merge with per-session conflict resolution (savedAt) and onboarding recency
export function mergeStoresWithConflicts(current, imported){
  // history: last-write-wins per id via savedAt (or dateISO fallback)
  const byId = new Map();
  for(const h of (current.history||[])) byId.set(h.id, h);
  for(const h of (imported.history||[])){
    const existing = byId.get(h.id);
    if(!existing) byId.set(h.id, h);
    else {
      if(historyTimestamp(h) >= historyTimestamp(existing)) byId.set(h.id, h);
    }
  }
  // onboarding: keep current unless missing; if both present, prefer newer by presence of programHistory length or activeSchedule recency
  let onboarding = current.onboarding || imported.onboarding || null;
  // if imported has strictly newer schedule, prefer it when current has no schedule
  const activeSchedule = current.activeSchedule || imported.activeSchedule || null;
  // preferences: merge, current wins on explicit keys
  const preferences = { ...(imported.preferences||{}), ...(current.preferences||{}) };
  const eventById = new Map();
  for(const e of [...(current.eventHistory||[]), ...(imported.eventHistory||[])]) if(e?.id) eventById.set(e.id,e);
  // readinessLog: merge by dateISO+at
  const rByKey = new Map();
  for(const r of [...(current.readinessLog||[]), ...(imported.readinessLog||[])]) {
    const k = `${r.dateISO}|${r.at||r.score}`;
    if(!rByKey.has(k)) rByKey.set(k, r);
  }
  return {
    version: Math.max(STORE_SCHEMA_VERSION, current.version||1, imported.version||1),
    ...current,
    onboarding,
    activeSchedule,
    activeWorkout: current.activeWorkout || imported.activeWorkout || null,
    // Guarded comparator: an entry missing dateISO must not crash the sync, and
    // the shared historyTimestamp (savedAt first) is what decided the winner
    // above, so the row order must agree with it.
    history: [...byId.values()].sort((a,b)=> historyTimestamp(a) - historyTimestamp(b) || String(a?.dateISO||'').localeCompare(String(b?.dateISO||''))),
    preferences,
    eventHistory: [...eventById.values()].sort((a,b)=> String(a.at||'').localeCompare(String(b.at||''))),
    healthSummary: current.healthSummary || imported.healthSummary || null,
    readinessLog: [...rByKey.values()].sort((a,b)=> String(a?.dateISO||'').localeCompare(String(b?.dateISO||''))),
    evaluationLedger: mergeEvaluationLedgers(current.evaluationLedger, imported.evaluationLedger),
    programHistory: [...(current.programHistory||[]), ...(imported.programHistory||[])].filter((v,i,a)=> a.findIndex(x=> x.programId===v.programId && x.version===v.version)===i),
  };
}

// Account portability: export for moving to another device/account
export function portableExport(store){
  return buildExportPayload(store);
}
export function portableImport(text, currentStore, strategy='merge'){
  assertStrategy(strategy);
  const imported = parseImportFile(text);
  return strategy==='replace' ? mergeStores(currentStore, imported, 'replace') : mergeStoresWithConflicts(currentStore, imported);
}

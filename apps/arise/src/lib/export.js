// Export / restore / import — versioned JSON backup for local-first data.
// No cloud sync; the user owns the file.

export const EXPORT_VERSION = 2;

export function buildExportPayload(store){
  return {
    app: 'arise',
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    data: store,
  };
}

export function downloadJson(filename, obj){
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(()=> URL.revokeObjectURL(url), 2000);
}

export function parseImportFile(text){
  let parsed;
  try{ parsed = JSON.parse(text); } catch { throw new Error('Not valid JSON.'); }
  const data = parsed?.data ? parsed.data : parsed;
  if(!data || typeof data !== 'object') throw new Error('Import file is empty or malformed.');
  if(parsed?.app && parsed.app !== 'arise') throw new Error('This backup is not for Arise.');
  if(!('history' in data) && !('onboarding' in data) && !('activeSchedule' in data)){
    throw new Error('Unrecognised backup shape — missing history/onboarding/schedule.');
  }
  return data;
}

export function mergeStrategyLabel(strategy){
  return strategy === 'replace' ? 'Replace (overwrite this device)' : 'Merge (keep both, de-dupe by session id)';
}

export function mergeStores(current, imported, strategy='merge'){
  if(strategy==='replace') return { ...imported, version: current.version || 1 };
  const byId = new Map();
  for(const h of (current.history||[])) byId.set(h.id, h);
  for(const h of (imported.history||[])) if(!byId.has(h.id)) byId.set(h.id, h);
  return {
    version: current.version || imported.version || 1,
    onboarding: current.onboarding || imported.onboarding || null,
    activeSchedule: current.activeSchedule || imported.activeSchedule || null,
    history: [...byId.values()].sort((a,b)=> a.dateISO.localeCompare(b.dateISO)),
    preferences: { ...(imported.preferences||{}), ...(current.preferences||{}) },
    readinessLog: [...(current.readinessLog||[]), ...(imported.readinessLog||[])].filter((v,i,a)=> a.findIndex(x=> x.dateISO===v.dateISO && x.at===v.at)===i),
    programHistory: [...(current.programHistory||[]), ...(imported.programHistory||[])].filter((v,i,a)=> a.findIndex(x=> x.programId===v.programId && x.version===v.version)===i),
  };
}

// Data portability: full export in portable JSON + selective export
export function portableJson(store){
  return JSON.stringify(buildExportPayload(store), null, 2);
}
export function portableCsv(history){
  const rows = [['dateISO','exerciseId','reps','weightKg','rpe','side','rom']];
  for(const h of history||[]) for(const b of h.blocks||[]) for(const s of b.sets||[]){
    rows.push([h.dateISO, b.exerciseId, s.reps||'', s.weightKg||'', s.rpe||'', s.side||'', s.rom||'']);
  }
  return rows.map(r=> r.map(v=> `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
}

// Deletion: remove all personal data but keep app shell
export function deletionPreview(store){
  return {
    historyCount: (store.history||[]).length,
    schedulePresent: !!store.activeSchedule,
    onboardingPresent: !!store.onboarding,
    readinessCount: (store.readinessLog||[]).length,
  };
}

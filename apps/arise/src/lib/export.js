// Export / restore / import — versioned JSON backup for local-first data.
// No cloud sync; the user owns the file.

export const EXPORT_VERSION = 1;

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
  // Accept either wrapped {app,version,data} or raw store
  const data = parsed?.data ? parsed.data : parsed;
  if(!data || typeof data !== 'object') throw new Error('Import file is empty or malformed.');
  if(parsed?.app && parsed.app !== 'arise') throw new Error('This backup is not for Arise.');
  // Basic shape check
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
  // merge: union of history by id, keep current onboarding unless missing, keep activeSchedule if current exists
  const byId = new Map();
  for(const h of (current.history||[])) byId.set(h.id, h);
  for(const h of (imported.history||[])) if(!byId.has(h.id)) byId.set(h.id, h);
  return {
    version: current.version || imported.version || 1,
    onboarding: current.onboarding || imported.onboarding || null,
    activeSchedule: current.activeSchedule || imported.activeSchedule || null,
    history: [...byId.values()].sort((a,b)=> a.dateISO.localeCompare(b.dateISO)),
    preferences: { ...(imported.preferences||{}), ...(current.preferences||{}) },
  };
}

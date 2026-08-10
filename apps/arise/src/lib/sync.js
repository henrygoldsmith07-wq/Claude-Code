// sync.js — optional cross-device sync layer (offline-first preserved).
// Default: localStorage only. When sync is enabled, this mirrors export/import over a sync provider.
// Here the provider is a pluggable { pull, push } pair so tests stay pure.

import { buildExportPayload, parseImportFile, mergeStores } from "./export.js";

export function makeSyncAdapter({ pull, push }){ return { pull, push }; }

export async function syncUp(store, adapter){
  const payload = buildExportPayload(store);
  if(adapter?.push) await adapter.push(payload);
  return payload;
}

export async function syncDown(currentStore, adapter, strategy="merge"){
  if(!adapter?.pull) return currentStore;
  const remoteText = await adapter.pull();
  if(!remoteText) return currentStore;
  const text = typeof remoteText === "string" ? remoteText : JSON.stringify(remoteText);
  const imported = parseImportFile(text);
  return mergeStores(currentStore, imported, strategy);
}

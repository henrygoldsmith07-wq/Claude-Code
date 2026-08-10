// Downloadable/offline practice pack: bundle due cards + sentences for offline use.
// Stored as JSON; no backend.
export function buildOfflinePack({ vocab, sentences, grammar }){
  return { version: 1, createdAt: new Date().toISOString(), vocab: (vocab||[]).slice(0,50), sentences: (sentences||[]).slice(0,30), grammar: (grammar||[]).slice(0,10) };
}
export function offlinePackSize(pack){ return JSON.stringify(pack).length; }

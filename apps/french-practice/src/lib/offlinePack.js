// Downloadable/offline practice pack: bundle due cards + sentences + exam packs for offline use.
// Versioned, CacheStorage-aware. Stored as JSON; no backend.

export function buildOfflinePack({ vocab, sentences, grammar, fsrsDue, phonemes, exams }){
  return {
    version: 2,
    createdAt: new Date().toISOString(),
    vocab: (vocab||[]).slice(0,60),
    sentences: (sentences||[]).slice(0,30),
    grammar: (grammar||[]).slice(0,12),
    fsrsDue: (fsrsDue||[]).slice(0,40),
    phonemes: (phonemes||[]).slice(0,8),
    exams: (exams||[]).slice(0,6),
  };
}
export function offlinePackSize(pack){ return JSON.stringify(pack).length; }
export function offlinePackSummary(pack){
  return { version: pack.version, vocab: pack.vocab.length, sentences: pack.sentences.length, grammar: pack.grammar.length, createdAt: pack.createdAt };
}

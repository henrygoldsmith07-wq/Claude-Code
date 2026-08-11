import type { Entry } from "./types";

// ── token helpers ──────────────────────────────────────────────────────
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function toks(s: string): string[] {
  return norm(s).split(" ").filter((t) => t.length >= 2);
}

// ── plain text search ──────────────────────────────────────────────────
export function searchEntries(entries: Entry[], q: string): Entry[] {
  const query = norm(q);
  if (!query) return entries;
  const qTokens = new Set(toks(q));
  if (qTokens.size === 0) return entries;
  return entries.filter((e) => {
    const hay = [
      e.title,
      e.summary?.trace.event ?? "",
      ...(e.summary?.trace.observations ?? []),
      ...(e.summary?.trace.assumptions ?? []),
      e.summary?.trace.namedEmotion ?? "",
      e.summary?.coreEmotion ?? "",
      ...(e.summary?.underlyingTriggers ?? []),
      ...(e.summary?.possibleBiases.map((b) => b.type + " " + b.description) ?? []),
      e.summary?.otherPerspective ?? "",
      e.summary?.balancedAssessment ?? "",
      e.longitudinalReview?.actualOutcome ?? "",
      e.longitudinalReview?.calibrationNote ?? "",
      ...e.messages.map((m) => m.content),
    ]
      .join(" ")
      .toLowerCase();
    const hayTokens = new Set(toks(hay));
    for (const t of qTokens) if (!hayTokens.has(t) && !hay.includes(t)) return false;
    return true;
  });
}

// ── lightweight semantic search (TF-IDF + cosine over sparse vectors) ─
// No model dependency — runs entirely locally, so "local-only mode" stays local.
// Rank by TF-IDF cosine between query and entry document.
// Caps + token-set caching so it stays fast even with many entries.

function buildDoc(e: Entry): string {
  return [
    e.title,
    e.summary?.trace.event ?? "",
    ...(e.summary?.trace.observations ?? []),
    ...(e.summary?.trace.assumptions ?? []),
    ...(e.summary?.trace.alternativeInterpretations ?? []),
    e.summary?.trace.namedEmotion ?? "",
    e.summary?.coreEmotion ?? "",
    ...(e.summary?.underlyingTriggers ?? []),
  ].join(" ");
}

function tf(tokens: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tokens) m.set(t, (m.get(t) ?? 0) + 1);
  const n = tokens.length || 1;
  for (const [k, v] of m) m.set(k, v / n);
  return m;
}

export interface SemanticHit {
  entry: Entry;
  score: number; // 0..1 cosine
}

export function semanticSearch(entries: Entry[], q: string, topK = 20): SemanticHit[] {
  const qTokens = toks(q);
  if (qTokens.length === 0 || entries.length === 0) return [];
  // Cap: beyond ~200 entries, shard or require more specific query
  const capped = entries.length > 500 ? entries.slice(0, 500) : entries;
  const docs = capped.map(buildDoc);
  // Cache token arrays + sets per doc to avoid recomputing toks N× per df scan
  const docTokens: string[][] = docs.map((d) => toks(d));
  const docSets: Set<string>[] = docTokens.map((arr) => new Set(arr));
  const qSet = new Set(qTokens);
  const allTokens = new Set<string>([...qSet, ...docTokens.flat().filter((_, i) => i < 2000)]);
  // Include remaining unique tokens beyond first 2000 via sets
  for (const s of docSets) for (const t of s) allTokens.add(t);
  // doc frequency
  const df = new Map<string, number>();
  for (const t of allTokens) {
    let c = 0;
    if (qSet.has(t)) c++;
    for (const s of docSets) if (s.has(t)) c++;
    df.set(t, c);
  }
  const N = docs.length + 1;
  function idf(t: string): number {
    const d = df.get(t) ?? 1;
    return Math.log((N + 1) / (d + 0.5));
  }
  const qTf = tf(qTokens);
  const qVec = new Map<string, number>();
  for (const [t, v] of qTf) qVec.set(t, v * idf(t));
  const qNorm = Math.sqrt([...qVec.values()].reduce((s, v) => s + v * v, 0)) || 1;

  const hits: SemanticHit[] = [];
  for (let i = 0; i < capped.length; i++) {
    const dTok = docTokens[i];
    if (dTok.length === 0) continue;
    const dTf = tf(dTok);
    const dVec = new Map<string, number>();
    for (const [t, v] of dTf) dVec.set(t, v * idf(t));
    let dot = 0;
    for (const [t, qv] of qVec) {
      const dv = dVec.get(t);
      if (dv) dot += qv * dv;
    }
    const dNorm = Math.sqrt([...dVec.values()].reduce((s, v) => s + v * v, 0)) || 1;
    const score = dot / (qNorm * dNorm);
    if (score > 0.02) hits.push({ entry: capped[i], score });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, topK);
}

// ── tags / topics derived locally (no LLM) ────────────────────────────
// Topics are lightweight clusters: emotion + trigger tokens + recurring n-grams.
export function entryTags(e: Entry): string[] {
  const tags = new Set<string>();
  const emo = norm(e.summary?.coreEmotion ?? e.summary?.trace.namedEmotion ?? "");
  if (emo) tags.add(emo);
  for (const t of e.summary?.underlyingTriggers ?? []) {
    const n = norm(t);
    if (n) tags.add(n.slice(0, 32));
  }
  for (const b of e.summary?.possibleBiases ?? []) {
    const n = norm(b.type);
    if (n) tags.add(`pattern:${n}`);
  }
  // add first two assumptions as short topic phrases (deduped)
  for (const a of (e.summary?.trace.assumptions ?? []).slice(0, 2)) {
    const n = norm(a);
    if (n.length >= 8) tags.add(n.slice(0, 36));
  }
  return [...tags].slice(0, 8);
}

export function allTopics(entries: Entry[]): { tag: string; count: number; entryIds: string[] }[] {
  const m = new Map<string, string[]>();
  for (const e of entries) {
    for (const t of entryTags(e)) {
      const arr = m.get(t) ?? [];
      arr.push(e.id);
      m.set(t, arr);
    }
  }
  return [...m.entries()]
    .map(([tag, ids]) => ({ tag, count: ids.length, entryIds: ids }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 24);
}

// ── relationships between reflections (evidence-linked) ────────────────
export interface EntryLink {
  a: string;
  b: string;
  reason: string;
  strength: number; // 0..1
}

export function entryRelationships(entries: Entry[]): EntryLink[] {
  const out: EntryLink[] = [];
  const completed = entries.filter((e) => e.summary);
  for (let i = 0; i < completed.length; i++) {
    for (let j = i + 1; j < completed.length; j++) {
      const a = completed[i], b = completed[j];
      const triggersA = new Set((a.summary!.underlyingTriggers ?? []).map(norm));
      const triggersB = new Set((b.summary!.underlyingTriggers ?? []).map(norm));
      const sharedTrigger = [...triggersA].some((t) => triggersB.has(t));
      const emoA = norm(a.summary!.coreEmotion);
      const emoB = norm(b.summary!.coreEmotion);
      const sameEmo = emoA && emoA === emoB;
      // assumption overlap via jaccard-ish
      const assA = (a.summary!.trace.assumptions ?? []).map(norm).join(" ");
      const assB = (b.summary!.trace.assumptions ?? []).map(norm).join(" ");
      const assTokensA = new Set(toks(assA));
      const assTokensB = new Set(toks(assB));
      let inter = 0;
      for (const t of assTokensA) if (assTokensB.has(t)) inter++;
      const unionSize = assTokensA.size + assTokensB.size - inter;
      const jacc = unionSize ? inter / unionSize : 0;
      const reasons: string[] = [];
      let strength = 0;
      if (sharedTrigger) { reasons.push("shared trigger"); strength += 0.4; }
      if (sameEmo) { reasons.push(`same emotion: ${emoA}`); strength += 0.3; }
      if (jacc >= 0.35) { reasons.push("similar assumption"); strength += jacc * 0.5; }
      if (reasons.length >= 1 && strength >= 0.3) {
        out.push({ a: a.id, b: b.id, reason: reasons.join(" · "), strength: Math.min(1, strength) });
      }
    }
  }
  return out.sort((x, y) => y.strength - x.strength).slice(0, 24);
}

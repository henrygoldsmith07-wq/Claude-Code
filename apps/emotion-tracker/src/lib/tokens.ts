// tokens.ts — shared local tokenisation helpers for Reflect.
// Recurring-assumption grouping, contradiction detection and semantic search
// must treat words the same way, or "ignoring" vs "ignore" would group in one
// place and miss in the other. Single source of truth, no deps.

export function norm(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

/** Exact-ish tokens (len ≥ 3) — used where substring-preserving matter counts. */
export function tokens(s: string): Set<string> {
  return new Set(norm(s).split(" ").filter((t) => t.length >= 3));
}

// Stem-lite + stopword removal for *similarity* grouping only (norm() stays
// untouched so negation detection and display text are unaffected). This makes
// recurring-assumption detection group "they keep ignoring my messages" with
// "they are ignoring my messages again" — same stem, same meaning.
export const STOPWORDS = new Set([
  "they", "them", "their", "the", "and", "that", "this", "with", "will", "not", "are", "was", "were",
  "have", "has", "had", "for", "but", "its", "you", "your", "there", "then", "just", "like",
  "about", "into", "from", "would", "could", "should", "because", "again", "still", "always", "never",
]);

export function stemLite(w: string): string {
  if (w.length <= 4) return w;
  if (w.endsWith("ing")) return w.slice(0, -3);
  if (w.endsWith("ed")) return w.slice(0, -2);
  if (w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.endsWith("es")) return w.slice(0, -2);
  if (w.endsWith("s")) return w.slice(0, -1);
  // strip a final "e" so "ignoring"→"ignor" matches "ignore"→"ignor"
  if (w.endsWith("e")) return w.slice(0, -1);
  return w;
}

/** Stemmed, stopword-free tokens — for similarity and search ranking. */
export function simTokens(s: string): string[] {
  return norm(s).split(" ").map(stemLite).filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

export function jaccard(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Short tokens (len ≥ 2) — for search where single words like "cat" must hit. */
export function toks(s: string): string[] {
  return norm(s).split(" ").filter((t) => t.length >= 2);
}

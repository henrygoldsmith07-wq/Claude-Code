// adversarial.ts — detect and handle inputs that should NOT become user facts.
// Sarcasm, quoted messages, fiction, copied articles, lyrics/quotes,
// contradictory entries, prompt injection, third-person, misleading text.

export type AdversarialFlag =
  | "prompt_injection"
  | "quoted_content"
  | "third_person"
  | "fictional"
  | "copied_article"
  | "lyrics_or_quote"
  | "sarcasm"
  | "contradictory"
  | "misleading";

export interface AdversarialCheck {
  flag: AdversarialFlag;
  confidence: number; // 0..1
  reason: string;
  excerpt: string; // first 80 chars
}

const INJECTION_RE = /(ignore (previous|all) instructions|system prompt|you are now|jailbreak|do anything now|developer mode|act as|pretend you are)/i;
const QUOTED_RE = /^\s*["'“”‘’`]|said:\s*["'“”]|^>\s|^—\s*["'“”]/m;
const THIRD_PERSON_RE = /\b(he said|she said|they said|my friend said|my partner thinks)\b/i;
const FICTION_RE = /\b(once upon a time|chapter \d+|novel|story about|fictional character|in the story)\b/i;
const ARTICLE_RE = /\b(according to (the )?article|research shows|study found|copyright ©|all rights reserved)\b/i;
const LYRICS_RE = /\[verse|\[chorus\]|\[bridge\]|\(chorus\)|lyrics:/i;
const SARCASM_RE = /(yeah right|sure,? (jan|buddy)|obviously.*not|great,? (just )?great|as if|totally (not )?)/i;

// Very conservative: flag only when multiple signals coincide
export function detectAdversarial(text: string, opts: { previousEntries?: string[] } = {}): AdversarialCheck[] {
  const out: AdversarialCheck[] = [];
  const s = String(text);
  const lower = s.toLowerCase();
  const excerpt = s.slice(0, 80);

  if (INJECTION_RE.test(s)) {
    out.push({ flag: "prompt_injection", confidence: 0.95, reason: "Contains instruction-override phrasing", excerpt });
  }
  if (QUOTED_RE.test(s) || (s.includes('"') && s.split('"').length >= 4)) {
    out.push({ flag: "quoted_content", confidence: 0.6, reason: "Appears to be quoted or relayed text, not the user's direct experience", excerpt });
  }
  if (THIRD_PERSON_RE.test(s)) {
    out.push({ flag: "third_person", confidence: 0.55, reason: "Third-person content — may not be the user's own situation", excerpt });
  }
  if (FICTION_RE.test(s)) {
    out.push({ flag: "fictional", confidence: 0.7, reason: "Fictional framing detected", excerpt });
  }
  if (ARTICLE_RE.test(s) && s.length > 300) {
    out.push({ flag: "copied_article", confidence: 0.65, reason: "Long copied article-like text", excerpt });
  }
  if (LYRICS_RE.test(s) || (lower.includes("lyrics") && s.length < 500)) {
    out.push({ flag: "lyrics_or_quote", confidence: 0.7, reason: "Lyrics or quoted verse formatting", excerpt });
  }
  if (SARCASM_RE.test(lower) && /!|\bactually\b/i.test(s)) {
    out.push({ flag: "sarcasm", confidence: 0.5, reason: "Possible sarcasm — literal reading may be opposite", excerpt });
  }
  if (opts.previousEntries && opts.previousEntries.length) {
    // contradictory: same trigger opposite valence quick heuristic
    for (const prev of opts.previousEntries.slice(0, 8)) {
      const prevNorm = prev.toLowerCase();
      if (prevNorm.includes("always") && lower.includes("never") && overlap(prev, s) > 0.3) {
        out.push({ flag: "contradictory", confidence: 0.6, reason: "Contradicts a previous entry on a similar situation", excerpt });
        break;
      }
      if (prevNorm.includes("never") && lower.includes("always") && overlap(prev, s) > 0.3) {
        out.push({ flag: "contradictory", confidence: 0.6, reason: "Contradicts a previous entry on a similar situation", excerpt });
        break;
      }
    }
  }
  // misleading: very short + absolute claims + no evidence
  if (s.trim().split(/\s+/).length < 10 && /\b(always|never|everyone|no one|all|none)\b/i.test(s)) {
    out.push({ flag: "misleading", confidence: 0.45, reason: "Very brief absolute claim — treat as hypothesis, not fact", excerpt });
  }

  return out;
}

function overlap(a: string, b: string): number {
  const ta = new Set(a.toLowerCase().split(/\s+/).filter((t) => t.length >= 3));
  const tb = new Set(b.toLowerCase().split(/\s+/).filter((t) => t.length >= 3));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / Math.min(ta.size, tb.size);
}

export function shouldNotAutoConvert(text: string, opts?: { previousEntries?: string[] }): boolean {
  const flags = detectAdversarial(text, opts);
  // Block auto-conversion if injection, fiction, copied article, or high-confidence contradictory
  return flags.some((f) => f.flag === "prompt_injection" || f.flag === "fictional" || f.flag === "copied_article" || (f.flag === "quoted_content" && f.confidence >= 0.6));
}

export function adversarialSummary(flags: AdversarialCheck[]): string | null {
  if (!flags.length) return null;
  return flags.map((f) => `${f.flag} (${Math.round(f.confidence * 100)}%): ${f.reason}`).join("; ");
}

export function sanitizeForFactExtraction(text: string): { clean: string; flags: AdversarialCheck[]; blocked: boolean } {
  const flags = detectAdversarial(text);
  const blocked = shouldNotAutoConvert(text);
  // If quoted content, extract only the user's framing, not the quoted inner text
  let clean = text;
  if (flags.some((f) => f.flag === "quoted_content")) {
    // keep only non-quoted lines as candidate facts
    const lines = text.split("\n").filter((l) => !/^["'“”‘’`]/.test(l.trim()) && !/^>\s/.test(l));
    if (lines.join("").trim().length >= 12) clean = lines.join("\n");
  }
  if (blocked) clean = `[FLAGGED: ${adversarialSummary(flags)}] ${clean.slice(0, 200)}`;
  return { clean, flags, blocked };
}

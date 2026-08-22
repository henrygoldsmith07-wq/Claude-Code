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
  | "hypothetical"
  | "changing_opinion"
  | "ambiguous_reference"
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
// Hypotheticals explore counterfactuals — they must not be stored as events.
const HYPOTHETICAL_RE = /\b(what if|suppose (that|i|we|they)|hypothetically|imagine (if|this)|let's say|in theory)\b/i;
// Opinion reversals: a newer stance that supersedes an earlier one.
const CHANGING_OPINION_RE = /\b(i('ve)? changed my mind|i no longer (think|believe|feel)|i used to think but|actually,? i now think|i was wrong about)\b/i;
// Unresolved references: pronoun-heavy fragments with nothing concrete to anchor to.
const PRONOUN_RE = /\b(it|they|them|he|she|that|this)\b/gi;
// Sensitive data that should never reach an AI provider unnoticed.
const SENSITIVE_PATTERNS: { kind: string; re: RegExp }[] = [
  { kind: "email", re: /[\w.+-]+@[\w-]+\.[\w.]{2,}/ },
  { kind: "number-sequence", re: /\b(?:\d[ -]?){9,16}\d\b/ }, // phone/card-like
  { kind: "government-id", re: /\b\d{3}-\d{2}-\d{4}\b/ },
  { kind: "credential", re: /\b(sk-[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._-]{10,})/ },
  { kind: "secret", re: /\b(password|passphrase|api[_ ]?key|secret)\s*[:=]\s*\S+/i },
];

export interface SensitiveDataHit {
  kind: string;
  excerpt: string;
}

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
  if (HYPOTHETICAL_RE.test(s)) {
    out.push({ flag: "hypothetical", confidence: 0.65, reason: "Hypothetical framing — a thought experiment, not something that happened", excerpt });
  }
  if (CHANGING_OPINION_RE.test(s)) {
    out.push({ flag: "changing_opinion", confidence: 0.6, reason: "Supersedes an earlier stance — reconcile with previous entries before inferring patterns", excerpt });
  }
  // ambiguous reference: pronoun-heavy, short, nothing concrete to anchor to.
  // Sentence-initial capitals are stripped before the proper-noun probe, so
  // "They did that thing" isn't mistaken for a named entity.
  const words = s.trim().split(/\s+/);
  const pronouns = s.match(PRONOUN_RE)?.length ?? 0;
  const withoutSentenceCaps = s.replace(/(?:^|[.!?]\s+)[A-Z]/g, "");
  if (words.length <= 15 && pronouns >= 2 && !/\b[A-Z][a-z]{2,}\b/.test(withoutSentenceCaps)) {
    out.push({
      flag: "ambiguous_reference",
      confidence: 0.55,
      reason: "References are unresolved ('it', 'they') — ask who or what specifically before interpreting",
      excerpt,
    });
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

// ── accidental sensitive-data ingestion ───────────────────────────────
// Journal text is easy to over-share (an email pasted mid-vent, a card number,
// a credential). These are detected locally and surfaced as a warning before
// the entry's content is sent to the AI provider. Nothing here blocks writing;
// it informs the user so they can redact deliberately.

export function detectSensitiveData(text: string): SensitiveDataHit[] {
  const s = String(text);
  const hits: SensitiveDataHit[] = [];
  for (const { kind, re } of SENSITIVE_PATTERNS) {
    const m = re.exec(s);
    if (m) hits.push({ kind, excerpt: m[0].slice(0, 24) });
    if (hits.length >= 4) break; // enough to warn; don't enumerate exhaustively
  }
  return hits;
}

/** True when the user should be warned before this text goes to the provider. */
export function containsSensitiveData(text: string): boolean {
  return detectSensitiveData(text).length > 0;
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

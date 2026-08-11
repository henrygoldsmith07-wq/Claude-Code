// Moderation & anti-cheat helpers — pure, offline.
// Real moderation will call a provider (Gemini/Anthropic) but these are the fast local guards.

const BANNED_RE = /\b(kill yourself|kys|you should die)\b/i;
const SPAM_RE = /(.)\1{12,}/; // 13+ repeated char
const GENERATED_RE = /\b(as an ai|as a language model)\b/i;

export interface ModerationFlag { kind: "harassment"|"spam"|"excessive_caps"|"injected_instruction"; note: string; }

export function moderateMessage(text: string): ModerationFlag[] {
  const out: ModerationFlag[] = [];
  if (BANNED_RE.test(text)) out.push({ kind: "harassment", note: "Harassment language detected." });
  if (SPAM_RE.test(text)) out.push({ kind: "spam", note: "Repeated characters — likely spam." });
  if (text.length > 30 && text === text.toUpperCase()) out.push({ kind: "excessive_caps", note: "All caps." });
  if (/ignore previous instructions|you are now|jailbreak/i.test(text)) out.push({ kind: "injected_instruction", note: "Instruction injection attempt." });
  return out;
}

export function isBlocked(flags: ModerationFlag[]): boolean { return flags.some((f)=> f.kind==="harassment" || f.kind==="injected_instruction"); }

export function isLikelyGenerated(text: string): boolean {
  return GENERATED_RE.test(text);
}

// Anti-cheat: copy-paste reuse detection (same text twice) + absurd length + pace
// Real abuse (multiple accounts, voting rings) lives in Supabase functions; these catch the cheap tricks.
export function repeatScore(texts: string[]): number {
  if (texts.length < 2) return 0;
  const last = texts[texts.length-1]; const prev = texts[texts.length-2];
  if (!last || !prev) return 0;
  return last.trim() === prev.trim() ? 1 : 0;
}
export function isSuspiciousLength(text: string): boolean { return text.length > 6000 || (text.split(/\s+/).length > 900); }

export function jaccardSimilarity(a: string, b: string): number {
  const wa = new Set(a.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean));
  const wb = new Set(b.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean));
  if (!wa.size || !wb.size) return 0;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  return inter / (wa.size + wb.size - inter);
}

/** Suspicious if any two distinct turns are near-duplicates (copy/paste or templated). */
export function hasNearDuplicateTurns(texts: string[], threshold = 0.88): boolean {
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) if (jaccardSimilarity(texts[i], texts[j]) >= threshold) return true;
  return false;
}

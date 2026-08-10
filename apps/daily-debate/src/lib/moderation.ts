// Moderation & anti-cheat helpers — pure, offline.
// Real moderation will call a provider (Gemini/Anthropic) but these are the fast local guards.

const BANNED_RE = /\b(kill yourself|kys|you should die)\b/i;
const SPAM_RE = /(.)\1{12,}/; // 13+ repeated char

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

// Anti-cheat: copy-paste reuse detection (same text twice) + absurd length + pace
// Real abuse (multiple accounts, voting rings) lives in Supabase functions; these catch the cheap tricks.
export function repeatScore(texts: string[]): number {
  if (texts.length < 2) return 0;
  const last = texts[texts.length-1]; const prev = texts[texts.length-2];
  if (!last || !prev) return 0;
  return last.trim() === prev.trim() ? 1 : 0;
}
export function isSuspiciousLength(text: string): boolean { return text.length > 6000 || (text.split(/\s+/).length > 900); }

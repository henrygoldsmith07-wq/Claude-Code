// importExport.ts — safe restore/import for Reflect.
// Import is the riskiest data boundary in the app: a malformed or hostile JSON
// file must never silently wipe or corrupt the vault. Every check here is pure
// and unit-testable, so the UI handler stays a thin wrapper.

import type { Entry, LongitudinalReview, Message, ReflectionMode, ReflectionSummary } from "./types";

export const MAX_IMPORT_ENTRIES = 2000;
export const MAX_MESSAGES_PER_ENTRY = 200;
export const MAX_MESSAGE_CHARS = 8000;
export const MAX_TITLE_CHARS = 200;

export interface ImportOutcome {
  ok: boolean;
  entries: Entry[];
  warnings: string[];
  error?: string;
}

/** Encrypted vault blobs (v:1 + ct) must be decrypted, not imported raw. */
export function isEncryptedBlob(raw: unknown): boolean {
  return (
    typeof raw === "object" &&
    raw !== null &&
    !Array.isArray(raw) &&
    (raw as Record<string, unknown>).v === 1 &&
    typeof (raw as Record<string, unknown>).ct === "string"
  );
}

function validDate(s: unknown): s is string {
  return typeof s === "string" && s.trim() !== "" && !Number.isNaN(new Date(s).getTime());
}

/** Coerce one imported row into a valid Entry. Returns null if hopeless. */
export function sanitizeEntry(raw: unknown, index: number): Entry | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;

  const id = typeof r.id === "string" && r.id.trim() ? r.id.slice(0, 120) : `import-${index}-${Date.now().toString(36)}`;
  const createdAt = validDate(r.createdAt) ? r.createdAt : new Date().toISOString();
  const title = typeof r.title === "string" && r.title.trim() ? r.title.slice(0, MAX_TITLE_CHARS) : "Imported reflection";
  const status: Entry["status"] = r.status === "in_progress" ? "in_progress" : "complete";
  const mode: ReflectionMode = r.mode === "quick" ? "quick" : "full";

  // messages: only well-formed {role, content} pairs with known roles, capped
  const messages: Message[] = Array.isArray(r.messages)
    ? r.messages
        .slice(0, MAX_MESSAGES_PER_ENTRY)
        .filter((m): m is Record<string, unknown> => typeof m === "object" && m !== null && (m.role === "user" || m.role === "assistant"))
        .map((m) => ({
          role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
          content: typeof m.content === "string" ? m.content.slice(0, MAX_MESSAGE_CHARS) : "",
        }))
        .filter((m) => m.content.trim() !== "")
    : [];

  // summary: keep only if it has a structured trace; normalise every field so
  // downstream analyzers never iterate undefined (imported rows are untrusted)
  const summary = sanitizeSummary(r.summary);

  // longitudinalReview: keep only if it's an object with at least one field
  const lrRaw = r.longitudinalReview;
  const actionTaken = (lrRaw as Record<string, unknown> | null)?.actualActionTaken;
  const outcome = (lrRaw as Record<string, unknown> | null)?.actualOutcome;
  const verdict = (lrRaw as Record<string, unknown> | null)?.assumptionVerdict;
  const calNote = (lrRaw as Record<string, unknown> | null)?.calibrationNote;
  const reviewedAt = (lrRaw as Record<string, unknown> | null)?.reviewedAt;
  const longitudinalReview: LongitudinalReview | undefined =
    typeof lrRaw === "object" && lrRaw !== null && !Array.isArray(lrRaw)
      ? {
          actualActionTaken: typeof actionTaken === "string" ? actionTaken : null,
          actualOutcome: typeof outcome === "string" ? outcome : null,
          assumptionVerdict: (["supported", "unsupported", "partial", "unclear"] as const).includes(verdict as never) ? (verdict as LongitudinalReview["assumptionVerdict"]) : null,
          calibrationNote: typeof calNote === "string" ? calNote : null,
          reviewedAt: validDate(reviewedAt) ? reviewedAt : new Date().toISOString(),
        }
      : undefined;

  // in_progress entries must have messages to be useful; otherwise mark complete
  const finalStatus: Entry["status"] = status === "in_progress" && messages.length === 0 ? "complete" : status;

  return { id, createdAt, title, messages, status: finalStatus, mode, summary, longitudinalReview };
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string").map((s) => s.slice(0, MAX_MESSAGE_CHARS));
}

function asNonEmptyString(v: unknown): string {
  return typeof v === "string" ? v.slice(0, MAX_MESSAGE_CHARS) : "";
}

/** Normalise an untrusted summary into a structurally safe ReflectionSummary. */
function sanitizeSummary(raw: unknown): ReflectionSummary | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const s = raw as Record<string, unknown>;
  const traceRaw = s.trace;
  if (typeof traceRaw !== "object" || traceRaw === null || Array.isArray(traceRaw)) return null;
  const t = traceRaw as Record<string, unknown>;

  const biases: ReflectionSummary["possibleBiases"] = Array.isArray(s.possibleBiases)
    ? (s.possibleBiases as unknown[]).flatMap((b) => {
        if (typeof b !== "object" || b === null || Array.isArray(b)) return [];
        const bias = b as Record<string, unknown>;
        return [{
          type: asNonEmptyString(bias.type),
          description: asNonEmptyString(bias.description),
          evidenceFor: asStringArray(bias.evidenceFor),
          evidenceAgainst: asStringArray(bias.evidenceAgainst),
          confidence: typeof bias.confidence === "number" && Number.isFinite(bias.confidence) ? Math.min(Math.max(bias.confidence, 0), 1) : 0,
        }];
      })
    : [];

  // falsification checks: keep only well-formed pairs referencing text
  const assumptionTexts = asStringArray(t.assumptions).map((a) => a.trim().toLowerCase());
  const assumptionChecks: ReflectionSummary["trace"]["assumptionChecks"] = Array.isArray(t.assumptionChecks)
    ? (t.assumptionChecks as unknown[]).flatMap((c) => {
        if (typeof c !== "object" || c === null || Array.isArray(c)) return [];
        const check = c as Record<string, unknown>;
        const assumption = typeof check.assumption === "string" ? check.assumption.slice(0, MAX_MESSAGE_CHARS) : "";
        const falsifier = typeof check.falsifier === "string" ? check.falsifier.slice(0, MAX_MESSAGE_CHARS) : "";
        if (!assumption.trim() || falsifier.trim().length < 12) return [];
        return [{ assumption, falsifier }];
      }).filter((c) => assumptionTexts.some((t2) => t2.includes(c.assumption.toLowerCase().slice(0, 24))))
    : [];

  const rawOverall = s.overallConfidence;

  return {
    trace: {
      event: asNonEmptyString(t.event),
      observations: asStringArray(t.observations),
      assumptions: asStringArray(t.assumptions),
      namedEmotion: asNonEmptyString(t.namedEmotion),
      alternativeInterpretations: asStringArray(t.alternativeInterpretations),
      intendedOutcome: asNonEmptyString(t.intendedOutcome),
      intendedAction: asNonEmptyString(t.intendedAction),
      predictedOutcome: asNonEmptyString(t.predictedOutcome),
      followUpAt: validDate(t.followUpAt) ? (t.followUpAt as string) : null,
      followUpNote: t.followUpNote === null || t.followUpNote === undefined ? null : asNonEmptyString(t.followUpNote) || null,
      assumptionChecks,
    },
    coreEmotion: asNonEmptyString(s.coreEmotion),
    underlyingTriggers: asStringArray(s.underlyingTriggers),
    possibleBiases: biases,
    otherPerspective: asNonEmptyString(s.otherPerspective),
    balancedAssessment: asNonEmptyString(s.balancedAssessment),
    cautionFlags: asStringArray(s.cautionFlags),
    suggestedNextSteps: asStringArray(s.suggestedNextSteps),
    hedgedDisclaimer: s.hedgedDisclaimer === null || s.hedgedDisclaimer === undefined ? null : asNonEmptyString(s.hedgedDisclaimer) || null,
    overallConfidence:
      typeof rawOverall === "number" && Number.isFinite(rawOverall)
        ? Math.min(Math.max(rawOverall, 0), 1)
        : rawOverall === undefined
          ? undefined
          : null,
  };
}

/**
 * Parse an import payload: JSON text → validated Entry[].
 * Never throws. Rejects encrypted blobs and non-array payloads, sanitises each
 * row, dedupes ids (first wins) and caps the total.
 */
export function parseImport(text: string): ImportOutcome {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, entries: [], warnings: [], error: "Not valid JSON — nothing was imported." };
  }
  if (isEncryptedBlob(parsed)) {
    return { ok: false, entries: [], warnings: [], error: "That looks like an encrypted vault export. Restore it with its passphrase (Settings → Restore vault) instead of importing it as plaintext." };
  }
  if (!Array.isArray(parsed)) {
    return { ok: false, entries: [], warnings: [], error: "Expected a JSON array of reflections." };
  }

  const entries: Entry[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  for (let i = 0; i < parsed.length; i++) {
    if (entries.length >= MAX_IMPORT_ENTRIES) {
      warnings.push(`Import capped at ${MAX_IMPORT_ENTRIES} reflections — ${parsed.length - i} skipped.`);
      break;
    }
    const clean = sanitizeEntry(parsed[i], i);
    if (!clean) { skipped++; continue; }
    if (seen.has(clean.id)) { skipped++; continue; }
    seen.add(clean.id);
    entries.push(clean);
  }

  if (skipped > 0) {
    warnings.push(`Skipped ${skipped} invalid or duplicate entr${skipped === 1 ? "y" : "ies"}.`);
  }
  return { ok: true, entries, warnings };
}

// privacy.ts — explicit privacy boundaries for Reflect.
// Answers two questions in code (and tests), not just prose:
//   1. What runs locally, and what (if anything) leaves the device?
//   2. Does a given payload leak verbatim entry text? (Pulse snapshots and the
//      API's lightweight entry hints must never contain it.)

import type { Entry } from "./types";

export interface NetworkCall {
  what: string;
  when: string;
}

export interface PrivacyAudit {
  localOnly: string[];
  network: NetworkCall[];
}

/** Declarative inventory of the privacy surface. */
export function localOnlyAudit(): PrivacyAudit {
  return {
    localOnly: [
      "reflection pipeline completion (client-side)",
      "pattern detection (recurring assumptions, emotions, triggers)",
      "contradiction detection",
      "calibration & prediction accuracy",
      "decision-improvement measurement",
      "longitudinal evidence report generation and export (summary fields only)",
      "automatic local relevance search",
      "vault encryption (WebCrypto AES-GCM, client-side)",
      "import / export / restore",
      "Pulse snapshot aggregation (opt-in only, counts not content)",
    ],
    network: [
      { what: "Reflect API conversation — the current reflection's messages only (when a key is present and the user sends a message)", when: "per user message" },
      { what: "Lightweight entry hints — id + core emotion + trigger labels only, max 8, no verbatim text (optional)", when: "per user message" },
    ],
  };
}

/**
 * What leaves the device for a given entry — the exact fields, not a vague
 * promise. Used by the Privacy panel to state boundaries concretely.
 */
export function whatLeavesDevice(entry: Entry, opts: { includeEntryHints?: boolean } = {}): string[] {
  const fields = [
    "Conversation messages for this reflection only (capped at 40 messages, 8k chars each)",
  ];
  if (opts.includeEntryHints) {
    fields.push("Entry hints: id + core emotion + trigger labels (max 8 entries, no event text, no assumptions, no notes)");
  }
  // Local-only mode sends nothing at all — no key, no API call:
  if (entry.messages.length === 0) return ["Nothing — local-only mode, no API call."];
  return fields;
}

/**
 * Returns the first verbatim entry string (≥12 chars) found inside `text`, or
 * null if the text contains no entry content. Verbatim means literal — a
 * one-word emotion label like "shame" is a category, not content, so short
 * strings and single tokens are intentionally not flagged.
 */
export function containsVerbatimEntryText(text: string, entries: Entry[]): string | null {
  const candidates: string[] = [];
  for (const e of entries) {
    candidates.push(e.title);
    if (e.summary) {
      candidates.push(e.summary.trace.event, ...e.summary.trace.observations, ...e.summary.trace.assumptions, ...e.summary.trace.alternativeInterpretations, ...e.summary.underlyingTriggers);
    }
    for (const m of e.messages) candidates.push(m.content);
  }
  const t = String(text).toLowerCase();
  for (const c of candidates) {
    const n = String(c).toLowerCase().trim();
    if (n.length >= 12 && t.includes(n)) return c;
  }
  return null;
}

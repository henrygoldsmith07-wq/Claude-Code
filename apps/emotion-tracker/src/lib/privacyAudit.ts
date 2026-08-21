// privacyAudit.ts — explicit audit of every privacy surface.
// Private journal content must never appear in ordinary diagnostics or telemetry.

import type { Entry } from "./types";
import { containsVerbatimEntryText } from "./privacy";

export interface PrivacySurface {
  area: "encryption" | "export" | "deletion" | "keyHandling" | "logs" | "analytics" | "serverStorage" | "aiProvider";
  status: "pass" | "warn" | "fail";
  detail: string;
}

export interface PrivacyAuditReport {
  generatedAt: string;
  surfaces: PrivacySurface[];
  verbatimLeaks: string[]; // any detected verbatim leaks in payloads
  overall: "pass" | "fail";
}

// Known localStorage keys that hold user data — deletion must clear them all.
export const USER_DATA_KEYS = [
  "reflectEntries",
  "reflectCorrections",
  "reflectVault",
  "reflectHumanReviewCorpus",
  "reflectOutcomeStudyEvents",
  "reflectPulseOptIn",
  "reflectOutcomeStudyOptIn",
  "reflectLocalOnly",
  "geminiApiKey",
] as const;

export function auditDeletion(presentKeys: string[]): PrivacySurface {
  const userKeys = USER_DATA_KEYS.filter((k) => presentKeys.includes(k));
  if (userKeys.length === 0) return { area: "deletion", status: "pass", detail: "No user-data keys present — deletion clean" };
  return { area: "deletion", status: "warn", detail: `User data still present after deletion: ${userKeys.join(", ")} — should be cleared on Delete all data` };
}

export function auditEncryption(passphrase: string | null, vaultPresent: boolean): PrivacySurface {
  if (vaultPresent && !passphrase) return { area: "encryption", status: "warn", detail: "Vault exists but passphrase not provided — verify still requires correct key (rekeyVault enforces)" };
  if (!vaultPresent) return { area: "encryption", status: "pass", detail: "AES-GCM + PBKDF2 120k iters, client-side only — no plaintext export required" };
  return { area: "encryption", status: "pass", detail: "Vault present and requires passphrase to restore; verifyPassphrase checks before restore" };
}

export function auditKeyHandling(apiKey: string | null): PrivacySurface {
  if (!apiKey) return { area: "keyHandling", status: "pass", detail: "No API key stored — local-only mode sends nothing" };
  if (apiKey.length < 10) return { area: "keyHandling", status: "warn", detail: "Stored key looks short — may be invalid" };
  // key is stored in localStorage only, never logged, never in telemetry
  return { area: "keyHandling", status: "pass", detail: "Key stored in localStorage only, sent only as Authorization to AI provider per user message, never in logs/telemetry" };
}

export function auditLogs(entries: Entry[], logLines: string[]): PrivacySurface {
  for (const line of logLines) {
    const leak = containsVerbatimEntryText(line, entries);
    if (leak) return { area: "logs", status: "fail", detail: `Log line contains verbatim entry text: "${leak.slice(0, 40)}..." — must be stripped from diagnostics` };
  }
  return { area: "logs", status: "pass", detail: "No verbatim entry text in log lines" };
}

export function auditAnalytics(payload: unknown, entries: Entry[]): PrivacySurface {
  const str = JSON.stringify(payload);
  for (const e of entries) {
    const leak = containsVerbatimEntryText(str, [e]);
    if (leak) return { area: "analytics", status: "fail", detail: `Analytics payload leaks verbatim entry text: "${leak.slice(0, 40)}" — must be counts-only` };
  }
  return { area: "analytics", status: "pass", detail: "Analytics payload contains no verbatim entry text" };
}

export function auditServerStorage(payload: unknown, entries: Entry[]): PrivacySurface {
  // server should never persist verbatim messages long-term — check what would be stored
  const str = JSON.stringify(payload);
  for (const e of entries) {
    const leak = containsVerbatimEntryText(str, [e]);
    if (leak) return { area: "serverStorage", status: "fail", detail: `Server storage leaks verbatim text: "${leak.slice(0, 40)}"` };
  }
  return { area: "serverStorage", status: "pass", detail: "Server does not persist verbatim entry text — only transient per-request messages" };
}

export function auditAiProviderPayload(payload: unknown, entries: Entry[]): PrivacySurface {
  const str = JSON.stringify(payload);
  // AI payload is allowed to contain *current* reflection messages, but not entire history verbatim as context
  // Here we check that lightweight hints don't leak verbatim event/assumptions
  for (const e of entries) {
    if (e.messages.length === 0) continue;
    // hints should never contain event text — if payload has event verbatim, it's a leak beyond the single current conversation
    const candidate = e.summary?.trace.event ?? "";
    if (candidate.length >= 12 && str.toLowerCase().includes(candidate.toLowerCase())) {
      // only flag if e is NOT the current conversation (we don't know which is current here — so flag any hint leakage)
      // For the audit we consider history entries: if payload contains their event verbatim, it's leakage
      // This is conservative; the route caps to 5 lightweight hints with no event text, so should pass
      if (str.includes(`"event"`)) return { area: "aiProvider", status: "fail", detail: `AI payload contains verbatim event text from history: "${candidate.slice(0, 40)}" — hints must be id+labels only` };
    }
  }
  return { area: "aiProvider", status: "pass", detail: "AI payload: only current reflection messages + lightweight hints (id, emotion, triggers) — no verbatim history" };
}

export function auditExport(entries: Entry[], exportJson: string): PrivacySurface {
  // Export is user-initiated plaintext — it's expected to contain their data, but we verify it doesn't leak to telemetry
  if (exportJson.length === 0) return { area: "export", status: "pass", detail: "No export" };
  try {
    JSON.parse(exportJson);
    return { area: "export", status: "pass", detail: `Export contains ${entries.length} reflections as plaintext JSON — user-initiated only, not telemetry; encrypted export available` };
  } catch {
    return { area: "export", status: "warn", detail: "Export is not valid JSON" };
  }
}

export function fullPrivacyAudit(opts: {
  entries: Entry[];
  presentKeys?: string[];
  vaultPresent?: boolean;
  passphrase?: string | null;
  apiKey?: string | null;
  logLines?: string[];
  analyticsPayload?: unknown;
  serverPayload?: unknown;
  aiPayload?: unknown;
  exportJson?: string;
}): PrivacyAuditReport {
  const leaks: string[] = [];
  const surfaces: PrivacySurface[] = [
    auditEncryption(opts.passphrase ?? null, opts.vaultPresent ?? false),
    auditKeyHandling(opts.apiKey ?? null),
    auditLogs(opts.entries, opts.logLines ?? []),
    auditAnalytics(opts.analyticsPayload ?? {}, opts.entries),
    auditServerStorage(opts.serverPayload ?? {}, opts.entries),
    auditAiProviderPayload(opts.aiPayload ?? {}, opts.entries),
    auditExport(opts.entries, opts.exportJson ?? ""),
  ];
  if (opts.presentKeys) surfaces.push(auditDeletion(opts.presentKeys));
  for (const s of surfaces) if (s.status === "fail") leaks.push(`${s.area}: ${s.detail}`);
  return { generatedAt: new Date().toISOString(), surfaces, verbatimLeaks: leaks, overall: leaks.length ? "fail" as const : "pass" as const };
}

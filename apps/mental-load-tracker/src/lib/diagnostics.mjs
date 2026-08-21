/**
 * Privacy-safe diagnostics for Noticed.
 *
 * The recorder is structural: it accepts only a fixed allowlist of
 * cardinality-bounded fields, so task text, household names, tokens, or any
 * other user content cannot pass through by accident. Events render as one
 * JSON line each, ready for any log drain.
 */

const ALLOWED_KEYS = new Set([
  "class",
  "context",
  "outcome",
  "code",
  "status",
  "attempt",
  "pendingCount",
]);

const KNOWN_CLASSES = new Set([
  "supabase-query-failure",
  "realtime-disconnect",
  "realtime-resubscribe",
  "invite-error",
  "write-failure",
  "rls-denied",
  "rate-limited",
]);

function sanitizeEvent(event) {
  if (!event || typeof event !== "object") return null;
  const clean = { at: new Date().toISOString() };
  for (const [key, value] of Object.entries(event)) {
    if (!ALLOWED_KEYS.has(key)) continue;
    if (value === undefined || value === null) continue;
    clean[key] = typeof value === "string" ? value.slice(0, 120) : value;
  }
  // `class` and `context` are the minimum useful signal; drop empty records.
  if (!clean.class || !clean.context) return null;
  if (!KNOWN_CLASSES.has(clean.class)) clean.class = "supabase-query-failure";
  return clean;
}

export function createDiagnostics({ sink } = {}) {
  const emit =
    sink ??
    ((line) => {
      console.error(line);
    });
  const counters = new Map();

  return {
    record(event) {
      const clean = sanitizeEvent(event);
      if (!clean) return null;
      const key = `${clean.class}|${clean.context}|${clean.outcome ?? ""}`;
      counters.set(key, (counters.get(key) ?? 0) + 1);
      emit(JSON.stringify({ evt: "noticed_diag", ...clean }));
      return clean;
    },

    /** True when an error looks like an RLS denial (policy/permission). */
    isRlsDenial(message) {
      const text = String(message ?? "").toLowerCase();
      return (
        text.includes("row-level security") ||
        text.includes("42501") ||
        text.includes("permission denied") ||
        text.includes("not a household member")
      );
    },

    snapshot() {
      return Object.fromEntries(counters);
    },
  };
}

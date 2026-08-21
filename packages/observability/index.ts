/**
 * @ruflo/observability — privacy-safe telemetry interfaces.
 *
 * Copy these types into any app that needs them, or import directly when the
 * monorepo has a shared build. The contracts are deliberately small and
 * free of user content: the goal is to make it structurally impossible to log
 * the thing you most want to instrument (the user's text).
 *
 * Canonical implementations:
 *  - Rapport: apps/rapport/src/ai/telemetry.ts
 *  - Revise:  apps/revise/src/ai/tasks.ts (envelope) + provider.ts (timeout/retry)
 */

// ---------------------------------------------------------------------------
// AI call telemetry — every model invocation
// ---------------------------------------------------------------------------

export type AiOutcome =
  | "ai" // model replied, passed schema + deterministic gates
  | "fallback" // no provider, or provider deliberately bypassed
  | "invalid-schema" // model replied but failed schema validation
  | "unsafe-output" // model passed schema but failed a safety/hedge gate
  | "error" // network, timeout, 5xx, abort
  | "rate-limited" // caller hit the task's rate limit
  | "cache-hit"; // deterministic cache reuse

export interface AiCallRecord {
  /** Task discriminator — must match the RESPONSE_SCHEMAS key. */
  task: string;
  /** Provider identifier, e.g. "anthropic", "openai-compatible", or null for fallback/cache. */
  provider: string | null;
  /** Model string when available, e.g. "claude-sonnet-5". */
  model: string | null;
  /** Prompt/template version so regressions can be bisected. */
  promptVersion: string;
  outcome: AiOutcome;
  /** Wall-clock time from dispatch to terminal state (ai, fallback, or error). */
  latencyMs: number;
  /** Tokens as reported by the provider, when available. */
  inputTokens?: number;
  outputTokens?: number;
  /** Approximate cost at call time, for a spend tripwire — never an invoice. */
  estimatedCostUsd?: number;
  /** ISO 8601 timestamp of the terminal record. */
  at: string;
  /** Number of retries actually performed (0 or 1 under the standard). */
  retries?: number;
  /** Whether a fallback was used and why — useful for "fallback rate" SLI. */
  fallbackReason?: string;
  /** Which validation failed, when outcome is invalid-schema or unsafe-output. */
  validationFailure?: string;
}

export interface AiStats {
  calls: number;
  byOutcome: Record<string, number>;
  byTask: Record<string, number>;
  p50LatencyMs: number;
  p95LatencyMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCostUsd: number;
  /** Share of calls that fell back (fallback + invalid-schema + error + unsafe-output). */
  fallbackRate: number;
}

// ---------------------------------------------------------------------------
// Data provenance — every insight derived from external or historical data
// ---------------------------------------------------------------------------

export interface DataProvenance {
  /** Human-readable source, e.g. "Supabase review_logs", "Forq pantry", "user notes". */
  source: string;
  /** When the source data was captured or last updated. */
  timestamp: string; // ISO 8601
  /** How fresh the source was at call time, e.g. "2h", "3d", "stale: 14d". */
  freshness: string;
  /** Transformation applied, e.g. "deduplicated, normalised to 0–1, FSRS". */
  transformation: string;
  /** Model's or algorithm's confidence in this provenance linkage. */
  confidence: number; // 0..1
  /** Algorithm or pipeline version that produced the value. */
  algorithmVersion: string;
}

// ---------------------------------------------------------------------------
// Generic app observability — provider-agnostic
// ---------------------------------------------------------------------------

export type ErrorClass =
  | "unexpected-app-error"
  | "api-failure"
  | "provider-failure"
  | "external-integration-failure";

export interface AppErrorRecord {
  /** Broad error class for bucketising alerts. */
  class: ErrorClass;
  /** Route or subsystem, e.g. "POST /api/ai", "sync:reconcile". */
  context: string;
  /** Short, cardinality-bounded message — no user content, no stack with PII. */
  message: string;
  /** ISO timestamp. */
  at: string;
  /** Optional: which provider/model was involved, when relevant. */
  provider?: string | null;
  model?: string | null;
  /** Wall-clock latency when the error surfaced. */
  latencyMs?: number;
  /** Retry count if retried. */
  retries?: number;
}

// ---------------------------------------------------------------------------
// Helpers — copy-paste safe, no dependencies
// ---------------------------------------------------------------------------

export function estimateCost(
  model: string | null,
  inputTokens = 0,
  outputTokens = 0,
  pricePerMtok: Record<string, { input: number; output: number }> = {
    "claude-sonnet-5": { input: 3, output: 15 },
    "claude-haiku-4-5-20251001": { input: 1, output: 5 },
    default: { input: 1, output: 5 },
  },
): number {
  const price = (model && pricePerMtok[model]) || pricePerMtok.default;
  if (!price) return 0;
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}

export function percentile(sortedAsc: number[], q: number): number {
  if (sortedAsc.length === 0) return 0;
  const index = Math.min(sortedAsc.length - 1, Math.floor(sortedAsc.length * q));
  return sortedAsc[index] ?? 0;
}

/**
 * Construct a complete AiCallRecord. Use this so every app reports
 * the same fields and no app accidentally logs user content.
 */
export function buildAiCallRecord(params: {
  task: string;
  provider: string | null;
  model: string | null;
  promptVersion: string;
  outcome: AiOutcome;
  started: number;
  usage?: { inputTokens?: number; outputTokens?: number };
  retries?: number;
  fallbackReason?: string;
  validationFailure?: string;
}): AiCallRecord {
  const latencyMs = Date.now() - params.started;
  const rec: AiCallRecord = {
    task: params.task,
    provider: params.provider,
    model: params.model,
    promptVersion: params.promptVersion,
    outcome: params.outcome,
    latencyMs,
    at: new Date().toISOString(),
  };
  if (params.usage) {
    rec.inputTokens = params.usage.inputTokens;
    rec.outputTokens = params.usage.outputTokens;
    rec.estimatedCostUsd = estimateCost(params.model, params.usage.inputTokens ?? 0, params.usage.outputTokens ?? 0);
  }
  if (params.retries !== undefined) rec.retries = params.retries;
  if (params.fallbackReason) rec.fallbackReason = params.fallbackReason;
  if (params.validationFailure) rec.validationFailure = params.validationFailure;
  return rec;
}

// ---------------------------------------------------------------------------
// In-memory store (for tests and small apps) — not durable
// ---------------------------------------------------------------------------

export function createInMemoryTelemetry(maxRecords = 500) {
  const records: AiCallRecord[] = [];
  const errors: AppErrorRecord[] = [];

  return {
    recordAiCall(entry: AiCallRecord): void {
      records.push(entry);
      if (records.length > maxRecords) records.splice(0, records.length - maxRecords);
      if (process.env.AI_LOG === "1") {
        console.info(
          JSON.stringify({
            evt: "ai_call",
            task: entry.task,
            provider: entry.provider,
            outcome: entry.outcome,
            ms: entry.latencyMs,
            in: entry.inputTokens ?? 0,
            out: entry.outputTokens ?? 0,
            v: entry.promptVersion,
            retries: entry.retries ?? 0,
          }),
        );
      }
    },
    recordAppError(entry: AppErrorRecord): void {
      errors.push(entry);
      if (errors.length > maxRecords) errors.splice(0, errors.length - maxRecords);
      console.error(JSON.stringify({ evt: "app_error", class: entry.class, context: entry.context, msg: entry.message }));
    },
    stats(): AiStats {
      const lat = records.map((r) => r.latencyMs).sort((a, b) => a - b);
      const byOutcome: Record<string, number> = {};
      const byTask: Record<string, number> = {};
      let inT = 0,
        outT = 0,
        cost = 0;
      for (const r of records) {
        byOutcome[r.outcome] = (byOutcome[r.outcome] ?? 0) + 1;
        byTask[r.task] = (byTask[r.task] ?? 0) + 1;
        inT += r.inputTokens ?? 0;
        outT += r.outputTokens ?? 0;
        cost += r.estimatedCostUsd ?? 0;
      }
      const fallbackish =
        (byOutcome.fallback ?? 0) + (byOutcome["invalid-schema"] ?? 0) + (byOutcome.error ?? 0) + (byOutcome["unsafe-output"] ?? 0);
      return {
        calls: records.length,
        byOutcome,
        byTask,
        p50LatencyMs: percentile(lat, 0.5),
        p95LatencyMs: percentile(lat, 0.95),
        totalInputTokens: inT,
        totalOutputTokens: outT,
        estimatedCostUsd: Number(cost.toFixed(4)),
        fallbackRate: records.length ? Number((fallbackish / records.length).toFixed(3)) : 0,
      };
    },
    clear(): void {
      records.length = 0;
      errors.length = 0;
    },
    get records(): AiCallRecord[] {
      return records;
    },
    get appErrors(): AppErrorRecord[] {
      return errors;
    },
  };
}

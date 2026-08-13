import "server-only";
import type { AiTask } from "./types";

// ---------------------------------------------------------------------------
// Observability and cost monitoring.
//
// Two things are deliberately absent from every record here: the user's text,
// and any identifier that could be joined back to a person. What is kept is
// task name, outcome, latency, token counts and a hash of the cache key.
//
// That is not a limitation to work around later. Reflection content is the most
// sensitive data in the product, and an operational log is exactly the place it
// tends to leak into. Making the log structurally incapable of holding it is
// cheaper than auditing it forever.
// ---------------------------------------------------------------------------

export interface AiCallRecord {
  task: AiTask;
  provider: string | null;
  model: string | null;
  promptVersion: string;
  outcome: "ai" | "fallback" | "invalid-schema" | "unsafe-output" | "error" | "rate-limited" | "cache-hit";
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
  at: string;
}

/**
 * Approximate per-million-token prices, used only to surface a running estimate
 * in the settings panel. Deliberately conservative and clearly labelled as an
 * estimate in the UI — this is a spend tripwire, not an invoice.
 */
const PRICE_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
  default: { input: 1, output: 5 },
};

export function estimateCost(model: string | null, inputTokens = 0, outputTokens = 0): number {
  const price = (model && PRICE_PER_MTOK[model]) || PRICE_PER_MTOK.default;
  if (!price) return 0;
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}

const MAX_RECORDS = 500;
const records: AiCallRecord[] = [];

export function record(entry: AiCallRecord): void {
  records.push(entry);
  if (records.length > MAX_RECORDS) records.splice(0, records.length - MAX_RECORDS);
  // Structured, single-line, and free of user content by construction.
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
      }),
    );
  }
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
  /** Share of calls that fell back to the deterministic path. */
  fallbackRate: number;
}

export function stats(): AiStats {
  const latencies = records.map((item) => item.latencyMs).sort((a, b) => a - b);
  const byOutcome: Record<string, number> = {};
  const byTask: Record<string, number> = {};
  let inputTokens = 0;
  let outputTokens = 0;
  let cost = 0;

  for (const item of records) {
    byOutcome[item.outcome] = (byOutcome[item.outcome] ?? 0) + 1;
    byTask[item.task] = (byTask[item.task] ?? 0) + 1;
    inputTokens += item.inputTokens ?? 0;
    outputTokens += item.outputTokens ?? 0;
    cost += item.estimatedCostUsd ?? 0;
  }

  const fallbackish = (byOutcome.fallback ?? 0) + (byOutcome["invalid-schema"] ?? 0) + (byOutcome.error ?? 0) + (byOutcome["unsafe-output"] ?? 0);

  return {
    calls: records.length,
    byOutcome,
    byTask,
    p50LatencyMs: percentile(latencies, 0.5),
    p95LatencyMs: percentile(latencies, 0.95),
    totalInputTokens: inputTokens,
    totalOutputTokens: outputTokens,
    estimatedCostUsd: Number(cost.toFixed(4)),
    fallbackRate: records.length ? Number((fallbackish / records.length).toFixed(3)) : 0,
  };
}

function percentile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * q));
  return sorted[index] ?? 0;
}

/** Reset, for tests. */
export function clear(): void {
  records.length = 0;
}

# Observability

Privacy-safe patterns for operational visibility. No sensitive user content is logged.

---

## 1. Principles

- **Cardinality-bounded**: log `task`, `provider`, `outcome`, `latencyMs`, `tokens`, `retries` — not prompts, not user text, not identifiers that join back to a person.
- **Structural privacy**: the record types (`packages/observability/index.ts`) have no slot for user content. A leak requires inventing a new field.
- **Same shape everywhere**: AI calls, API failures, provider failures, and external integration failures share a small, overlapping set of fields so dashboards do not need per-app special cases.

## 2. AI telemetry interface

From `packages/observability/index.ts`:

```ts
interface AiCallRecord {
  task: string; provider: string | null; model: string | null;
  promptVersion: string;
  outcome: "ai" | "fallback" | "invalid-schema" | "unsafe-output" | "error" | "rate-limited" | "cache-hit";
  latencyMs: number; inputTokens?: number; outputTokens?: number; estimatedCostUsd?: number;
  at: string; retries?: number; fallbackReason?: string; validationFailure?: string;
}
interface AiStats {
  calls: number; byOutcome: Record<string,number>; byTask: Record<string,number>;
  p50LatencyMs: number; p95LatencyMs: number; totalInputTokens: number; totalOutputTokens: number;
  estimatedCostUsd: number; fallbackRate: number;
}
```

- Record a completed `AiCallRecord` for every AI dispatch, including fallbacks and cache hits.
- Aggregate with `stats()` for settings panels or log sinks.
- Enable JSON-line logging with `AI_LOG=1` — single-line, no user content by construction.

Reference implementation: `apps/rapport/src/ai/telemetry.ts`.

## 3. App-level errors

```ts
interface AppErrorRecord {
  class: "unexpected-app-error" | "api-failure" | "provider-failure" | "external-integration-failure";
  context: string;        // route or subsystem, e.g. "POST /api/ai"
  message: string;        // cardinality-bounded, no user content, no PII
  at: string;             // ISO 8601
  provider?: string | null; model?: string | null;
  latencyMs?: number; retries?: number;
}
```

- Provider failures (timeout, 5xx, abort) map to `provider-failure` and always degrade to fallback rather than surfacing as `500` unless the fallback itself failed.
- External integration failures map to `external-integration-failure`; preserve status codes, never response bodies.
- Unexpected application errors include route/subsystem but not stack PII.

## 4. Adoption checklist

- [ ] Every provider call is timed and recorded, including the fallback path.
- [ ] Outcome is one of the seven canonical values — not free text.
- [ ] `retries` and `validationFailure`/`fallbackReason` populated when applicable.
- [ ] `AI_LOG=1` produces single-line JSON verified to contain no user content.
- [ ] Route error handlers emit `AppErrorRecord` for uncaught errors.

## 5. Current adoption

| App | AI telemetry | App error record | Notes |
|-----|--------------|------------------|-------|
| Rapport | ✅ full (`telemetry.ts`) | ✅ | Reference implementation |
| Revise | ◐ envelope only (source/provider) | ◐ console | Adopt `packages/observability` for tokens/cost/latency |
| Daily Debate | absent | absent | Add with timeout hardening |
| Reflect | absent | absent | Add with timeout hardening |
| Pulse | N/A (not generative) | absent | Findings already privacy-safe |
| Forq / Habit / Arise / French / Noticed | N/A or local | local | Document export/recovery instead |

## 6. What not to do

- Do not log prompts, transcripts, or any string that could contain the user's free text.
- Do not log raw provider error bodies — they can echo request content. Keep a bounded shape: `message.slice(0,40).replace(/[\r\n]/g," ")`.
- Do not log user ids. Rate-limit keys are IP hashes / session ids.

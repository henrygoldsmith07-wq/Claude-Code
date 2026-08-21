# @ruflo/observability

Privacy-safe telemetry interfaces shared across AI-enabled apps.

## What this is

A **type-only contract** for:

- `AiCallRecord` — provider, model, latency, tokens, retries, validation failure, fallback, cost
- `AppErrorRecord` — unexpected errors, API failures, provider failures, external integration failures
- `DataProvenance` — source, timestamp, freshness, transformation, confidence, algorithm/version

No user content is ever a field. That is structural: the types have no `prompt`, `userText`, or `identifier` slot to fill, so a leak requires inventing a new field, not forgetting to redact one.

## Usage

Copy `index.ts` into any app, or import when the monorepo has a shared build:

```ts
import { buildAiCallRecord, createInMemoryTelemetry } from "@ruflo/observability";

const telemetry = createInMemoryTelemetry();
const started = Date.now();
try {
  const result = await provider.complete(req);
  telemetry.recordAiCall(buildAiCallRecord({
    task: "explain",
    provider: provider.name,
    model: provider.model,
    promptVersion: PROMPT_VERSIONS.explain,
    outcome: "ai",
    started,
    usage: result.usage,
  }));
} catch (error) {
  telemetry.recordAiCall(buildAiCallRecord({
    task: "explain",
    provider: provider.name,
    model: provider.model,
    promptVersion: PROMPT_VERSIONS.explain,
    outcome: "error",
    started,
    fallbackReason: error instanceof Error ? error.message.slice(0, 60) : String(error).slice(0, 60),
  }));
}
```

The in-memory store is for tests and small deployments. For production, forward `AiCallRecord` to your log sink (still no user content) and aggregate with `stats()`.

## Canonical implementations

- **Rapport**: `apps/rapport/src/ai/telemetry.ts` — full implementation with `stats()`, cost estimation, `AI_LOG=1` JSON lines.
- **Revise**: `apps/revise/src/ai/tasks.ts` logs via envelope `provider`/`note`; adopt this package to add token/cost/latency reporting.

## What not to log

- User prompts, completions, transcripts, file contents, or any free-text field that could contain PII.
- Raw error messages that echo request bodies. Slice and sanitise: `message.slice(0, 40).replace(/[\r\n]/g, " ")`.
- Identifiers that join back to a person. Rate-limit keys are IP hashes or session ids, never user ids.

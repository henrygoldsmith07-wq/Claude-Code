# AI Engineering Standard

Every AI-enabled product in this monorepo must implement the same pipeline, so a reviewer can audit any one of them without learning a new shape.

The standard is intentionally narrow: it does not dictate model choice, prompt wording, or product voice. It dictates **where validation and accountability live** so that model output can never be mistaken for verified work.

---

## 1. Pipeline

```
input validation
  → context construction (with token budget)
    → provider call (with timeout + retry + fallback)
      → structured schema (tool / json_mode / json_hint)
        → schema validation (zod)
          → deterministic validation
            → confidence
              → provenance
                → user output (always labelled)
```

### 1.1 Input validation

- Validate every caller-supplied field with `zod` (or equivalent) **before** constructing a prompt.
- Enforce hard max lengths: text fields ≤8–60k chars depending on task, arrays capped (e.g. history ≤20 turns), image payloads ≤8 MB base64.
- Reject unknown `task` names with `400 Unknown task` — never pass an unlisted task into a provider.
- Strip or reject control characters and unexpected markup before prompt injection.

Reference: `apps/revise/src/ai/tasks.ts:payloadSchemas`, `apps/rapport/src/ai/types.ts`.

### 1.2 Context construction

- Assemble prompts from **authored curriculum / domain objects**, not by concatenating raw user text into an unbounded transcript.
- Keep the transcript slice small: last N turns or last K characters (e.g. `text.slice(0, 18_000)` in Revise). Oversized context is a cost bug and a prompt-injection surface.
- System prompt carries the task discriminator; do not duplicate it in the user message (`stripForPrompt` in Rapport).
- For grounded tasks (explanation, marking, flashcards from notes), inject the spec content / notes **verbatim** and instruct the model not to add facts not in the context.

### 1.3 Provider call

- **Timeout** mandatory: `AbortController` with `30–45s` (Rapport `30_000`, Revise `45_000`). No unbounded `fetch`.
- **Retry** at most once on transient failure (`429`, `5xx`, `AbortError`). `4xx` other than `429` must not retry.
- **Keys never leave the server**: no provider SDK in the client bundle, no key serialised into any response.
- **Fallback** is required, not optional: every task has a deterministic implementation in `domain/` that runs when the provider is absent, times out, or returns malformed/unsafe output. The fallback must be **accurate, not a stub** (e.g. Revise's curriculum-derived `explainFallback`, Rapport's domain heuristics).

### 1.4 Structured schema

- Every task declares a `RESPONSE_SCHEMAS[task]` (zod) shared between server and browser. The browser never assumes a wider shape than the server validates.
- Prefer provider **tool use** with `required` fields (`anthropic.tools` with `tool_choice: {type:"tool", name}`) where the provider supports it (Daily Debate, Emotion Tracker). Where not available, use `jsonHint` / `response_format: {type:"json_object"}` plus `extractJson`.

### 1.5 Schema validation

- Parse `extractJson(text)` then `schema.safeParse`. On failure, treat the call as failed — do not attempt to coerce or regex-extract fields.
- `extractJson` must handle ```json fences and surrounding prose but then validate strictly; leniency in extraction must not become leniency in validation.

### 1.6 Deterministic validation

- After schema validation, run a **task-specific deterministic check** that the model cannot waive:
  - Revise: `mark` confidence must be `0–1`, credited/missed points consistent with awarded marks, LaTeX preserved.
  - Daily Debate: `argGraph` nodes have `evidenceStrength` `cited|strong` only when `citations` are present; edges reference existing node ids (`argGraphValidation.ts`).
  - Reflect: `validateSummary` enforces hedged bias language and required `trace` fields.
  - Rapport: `safetyCheck` / `checkGeneratedContent` plus per-task language gates (appearance, trait inference, excessive criticism).

### 1.7 Confidence

- Every scored or diagnostic output carries a `confidence: number 0..1` or an explicit `null` when no model was involved.
- Do **not** invent certainty:
  - Correlation findings cannot be `high` confidence (`apps/pulse/src/statistics/confidence.ts`).
  - Bias flags below `0.45` are omitted rather than hedged (`apps/emotion-tracker/src/lib/gemini.ts`).
  - Returning a numeric score without calibration data is a failure to be fixed, not a UI edge case.

### 1.8 Provenance

- Every user-visible AI result is wrapped in an envelope `{ data, source: "ai" | "fallback", provider, promptVersion?, latencyMs?, note? }` so the UI can always state who wrote it.
- For insights/recommendations derived from external or historical data, attach a separate provenance record (see [Data Provenance](./data-provenance.md)): `source`, `timestamp`, `freshness`, `transformation`, `confidence`, `algorithm/version`.

### 1.9 User output

- Never display unstructured model prose without passing through §1.5–§1.7.
- Label the source in the UI: model-written vs deterministic. The label comes from the envelope's `source`, never from a string the model produced.
- For hedged domains (bias, causality, medical, financial), enforce hedged phrasing templates: `"This interpretation may involve …; evidence for (…) vs against (…)."` Plain assertion is a schema failure.

---

## 2. Audit checklist (for PR review)

- [ ] Payload schemas validate max lengths, cap arrays, reject unknown tasks.
- [ ] Context assembly slices to a token/char budget and injects spec content deterministically.
- [ ] Provider call has an `AbortController` timeout ≤45s.
- [ ] One retry on `429/5xx` only; other `4xx` fails fast and falls back.
- [ ] Every task lists a response schema with min/max bounds and `confidence` where scoring.
- [ ] `extractJson` + strict parse with fallback on failure — no raw text display.
- [ ] Deterministic gate after schema parse (safety, hedge, citation rule, etc.).
- [ ] Envelope returned with `source` and `provider` for UI labelling.
- [ ] Offline fallback exists and is accurate (derived from curriculum/domain, not a placeholder).

---

## 3. Current conformance

| App | Provider abstraction | Timeout | Retry | Structured schema | Schema validation | Deterministic gate | Fallback | Confidence | Provenance |
|-----|----------------------|---------|-------|-------------------|-------------------|--------------------|----------|------------|------------|
| **Revise** | `src/ai/provider.ts` (anthropic + openai-compatible) | 45s | 1 transient | `RESPONSE_SCHEMAS` (zod) | `safeParse` + `extractJson` | mark-scheme checks, LaTeX | `fallback.ts` (curriculum-derived) | `confidence 0..1` | envelope per task |
| **Rapport** | `src/ai/provider.ts` | 30s | 1 transient (`completeWithRetry`) | `RESPONSE_SCHEMAS` | `safeParse` | `safetyCheck`, language gates, hedge | Domain fallbacks | per-evaluation | `evidence.ts` ledger |
| **Daily Debate** | `src/lib/anthropic.ts` (tools) | SDK default* | none explicit | tool `input_schema` | tool_use extraction + `argGraphValidation` | `finalizePvpAssessment`, observable assessment | deterministic scoring | breakdown + `scoreStatus` | homepage-only citations |
| **Reflect** (emotion-tracker) | `src/lib/gemini.ts` (tools) | SDK default* | none explicit | `ASK_TOOL` / `CONCLUDE_TOOL` | `validateSummary` + output validation | hedged bias + pipeline completeness | backfill + predicted-outcome default | `0.45` threshold | evidence report |
| **Pulse** | Analytics, not generative | — | — | `finding.ts` | `validateFinding` | causal-language gate, high-confidence guard | local discovery engine | `confidence.score` | full provenance on Finding |
| **Forq / Habit / Arise / French / Noticed** | No generative AI (local-first) | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |

\* SDK defaults should be wrapped in an explicit timeout — flagged as a gap below.

### Gaps to close

1. **Daily Debate & Reflect**: add explicit `AbortController` timeout around SDK calls and one transient retry where a fallback exists. Low risk today because scoring is deterministic, but the pipeline lists it as required.
2. **Daily Debate**: harmonise rate limiting + envelope shape with Revise/Rapport across topic/turn routes.
3. **Revise provenance**: attach a `DataProvenance` object to recommender actions (currently only the AI envelope carries provider info).

---

## 4. References

- Revise: `apps/revise/src/ai/provider.ts`, `apps/revise/src/ai/tasks.ts`, `apps/revise/src/ai/types.ts`, `apps/revise/src/ai/fallback.ts`
- Rapport: `apps/rapport/src/ai/provider.ts`, `apps/rapport/src/ai/tasks.ts`, `apps/rapport/src/domain/safety.ts`
- Daily Debate: `apps/daily-debate/src/lib/anthropic.ts`, `apps/daily-debate/src/lib/observableAssessment.ts`, `apps/daily-debate/src/lib/argGraphValidation.ts`
- Reflect: `apps/emotion-tracker/src/lib/gemini.ts`, `apps/emotion-tracker/src/lib/validation.ts`
- Pulse: `apps/pulse/src/discovery/finding.ts`, `apps/pulse/src/statistics/confidence.ts`

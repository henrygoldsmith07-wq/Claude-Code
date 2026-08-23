# Reflect — 6.3/10 → structured challenge, not tracking

A structured reflection tool that challenges interpretations instead of merely
logging a mood. Intentionally *not* a Bearable-style breadth tracker.

Specialization — one clean pipeline, not dashboards:

```
event → observations → assumptions → emotion → alternative interpretations → intended outcome → action → later follow-up
```

- **event** — what happened (1–3 sentences, facts first).
- **observations** — verifiable facts only ("they said …", "they did …"); no mind-reading there — motive attributions move to assumptions.
- **assumptions** — unchecked inferences the user treated as fact.
- **emotion** — the specific feeling underneath the first label.
- **alternatives** — at least one other plausible reading of the *same* observations.
- **outcome / action** — what the user actually wants, and the single next step.
- **follow-up** — when to check whether it helped (`followUpAt` + later `followUpNote`).

## How it works

1. Choose a **Quick reflection** (one focused question) or a **Full reflection** (up to five questions), then describe the situation and your first read on it.
2. Claude asks one careful question at a time, advancing the pipeline step-wise: separating observations from assumptions, naming the deeper emotion, proposing alternatives, clarifying outcome/action and a check-in date.
3. Then it concludes with a structured `trace` (the 8 stages above) plus: triggers, a hedged take on any reasoning patterns, the other side's perspective, an honest assessment, caution flags, next steps, and a follow-up checkpoint you can set or record an outcome on later.

All data is stored locally in `localStorage` — no account or backend other than the reflection API.

## Language contract — no false certainty

The largest product risk here is presenting a tentative reading as a diagnosis.
So Reflect enforces a hedged style:

- Never "You have catastrophizing bias". Instead, e.g.:
  > "This interpretation **may involve** catastrophizing; **here's the evidence for that reading** (…) **and the evidence against it** (…)."
- Each bias flag carries `description` (hedged) + `evidenceFor` + `evidenceAgainst` + `confidence` (0..1). Below 0.45 the flag is omitted entirely rather than hedged.
- When any pattern is flagged, a `hedgedDisclaimer` is required: tentative readings of a single account, not diagnoses.

This is validated in code (`src/lib/validation.ts`); the model is rejected if it violates the contract.

## Product surfaces

The main navigation is deliberately small: **Reflect**, **History**, **Patterns** and **Settings**. History combines the former reflection list and timeline, while Patterns combines repeated signals, evidence over time, calibration and predicted-vs-actual reviews. Settings contains privacy, export, encryption, the optional API key and the optional outcome-study event log.

The **evidence report** adds a dated, versioned view of the same local summaries: month-by-month evidence counts, linked findings, calibration and action trends, plus JSON or Markdown export. Conversation messages are excluded from the report; findings cite the local reflection IDs they came from.

## Pattern engine — calibration, not just counting

`src/lib/longitudinal.ts` turns the follow-up loop into measurable learning:

- **Quantified accuracy** — `predictionAccuracy()` reports supported/unsupported/partial percentages across reviewed predictions; `predictionAccuracySeries()` orders them over time.
- **Decision improvement** — `decisionImprovement()` splits reviewed reflections chronologically and measures whether the unsupported-assumption rate drops in the second half (reflection tracking reality better).
- **Prioritised resurfacing** — `resurfacingQueue()` ranks open follow-ups by days-overdue + whether the intended action was ever logged; `suggestFollowUp()` picks the re-check interval from the verdict (unsupported → 3d, supported → 14d, missing action → sooner).
- **Action tracking** — `actionFollowThrough()` measures how many reviewed reflections actually logged their action.
- **Patterns link to evidence** — `summaryInsights()` returns every pattern/contradiction/calibration/unresolved item with its supporting `entryIds`; weekly/monthly reviews carry the same linked `patterns`, `contradictions` and `actionsOutstanding`.
- **Users can correct the model** — `src/lib/corrections.ts`: rejecting an inferred pattern stores a stable key, and `withoutDismissed()` filters it out of summaries, insights and reviews forever (no resurfacing).
- **Sharper detectors** — recurring-assumption grouping is stem-aware and stopword-aware (shared tokenisation with search, so the pattern engine and search agree); contradiction detection now catches always-vs-never oppositions and labels same-trigger emotion shifts as possible change.
- **Automatic search that agrees with the detectors** — `automaticSearch` ranks locally with stem-aware relevance over a weighted document (title/emotion/trigger outrank buried message text), then falls back to exact matching. Runs fully locally, so local-only mode stays local.
- **Safe restore/import** — `src/lib/importExport.ts` is the trust boundary for imports: encrypted vault exports are rejected (they must be decrypted with the passphrase), malformed JSON/rows are skipped with warnings, ids are deduped (first wins), and imports are capped. Nothing imported can silently wipe the vault.
- **Validated on realistic longitudinal data** — the benchmark now includes `runRealisticLongitudinalBenchmark()`: a multi-month corpus with paraphrased recurrences, a near-duplicate decoy that must NOT group, unrelated noise, a planted contradiction and a recurring emotion pattern — precision and recall checked together, not just clean planted fixtures.

## Privacy boundaries (tested)

`src/lib/privacy.ts` states the contract in code: `localOnlyAudit()` inventories what runs locally vs the single network call (the current reflection's messages, only with a key present); `containsVerbatimEntryText()` proves Pulse snapshots and API entry hints never carry entry content. `crypto.ts` adds `verifyPassphrase()` (check the key before restoring) and `rekeyVault()` (change the passphrase without losing the vault). `emitPulseGuarded()` in `pulse.ts` enforces explicit opt-in at the API level — no opt-in, no dispatch.

The longitudinal engine is benchmarked deterministically (`runLongitudinalBenchmark()` in `src/lib/benchmark.ts`): planted recurring patterns, contradictions, calibration improvement and resurfacing priority are all recovered, and a rejected pattern never resurfaces. `runRealisticLongitudinalBenchmark()` adds a noisy multi-month corpus to catch precision regressions (decoy and noise entries must stay out of planted groups).

## Optional outcome study

The Settings screen includes an explicit opt-in for a real user outcome study. When enabled, Reflect stores only local timestamps, reflection mode, completion/follow-up counts, outcome-review verdicts and correction events. It never records reflection text or uploads the event log; the user exports it deliberately if a study requires the data.

## Setup

```bash
npm install
cp .env.example .env.local
```

Set `ANTHROPIC_API_KEY` in `.env.local` for a server fallback, or set `OPENROUTER_API_KEY` to route guided reflection through OpenRouter's free-tier models (any key shaped `sk-or-…` pasted into the app is routed to OpenRouter automatically; the model chain lives in `src/lib/openrouter.ts` and is overridable via `OPENROUTER_MODEL`). Leave both unset and visitors can paste their own key in the app.

```bash
npm run dev
```

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run lint` — lint
- `npm run type-check` — `tsc --noEmit`
- `npm test` — Vitest (prompt/model regression tests are the priority for this product)
- `npm run test:watch` — Vitest watch
- `npm run test:e2e` — Playwright browser flows (reflection → structured output → evidence → correction → export/delete → provider failure)

## Tests — the trust layer

For this product, prompt/model regression tests matter more than another chart:

- `src/lib/validation.test.ts` — hedged language, false-certainty detection, pipeline invariants.
- `src/lib/anthropic.test.ts` — system prompt contains the pipeline + hedged template + `evidenceFor/evidenceAgainst`/`hedgedDisclaimer`; tool schema still reflects every pipeline stage and the `followUpAt` checkpoint; min/max question enforcement.
- `src/lib/rateLimit.test.ts`, `src/lib/useEntries.test.ts` — guardrails + persistence shape including follow-up mutation.

Run them on every change to the prompts or `types.ts`.

## Trust infrastructure

Beyond the hedged-language contract, Reflect ships explicit machinery for trustworthiness:

- **Human review corpus v2** (`src/lib/humanReview.ts`) — storage, persistence (`loadCorpus`/`saveCorpus`/`upsertRecord`) and anonymisation for external review of system interpretations. Reviewer vocabulary: *supported fact / reasonable observation / plausible hypothesis / weak inference / unsupported interpretation / misleading interpretation* (v1 labels remain readable). No human review is ever fabricated — records only rehydrate labels real reviewers produced. Anonymised records carry counts and confidence bands, never verbatim entry text.
- **Double review, inter-rater reliability & adjudication** (`src/lib/reviewAgreement.ts`, `resolveEffectiveRecords`) — multiple reviewers label the same interpretation; agreement is measured as exact-label agreement, support-pole agreement and mean Jaccard over label sets, with a reliability tier withheld below five pairs. Supported-vs-unsupported conflicts are queued for adjudication; an adjudicator record (`role: "adjudicator"`) becomes authoritative. Unresolved conflicts are excluded from precision/false-inference rates and counted openly rather than counted twice.
- **Independent-review measurements** (`interpretationQuality`, `evidenceAttribution`) — precision (strictly grounded share), false-inference rate, evidence-attribution rate, and a dedicated **confident-misread tracker**: high-confidence interpretations later judged misleading or unsupported are listed for priority review. All computed only from labels real reviewers produced.
- **Longitudinal validation** (`src/lib/validationMetrics.ts`) — answers descriptively from local data: does a pattern remain supported later; how often patterns carry contradictory evidence; how often incorrect patterns get retired (user rejection or staleness expiry); whether user corrections permanently stop rejected interpretations (`correctionPersistence`); **pattern lifespan** (first→last evidence, median across patterns); and a **user-confirmed vs system-inferred separation** so patterns backed by user-verdicted reflections are never merged with purely inferred ones.
- **Confidence calibration** (`src/lib/confidenceCalibration.ts`) — pairs stored confidence with later human support and reports per-band supported rate, sample size, calibration error and an ordering check (high > moderate > low). Thin bands are flagged rather than over-claimed.
- **Self-calibration & falsifiability** (`src/lib/selfCalibration.ts`) — the system's `overallConfidence` is scored against the user's own follow-up verdicts using the same band math as reviewer calibration: does 0.9 actually hold up ~90% of the time? The provider contract enforces falsifiability at generation time (`validation.ts`): a ≥0.9 reading must cite ≥2 substantive observations or evidence items AND carry at least one concrete **falsification check** per assumption (`trace.assumptionChecks` — the observable that would count against the reading). Vague falsifiers and evidence-free confidence are rejected before storage; summaries render both the calibrated confidence language ("Fairly clear · 78%") and each "how this could be proven wrong" check.
- **Correction propagation** (`src/lib/corrections.ts`, extended) — rejecting an interpretation stores the rejected text, reason, timestamp, affected facts/patterns and an optional replacement understanding. The system prompt receives a "do not reintroduce" section, and `getNextReflectionStep` hard-fails if the model returns a previously rejected assumption without new evidence.
- **Pattern evidence with freshness** (`src/lib/patternEvidence.ts`) — every pattern carries evidence instances, contradictory instances, observation count, timespan, recency, strength, confidence, plus **temporal decay** (`effectiveStrength = strength × 0.5^(age/60d)`) and an explicit status tier: `insufficient | expired | emerging | established`. Patterns are not generated from minimal data (< 3 observations), stale ones are labelled expired rather than silently dropped, and insufficient-evidence signals stay visible in Patterns → Trust & self-validation.
- **Observation vs inference** (`src/lib/observationVsInference.ts`) — five tiers (user-stated fact → direct observation → computed pattern → hypothesis → user-confirmed) with distinct labels, styles and certainty language; hypotheses always carry for/against evidence; hedged "facts" are now flagged as mislabelled hypotheses.
- **Adversarial input** (`src/lib/adversarial.ts`) — flags sarcasm, quoted messages, third-person content, fiction, copied articles, lyrics, contradictions, prompt injection, hypothetical framings, opinion reversals, ambiguous references and **accidental sensitive-data ingestion** (emails, card/ID-like numbers, credentials). Pure injection is rejected at the route; sensitive data triggers a confirm-before-send warning; other flagged content is never auto-converted into user facts — the model is told to ask first.
- **Context/memory architecture** (`src/lib/memory.ts`) — separates recent raw entries, validated facts, corrections, patterns and summaries; retrieves only query-relevant context and caps provider hints to 5 lightweight entries instead of sending journal history.
- **Output validation** (`src/lib/outputValidation.ts`) — structured accept/retry/reject verdicts covering invalid structure, unsupported certainty, missing evidence, contradictory output (assumption duplicating an observation) and malformed confidence.
- **Privacy audit & verification** (`src/lib/privacyAudit.ts`, `privacy.ts`) — programmatic checks across encryption, export, deletion, key handling, logs, analytics, server storage and AI-provider payloads; any verbatim leak in diagnostics fails the audit. Exports are round-trip verified against on-device entries and deletions verify the keys actually left storage. Opt-in **retention windows** (`retention.ts`) purge old reflections explicitly and confirmed, never silently.
- **Outcome evidence** (`src/lib/outcomeEvidence.ts`) — descriptive measures of whether insights are later confirmed, rejected, stable over time, and whether action-logged suggestions correlate with supported outcomes. Descriptive only.

The **Patterns → Trust & self-validation panel** (`TrustPanel.tsx`) surfaces all of the above in one place: precision, false-inference rate, confident misreads, evidence attribution, calibration ordering, correction stickiness and retirement counts — each with honest thin-sample notes.

## Remaining limits of AI interpretation

These are inherent to the design and **not** fixed by anything above:

1. **Single-account bias** — every interpretation is built from one person's self-report. There is no access to how others experienced the same event, so "the other perspective" is speculation, however carefully hedged.
2. **No ground truth** — confidence numbers are model-generated estimates, not measured probabilities. Calibration reporting can only show whether they *correlate* with human support after the fact. The independent-review corpus (v2) and its measurement suite exist and run locally, but **no external reviewers have labelled a corpus yet** — precision, false-inference and calibration numbers stay empty until real reviews are collected, and the app says so rather than implying validation it doesn't have.
3. **Lexical pattern detection** — recurring-assumption grouping uses stemming + Jaccard similarity. It will miss paraphrases with different wording and may group surface-similar but meaning-different statements despite decoy tests.
4. **Contradiction detection is shallow** — negation/always-vs-never heuristics catch obvious oppositions only; semantic contradictions pass unnoticed.
5. **Corrections are lexical too** — a rejected interpretation is blocked by key/text matching. A genuinely new phrasing of the same rejected idea can still resurface until reviewed again.
6. **The model can be wrong about emotions** — named emotions and bias labels are plausible readings, not assessments. A confident-sounding misread is still a misread.
7. **No clinical validity** — Reflect is a reflection aid. Nothing here is diagnosis, therapy, or evidence of psychological benefit; outcome metrics describe usage, not efficacy.
8. **Provider dependence** — interpretation quality varies with the model behind the API; validation enforces structure and hedging, not accuracy.

## Setup

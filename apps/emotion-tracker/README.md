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

Set `ANTHROPIC_API_KEY` in `.env.local` for a server fallback, or leave it unset and let visitors paste their own key in the app.

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

## Tests — the trust layer

For this product, prompt/model regression tests matter more than another chart:

- `src/lib/validation.test.ts` — hedged language, false-certainty detection, pipeline invariants.
- `src/lib/anthropic.test.ts` — system prompt contains the pipeline + hedged template + `evidenceFor/evidenceAgainst`/`hedgedDisclaimer`; tool schema still reflects every pipeline stage and the `followUpAt` checkpoint; min/max question enforcement.
- `src/lib/rateLimit.test.ts`, `src/lib/useEntries.test.ts` — guardrails + persistence shape including follow-up mutation.

Run them on every change to the prompts or `types.ts`.

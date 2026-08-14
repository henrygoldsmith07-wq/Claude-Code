# Pulse

Privacy-first personal analytics and experimentation engine — the intelligence
layer over the rest of the ecosystem.

Pulse connects data from your other apps and turns it into **evidence-backed**
insights, experiments and recommended actions. It is deliberately not a habit
tracker and not a dashboard of correlations.

The core loop:

```
COLLECT → NORMALISE → VALIDATE → ANALYSE → DISCOVER → HYPOTHESISE
→ EXPERIMENT → RECOMMEND → MEASURE → LEARN
```

## The rule everything else serves

**Correlation is never presented as causation.** Every insight must show what
was found, which data supports it, the sample size, the effect size, the
confidence, the possible confounders, whether it is an observation, a
correlation, a hypothesis or an experimental result, and a recommended next
action — or an explicit "no action is justified yet".

That contract is a type (`Finding` in `src/discovery/finding.ts`) with a
validator, not a convention. A finding that uses causal language without
experimental evidence, or that is graded high confidence off a correlation, is
rejected before it reaches the UI.

## Running it

```bash
npm install
npm run dev        # boots against a synthetic benchmark user — no accounts, no network
npm run verify     # lint + type-check + unit tests + build
npm run test:e2e   # browser tests, including axe accessibility in both colour schemes
```

The dev build carries no real data. It generates a seeded synthetic person with
relationships known by construction, so the app is explorable and the engine is
testable against a known answer.

## Layout

Analytics is completely independent of the UI. Everything under `src/` except
`ui/` is framework-free and runs in plain Node.

| Directory | What lives there |
|---|---|
| `events/` | Versioned universal event schema, DST-safe time maths, migrations, dedup, storage |
| `connectors/` | Connector SDK, sync engine (consent, paging, cursors, backfill, health), one module per source |
| `quality/` | Five-dimension data-quality scoring that feeds the confidence grade |
| `metrics/` | Metric registry, curated catalogue, per-event and per-day computation |
| `timeseries/` | Trend (Theil-Sen + Mann-Kendall), baselines, anomalies, lag analysis, cross-app timeline |
| `statistics/` | Distributions, comparisons, effect sizes, correlation, multiple-testing, power, seeded resampling, confidence grading |
| `discovery/` | Candidate generation, confounder detection and adjustment, the relationship scan |
| `hypotheses/` | Hypothesis records and their status machine |
| `experiments/` | Crossover / A-B / before-after design and analysis |
| `recommendations/` | Evidence-weighted ranking and insight feedback |
| `predictions/` | Walk-forward validated models that refuse to publish unless they beat the baselines |
| `knowledge/` | The personal knowledge graph |
| `reports/` | The weekly intelligence brief |
| `privacy/` | Consent, export, per-source deletion, redaction, encryption at rest |
| `ai/` | The narrow AI boundary and its numeric guard |
| `ask/` | Natural-language question parsing and deterministic answering |
| `synthetic/` | Benchmark users with known ground truth |
| `ui/` | A thin React layer that renders what the engine computed |

## How Pulse avoids fooling you

Personal analytics fails in a specific way: with twenty metrics there are
hundreds of comparisons, and at p < 0.05 a good handful will look significant
on pure noise. Six defences, all tested:

1. **Curated metrics.** Only quantities someone has classified as an outcome,
   behaviour or context are scanned. `role` and `direction` are editorial
   judgements, and a third-party connector's metrics start as `context` — never
   as outcomes — until someone vets them.
2. **Explicit candidates.** Pulse asks five shapes of question a person would
   actually ask, not every pair against every other pair. Metrics riding on the
   same underlying event get one question between them, not one each.
3. **An independence floor.** Twelve flashcard reviews in one sitting are one
   sitting. Every group comparison is computed on *sitting-level* cluster means,
   and nothing is published below 14 distinct days.
4. **Multiple-testing correction within families.** Benjamini-Hochberg is applied
   within each outcome metric's family of related questions — pooling unrelated
   questions over-corrects — and both the family size and the total scan are
   shown to the user.
5. **An effect-size floor.** Statistical detectability is not a finding. An
   effect too small to act on is rejected with that reason recorded.
6. **Confounder adjustment, not confounder disclaimers.** Time of day, day of
   week, secular trend and session mix are each tested, and where a group
   difference exists the effect is re-estimated within two-hour strata. An
   effect that loses more than a third of its size under adjustment is marked
   uncontrolled and is never promoted to "run an experiment".

Findings are also checked for out-of-sample replication across a time split,
and observational evidence is capped below "high" confidence however good the
data is.

## Experiments

Pulse turns a strong association into a structured experiment: hypothesis,
condition A, condition B, target metric, minimum sample derived from the
predicted effect, duration, likely confounders, analysis method and success
criteria — with the predicted direction and size registered *before* the run.

Crossover is the default because it removes the biggest confounder in personal
data: you, changing over time.

Analysis can return `supported`, `refuted`, `inconclusive` or `invalid`.
`inconclusive` is a first-class outcome, not a failure to record, and an
underpowered null is never reported as evidence of no effect.

## AI boundary

AI is used for explanation, summarisation, natural-language querying and
hypothesis wording. It is never used to produce a number.

That is enforced, not promised: any narrative a model returns is scanned for
numeric tokens, and every one must appear in the fact set the deterministic
engine computed. A single unverifiable number rejects the whole narrative and
the deterministic text is used instead. Causal language in an explanation is
rejected the same way. Pulse is fully functional with no AI provider
configured.

## Privacy

- Everything is processed locally; there is no server.
- Consent is per-source and per-scope, with the scope descriptions shown verbatim.
- **Reflect requires its own explicit permission** and can never be enabled by a
  bulk "connect everything" action.
- Sensitive sources are excluded from analysis, exports and AI prompts unless
  asked for by name.
- Any source can be revoked and its data deleted on its own — and the findings
  that depended on it are invalidated with it.
- Full export in JSON, NDJSON or CSV. Free text never enters the analytic path.
- Optional AES-GCM encryption at rest with a PBKDF2-derived key.
- Telemetry carries shapes and counts only, enforced by a whitelist and a
  redaction assertion.

## Testing

`npm test` runs 370+ tests covering the schema, migrations, connector contracts,
deduplication, timezone and DST behaviour, missing data, metrics, statistics
(checked against published reference values), lag analysis, experiment analysis,
recommendation ranking, privacy and security, the AI guard, the full core loop,
performance budgets, and accessibility.

The benchmark users are the centrepiece. Each carries planted true effects,
planted null effects and a deliberately confounded relationship, so the suite
asserts both halves of the job:

- **sensitivity** — the planted effects are found;
- **specificity** — the planted non-effects are *not*, and the confounded one is
  flagged rather than endorsed.

The specificity tests are the load-bearing ones. Any tool will find something.

## Adding a connector

Implement a reader and a pure mapping function, then hand both to
`defineReaderConnector`. Paging, cursors, health checks, consent enforcement,
normalisation, validation and de-duplication come from the SDK — a connector
cannot accidentally skip a safety step.

Declare what you emit (`emits`) and what you read (`scopes`). `checkContract`
verifies at test time that a connector only emits metrics it declared, within
the ranges it declared.

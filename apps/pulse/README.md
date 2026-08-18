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
| `connectors/` | Connector SDK, sync engine (consent, paging, cursors, backfill, health), one module per source, cross-source reconciliation and the connector health dashboard |
| `quality/` | Five-dimension data-quality scoring that feeds the confidence grade |
| `metrics/` | Metric registry, curated catalogue, per-event and per-day computation |
| `timeseries/` | Trend (Theil-Sen + Mann-Kendall), context-aware baselines, drift and change points, seasonal adjustment, distributed lag/carryover analysis, cross-app timeline |
| `statistics/` | Distributions, comparisons, effect sizes, correlation, multiple-testing, power, seeded resampling, confidence grading and P1 safeguards |
| `discovery/` | Candidate generation, confounder detection and adjustment, the relationship scan |
| `hypotheses/` | Hypothesis records and their status machine |
| `experiments/` | Crossover / A-B / before-after design and analysis |
| `recommendations/` | Evidence-weighted ranking and insight feedback |
| `predictions/` | Walk-forward validated models that refuse to publish unless they beat the baselines |
| `knowledge/` | The personal knowledge graph |
| `evidence-graph/` | The personal evidence graph — beliefs, their evidence, and contradiction detection |
| `evidence-api/` | Versioned, read-only DTO access to the personal evidence graph |
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

7. **Contradictory evidence is tracked, not dropped.** The replication
   signature includes direction, so a later discovery of the same pair
   pointing the *other* way would otherwise look like an unrelated new claim.
   A contradiction ledger catches it: every sighting of a conflicted pair is
   recorded, and every finding on either side is marked `contradicted` —
   overriding any replication status it had — with a note naming the
   conflicting sighting. A claim seen pointing both ways is suspect whichever
   side it was on, and the ledger keeps that conflict auditable and in the
   export until one side's data is gone.

### P1 statistics safeguards

The P1 layer in `statistics/safeguards.ts`, `timeseries/context.ts` and
`connectors/agreement.ts` makes the remaining failure modes explicit:

- **Personal context and baselines:** travel, illness, school, work and
  holiday labels; weekday/weekend and seasonal adjustment; context-aware
  baselines; baseline drift and change-point detection.
- **Temporal structure:** distributed lag models, carryover detection and
  autocorrelation-adjusted effective sample sizes. Estimated timestamps carry
  uncertainty windows, so weak temporal ordering cannot masquerade as a lag.
- **Robustness:** minimum observation/day thresholds, independent holdout
  periods, confounder and negative-control sensitivity, outlier sensitivity,
  effect stability and measurement-error propagation.
- **Evidence quality:** named BH/Holm/Bonferroni safeguards, reliability
  weighting and nearest-timestamp cross-source agreement checks. Discovery
  confidence surfaces serial correlation, unstable effects, low reliability and
  uncertain timestamps as limitations.

All primitives are deterministic and operate on local arrays or event
metadata. They do not send data to a server or make a causal claim by
themselves.

### User-controlled statistical inspector

The **Inspector** tab lets a person choose an outcome, exposure and optional
negative-control metric, then re-run the safeguards with an explicit policy:

- Benjamini–Hochberg, Holm or Bonferroni correction and a chosen significance level;
- autocorrelation lag, forward temporal-lag scan and independent holdout fraction;
- outlier cutoff, reliability weighting and uncertain-timestamp exclusion;
- weekday/weekend, calendar-trend and seasonal sensitivity controls.

The report shows raw and corrected p-values, effective sample sizes, holdout
direction, lag results, timestamp exclusions and limitations. Each lag tested
joins the correction family. Applying controls is explicit and never mutates
the finding ledger; the inspector is diagnostic evidence, not a causal claim.

## Experiments

Pulse turns a strong association into a structured experiment: hypothesis,
condition A, condition B, target metric, minimum sample derived from the
predicted effect, duration, likely confounders, analysis method and success
criteria — with the predicted direction and size registered *before* the run.

The Experiments view includes versioned templates for the three supported
designs: weekly crossover, balanced daily A/B and before/after baseline. A
template is a reproducible starting point, not a claim that every hypothesis
should use the same design; its caveats are shown before the run and its ID and
version are retained in the export.

Crossover is the default because it removes the biggest confounder in personal
data: you, changing over time.

Analysis can return `supported`, `refuted`, `inconclusive` or `invalid`.
`inconclusive` is a first-class outcome, not a failure to record, and an
underpowered null is never reported as evidence of no effect.

## Personal evidence graph

Above the findings sits what the person *believes* and why. Every belief is a
claim; every claim is settled only by evidence that carries its class and
confidence, and the same rules apply as everywhere else:

- every evidence edge names the engine entity it came from — no provenance, no
  edge;
- observational evidence caps a claim below "high" confidence;
- a claim worded causally is never endorsed unless an experiment backs it;
- supporting and refuting evidence that are both strong is surfaced as
  **contested**, not averaged into a mild "supported".

A belief with no evidence is **open**, not true. Claims are derived from
findings, hypotheses and experiment results, and can be authored directly via
`pulse.recordClaim(...)` — the engine labels each so the two can never be
confused.

## Personal Evidence API

`pulse.personalEvidence()` exposes a versioned, read-only in-process
contract for sibling UI code and trusted local integrations:

```ts
const evidence = pulse.personalEvidence();
const supported = evidence.listClaims({ status: "supported", limit: 20 });
const detail = supported[0] ? evidence.explainClaim(supported[0].id) : null;
const snapshot = evidence.snapshot();
```

The API returns claims, confidence, evidence nodes, provenance edges and
deterministic query results. It never returns raw events, metric attributes or
notes, and it rebuilds from the live graph on every call so source deletion is
reflected immediately. Claim and evidence statements can still contain the
person's own text; a future HTTP host must add authentication, tenancy,
transport redaction and rate limiting before exposing this contract remotely.
The API also exposes explicit `fullExport()` and `researchExport()` hand-offs;
the latter is the de-identified shareable payload. The older
`personalEvidenceApi()` method remains as a compatibility alias.

## Personal causal hypothesis library

Pulse's findings answer "what is true?" and its experiments answer "what is
causal?" — but neither is the user's own record of what they believe. The
library is that record: beliefs the user holds about what changes what, each
with a standing — untested → plausible → strengthening → confirmed or refuted —
that follows the evidence filed under it. Findings are promoted in one click
from the Insights tab (the finding becomes the belief's first evidence), and an
analysed experiment moves the standing when its verdict is decisive. The user
can override any standing; only "retired" is sticky. Beliefs, evidence and
standing history are scrubbed when a source that supplied them is deleted, and
persist at rest through the same encrypted adapter as the event store.

## Persistent insight history

Every discovery scan is a point-in-time photograph of what the engine believes;
the history ledger keeps each one and matches insights across scans by the
relationship they describe, so the Insights tab shows each insight's journey —
appeared, strengthened, weakened, reversed, disappeared (with the scan's own
rejection reason) — rather than only its current state. Identical rescans are ignored, so
the history records change, not churn, and it survives reloads: scans are
written through an encrypted adapter and restored by `pulse.load()` before the
boot replays them.

## Research export

`pulse.researchExport()` is the shareable form of the data: a de-identified,
statistics-first snapshot that can go to a researcher or into a study without
carrying a year of personal data along with it. Findings carry effect sizes,
confidence intervals, corrected p-values, sample sizes and confounders — never
titles, statements or narratives. Experiments carry verdicts, observed effects,
power and adherence. Coverage is counts and grades, never events, and each
insight's journey is condensed to its signature and change sequence. The whole
payload must survive the same redaction guard that protects anything else
leaving the device (`assertNoRawContent`), and sensitive sources are excluded
unless asked for by name — the same consent rules as the full export. The
Sources & privacy view offers it as a JSON download.

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
- The event store, insight history and causal hypothesis library persist
  through the same encrypted adapter and survive reloads via `pulse.load()`.
- Telemetry carries shapes and counts only, enforced by a whitelist and a
  redaction assertion.

## Testing

`npm test` runs 450+ tests covering the schema, migrations, connector contracts,
deduplication and cross-source reconciliation, connector freshness and coverage
gaps, file-import parsing and coercion, timezone and DST behaviour, missing data,
metrics, statistics (checked against published reference values), lag analysis,
experiment analysis, recommendation ranking, privacy and security, the AI guard,
the full core loop, performance budgets, and accessibility.

The benchmark users are the centrepiece. Each carries planted true effects,
planted null effects and a deliberately confounded relationship, so the suite
asserts both halves of the job:

- **sensitivity** — the planted effects are found;
- **specificity** — the planted non-effects are *not*, and the confounded one is
  flagged rather than endorsed.

The specificity tests are the load-bearing ones. Any tool will find something.

## Where the data comes from

| Source | Module | What it contributes |
|---|---|---|
| Apple Health, Health Connect | `connectors/health.ts` | Sleep, daily vitals, movement, body composition, workouts |
| Garmin, Fitbit, WHOOP, Oura | `connectors/wearables.ts` | The same physiology read first-hand, plus each vendor's own scores |
| Google Calendar, Outlook | `connectors/calendar.ts` | Commitment times and day shape — no titles, no attendees, no locations |
| Any CSV or JSON file | `connectors/tabular.ts` | Whatever the user maps, previewed before a single row is stored |
| The first-party apps | `revise`, `arise`, `forq`, `habit`, `chrono`, `le-studio-french`, `reflect`, `rapport` | As before |
| Habit (Supabase) | `connectors/habit.ts` | Habit check-ins — one event per habit per day, done or missed |
| Habit (same origin) | `connectors/habit.ts` | The same check-ins read from the app's local mirror, gated by Habit's own opt-in flag |
| Rapport (same origin) | `connectors/rapport.ts` | Drill and challenge history read from the app's local mirror, gated by Rapport's own opt-in flag |
| Revise (cloud) | `connectors/revise.ts` | Study history from `/api/pulse/history`, which the app refuses server-side unless its `pulseEnabled` flag is on |

Three decisions in that layer are worth knowing about.

**Measured physiology is shared; invented scores are not.** Every health source
emits the same `health.*` events with the same metric keys, so resting heart
rate is one series whichever band took it and switching device does not split
a year of data in two. WHOOP Recovery, Oura Readiness, Garmin Body Battery and
Fitbit Readiness are *models*, not measurements — all "0–100, higher is better"
and all computed differently — so they stay under `whoop.score`, `oura.score`
and so on, and are never pooled.

**A platform is an aggregator, so attribution is kept.** Apple Health will
happily hand over a step count that Garmin Connect wrote into it. Every health
event carries `origin_app` and `first_hand`, and `connectors/reconcile.ts` uses
them to recognise one measurement arriving twice. Double-counting inflates
daily totals, but the real damage is subtler: the sample looks twice as large
as it is, and the two "sources" agree perfectly, which reads as independent
corroboration when it is one watch wearing two hats. Reconciliation returns a
view plus a report of what it set aside and why — nothing is deleted, and the
user can override the precedence.

**A gap is not automatically a fault.** `connectors/dashboard.ts` judges
freshness against each connector's declared cadence, because a sleep tracker
silent for three days is broken and a file import silent for three months is
finished. When every source went quiet on the same days, that is named as a
blackout — a holiday, a flat battery — and excluded from the per-connector gap
counts, so the dashboard stays worth reading.

## Importing a file

`previewImport` is a dry run: it reports how many rows would land, names the
row and column behind every rejection, and lists the columns the mapping is
ignoring. Nothing is stored until the user agrees to it.

The importer refuses to guess. A blank cell is *not measured* rather than zero,
`1,234` is rejected rather than read as either 1234 or 1.234, and a
milliseconds column mapped as seconds is caught by a plausibility bound. An
import that fails loudly costs one row; an import that succeeds quietly and
wrongly costs the dataset.

## Adding a connector

Implement a reader and a pure mapping function, then hand both to
`defineReaderConnector`. Paging, cursors, health checks, consent enforcement,
normalisation, validation and de-duplication come from the SDK — a connector
cannot accidentally skip a safety step.

Declare what you emit (`emits`) and what you read (`scopes`). `checkContract`
verifies at test time that a connector only emits metrics it declared, within
the ranges it declared.

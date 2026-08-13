# Architecture

## The one rule

Deterministic systems own every number and every decision. The model writes
sentences.

That line is drawn deliberately and enforced structurally:

- `src/domain/` is pure TypeScript with no I/O, no React and no model calls. It
  holds the mastery model, the recommender, the evaluator, the scheduler, the
  safety gates, the analytics and all the content.
- `src/ai/` may only *phrase* things. Every task passes the computed values in
  and gets prose back; the response is schema-validated, safety-checked, and
  discarded in favour of a deterministic fallback if either fails.

The consequence worth stating plainly: **with no API key configured, nothing is
missing.** Scores, recommendations, spacing, difficulty, insights and weekly
reviews are identical. Only the wording of feedback and the fluency of simulated
characters change. The E2E suite runs in exactly that configuration so this
cannot quietly regress.

## Layers

```
src/domain/          pure logic and content
  types.ts           the complete data model
  skills.ts          75 skills, 51 dependency edges, graph queries
  mastery.ts         belief per skill: mastery + confidence, each with uncertainty
  scheduling.ts      retention, due dates, spacing priority
  recommender.ts     ten weighted factors, each individually explained
  session.ts         the daily plan and its time budget
  evaluation.ts      transcript features → behaviour scores → one improvement
  simulator.ts       character engine: styles, memory, engagement, difficulty drift
  scenarios.ts       scenario library + deterministic scenario builder
  challenges.ts      real-world challenge library + selection + derivation
  lessons.ts         micro-lessons with source metadata
  reflection.ts      signal extraction, retention/redaction
  coach.ts           problem → skill → principle routing
  analytics.ts       insight engine with sample thresholds
  weekly-review.ts   week regenerated from the log
  experiments.ts     personal experiments and their caveats
  progress.ts        counts and per-skill movement
  gamification.ts    milestones, coverage, non-punitive streaks
  voice.ts           pace/filler/pause metrics only
  safety.ts          manipulation, unsafe practice, distress, feedback language
  events.ts          the event log and its fold

src/ai/              provider abstraction, prompts, schemas, cache, telemetry, benchmark
src/data/            IndexedDB repository, export/wipe, E2E-encrypted sync
src/state/           one store, one clock
src/app/             pages + the single /api/ai route
```

## Event sourcing

`UserSkillState` is a **projection**, not a record. Everything that could move
mastery is appended to an event log first, and the states are folded from it by
`recomputeStates`.

This exists for one concrete reason: the scoring model will change. With stored
state, a change leaves months of numbers produced by the old model sitting
alongside numbers produced by the new one, and nobody can interpret the
history. With a log, the cached projection carries `SCORING_MODEL_VERSION`; when
the code's version no longer matches the stored stamp, `getSkillStates`
re-derives everything. No migration, no stale numbers, no reconciliation.

The same property makes weekly reviews and insights *derived* rather than
accumulated — regenerating a past week from the log always gives the same
answer, and improving the analytics improves the past too.

## The mastery model

Not XP. XP only increases, which makes it useless for deciding what to practise.
Each skill carries a belief:

- **mastery** — 0-1 estimated competence, with `masteryUncertainty`
- **confidence** — 0-1 estimated comfort, with `confidenceUncertainty`
- plus `attemptCount`, `successEvidence`, `difficultyTolerance`,
  `lastPractisedAt`, `retentionEstimate`

Evidence moves the estimate by a Kalman-style gain proportional to current
uncertainty, so early evidence moves things a long way and later evidence
refines. Uncertainty shrinks with evidence and **regrows with time**, which is
what stops the app asserting "strong" about a skill it last saw four months ago.

Three deliberate asymmetries:

1. Real-world evidence outweighs simulation evidence (weights 1.0 vs 0.6). The
   claim the product makes is about life outside the app.
2. Difficulty scales the target: performing well at difficulty 5 implies more
   than the same performance at difficulty 1.
3. Confidence lags mastery by design (a quarter of the gain) unless the user
   reports comfort directly — because it does.

Mastery itself does not decay; **retention** does. What someone *can* do is not
what fades, but the likelihood they would do it today is.

## The recommender

A transparent weighted model, not a learned one, for three reasons: it must
explain itself in a sentence ("why this?" is a first-class UI affordance); it
must behave sanely with almost no data; and a black box telling someone what to
work on socially is not something worth shipping.

Ten factors, several deliberately negative:

| Factor | Weight | Role |
|---|---|---|
| goalAlignment | 1.25 | People quit training unrelated to why they came. |
| prerequisite | 1.10 | Routes a blocked goal to what is blocking it. |
| weakness | 0.90 | Bounded — very hard + very weak is not where to start. |
| spacing | 0.85 | Capped: a year-old skill is *new*, not maximally urgent. |
| challengeFit | 0.60 | Keeps stretch to about one level. |
| confidenceGap | 0.55 | Competent-but-uncomfortable is the most trainable state. |
| contextRelevance | 0.50 | Matches the settings the user is actually in. |
| recentProgress | 0.45 | Consolidates momentum instead of abandoning at 60%. |
| variety | 0.40 | Stops a week becoming one domain. |
| **fatigue** | **−1.00** | Stops the engine grinding one weakness into the ground. |

## The evaluator

Asking a model for a score out of ten produces numbers that are unstable across
runs, uncalibrated across users, and indefensible when someone asks "why a six?".

So scoring is computed from countable transcript features: replies that picked
up something the other person said, open versus closed questions, disclosures
against questions, speaking share, hedges, fillers, reflections, validations,
minimising phrases, signalled versus unsignalled topic changes.

Three properties are load-bearing:

- **Evidence is attached to every score.** "3 of 5 replies referenced something
  they had said" is checkable; "0.62" is not.
- **Unreliable scores are excluded from mastery.** Each behaviour has a minimum
  turn count, and behaviours the transcript could not exercise (empathy in a
  cheerful exchange; relevance when the character said "Mm.") are not scored.
- **Exactly one improvement is named.** Ties are broken towards behaviours where
  something was *actively done* (minimising a feeling, taking 97% of the
  airtime) over something merely absent — better feedback, and it prevents the
  same generic weakness winning every time.

## The simulator

The engine decides *what kind of turn* the character takes — length, whether it
volunteers anything, whether it asks back, whether it winds down — and the model
only writes the words. A model asked to "be a quiet person" drifts helpful
within three turns; a turn plan does not.

Characters have `openness` and `reciprocity`, scaled by delivered difficulty, so
the same scenario is genuinely harder at level 5. Engagement responds to the
user: a good follow-up opens a character up, three questions in a row closes
them down. Difficulty drifts within a session — rising, then easing around turn
eight so a session does not end on its hardest moment.

## AI pipeline

```
rate limit → cache → provider (1 retry) → JSON extract → schema validate
           → safety gate → task validation → return
                                    ↓ any failure
                          deterministic fallback
```

Caching is per task: `simulate-turn` is never cached (a character repeating
itself destroys the illusion) and neither is `summarise-reflection` (a cache
keyed on reflection text is a store of it). Telemetry records task, outcome,
latency, tokens and estimated cost — and structurally cannot hold user content.

## Known limits

- Scoring is lexical. Stemming, anaphora detection and elliptical-question
  handling cover the common cases, but a reply that is topically relevant with
  no shared vocabulary can still be under-credited on `relevance`.
- Retention is a model assumption, not a measurement; the UI says so wherever it
  is shown.
- The insight engine looks for a fixed set of patterns rather than searching. It
  will not surprise anyone, which is the intended trade against false positives.
- Sync is last-writer-wins on the whole blob. There is no field-level merge that
  produces a coherent training history, and the UI asks rather than resolving
  quietly.

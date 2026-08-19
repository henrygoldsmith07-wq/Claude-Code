# Rapport

A personal training system for practical communication skills. Not a chatbot, not
a dating app, not a popularity tracker: a structured loop of assess → learn →
rehearse → practise for real → reflect → analyse → adapt, built around one claim —
**success is the user needing the app less over time.**

```
npm install
npm run dev          # http://localhost:3000
npm run verify       # lint + types + content validation + tests + build
npm run test:e2e     # Playwright, desktop and mobile
```

No API key is required. With no AI provider configured the whole product works:
scoring, recommendations, scheduling, insights and reviews are computed on the
device, and practice conversations fall back to the built-in character engine.

## What it does

| Area | Behaviour |
|---|---|
| **Skill graph** | 75 skills across 10 domains, with 51 dependency edges. Each skill is defined by observable behaviours, never by traits. |
| **Assessment** | Seven onboarding questions producing *priors with wide uncertainty*, explicitly labelled as guesses. No score, no label. |
| **Mastery model** | Kalman-style belief per skill: mastery and confidence tracked **separately**, each with an uncertainty that shrinks with evidence and widens with time. |
| **Adaptive engine** | Ten weighted, individually-explained factors — goals, weakness, prerequisites, spacing, confidence gap, variety, challenge fit, momentum, context, and fatigue (negative). |
| **Simulator** | Characters with communication styles, conversational memory and engagement that responds to what the user does. Difficulty drifts within a session. |
| **Evaluation** | Behaviour scores computed from countable transcript features, each shipped with its evidence. Scores from too little material are marked unreliable and never move mastery. |
| **Challenges** | Real-world tasks with completion criteria that depend only on what the user does. Skipping and swapping are free. |
| **Reflection** | Four questions, two optional. Signals extracted locally; never a diagnosis. |
| **Coach** | Routes a problem to its underlying skill and teaches the principle. Refuses to hand over a script. |
| **Analytics** | Insights carry observation, evidence, confidence, a hedged explanation and an action — and are suppressed below a minimum sample. |
| **Experiments** | Personal A/B with both group sizes reported and a mandatory causation caveat. |
| **Evidence lab** | Human-labelled behaviour corpus, independent raters, disagreement/adjudication, system calibration and real-world transfer outcomes. |
| **Voice** | Pace, fillers, pauses, reply length and turn share. Nothing else is computable from what is stored. |
| **Privacy** | Local-first. Every permission off by default. Optional end-to-end encrypted sync. |

## Pulse connection

Rapport can share a transcript-free history of its drills and challenges with
Pulse, the personal evidence engine in this ecosystem, when both apps are
served from one origin. Sharing is **opt-in** and controlled here, where the
data originates: Settings → Data & permissions has a "Share with Pulse"
toggle. While it is on, the app writes the derived history
(`rapport.pulse-history.v2`) where Pulse's same-origin connector can read it.
Turning it off deletes that copy immediately and clears the opt-in flag
(`rapport-pulse-opt-in`) Pulse's connector checks, so the flow stops at the
source — even a stale mirror is refused. Pulse never sees conversation
transcripts; the shared history is scores, timings and skill ids only.

## Architecture

```
src/domain/     Pure TypeScript. No I/O, no React, no model calls.
                The mastery model, recommender, evaluator, scheduler, safety
                gates, analytics and content all live here and are directly
                testable.
src/ai/         Provider abstraction, versioned prompts, zod response schemas,
                cache, rate limiter, telemetry, benchmark set.
src/data/       IndexedDB repository, event log, export/wipe, E2E-encrypted sync.
src/state/      One store; every derived value recomputed from the event log.
src/app/        Next.js App Router pages and the single AI route.
```

The split that matters: **deterministic systems own every number and every
decision; the model only ever writes sentences.** Scores, recommendations,
scheduling, difficulty and mastery are computed locally. A model, when
configured, rewrites feedback wording, plays characters and phrases
explanations — and its output is schema-validated and safety-checked before it
is shown, with a deterministic fallback behind it.

Skill states are a **projection of an append-only event log**, stamped with the
scoring-model version that produced them. When the scoring model changes, the
stamp mismatches and history is recomputed rather than left stale.

See [`docs/architecture.md`](docs/architecture.md), [`docs/privacy.md`](docs/privacy.md)
and [`docs/ai-evaluation.md`](docs/ai-evaluation.md).

## Group conversations

One-to-one practice has an invariant that quietly does the user a favour: after
every user turn, the character replies. The floor always comes back, so the only
thing being trained is what to *say* once you have it.

In a group that invariant is false, and its absence is the skill. `floor.ts`
therefore **can exclude the user**: characters bid for each turn on style and
engagement, and at higher difficulty they hold several turns among themselves
without addressing anyone. Two guards keep that hard rather than hopeless —
exclusion is bounded by difficulty (one turn at difficulty 1, four at 5, so
existing solo scenarios are unchanged), and breaking in is scored as a success
rather than punished as rudeness.

| Module | What it adds |
|---|---|
| `floor.ts` | Who speaks next, whether the user is invited, and who they never brought in. |
| `interruption.ts` | Classifies overlap instead of counting it. |
| `addressing.ts` | Who a turn is aimed at — shared by both, so neither imports the other. |
| `donation.ts` | Opt-in transcript donation and the human-rating apparatus. |

Three decisions worth knowing about:

- **Being named is not a bid you can lose.** Address someone and they answer,
  deterministically. Bringing a quiet person in is the headline skill of a group
  conversation, and it is only trainable if it reliably works — a user who says
  "Sam, what do you think?" and gets Priya has learned that names do nothing.
- **Attention costs something.** `updateEngagement` previously applied the full
  engagement change to every character, which made attention free: talk only to
  Alex all session and Sam warmed up just as much. A turn aimed at someone else
  now lands as being passed over, so "include the quiet one" has a mechanism
  behind it rather than being advice.
- **Interruption is classified, not counted.** "Don't interrupt" is bad advice
  and a worse metric. A short "yeah" over someone is support; an overlap they
  spoke through is ordinary; only stopping someone mid-sentence costs anything.
  Being cut off and *coming back* is counted separately, because that is the
  trainable half and it is invisible otherwise. A turn counts as cut off by
  whether it reached the end of its sentence — "did they speak again?" is the
  obvious test and makes coming back impossible to detect by construction.

`inclusion` and `floorEntry` join the behaviour keys, and are **dropped from
one-to-one transcripts** rather than scored at zero: a two-person conversation
cannot display a group behaviour, so it does not get to produce evidence about
one in either direction. Adding them bumps `SCORING_MODEL_VERSION` to 4, so
existing histories recompute instead of mixing two scales.

Group scenarios use three characters rather than two — with one other voice the
floor still returns by default, and there is no group to get into.

Overlap is computed from turn start times and voice durations, never from audio,
so the guarantee in `voice.ts` that nothing here can infer accent, pitch or
emotion is unaffected. In text mode overlap does not exist and the summary says
so rather than reporting zero.

## Donated transcripts

The evaluator has never been checked against a human judgement of a real
conversation, because there are none to check it against: conversations are
never collected, and `ai/benchmark.ts` names that as the reason its cases are
hand-written. That reasoning is right, so the invariant stays and donation
becomes a separate, deliberate act instead of a setting:

- one transcript at a time — there is no "donate my sessions" switch, because a
  switch collects things the user has not read;
- the user sees the exact text that would leave the device and edits it; the
  redacted copy is what is stored, never the original;
- donated copies carry no user id, no timings and no link to reflections,
  challenges or mastery — absent from the *type*, so a later refactor cannot
  quietly reintroduce them;
- consent records what was agreed to, and can be withdrawn.

Redaction suggestions are a lexical best effort and are presented as such. A
conversation can identify someone by what it describes with every name removed,
so the person donating is the last check, not the first.

The corpus ships **empty**. `evaluatorAgreement` reports "the evaluator has not
been checked against human judgement" rather than a number, uses only
transcripts with two or more raters, and ignores any behaviour the raters
themselves disagree about by more than 0.25 — rater disagreement means the
behaviour is not well enough defined to serve as a reference, which is itself
the finding. The local **Evidence lab** adds the operational layer around that
primitive: it stores independent labels, rater confidence, exact evidence,
disagreement rows, adjudications, inter-rater reliability, human-vs-system
false-positive/false-negative analysis, score calibration and transfer-study
outcomes. It makes no claim about real-world performance until a researcher
records a real outcome. `/evidence` also shows the persistent event history and
the transcript-free Pulse-compatible event-log sidecar.

## Configuration

Copy `.env.example` to `.env.local`. Everything is optional.

| Variable | Effect |
|---|---|
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | Enables the Anthropic provider. |
| `OPENAI_COMPATIBLE_BASE_URL` / `_API_KEY` / `_MODEL` | Any OpenAI-compatible endpoint. |
| `AI_PROVIDER` | Force `anthropic`, `openai-compatible`, or `none`. |
| `AI_RATE_LIMIT_PER_HOUR` | Per-caller ceiling (default 60). |
| `AI_LOG=1` | Structured, content-free call logging. |
| `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` | Enables optional encrypted sync. |

Sync requires the migration in `supabase/migrations/0001_init.sql`, which creates
a single table holding one opaque encrypted blob per user, with row-level
security allowing access only to its owner.

## Testing

| Suite | What it protects |
|---|---|
| `tests/skill-graph` | Graph integrity, acyclicity, behavioural (not trait) definitions. |
| `tests/mastery` | Belief updates, decay, uncertainty, evidence weighting, user overrides. |
| `tests/evaluation` | Transcript feature extraction and behaviour scoring. |
| `tests/recommender` | Factor behaviour, prerequisite routing, fatigue, determinism. |
| `tests/training-loop` | Onboarding → session → reflection → event log → weekly review. |
| `tests/analytics` | Insight thresholds, hedging, experiments, progress metrics, voice. |
| `tests/safety` | Manipulation, unsafe practice, distress, feedback language. |
| `tests/content` | Every lesson, challenge and scenario, checked as content. |
| `tests/persistence` | IndexedDB, export/import round-trip, retention, deletion. |
| `tests/ai-eval` | Benchmark calibration, prompt contracts, schema rejection. |
| `tests/a11y` | Focus, labels, landmarks, dark-mode tokens, copy contracts. |
| `e2e/` | The full loop in a real browser, with **no AI provider configured**. |

`npm run verify` runs lint, types, content validation, all unit suites and the
production build.

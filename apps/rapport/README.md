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
| **Voice** | Pace, fillers, pauses, reply length and turn share. Nothing else is computable from what is stored. |
| **Privacy** | Local-first. Every permission off by default. Optional end-to-end encrypted sync. |

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

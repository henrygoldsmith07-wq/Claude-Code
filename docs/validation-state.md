# Validation State — Implemented vs Proven Effective

Every product claim must be read with two questions:

1. **Is it implemented?** Does the code exist and run?
2. **Is it proven effective?** Has a measurement with real users or an independent audit shown it works?

A sophisticated implementation is **not** an effective product. The table below keeps the two questions separate.

---

## Legend

- **Implemented** — feature exists on `main`, on-device or behind a provider flag, with unit/integration tests.
- **Proven effective** — registry entry at `demonstrated` or `externally validated` with a cited source, sample, and benchmark. Anything else (`internally benchmarked`, `infrastructure only`, `insufficient evidence`) is **not** proven effective.

## Product table (2026-08-21)

| Product | What the code does (implemented) | Evidence claim | Validation state | What would prove it |
|---------|-----------------------------------|----------------|------------------|---------------------|
| **Revise** | 2,216 spec points, FSRS scheduling, 14 test suites (245 tests), content validator, AI explain/mark/socratic/cards with fallbacks, realtime sync | `revise-marking-accuracy` | **Implemented + internally benchmarked** — marks 32 fixtures against rubric | Blind double-marking vs external examiners; inter-rater κ |
| | | `revise-fsrs-scheduling` | **Implemented, not validated** — uses ts-fsrs, never measured retention in-product | 30-day retention study vs fixed schedule |
| **Rapport** | Skill graph, mastery model, scenarios, simulation runner, deterministic scoring, evidence ledger (4 channels), safety gates, AI tasks with fallbacks | `rapport-transfer` | **Implemented, not validated** — human-rated/validated-transfer channels exist but have zero field ratings | Pre/post study with third-party blind ratings |
| | | `rapport-safety-gate` | **Implemented + internally benchmarked** — pattern suite covers manipulation/isolation/distress | External red-team evaluation; FP/FN rates |
| **Pulse** | Universal event schema, connectors, discovery engine, counterfactuals, findings with structural validation | `pulse-discovery` | **Implemented + internally benchmarked** — causal-language and confidence guards enforced | Ground-truth dataset with injected effects; precision/recall |
| **Daily Debate** | Topic generation, solo debate with observable scoring, PvP judging with argument graph, source retrieval + verification pipeline | `daily-debate-observable-scoring` | **Implemented + internally benchmarked** — invariance fixtures; graph validation | Human-judge inter-rater agreement on real transcripts |
| **Reflect** (emotion-tracker) | Structured reflection pipeline, hedged bias language, output validation, corrections, longitudinal calibration | `emotion-tracker-reflection-quality` | **Implemented + internally benchmarked** — deterministic hedge + pipeline gates | User study on clarity/accuracy; clinician review of hedged phrasing |
| **Arise** | Programs, sessions, levelled attributes, offline progression, leakage-safe backtest | `arise-progression` | **Implemented + internally benchmarked** | Prescribed-vs-coach agreement; outcome correlation |
| **RTK** | Token-saving filter with families/detection/retention benchmarks and evidence ledger | `rtk-token-saving` | **Implemented + internally benchmarked** | Independent corpus + task-success A/B |
| **Noticed** (mental-load) | Shared board, household membership (RLS + RPC), hashed invitation tokens, realtime | `noticed-household-isolation` | **Implemented + internally benchmarked** | External pentest; enumeration timing; revocation race test |
| **Le Studio French** | Today/Speak/Review/Learn/Progress, Groq arena, relay hardening | `french-practice-fluency` | **Implemented, not validated** — content lint only | Learner progress study or STT/TTS correction accuracy |
| **Forq** (food-shopping-os) | Pantry, retailer, nutrition, local-first cloud sync, waste-minimising planner, E2E + migration tests | — (no registry entry yet) | **Implemented**. Suite currently has 19 red tests being fixed | Add registry entry when an insight claim is made |
| **Habit** | Daily check-ins, targets, streaks, history; authenticated isolation migration in flight | — | **Implemented**. 3+ suites incl. RLS/security | Adherence improvement vs control |
| **Ecosystem Shell** | One-origin shell, storage collision guard, rewrites | infra | **Implemented + tested** | Cross-app localStorage under the shell |

### No product is `demonstrated` or `externally validated`

That is correct as of this date. Reaching those statuses requires human evaluation or independent audit, not more unit tests.

## Evidence gaps that need humans, not more code

- Revision marking accuracy against human examiners (Revise)
- Training transfer observed by third-party raters (Rapport)
- Discovery precision/recall on injected effects (Pulse)
- Debate judge agreement with human panels (Daily Debate)
- Whether hedged reflections leave users clearer/more accurate (Reflect)
- Whether progressions match coach prescription and improve outcomes (Arise)
- Token saving measured as LLM task success per token (RTK)
- Household isolation under adversarial use (Noticed — external pentest)
- Fluency gain (Le Studio French — learner study)

All are listed under `limitations` in `evidence/registry.json`.

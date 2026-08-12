# AI quality evaluation

## What is being evaluated

Not "is the model good". The question that matters here is narrower and
answerable: **does the system behave correctly regardless of what the model
does?** Because the model only ever writes prose over locally-computed values,
most of the quality surface is deterministic and can be tested directly.

The suites run with no provider configured. That is the point — they test the
contracts and the fallback behaviour that must hold when a model is absent,
slow, malformed or unsafe.

## The benchmark set

`src/ai/benchmark.ts` holds six hand-written transcripts, each with a known
failure mode, and ten safety probes with expected verdicts.

| Case | Failure mode | Must be named as the improvement |
|---|---|---|
| `bench.interview` | Question after question, nothing offered | `reciprocity` |
| `bench.monologue` | User takes ~97% of the words | `contribution` |
| `bench.good-follow-up` | None — competent conversation | (strong on follow-up, relevance, question quality) |
| `bench.topic-hopping` | Every reply changes subject | `relevance` |
| `bench.no-empathy` | Solutions and minimising after bad news | `empathy` |
| `bench.over-hedged` | Request buried under apologies | `assertiveness` |

The assertion is on `selectImprovement` — the single sentence a user would
actually read — rather than on raw score ordering, because that is the decision
the product makes.

These are written by hand rather than sampled from users: the product does not
collect conversations for evaluation, and a benchmark built from private
reflections would contradict the privacy model it exists to protect.

## What the suites check

**Calibration** — expected weaknesses score below 0.45 and win the improvement
slot; the competent transcript out-scores the weak ones; repeated evaluation is
bit-identical.

**Excessive criticism** — no transcript produces feedback containing verdicts
about the person ("you always", "you are bad at"). `checkCriticismBalance`
requires at least one thing that worked before an improvement is shown.

**Repetition** — the six cases must not collapse to one or two improvements.
This is what caught the tie-breaking problem where a generic weakness won every
time regardless of the actual failure.

**Hallucination and overconfidence** — response schemas cap every field's
length; scores are never supplied by the model; the `explain-insight` gate
rejects an explanation that is not hedged.

**Inappropriate assumptions** — a regex sweep over every generated evaluation
for trait, mood and appearance language, plus `checkFeedbackLanguage` applied to
all model output and to the interface copy itself.

**Manipulation advice** — ten safety probes, including four ordinary requests
that must **not** be refused. Over-refusal is a tracked failure, not a safe
default.

**Context retention** — the character engine's memory is rebuilt from the
transcript and asserted to stay consistent; scenarios replay identically from
the same seed.

## Prompt versioning

Every task carries a version (`sim-v3`, `feedback-v3`, …) stored alongside
anything it produced. `tests/ai-eval.test.ts` asserts that every task has a
prompt, a JSON hint, a temperature, a token budget, a version and a response
schema, and that every system prompt states the house rules.

When a prompt changes:

1. bump its version in `PROMPT_VERSIONS`;
2. run `npm test` — contract and benchmark regressions fail here;
3. if the response shape changed, update the zod schema and the JSON hint
   together; the tests check they stay in step.

## Failure handling

| Failure | Outcome |
|---|---|
| No provider | Deterministic result, labelled "No AI provider configured." |
| Timeout / 5xx / 429 | One retry, then fallback. 4xx does not retry. |
| Non-JSON or wrong shape | Fallback, recorded as `invalid-schema`. |
| Manipulation or unsafe content in output | Fallback, recorded as `unsafe-output`. |
| Trait or appearance language in feedback | Fallback, recorded as `unsafe-output`. |
| Unhedged causal claim in an insight | Fallback. |
| Rate limit hit | Fallback, with the reset time shown. |

Every response carries `source: "ai" | "fallback"` and the UI always shows which
one it is displaying.

## Cost and observability

`GET /api/ai` returns provider status and aggregate stats: call count, outcome
breakdown, p50/p95 latency, token totals, estimated spend and the fallback rate.
The settings page surfaces these. A rising fallback rate is the signal that
something is wrong with the model path — and, by design, not with the product.

# Evidence Registry

Evidence lives in [`evidence/registry.json`](../evidence/registry.json) — a durable, machine-readable ledger of what has been **implemented** versus what has been **proven effective**.

## Why this exists

A sophisticated implementation is not the same as a validated product. A large test suite proves the code runs; it does not prove users improve, retain knowledge, or transfer skills. This registry keeps those two questions separate and prevents accidental claim inflation.

## Schema

Each entry has:

| Field | Meaning |
|-------|---------|
| `claim` | Plain statement of what the product says it does |
| `status` | One of the six values below |
| `evidence source` | Files, datasets, or external reports that back the claim |
| `sample size` | Number of independent observations / participants |
| `benchmark` | What was measured and how |
| `last updated` | ISO date of last meaningful re-evaluation |
| `limitations` | What is still missing or uncertain |

## Status values

| Status | Meaning |
|--------|---------|
| `demonstrated` | End-to-end behaviour shown with a cited benchmark and real sample |
| `partially demonstrated` | Core path demonstrated; edge cases, scale, or replication not yet shown |
| `internally benchmarked` | Measured on curated/synthetic data by the team; no real-user or third-party data |
| `infrastructure only` | Plumbing exists (types, schema, fallbacks) but no user-facing behaviour has been exercised |
| `insufficient evidence` | Claim made or implied but no measurement exists |
| `externally validated` | Independent replication or audit confirms the claim |

**Never automatically upgrade a claim based only on test count.** A claim moves from `internally benchmarked` to `demonstrated` only when a new, cited measurement with a real sample is added.

## Maintenance

- Update `evidence/registry.json` when a new benchmark, sample, or external report lands.
- Update `lastUpdated` on every status or evidence change.
- Be honest in `limitations` — the value of this file is in what it admits it does not know.

## Current summary (2026-08-21)

| Product | Claim | Status |
|---------|-------|--------|
| Revise — marking | Marks accurately without a model | `internally benchmarked` |
| Revise — FSRS | Spaces cards effectively | `infrastructure only` |
| Rapport — transfer | Simulator → real-world behaviour | `infrastructure only` |
| Rapport — safety | Blocks manipulation/isolation | `internally benchmarked` |
| Pulse — discovery | Confounder-controlled findings | `internally benchmarked` |
| Daily Debate — scoring | Observable-feature scoring is invariant | `internally benchmarked` |
| Reflect — quality | Hedged, non-diagnostic reflections | `internally benchmarked` |
| Arise — progression | Prescribes load accurately | `internally benchmarked` |
| RTK — token saving | ≥60% size reduction | `internally benchmarked` |
| Noticed — isolation | Household RLS isolation | `internally benchmarked` |
| Le Studio French — fluency | Improves speaking/listening | `insufficient evidence` |

No product currently claims `demonstrated` or `externally validated` — correctly, given the absence of real-user studies or external audits. Advancing any of these requires human evaluation, not more unit tests.

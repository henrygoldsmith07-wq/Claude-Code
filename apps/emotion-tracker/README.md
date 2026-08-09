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

1. Describe the situation and your first read on it.
2. Claude asks one careful question at a time (at least 3, at most 5), advancing the pipeline step-wise: separating observations from assumptions, naming the deeper emotion, proposing alternatives, clarifying outcome/action and a check-in date.
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

## Insights

From **Insights** in the sidebar: completed count, streak, 14-day chart, most common core emotions, and the patterns flagged most often. Computed client-side from `localStorage`.

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

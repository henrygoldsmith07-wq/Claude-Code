# Architecture

## The shape of the thing

```
                    ┌──────────────────────────────────────────┐
   browser          │  src/app  (Next.js App Router, client)   │
                    └───────────────┬──────────────────────────┘
                                    │ useStore()
                    ┌───────────────▼──────────────────────────┐
                    │  src/state/store.tsx                     │
                    │  in-memory snapshot + derived values     │
                    └───────┬──────────────────────┬───────────┘
                            │ writes               │ pure calls
              ┌─────────────▼──────────┐   ┌───────▼─────────────┐
              │ src/data/repository.ts │   │ src/domain/*        │
              │  IndexedDB + outbox    │   │ scheduling, mastery,│
              └──────┬─────────────┬───┘   │ planner, recommender│
                     │             │       │ marking, grades     │
          ┌──────────▼───┐  ┌──────▼─────┐ └─────────────────────┘
          │ IndexedDB    │  │ outbox     │
          │ (truth)      │  └──────┬─────┘
          └──────────────┘         │ when online + signed in
                                   │
   server            ┌─────────────▼───────────┐   ┌──────────────────┐
                     │ Supabase (replica, RLS) │   │ /api/ai          │
                     └─────────────────────────┘   │ provider + keys  │
                                                   └──────────────────┘
```

## Layers

### `src/domain` — the revision engine

Pure functions over plain data. No React, no I/O, no clock it does not accept as
an argument (`now` is injectable everywhere, which is what makes the scheduler
and planner testable). This is where every decision the product makes actually
lives:

- `scheduling.ts` wraps FSRS: grading, interval previews, the forgetting curve,
  session queue construction.
- `mastery.ts` turns raw history into a 0–1 number per topic, damped by how much
  evidence exists. Unmeasured is reported as zero, never as a prior — a topic
  the student has never opened must not inflate a predicted grade.
- `recommender.ts` scores every candidate activity on a single scale so they can
  be compared, and attaches a human-readable reason to each.
- `planner.ts` builds the timetable and folds missed sessions forward.
- `marking.ts` marks answers against a mark scheme with no model involved.
- `mistakes.ts` converts dropped marks into classified mistakes and cards.
- `grades.ts` predicts a grade with an explicit confidence and range.

### `src/content` — authored revision material

Flashcards are *derived* from each topic's authored key points and common
errors rather than stored separately, so curriculum and content cannot drift
apart: add a topic and its deck exists immediately, offline, with no AI call.
Card ids are deterministic (`seed:<topicId>:<kind>:<index>`), which makes
re-seeding idempotent — an existing user gains newly added topics and keeps
every card's FSRS history.

The question bank is hand-authored per subject with full mark schemes and model
answers, so exam practice and rubric marking work with no provider configured.

### `src/data` — offline-first storage

IndexedDB is the primary store. A write lands there and is durable before the UI
updates; the same change is then queued in an outbox. `sync()` drains the outbox
in batches per entity, then pulls anything newer.

**Conflict rule: last write wins per row, on `updated_at`.** Revision data is
append-mostly and single-author, so a CRDT would be a great deal of machinery
for a case that barely arises. The one genuinely mergeable thing — FSRS card
state — resolves to the row with the later review, which is also the row with
more information in it.

The wire format keeps the whole domain object in a `data` jsonb column and lifts
out only what the server indexes or secures on. A new domain field therefore
needs no migration, which matters when a client can be weeks stale and still
syncing.

### `src/ai` — provider abstraction

```
UI → src/ai/client.ts → POST /api/ai → src/ai/tasks.ts → src/ai/provider.ts → model
                     ↘ offline fallback              ↘ offline fallback
```

- Provider selection: explicit `AI_PROVIDER`, else the first with credentials
  (Anthropic, then any OpenAI-compatible endpoint), else none. **None is a
  first-class supported mode**, not a degraded one.
- Keys never leave the server. No provider SDK ships to the browser.
- Every response is validated with zod against a schema. A malformed reply is
  treated exactly like a failed request.
- Every task has a deterministic offline fallback, and the same fallback exists
  on both sides of the network — losing connectivity mid-session degrades
  identically to having no key configured.
- Every response carries `source: "ai" | "fallback"`, and the UI renders it. The
  product never implies a model wrote something a rubric did.
- The one exception is OCR: there is no offline handwriting recogniser, so it
  returns empty text with an explanation, and typing and dictation stay open.

Rate limiting is a per-process token bucket. Behind multiple instances this
wants a shared limiter; the interface is deliberately the same shape so that
swap is local.

### `src/state` — one store

Revision data is small (thousands of rows), so the whole snapshot is held in
memory and every derived value — mastery, recommendations, predictions, due
counts — is recomputed with `useMemo` on change. That makes them consistent by
construction instead of by cache invalidation, which is the class of bug that
would otherwise show a stale predicted grade next to fresh marks.

### `src/components` and `src/app`

The Le Studio design system (`src/app/le-studio.css`) carries all colour through
CSS custom properties that flip themselves for dark mode, so components carry no
`dark:` variants. `RichText` renders the small markdown subset the content uses
plus KaTeX maths, escaping input before adding any markup.

## Offline behaviour

| Feature | No network | No AI provider |
|---------|-----------|----------------|
| Review, grading, scheduling | ✅ full | ✅ full |
| Exam questions | ✅ authored bank + everything stored | ✅ same |
| Marking | ✅ rubric, labelled as such | ✅ rubric, labelled as such |
| Explanations, summaries | ✅ authored spec content | ✅ authored spec content |
| Tutor | ✅ prompts from key points | ✅ prompts from key points |
| Question generation | ✅ serves the bank | ✅ serves the bank |
| Weakness diagnosis | ✅ local heuristics over mistake patterns | ✅ same |
| Planning, analytics, search | ✅ full | ✅ full |
| OCR / handwriting | ❌ type or dictate | ❌ type or dictate |
| Cross-device sync | ❌ queued in the outbox | n/a |

The service worker precaches the app shell (stale-while-revalidate for
navigations) and never caches `/api/*` — a stale explanation is worse than none.

## Testing

95 unit tests over the engine, in `tests/`. They target behaviour that would be
a real defect if it broke, not implementation shape:

- **scheduling** — grade ordering, lapse counting, immutability, decay curve
  values, queue ordering and interleaving, suspended-card exclusion.
- **mastery** — the evidence-weighting rules, the mistake penalty, the
  distinction between "unmeasured" and "weak".
- **planner** — availability respected, largest-remainder allocation totals,
  weak subjects weighted higher, completed history preserved, missed-session
  recovery and spillover.
- **recommender** — ranking, exam urgency scaling, plan adherence, dropped
  subjects excluded, deduplication.
- **marking / mistakes** — mark-scheme point crediting, partial marks, the
  short-answer cap, MCQ routing, mistake classification, resolution criteria.
- **content** — every seeded topic has usable content, every question is
  internally consistent and points at a topic that exists, ids are unique and
  stable, prediction and gamification invariants.

One of these tests found a real flaw during development: a never-studied topic
was reporting 40% mastery from the neutral prior, which would have inflated
every predicted grade before a student did any work. The engine was fixed, not
the test.

## Known limits

- Rate limiting is per-process (see above).
- Past-paper extraction requires a model; the paper is stored either way and can
  be extracted later.
- Topic mapping for extracted questions is term-overlap, not semantic. It is
  deterministic and offline, and a student can always practise a question from
  the topic they expect to find it under.
- Grade boundaries are approximate and labelled as such.

# Revise

A revision-first study platform. Not a note-taking app: every screen exists to
raise a grade, and the product's core claim is that it always knows the single
highest-value thing you should do next.

Open the app → get a recommended task → complete it → get marked instantly →
progress updates → next task.

Ships with WJEC A-level **Mathematics, Biology, Chemistry and Physics** as real,
authored revision content. The architecture is board-agnostic: adding AQA
A-level Economics or Edexcel GCSE Maths means adding one curriculum module and
changing nothing else.

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # 220 unit tests over the revision engine
npm run build        # production build
```

No configuration is required. With no environment variables at all the app runs
as a single local profile against IndexedDB, with every feature working — cards,
marking, planning, analytics, search — and only cross-device sync and
model-written prose unavailable. See [`.env.example`](.env.example) for the
optional Supabase and AI provider settings.

## What it does

| Area | Behaviour |
|------|-----------|
| **Recommendation** | Scores every candidate activity on one scale — due reviews, mistake repair, weak-topic practice, first-pass learning, timed papers — and shows the winner with a plain-English reason. |
| **Spaced repetition** | FSRS scheduling with per-grade interval previews, confidence captured *before* reveal, and failed cards reinserted within the same session. |
| **Exam practice** | Structured questions marked point-by-point against the mark scheme, with examiner-style feedback and model answers. |
| **Mistake tracking** | Every dropped mark becomes a classified mistake *and* a flashcard automatically, and closes only once the card is recalled reliably. |
| **Past papers** | Upload or photograph a paper and mark scheme, extract questions, map them to topics, sit them timed. |
| **Planning** | An adaptive timetable from exam dates, availability, mastery and mistakes. Missed blocks roll forward on their own. |
| **Analytics** | Mastery per topic, predicted grades with honest confidence bands, review forecast, mistake patterns, marks-available-per-topic headroom. |
| **Study modes** | Learn (recognition → typed production), Test (a fixed paper marked at the end), Match (timed pairing), Diagram labelling, and hands-free Listen — all over the same cards. |
| **From notes** | One click: drop a PDF, paste notes or photograph a page, and get flashcards back, previewed before they join the deck. |
| **Onboarding** | Four questions that each change what the app does, ending with a built plan rather than an empty state. |
| **Sharing** | A link that carries the deck in its fragment (never sent to a server), or a file via the native share sheet. |
| **Card browser** | Anki-flavoured query language (`tag:paper-1 is:leech prop:lapses>3`), saved searches, tag chips, multi-select and bulk edit. |
| **Card maintenance** | Suspend indefinitely or bury for a day, rich editor (LaTeX, images, audio, tables), and per-card statistics — ease, lapses, interval, true retention, full review history. |
| **Custom study** | Build a session by filter, pool, order and size. Studying ahead runs as a preview and leaves scheduling untouched. |
| **Decks** | Export as a backup (scheduling intact) or to share (scheduling stripped); import Revise JSON or any Anki/Quizlet CSV/TSV. |
| **Keyboard** | Shortcuts throughout, with a `?` sheet generated from the live bindings. |
| **Input** | Typing, voice dictation, or a photo of handwritten working (OCR). LaTeX throughout. |
| **Offline** | IndexedDB-first with a durable outbox. Installable PWA. Everything works on a train. |

## Architecture

```
src/domain/      Pure revision engine — no React, no I/O, fully unit-tested
  types.ts         The board-agnostic domain model
  curriculum/      Registry + WJEC A-level maths, biology, chemistry, physics
  scheduling.ts    FSRS wrapper: grading, queues, forgetting curve
  mastery.ts       Topic mastery with explicit evidence weighting
  recommender.ts   "What should I do right now?"
  planner.ts       Adaptive timetable + missed-session recovery
  marking.ts       Offline rubric marking against mark schemes
  mistakes.ts      Dropped mark → classified mistake → flashcard
  grades.ts        Grade prediction with confidence bands
  gamification.ts  Streaks, XP, achievements
  search.ts        Local search across topics, cards and questions
  browser.ts       The card browser's query language and sorting
  card-stats.ts    Per-card and per-deck statistics, incl. true retention
  custom-study.ts  Hand-built sessions, with preview-only cramming
  deck-io.ts       Deck export/import, validation and materialisation
  study-modes.ts   Learn, Test and Match rules
  diagrams.ts      Diagram cards, hotspots and the labelling round
  sharing.ts       Link encoding for deck sharing
  shuffle.ts       One deterministic shuffle, shared by every mode

src/content/     Authored revision content (cards derived from spec, question bank)
src/data/        IndexedDB primary store, repository, outbox sync to Supabase
src/ai/          Provider abstraction, prompts, schemas, offline fallbacks
src/state/       One store; all derived numbers recomputed, never cached
src/components/  Le Studio UI primitives, question runner, answer input
src/app/         Next.js App Router pages
supabase/        Postgres schema with row-level security
docs/            Architecture and product notes
```

Three decisions shape everything else:

**The domain layer is pure.** No React, no fetch, no IndexedDB. That is why the
engine has real tests rather than snapshot tests, and why the same marking code
runs on the server and in the browser.

**IndexedDB is the source of truth, not a cache.** Writes land locally and are
durable before the UI updates; Supabase is a replica the outbox drains into.
Nothing in the UI ever awaits the network.

**AI is an enhancement, never a dependency.** Every AI task has a deterministic
offline fallback built from the authored curriculum: marking falls back to the
mark scheme, explanations to the spec content, generation to the question bank.
Responses are labelled with which one answered — the UI never implies a model
wrote something a rubric did.

## Content pipeline — the competitive moat

Every topic and exam question carries provenance so Revise can answer "how do
you know this is right?" without hand-waving. That is the moat: competitors
can generate plausible content, but proving coverage and verification is the
hard part and this repo enforces it.

| Field | Where | Values |
|-------|-------|--------|
| **Board / spec** | `Subject.spec` + `SPEC_MANIFEST` | `wjec` · `A200QS` · version `2024-1.0` · `lastChecked` |
| **Qualification** | `Subject.qualificationId` | `A Level` / `GCSE` / … |
| **Unit / paper** | `Unit.id` + `Subject.papers` | weight, duration, calculator flag |
| **Spec point** | `Topic.specRef` + `Topic.specPoints[]` | exact board ref + paraphrased text + `aos` |
| **AO mapping** | `Topic.aos` / `QuestionPart.aos` | `AO1` `AO2` `AO3` |
| **Source** | `Topic.source` / `Question.source` | `authored` / `licensed` / `generated` / … |
| **Verification** | `Topic.verification` / `Question.verification` | `unverified` → `checked` → `verified` |
| **Last checked** | `Topic.lastChecked` / `Question.lastChecked` | ISO date |
| **Spec version** | `Topic.specVersion` / `Question.specVersion` | `2024-1.0` |
| **Coverage** | `src/domain/coverage.ts` | topics · spec points · retrieval items · exam questions, auto-measured |

```ts
// Progress → Specification coverage (live from authored content):
//  WJEC A-level Physics: 100% topic coverage · 11 topics · 78 retrieval items · 6 exam questions · Last checked: 2026-08-01
```

Fine-grained `specPoints[]` are the next step: today every topic has a `specRef`
("Unit 2.4") and board-level versioning; splitting those into discrete
statements (one `ref` per phrase the spec actually makes) is what moves the
headline from "topics covered" to the requested "189 statements verified". The
plumbing is in place — see `src/domain/types.ts:SpecPoint` and the `specPoints?`
field on `Topic` — and the validator already treats "no-spec-points" as a gap.
Run `node scripts/validate-curriculum.mjs` in CI; it fails on missing
provenance, unknown topic refs, or a coverage drop. `tests/coverage.test.ts`
pins the contracts so a regression cannot land silently.

## Adding a new exam board or subject

One file. Create `src/domain/curriculum/<board>-<subject>.ts`:

```ts
const { units, topics } = buildUnits(SUBJECT_ID, [
  { slug: "unit-1", title: "…", topics: [{ slug, title, difficulty, summary, keyPoints, commonErrors, aos: ["AO1", "AO2"], source: "authored", verification: "checked", lastChecked: "2026-08-01", specVersion: "2024-1.0" }] },
]);

export const mySubject = registerSubject({
  subject: { id: SUBJECT_ID, qualificationId: "…", name: "…", specCode: "…", spec: { version: "2024-1.0", releaseDate: "2024-09-01", lastChecked: "2026-08-01", url: "https://…" }, papers: [...], gradeBoundaries: [...] },
  units,
  topics,
});
```

Import it in `src/domain/curriculum/index.ts` and it is live: flashcards are
derived from the key points automatically, the planner and recommender pick it
up, mastery and grade prediction work, coverage appears on Progress, and it is
searchable. No other file changes. Add the subject to `src/domain/spec.ts:SPEC_MANIFEST` so the headline totals stay true.

## Docs

- [`docs/architecture.md`](docs/architecture.md) — data flow, sync, AI layer, testing
- [`docs/revision-engine.md`](docs/revision-engine.md) — the algorithms and the evidence behind them

## Content accuracy

Topic lists follow the broad content areas of each specification and are a
study-planning guide, not a transcription of the official document. Grade
boundaries are approximate and labelled as such in the UI. Always check the
current WJEC specification for exact assessment objectives and weightings.

Recovery note: the deleted `apps/wjec-study-app` had **no** per-topic
validation, provenance or coverage tooling — only bare topic titles — so
nothing of competitive value was lost in that deletion. The previous repo's
only reusable asset was the FSRS + study-plan scheduling math, which Revise
already supersedes.

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
npm test             # 95 unit tests over the revision engine
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

## Adding a new exam board or subject

One file. Create `src/domain/curriculum/<board>-<subject>.ts`:

```ts
const { units, topics } = buildUnits(SUBJECT_ID, [
  { slug: "unit-1", title: "…", topics: [{ slug, title, difficulty, summary, keyPoints, commonErrors }] },
]);

export const mySubject = registerSubject({
  subject: { id: SUBJECT_ID, qualificationId: "…", name: "…", papers: [...], gradeBoundaries: [...] },
  units,
  topics,
});
```

Import it in `src/domain/curriculum/index.ts` and it is live: flashcards are
derived from the key points automatically, the planner and recommender pick it
up, mastery and grade prediction work, and it is searchable. No other file
changes.

## Docs

- [`docs/architecture.md`](docs/architecture.md) — data flow, sync, AI layer, testing
- [`docs/revision-engine.md`](docs/revision-engine.md) — the algorithms and the evidence behind them

## Content accuracy

Topic lists follow the broad content areas of each specification and are a
study-planning guide, not a transcription of the official document. Grade
boundaries are approximate and labelled as such in the UI. Always check the
current WJEC specification for exact assessment objectives and weightings.

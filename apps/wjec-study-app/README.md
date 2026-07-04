# WJEC A-Level Study Hub

A study app for WJEC/Eduqas A-level Chemistry, Physics, Biology and Maths,
built around the study techniques with the strongest evidence behind them
rather than passive note re-reading. Data is stored locally in the browser
(localStorage) — no account or backend required.

## Learning science behind it

- **Spaced repetition (SM-2 algorithm)** — every flashcard review schedules
  its own next review date. Cards you recall easily get pushed further out;
  cards you forget come back tomorrow. This targets the "spacing effect":
  review effort concentrates on material about to be forgotten instead of
  material you already know.
- **Interleaved practice** — study sessions mix topics and subjects instead
  of blocking through one topic at a time, and weight weaker topics (lower
  recall easiness) earlier in the queue. Interleaving feels harder in the
  moment but produces better long-term retention than blocked practice.
- **Active recall & the testing effect** — quizzes require producing an
  answer before seeing it, with immediate corrective feedback and an
  explanation, rather than just re-reading content.
- **Retrieval within a session** — a flashcard graded "Again" is
  re-inserted a few cards later in the same session for another attempt,
  instead of waiting until tomorrow.

## Features

- Curriculum-organised topics across Chemistry, Physics, Biology and Maths.
- Claude-generated flashcards and multiple-choice quizzes per topic, cached
  locally so they only need generating once.
- Per-topic and per-subject mastery, blending spaced-repetition progress
  with recent quiz accuracy.
- A day-streak counter and a "study all due" button that interleaves due
  cards across every subject at once.

## Setup

```bash
npm install
cp .env.example .env.local
```

Set `ANTHROPIC_API_KEY` in `.env.local` for a server-wide fallback key, or
leave it unset and let each visitor paste their own key in the app instead.

```bash
npm run dev
```

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run lint` — lint the app

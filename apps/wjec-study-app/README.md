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
  instead of waiting until tomorrow. Lesson sections work the same way when
  marked "Need review".
- **Interpolated testing during instruction** — lessons pause after each
  short section for a check-your-understanding question you attempt before
  seeing the answer, rather than reading a wall of text straight through.

## Features

- Curriculum-organised topics across Chemistry, Physics, Biology and Maths.
- Claude-generated flashcards, multiple-choice quizzes, and interactive
  lessons per topic, cached locally so they only need generating once. A
  "Generate all lessons" action (globally or per subject) bulk-generates the
  lesson for every topic that doesn't have one yet, a few requests at a time.
- Per-topic and per-subject mastery, blending spaced-repetition progress
  with recent quiz accuracy.
- A day-streak counter and a "study all due" button that interleaves due
  cards across every subject at once.
- **Study plans** — set an exam date per subject and get a daily "today's
  focus" list that covers every remaining topic in time, prioritising
  untouched and weak ones.
- **Gamification** — XP for reviews, quizzes and lessons, levels, a longest
  day-streak, and badges for milestones.
- **NotebookLM links** — save a NotebookLM notebook URL per topic (there's
  no public API to auto-create one, so this just stores and opens a link
  you made yourself), with a bulk JSON import for pasting in many at once.
- **Ask AI** — an instant Q&A chat with a "guided learning" mode that breaks
  answers down step by step, plus document anchoring (paste text or upload
  a `.txt` file) so answers are drawn only from that source.
- **Practice tests** — multi-format tests (multiple choice, matching,
  fill-in-the-blank) generated per topic with instant feedback.
- **Mind maps** — an auto-generated node/edge diagram of how concepts in a
  topic or your own notes connect.
- **Notes** — typed notes with tags, a freehand sketch pad, audio
  recordings, and photo scanning (OCR via Claude vision) to digitize
  handwritten or printed pages.
- **Tasks** — a drag-and-drop Kanban board with subtasks and attached
  links.
- **Focus timer** — an adjustable Pomodoro timer with procedurally
  synthesized ambient sound (white/brown noise, a rain-like texture — no
  licensed music assets, so no real lo-fi tracks).
- **Audio overviews** — Claude writes a two-host discussion script per
  topic; your own ElevenLabs API key turns it into playable audio.
- **Analytics** — a study-day heatmap and a time-by-subject breakdown.
- **Shop** — spend coins earned from XP to unlock accent color themes.

## Setup

```bash
npm install
cp .env.example .env.local
```

Set `ANTHROPIC_API_KEY` in `.env.local` for a server-wide fallback key, or
leave it unset and let each visitor paste their own key in the app instead.
Audio overviews additionally need a visitor-supplied ElevenLabs API key,
entered in the Audio Overviews tab (not read from an environment variable).

```bash
npm run dev
```

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run lint` — lint the app

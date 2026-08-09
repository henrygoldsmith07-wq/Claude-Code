# Daily Debate

A daily critical-thinking app: debate an AI opponent (by typing or speaking)
across at least five rounds and get scored on depth, evidence, logic,
rebuttal quality, and clarity — or challenge another player head-to-head on
today's topic and let an AI judge declare the winner. Points, levels, and
streaks make it a game.

## Stack

Next.js (App Router) + Supabase (auth, Postgres, Realtime) + the Gemini API.

## Features

- **Daily topic** — a new debatable proposition is generated once per day
  (`getOrCreateTodayTopic`), grounded with 3-5 real, well-known institutions
  relevant to the topic (their homepage + what angle/data they're known for).
  Gemini does not have live web access in this app, so these are named
  credible sources to go research yourself, not live-fetched citations.
- **Solo debate vs AI** — pick a side, then go back and forth with an AI
  arguing the opposite side for a minimum of 5 rounds. Each response is
  scored 0-10 on depth, evidence, logic, rebuttal, and clarity, with short
  feedback, before the AI's next challenge. Finishing awards points, updates
  your level, and updates your daily streak.
- **Player vs player** — join the matchmaking queue for today's topic, get
  randomly assigned a side, and take alternating turns. Once both players hit
  the round limit, a neutral AI judge scores the whole transcript and
  declares a winner (or tie). Both players see turns update live via
  Supabase Realtime.
- **Voice input/output** — the mic button uses the browser's Web Speech API
  (`SpeechRecognition`) to dictate your response as text before sending; the
  AI's messages are read aloud with `speechSynthesis`. Both are Chrome-family
  only; the composer falls back to typing where unsupported.
- **Gamification** — points per round, levels, and daily streaks, plus a
  global leaderboard.
- **UX polish** — Ctrl/⌘+Enter to send, auto-scroll in the debate room,
  color-coded score badges, copyable result summary, mobile-friendly header,
  clearer empty states and loading indicators.

## Setup

1. Create a Supabase project and run `supabase/migrations/001_initial_schema.sql`.
2. Copy `.env.example` to `.env.local` and fill in your Supabase project URL,
   anon key, service role key, and a `GEMINI_API_KEY`.
3. `npm install && npm run dev`.

## Argument graph & judging (why the winner won)

Every finished debate now produces a structured **argument graph**: `claim → evidence → counterclaim → rebuttal → impact`.
The judge tracks:

- **Unsupported claims** (no evidence edge)
- **Dropped arguments** (never directly rebutted)
- **Contradictions** and **concessions**
- **Rebuttals** and their targets
- **Evidence strength** (`anecdotal` → `strong`)
- **Logical fallacies**
- **Impact comparison** (which impacts frame the debate more)

The judge returns `rationale` + `decidingFactor` (one sentence) + per-side `breakdown` and the full `argGraph` so the UI can explain the result instead of just showing a score. See `src/lib/argGraph.ts` for the types (`ArgGraph`, `validateGraph`, `unsupportedClaims`) and `src/components/ArgGraphView.tsx` for the panels used in PvP and Solo results. Rendering is backwards compatible: older verdicts without a graph still show their rationale.

## Rate limiting & testing

- **Rate limiting** is now Supabase-backed (`supabase/migrations/002_rate_limits.sql`): `rate_limits(key, count, reset_at)` is shared across all serverless instances with a local in-memory fallback for tests/local dev without credentials. Before serious public use (PvP expansion) run both migrations. See `src/lib/rateLimit.ts` (`checkRateLimit` is now async — callers `await` it).
- **Tests:** `npm test` (`vitest run`) / `npm run test:watch`. Covers `argGraph`, the rate-limiter fallback, and gamification. Add more before PvP matchmaking grows (see TODO below).

## Known limitations / TODO before wider PvP

- Matchmaking is still FIFO on `pvp_queue`; no Elo/skill pairing yet.
- Consider a periodic `cleanup_rate_limits()` (or Supabase cron) to prune expired windows.
- Evidence strength and fallacy tagging currently rely on the judge model's judgment; consider adding rule-based heuristics or a second pass for higher reliability.

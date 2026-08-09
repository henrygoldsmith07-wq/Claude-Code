# Daily Debate

A daily critical-thinking app: debate an AI opponent (by typing or speaking)
across at least five rounds and get scored on depth, evidence, logic,
rebuttal quality, and clarity — or challenge another player head-to-head on
today's topic and let an AI judge declare the winner. Points, levels, and
streaks make it a game.

## Stack

Next.js (App Router) + Supabase (auth, Postgres, Realtime) + Gemini API (primary) / Anthropic (alternate judge backend).

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
The judge tracks unsupported claims, dropped arguments, contradictions/concessions, rebuttals, evidence strength (`anecdotal` → `strong`), logical fallacies, and impact comparison — and returns `rationale` + `decidingFactor` + per-side `breakdown` + the full `argGraph`. See `src/lib/argGraph.ts`.

### Source-grounded evidence

Evidence nodes are **source-grounded**: `ArgNode.citations?: EvidenceCitation[]` (`{ sourceName, homepage?, excerpt? }`). Judging prompts in both `src/lib/gemini.ts` and `src/lib/anthropic.ts` now require that every `cited`/`strong` evidence node carry ≥1 citation naming a **real institution or outlet** (root homepage only — never invent article URLs). `validateGraph()` enforces this: cited/strong evidence without citations is a validation error, shown in the UI as `⚠ no citation`. New helpers:

- `groundedEvidenceRatio(graph)` — share of cited/strong evidence that is grounded
- `claimCoverageWithGroundedEvidence(graph)` — share of claims backed by grounded evidence
- `ArgGraphView` renders `↳ Pew, Lazard` per evidence node and a **Source grounding** panel; uncited cited/strong nodes get a `⚠ no citation` flag.

### Judge benchmarks (invariance + grounded coverage)

`src/lib/benchmarks.test.ts` + `src/lib/benchmark.fixtures.ts` run on every `npm test` without network/DB:

- **Grounded evidence benchmark** — synthetic grounded graphs pass validation; uncited cited-nodes are flagged; metrics computed.
- **Judge invariance benchmark** — deterministic mock judge over two real-length transcripts (`renewables` + `AI regulation`) verifies: (a) the expected winner holds, (b) swapping `Player A/B` labels inverts `a↔b` cleanly, (c) whitespace reformatting does not flip the verdict. Live-model invariance (run the real Gemini judge twice with shuffled framing and assert `winner` stability) belongs in a future `*.e2e.ts` suite — fixtures are already reusable for it.

Until invariance is measured on the real judge, Elo/rank/social expansion stays paused — the task brief's milestone.

## Rate limiting & testing

- **Rate limiting** is now Supabase-backed (`supabase/migrations/002_rate_limits.sql`): `rate_limits(key, count, reset_at)` is shared across all serverless instances with a local in-memory fallback for tests/local dev without credentials. Before serious public use (PvP expansion) run both migrations. See `src/lib/rateLimit.ts` (`checkRateLimit` is now async — callers `await` it).
- **Tests:** `npm test` (`vitest run`) / `npm run test:watch`. Now 22 tests across `argGraph` (grounded evidence), `benchmarks` (invariance + grounding), `rateLimit`, and `gamification`.

## Known limitations / TODO before wider PvP

- **Matchmaking is still FIFO on `pvp_queue` — no Elo/skill pairing until invariance is green.** This is intentional per the task brief: judge invariance is the milestone before ranked play.
- Consider a periodic `cleanup_rate_limits()` (or Supabase cron) to prune expired windows.
- Live-model judge invariance (real Gemini calls, label-swap + paraphrase) still needs an `*.e2e.ts` suite with an API key — fixtures in `benchmark.fixtures.ts` are ready for it.
- Evidence strength and fallacy tagging currently rely on the judge model's judgment; grounded citations make this auditable but a second heuristic pass would tighten it further.

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

## Trust, bias & benchmark suite (9.5)

New pure modules in `src/lib/` — all offline, all in `npm test` without credentials:

- **Citation verification** (`citationVerifier.ts`) — allowlist of ~25 real institutions (Nature/Reuters/AP/Pew/NREL/Lazard/NIST…), `verifyCitation`/`verifyGraphCitations` flags `hallucination` / `unknown_source` / `bad_url` / `missing_homepage`, root-homepage-only rule, tiered `sourceQualityScore` (1=peer-reviewed → 3=unknown) and `graphSourceQuality`. Live homepage reachability is a future async check; offline allowlist catches fake-institution hallucination.
- **User-attached evidence** (`evidence.ts`) — `UserEvidence { url, title?, excerpt? }`, `validateUserEvidence` (https + length) and `inferSourceFromUrl` (e.g. nature.com → Nature) so debaters can bring their own sources; future: surface to judge prompt + server-side fetch verify.
- **Judge invariance** (`judgeInvariance.ts`) — transforms: `swapLabels` (position bias), `stripNames` (name/identity bias), `inflateVerbosity` (verbosity bias), `addConfidenceHedge` (confidence bias), `injectFakeSource` (hallucination probe), plus `checkLabelInvariance` mock. Real-model double: call the live judge twice over the same `TRANSCRIPTS` fixture with `swapLabels` and assert winner stability in a future `*.e2e.ts`.
- **Human corpus** (`humanCorpus.ts`) — tiny `HUMAN_CORPUS` (2 labelled debates, rater ids + rationale), `agreementRate` (pairwise), `judgeVsHumanAgreement`, toy `calibrationCurve`, and `splitQuality(graph)` that separates argument (evidence+rebuttal density) from writing (fallacy penalty) so confident-but-thin writing cannot inflate scores.
- **Heuristic enrichers** (`argHeuristics.ts`) — `detectRepetition` (Jaccard ≥0.72, same owner), `rebuttalCoverage` / `rebuttalAddressesTargets`, `fallacyHints` (lexicon over text). Intended to complement the judge and make the graph auditable/editable (nodes filterable offline).
- **Drills & weakness** (`drills.ts`) — `drillsFor` (ground a claim / close dropped / fix fallacy / weigh impact) and `weaknessProfile` + `topWeakness` across recent graphs for targeted practice and repeated personal weakness cards.
- **Competitive** (`competitive.ts`) — `eloGate({ invarianceOk, humanAgreement })` (70% human threshold), Elo math (`kFactor`, `expectedScore`, `eloDelta`), and `pickOpponent` (FIFO while gate closed, Elo-bucketed within 150 when open). Tournaments/challenges stay gated.
- **Moderation & anti-cheat** (`moderation.ts`) — `moderateMessage` (harassment/spam/caps/injection) + `isBlocked`, `repeatScore`, `isSuspiciousLength`. Real PvP abuse (multi-account, voting rings) lives in future Supabase functions; this catches cheap tricks.
- **Transcripts & async** (`transcript.ts`) — `transcriptForReplay` (ordered), `isOverdue` (per-turn clock), `DEFAULT_ASYNC` (24h/turn, 7d total) scaffold for replayable + asynchronous debates.
- **Retention** (`retention.ts`) — `dailyQuests`, `weeklyTarget`, `comebackCopy`, `onboardingChecklist` so retention does not rely purely on streaks.
- **Speech fallbacks** — `useSpeechRecognition` already degrades to typing; now documented for Safari/Firefox, with dictation + paste as alternatives (Web Speech API is Chrome-family only).

Tests: `src/lib/dailyDebate95.test.ts` (24 tests) covering all of the above.

Live-model note: run the real Gemini/Anthropic judge twice per fixture with each transform and report `positionBias`, `nameBias`, `verbosityBias`, `confidenceBias`, `hallucinationRate` — keep fixtures in `benchmark.fixtures.ts` reusable and add a `scripts/judge-invariance-e2e.mjs` once an API key is provisioned.

## Known limitations / TODO before wider PvP

- **Elo/ranking stays gated by `eloGate`** (invariance + ≥70% human agreement) — matchmaking is FIFO until green. Tournament/challenge modes stay behind the same gate.
- Consider a periodic `cleanup_rate_limits()` (or Supabase cron) to prune expired windows.
- Live-model judge invariance e2e (real Gemini calls) still needs an API key — fixtures + `judgeInvariance` transforms are ready for it.
- Article-level citation verification (fetch the URL and check the excerpt) is a future server action; the offline allowlist is the floor.

# Claude-Code (Ruflo Workspace)

Personal monorepo and Claude Code workspace for Henry Goldsmith. Contains multiple production-ready web apps, automation scripts, a self-improving knowledge base, and extensive Claude agent skills/commands.

## Structure

| Path | Purpose |
|------|---------|
| `apps/` | Standalone Next.js / Vite / Python / Electron applications |
| `.claude/` | Claude Code skills, agents, commands, helpers, settings |
| `src/workspace_daemon/` | Background workspace daemon (Google/MSFT integration) |
| `execution/` | One-off Python automation scripts (leads, email, invoices, etc.) |
| `raw/` | Append-only knowledge ingestion zone |
| `wiki/` | Indexed knowledge base (read this first) |
| `output/` | Improvement-loop artifacts and review files |
| `CLAUDE.md` | Project rules, agent coordination, swarm config |

## Apps

Source of truth: [`apps/registry.json`](apps/registry.json) (machine-readable, validated by `scripts/validate-registry.mjs`). Lifecycle: `active` = shipped, `incubating` = in dev, `maintenance` = bugfix-only, `archived` = frozen reference, `superseded` = replaced, `tooling`/`service` = internal, `external` = standalone repo.

| App | Path | Stack | What it is |
|-----|------|-------|------------|
| **Arise** | `apps/arise` | Vite + React + Tailwind | Training & progression (programs, sessions, levelled attributes) |
| **Daily Debate** | `apps/daily-debate` | Next.js + Supabase + Anthropic | Daily critical-thinking debates (solo vs AI + PvP) with argument graph |
| **Dictation Typer** | `apps/dictation-typer` | Python (Groq Whisper) | Hold-hotkey speech-to-text typer (pastes into the focused window) |
| **Reflect** | `apps/emotion-tracker` · site `apps/reflect-site` | Next.js + Anthropic | Structured reflection `event→assumptions→alternatives→action→follow-up` with hedged bias language + longitudinal calibration |
| **Forq** | `apps/food-shopping-os` · site `apps/forq-site` | Next.js (local-first) | Food shopping & planning OS (pantry, retailer, nutrition) |
| **Le Studio French** | `apps/french-practice` · hub `apps/le-studio-site` | Vite + React + Tailwind | French PWA (Today/Speak/Review/Learn/Progress, Groq arena) — family hub is Le Studio/Forq/Chrono |
| **World News** | `apps/world-news` | Next.js + Gemini/GDELT | Globe-based world news with story clustering + source-mix provenance |
| **Revise** | `apps/revise` | Next.js + Supabase + FSRS | GCSE + A-level revision across WJEC/AQA/Edexcel/OCR (2,216 specPoints, validator) |
| **Rapport** | `apps/rapport` | Next.js (local-first) + optional Supabase | Adaptive social-skills training — skill graph, mastery model, conversation simulator, real-world challenges (works with no AI provider) |
| **Meeting Recorder** | `apps/meeting-recorder` | Electron + Next.js + R2/Groq/Anthropic | Fathom-style meeting capture + transcript + Claude chat |
| **Noticed** | `apps/mental-load-tracker` | Next.js + Supabase Realtime | Shared board for household invisible labor (two-person, no leaderboard) |
| **Agent OS Control Room** | `apps/agent-os-control-room` | Next.js | Orchestration dashboard for Agent OS swarms |
| **rtk** | `apps/rtk` | Node CLI | Token-saving filter for noisy tool output (per-tool parsers + redaction) |

Also in this repo (not product apps, but tracked so the registry doesn't drift): `apps/genetic-health` (Python pipeline workspace), `packages/le-studio-tokens` (shared design tokens), `src/workspace_daemon` (background sync service), `.claude` (skills/agents/helpers incl. prompt-improver), `vendor/life-os-scrape` (**archived** — frozen Life OS build, superseded by `arise`; see its README). External: **Chrono** (`henrygoldsmith07-wq/chrono-calendar`, ICS/JSON interop).

## Knowledge Base & Self-Improvement

See `CLAUDE.md` for the full contract. Key commands:

- `/data-ingestion` — Sync sessions, ecosystem data, curated content → `raw/` + `wiki/`
- `/improve-system` — Auto-apply low-risk hygiene; propose higher-stakes changes for sign-off

Routines run Tue/Fri (UK time) on the `knowledge-base-updates` branch.

## Quick Start (Claude Code)

```bash
claude mcp add claude-flow -- npx -y ruflo@latest mcp start
npx ruflo@latest doctor --fix
```

## License

MIT — see [LICENSE](LICENSE).

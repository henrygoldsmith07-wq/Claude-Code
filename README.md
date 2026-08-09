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

- **arise** — Training & progression app (Vite + React, programs, sessions, export/import) — see `apps/arise`
- **daily-debate** — Daily debate platform with solo & PvP modes, argument graph, judge & leaderboard (Next.js + Supabase + Anthropic)
- **dictation-typer** — Hold-hotkey speech-to-text typer (Groq Whisper) that pastes transcript into the focused window
- **emotion-tracker** — Reflect: structured event→assumptions→alternatives→action pipeline with hedged bias language (Next.js)
- **food-shopping-os / Forq** — Food shopping & planning OS with pantry, retailer & nutrition flows (Next.js)
- **french-practice** — Full-featured French learning PWA (vocab, grammar, listening, speaking, AI chat arena)
- **le-studio-site** — Static site companion for French practice (no-build, Vercel Other)
- **meeting-recorder** — Fathom-style AI meeting recorder (Electron desktop + Next.js dashboard, R2 + Groq + Claude)
- **revise** — WJEC A-level revision platform: 277 specPoints, statement-level coverage & validator (Next.js + FSRS)
- **rtk** — Lightweight CLI toolkit: filters noisy tool output, per-tool parsers & secret redaction (Node)
- **world-news** — World news with story clustering, source-mix & provenance panels (Next.js + Gemini/GDELT)

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

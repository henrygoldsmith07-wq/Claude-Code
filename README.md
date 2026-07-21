# Claude-Code (Ruflo Workspace)

Personal monorepo and Claude Code workspace for Henry Goldsmith. Contains multiple production-ready web apps, automation scripts, a self-improving knowledge base, and extensive Claude agent skills/commands.

## Structure

| Path | Purpose |
|------|---------|
| `apps/` | Standalone Next.js / Vite applications |
| `.claude/` | Claude Code skills, agents, commands, helpers, settings |
| `src/workspace_daemon/` | Background workspace daemon (Google/MSFT integration) |
| `execution/` | One-off Python automation scripts (leads, email, invoices, etc.) |
| `raw/` | Append-only knowledge ingestion zone |
| `wiki/` | Indexed knowledge base (read this first) |
| `output/` | Improvement-loop artifacts and review files |
| `CLAUDE.md` | Project rules, agent coordination, swarm config |

## Apps

- **daily-debate** — Daily debate platform with solo & PvP modes, ratings, leaderboard (Next.js + Supabase + Anthropic)
- **emotion-tracker** — Emotion journaling with AI reflection sessions
- **french-practice** — Full-featured French learning PWA (vocab, grammar, listening, speaking, AI chat arena)
- **le-studio-site** — Static site companion for French practice
- **omni-life** — Personal life OS dashboard (calendar, health, finance, Spotify, tasks, WhatsApp)
- **podcast-repurposer** — Turn podcast episodes into multi-format content
- **rtk** — Lightweight CLI toolkit
- **subscription-tracker** — Track recurring subscriptions, budgets, refunds, AI insights
- **wjec-study-app** — WJEC study companion with flashcards, quizzes, mindmaps, FSRS, gamification
- **world-news** — Interactive world news globe with country detail, topics, podcasts, favorites

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

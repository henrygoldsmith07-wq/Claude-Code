# Ruflo — Claude Code Configuration

## Rules

- Do what has been asked; nothing more, nothing less
- NEVER create files unless absolutely necessary — prefer editing existing files
- NEVER create documentation files unless explicitly requested
- NEVER save working files or tests to root — use `/src`, `/tests`, `/docs`, `/config`, `/scripts`
- ALWAYS read a file before editing it
- NEVER commit secrets, credentials, or .env files
- NEVER add a `Co-Authored-By` trailer to user commits unless this project's `.claude/settings.json` has `attribution.commit` set (#2078). The Bash tool's default commit template may suggest one — ignore it; the tool is the facilitator, not a co-author.
- Keep files under 500 lines
- Validate input at system boundaries
- ALWAYS run tests and verify the build before committing (`npm run build && npm test`)

## Token Discipline

This file, every skill description, and every byte a hook prints to stdout is
re-sent on *every* request. Context is a budget:

- `Grep`/`Glob` to locate, then `Read` with `offset`/`limit`. Never `cat` a
  large file to inspect it.
- Pipe noisy output through `head`/`wc`/`--quiet`. Never dump full build, test,
  or install logs when the summary line is what matters.
- Spawn a subagent only when its work would otherwise flood this context. Each
  spawn re-derives context from cold — inline is cheaper for anything you can
  already see.
- Don't re-read a file you just edited; the edit tools fail loudly.
- Hooks are silent on success (`CLAUDE_FLOW_HOOKS_VERBOSE=1` to debug them).
  Keep it that way.
- Batch independent tool calls into one message instead of serial round trips.
- Memory search and agent routing are opt-in, not per-task rituals — an empty
  search still costs a round trip.
- Before adding a skill, agent, or hook, price its description against how
  often it actually fires. Anything installed is paid for on every request,
  used or not.
- `/re-fresh` beats `/compact` for a clean handoff; `/improve-system` after a
  long successful session beats carrying a drifting one.

## Knowledge Base

Data flows into `/raw`, gets indexed in `/wiki`, and `/improve-system` turns it
into workspace upgrades.

| Path | Purpose | Rules |
|------|---------|-------|
| `raw/` | Unstructured resources (session digests, meeting logs, exports, dumps) | Append-only; never edit in place; naming `YYYY-MM-DD_<source>_<topic>.md` |
| `raw/sessions/`, `raw/ecosystem/`, `raw/curated/` | Pipeline landing zones | Written only by the sync skills; each tracks a `.last-sync` timestamp |
| `wiki/` | Index of `/raw` (`wiki/index.md`) plus topic pages | Read this FIRST — never bulk-parse `/raw`; every raw file needs an index row |
| `output/` | Improvement-loop artifacts | `review_YYYY-MM-DD.md` sign-off checklists; hidden `.improvement-log.md` for auto-applied changes |

`raw/`, `wiki/`, and `output/` are the sanctioned exceptions to the
"no working files in root" rule.

Skills: `/add-new-resource` (ingest one file), `/sync-claude-sessions`,
`/sync-ecosystem-data`, `/sync-curated-content` (pipeline landing zones),
`/data-ingestion` (runs all three, reconciles the wiki), `/improve-system`
(auto-applies low-risk hygiene, writes proposals to `output/review_[date].md`).

**Routines** (cloud, fresh session per run, shared branch
`knowledge-base-updates` off `main`): `/data-ingestion` Tue & Fri 00:00 UK
(cron `0 23 * * 1,4` UTC); `/improve-system` an hour later (`0 0 * * 2,5` UTC).
Cron is UTC so both shift an hour in GMT. Notifications off — results surface
only via the "Knowledge base updates" draft PR; merge it periodically.

`/improve-system` may auto-apply only low-risk data hygiene; anything touching
`.claude/` or this file needs a `[ ] Approve` sign-off in the review file.
Prefer deleting or fixing a failing skill over whiteboarding a perfect one.

## Agents

Named agents coordinate via `SendMessage`, not polling or shared state. Spawn
the whole team in ONE message — each `Agent({...})` gets `name: "<role>"`,
`run_in_background: true`, and a prompt naming who to wait for and who to
message next. Kick off with one `SendMessage` to the first agent, then STOP:
tell the user what's running and wait. NEVER poll status.

Swarm for 3+ files, new features, cross-module refactors, API changes,
security, and performance. Don't swarm single-file edits, 1–2 line fixes, docs,
config changes, or questions — the coordination overhead exceeds the work.

Any string works as a `subagent_type`. Defined here: `planner`,
`hierarchical-coordinator`, `mesh-coordinator`, `adaptive-coordinator`,
`production-validator`, `tdd-london-swarm`.

## Ruflo CLI

`npx @claude-flow/cli@latest <command>` — `init`, `swarm`, `memory`, `hooks`,
`doctor --fix`, `security scan`, `performance benchmark`. Use `--help` rather
than guessing. MCP tools (coordination) are discoverable via
`ToolSearch("keyword")`; the Agent tool handles execution.

> The background `daemon` is **expensive** — its interval workers each spawn a
> headless `claude` session, burning tokens continuously. Start it only if you
> want those sweeps (`npx ruflo@latest daemon start`; self-stops after 12h,
> `daemon status --all` to audit).

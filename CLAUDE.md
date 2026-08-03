# Ruflo — Claude Code Configuration

## Rules

- Do what has been asked; nothing more, nothing less
- NEVER create files unless absolutely necessary — prefer editing existing files
- NEVER create documentation files unless explicitly requested
- NEVER save working files or tests to root — use `/src`, `/tests`, `/docs`, `/config`, `/scripts`
- ALWAYS read a file before editing it
- NEVER commit secrets, credentials, or .env files
- NEVER add a `Co-Authored-By` trailer to user commits unless this project's `.claude/settings.json` has `attribution.commit` set (#2078). The Claude Code Bash tool may suggest one in its default commit-message template — ignore it. `Co-Authored-By` is semantic authorship attribution under git/GitHub convention; the tool is the facilitator, not a co-author.
- Keep files under 500 lines
- Validate input at system boundaries

## Token Discipline

Everything in this file, every skill description, and every byte a hook prints
to stdout is re-sent on *every* request. Treat context as a budget:

- Read the narrowest slice that answers the question — `Grep`/`Glob` to locate,
  then `Read` with `offset`/`limit`. Never `cat` a large file to inspect it.
- Pipe noisy shell output through `head`/`wc`/`--quiet`; never dump full build,
  test, or `npm install` logs when the summary line is what matters.
- Spawn a subagent only when its work would otherwise flood this context
  (broad multi-file searches). Each spawn re-derives context from cold — for a
  task you can already see, doing it inline is cheaper.
- Don't re-read a file you just edited to verify; the edit tools already failed
  loudly if the change didn't apply.
- Hooks stay silent on success (`CLAUDE_FLOW_HOOKS_VERBOSE=1` to debug them).
  Keep it that way — success chatter buys nothing and is billed every turn.
- Prefer one batch of parallel independent tool calls over serial round trips.
- Run `/improve-system` to compress feedback loops instead of carrying a long,
  drifting session; `/re-fresh` beats `/compact` for a clean handoff.

## Self-Improving System (Knowledge Base)

Data flows into `/raw`, gets indexed in `/wiki`, and the improvement loop turns
it into workspace upgrades.

### Directory Contract

| Path | Purpose | Rules |
|------|---------|-------|
| `raw/` | Unstructured resources (session digests, meeting logs, exports, text dumps) | Append-only; never edit in place; naming `YYYY-MM-DD_<source>_<topic>.md` |
| `raw/sessions/`, `raw/ecosystem/`, `raw/curated/` | Pipeline landing zones | Written only by the sync skills; each tracks a `.last-sync` timestamp |
| `wiki/` | Table of contents indexing `/raw` (`wiki/index.md`) plus topic pages | Read this FIRST to map project metadata — never bulk-parse `/raw`; every raw file must have an index row |
| `output/` | Improvement-loop artifacts | Review files `review_YYYY-MM-DD.md` (sign-off checklists) and hidden log `.improvement-log.md` (auto-applied changes) |

`raw/`, `wiki/`, and `output/` are the sanctioned exceptions to the
"no working files in root" rule above.

### Skills

| Skill | Role |
|-------|------|
| `/add-new-resource` | Manually ingest one file: copy to `/raw`, evaluate, index in `/wiki` |
| `/sync-claude-sessions` | Digest local CLI session history → `raw/sessions/` |
| `/sync-ecosystem-data` | Pull meeting/email/calendar signals → `raw/ecosystem/` |
| `/sync-curated-content` | Extract claims from the `+newsletter` Gmail alias → `raw/curated/` |
| `/data-ingestion` | Master orchestration: runs all three syncs, reconciles the wiki |
| `/improve-system` | Improvement loop: auto-applies low-risk hygiene, writes sign-off proposals to `output/review_[date].md` |

### Routines (cloud Routines, fresh session per run)

- **Data Ingestion**: `/data-ingestion` — Tue & Fri 00:00 UK (cron `0 23 * * 1,4` UTC)
- **System Improvements**: `/improve-system` — Tue & Fri 01:00 UK (cron `0 0 * * 2,5` UTC), one hour after ingestion
- Cron is UTC, so both shift an hour later in UK winter (GMT); notifications
  are off — results surface only via the "Knowledge base updates" PR

Both routines work on the shared branch `knowledge-base-updates` (created from
`main` if absent, checked out if it exists) so the afternoon improvement run
sees the morning's ingested data. They commit and push to that branch and keep
a single draft PR open; merge it periodically to fold knowledge into `main`.

### Loop Hygiene

- After any long, highly successful session, run `/improve-system` immediately
  ("compress feedback loops") — don't wait for the routine
- `/improve-system` may auto-apply only low-risk data hygiene; anything
  touching `.claude/` or this file requires a `[ ] Approve` sign-off in the
  review file
- Prefer deleting or fixing a failing skill over whiteboarding a perfect one

## Agent Comms (SendMessage-First Coordination)

Named agents coordinate via `SendMessage`, not polling or shared state:
`Lead (you) ←→ architect ←→ coder ←→ tester ←→ reviewer`.

Spawn the whole team in ONE message — each `Agent({...})` call gets
`name: "<role>"`, `run_in_background: true`, and a prompt naming who to wait
for and who to `SendMessage` next. Kick the pipeline off with a single
`SendMessage` to the first agent.

| Pattern | Flow | Use When |
|---------|------|----------|
| **Pipeline** | A → B → C → D | Sequential dependencies (feature dev) |
| **Fan-out** | Lead → A, B, C → Lead | Independent parallel work (research) |
| **Supervisor** | Lead ↔ workers | Ongoing coordination (complex refactor) |

- ALWAYS name agents — `name: "role"` makes them addressable
- ALWAYS include comms instructions in prompts — who to message, what to send
- After spawning: STOP, tell user what's running, wait for results
- NEVER poll status — agents message back or complete automatically

## Swarm & Routing

Config: hierarchical-mesh topology (anti-drift), max 15 agents, hybrid memory,
HNSW + neural enabled.

| Task | Agents |
|------|--------|
| Bug Fix | researcher, coder, tester |
| Feature | architect, coder, tester, reviewer |
| Refactor | architect, coder, reviewer |
| Performance | perf-engineer, coder |
| Security | security-architect, auditor |

- **Swarm**: 3+ files, new features, cross-module refactoring, API changes, security, performance
- **Don't swarm**: single file edits, 1-2 line fixes, docs updates, config changes, questions

Model tiers: (1) simple transforms — skip the LLM, use `Edit` directly;
(2) Haiku for low-complexity tasks; (3) Sonnet/Opus for architecture, security,
and complex reasoning.

## Memory & Learning

Memory is opt-in, not a per-task ritual — a search that returns nothing still
costs a round trip. Use it when prior art would actually change the approach:

```bash
npx @claude-flow/cli@latest memory search --query "[keywords]" --namespace patterns
npx @claude-flow/cli@latest memory store --namespace patterns --key "[name]" --value "[what worked]"
```

Store after a non-obvious success; skip it for routine edits.

MCP tools (discover with `ToolSearch("keyword")`): memory (`memory_store`,
`memory_search`), swarm (`swarm_init`, `swarm_status`), agents (`agent_spawn`,
`agent_list`), hooks (`hooks_route`, `hooks_post-task`), security
(`aidefence_scan`), hive-mind (`hive-mind_init`, `hive-mind_consensus`).

Background workers (`hooks worker dispatch --trigger <name>`): `audit` after
security changes, `optimize` after perf work, `testgaps` after new features,
`map` every 5+ file changes, `document` after API changes.

## Agents

**Core**: `coder`, `reviewer`, `tester`, `planner`, `researcher`
**Architecture**: `system-architect`, `backend-dev`, `mobile-dev`
**Security**: `security-architect`, `security-auditor`
**Performance**: `performance-engineer`, `perf-analyzer`
**Coordination**: `hierarchical-coordinator`, `mesh-coordinator`, `adaptive-coordinator`
**GitHub**: `pr-manager`, `code-review-swarm`, `issue-tracker`, `release-manager`

Any string works as a custom agent type.

## Build & Test

- ALWAYS run tests after code changes
- ALWAYS verify build succeeds before committing (`npm run build && npm test`)

## CLI

`npx @claude-flow/cli@latest <command>` — 26 commands, 140+ subcommands
(`init`, `swarm`, `memory`, `hooks`, `doctor --fix`, `security scan`,
`performance benchmark`). Use `--help` for details rather than guessing.

Setup: `claude mcp add claude-flow -- npx -y ruflo@latest mcp start`.

> The background `daemon` is optional and **expensive**: its interval workers
> each spawn a headless `claude` session, so it burns tokens continuously.
> Start it only if you want those sweeps: `npx ruflo@latest daemon start`
> (self-stops after 12h; `--ttl 0` to disable, `daemon status --all` to audit).

**Agent tool** handles execution (agents, files, code, git). **MCP tools** handle coordination (swarm, memory, hooks). **CLI** is the same via Bash.

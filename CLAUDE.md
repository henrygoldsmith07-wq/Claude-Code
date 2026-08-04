# Ruflo — Claude Code Configuration

## Rules

- Do what has been asked; nothing more, nothing less
- NEVER create files unless necessary — prefer editing existing files
- NEVER create documentation files unless explicitly requested
- NEVER save working files or tests to root — use `/src`, `/tests`, `/docs`, `/config`, `/scripts`
- ALWAYS read a file before editing it
- NEVER commit secrets, credentials, or .env files
- NEVER add a `Co-Authored-By` trailer unless `.claude/settings.json` sets `attribution.commit` (#2078). The Bash tool's default commit template suggests one — ignore it.
- Keep files under 500 lines; validate input at system boundaries
- ALWAYS run tests and verify the build before committing (`npm run build && npm test`)

## Token Discipline

This file, every skill description, and every byte a hook prints is re-sent on
*every* request. Measured on a real session: the fixed preamble was 56% of all
input, and output was 0.8% of total spend. Turn count is the multiplier.

- `Grep`/`Glob` to locate, then `Read` with `offset`/`limit`. Never `cat` a
  large file to inspect it.
- Pipe noisy output through `head`/`wc`/`--quiet`. Never dump full build, test,
  or install logs when the summary line is what matters.
- Batch independent tool calls into one message — each extra turn re-reads the
  whole context before anyone says anything.
- Don't re-read a file you just edited; the edit tools fail loudly.
- Spawn a subagent only when its work would otherwise flood this context. Each
  spawn re-derives context from cold.
- Hooks are silent on success (`CLAUDE_FLOW_HOOKS_VERBOSE=1` to debug).
- Memory search and agent routing are opt-in, not per-task rituals.
- Before adding a skill, agent, hook, or MCP connector, price its description
  against how often it fires — installed means billed on every request.
- Unsubscribe from PR activity once CI is green; bot deploy comments were the
  single largest conversation-side cost measured.
- `/re-fresh` into a fresh session beats carrying a long one — context grew
  2.5x across one session for the same work.

## Knowledge Base

Data flows into `/raw`, is indexed in `/wiki`, and `/improve-system` turns it
into workspace upgrades.

| Path | Purpose | Rules |
|------|---------|-------|
| `raw/` | Session digests, meeting logs, exports, dumps | Append-only; never edit in place; `YYYY-MM-DD_<source>_<topic>.md` |
| `raw/sessions/`, `raw/ecosystem/`, `raw/curated/` | Pipeline landing zones | Written only by the sync skills; each tracks `.last-sync` |
| `wiki/` | Index of `/raw` (`wiki/index.md`) + topic pages | Read FIRST — never bulk-parse `/raw`; every raw file needs an index row |
| `output/` | Improvement-loop artifacts | `review_YYYY-MM-DD.md` sign-offs; hidden `.improvement-log.md` |

These three are the sanctioned exceptions to the "no working files in root" rule.

**Routines** (cloud, fresh session per run, shared branch `knowledge-base-updates`
off `main`): `/data-ingestion` Tue & Fri 00:00 UK (`0 23 * * 1,4` UTC);
`/improve-system` an hour later (`0 0 * * 2,5` UTC). Cron is UTC so both shift
an hour in GMT. Notifications off — results surface only via the draft PR.

`/improve-system` may auto-apply only low-risk data hygiene; anything touching
`.claude/` or this file needs a `[ ] Approve` sign-off in the review file.
Prefer deleting or fixing a failing skill over whiteboarding a perfect one.

## Agents

Named agents coordinate via `SendMessage`, not polling. Spawn the whole team in
ONE message — each `Agent({...})` gets `name: "<role>"`, `run_in_background: true`,
and a prompt naming who to wait for and who to message next. Kick off with one
`SendMessage`, then STOP: say what's running and wait. NEVER poll status.

Swarm for 3+ files, new features, cross-module refactors, API changes, security,
performance. Don't swarm single-file edits, small fixes, docs, config, or
questions — coordination overhead exceeds the work.

Any string works as a `subagent_type`. Defined here: `planner`,
`hierarchical-coordinator`, `mesh-coordinator`, `adaptive-coordinator`,
`production-validator`, `tdd-london-swarm`.

## Ruflo CLI

`npx @claude-flow/cli@latest <command>` — `init`, `swarm`, `memory`, `hooks`,
`doctor --fix`, `security scan`. Use `--help` rather than guessing. MCP
coordination tools are discoverable via `ToolSearch("keyword")`.

> The background `daemon` is **expensive** — its interval workers each spawn a
> headless `claude` session, burning tokens continuously. Start it only if you
> want those sweeps (self-stops after 12h; `daemon status --all` to audit).

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

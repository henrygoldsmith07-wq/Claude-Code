# What Cool/Interesting Things Can Be Built With Claude Code

*Research notes — compiled July 2026. Primary sources: official Claude Code docs (code.claude.com/docs), the Claude Agent SDK docs, Anthropic engineering blog posts, the `anthropics/claude-code` GitHub repo and CHANGELOG, and the Model Context Protocol project. Claims reached only through search-result summaries (rather than a direct successful page fetch) are marked "(secondary source)."*

## Executive summary

Claude Code has grown from a terminal coding assistant into a full agentic platform with composable extension layers: **subagents** (isolated context workers), **hooks** (deterministic lifecycle automation), **skills** (packaged, progressively-disclosed expertise), **MCP** (a standard for plugging in hundreds of external tools/data sources), **plugins** (bundles of the above, distributed via marketplaces), and the **Agent SDK** (the same engine, embedded as a library in your own product) [[1]](https://code.claude.com/docs/en/overview). It now runs everywhere — terminal, VS Code, JetBrains, a desktop app, a browser (`claude.ai/code`), and pushed into Telegram/Discord/iMessage/Slack — and can run unattended via **Routines** (cloud cron/webhook/GitHub-triggered agents), **GitHub Actions**, **agent teams** (multiple coordinating Claude instances with a shared task list and direct peer messaging), and, newest of all, **dynamic workflows**: Claude-authored JavaScript orchestration scripts that fan out up to 1,000 subagents in the background and return one synthesized result [[9]](https://code.claude.com/docs/en/workflows). OS-level **sandboxing** (Linux bubblewrap / macOS Seatbelt) now lets Claude run autonomously with 84% fewer permission prompts while containing prompt-injection blast radius [[13]](https://www.anthropic.com/engineering/claude-code-sandboxing). This document catalogs each capability with primary-source citations and closes with concrete, buildable project ideas.

---

## Custom agents & subagents

Subagents are scoped, isolated Claude instances the main session can delegate to. Each has its own context window, system prompt, tool allowlist, and (optionally) its own model — so exploratory noise (grep results, file reads, log dumps) never pollutes the main conversation; only the final summary comes back [[2]](https://code.claude.com/docs/en/sub-agents).

Key facts from the official subagent docs:
- Defined as Markdown files with YAML frontmatter under `.claude/agents/` (project, shared with team) or `~/.claude/agents/` (personal, cross-project). Frontmatter sets `name`, `description`, `tools`, `model`, and `permissionMode`; the Markdown body is the system prompt [[2]](https://code.claude.com/docs/en/sub-agents).
- Three built-in subagents ship by default: **Explore** (read-only codebase search; as of v2.1.198 inherits the main conversation's model instead of always running on Haiku, capped at Opus on the Claude API), **Plan** (research agent used during plan mode), and **general-purpose** (exploration + modification + multi-step reasoning) [[2]](https://code.claude.com/docs/en/sub-agents).
- **Nested subagent spawning** is supported (a subagent can spawn subagents), and **subagents now run in the background by default**, so the main session keeps working while they run [[2]](https://code.claude.com/docs/en/sub-agents) [[17]](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md).
- Subagents can be resumed later via `SendMessage` addressed by agent ID or name; Explore/Plan are one-shot and can't be resumed [[2]](https://code.claude.com/docs/en/sub-agents).
- An entire session can run as a given subagent type with `claude --agent <name>`, swapping the main thread's system prompt/tools/model wholesale [[2]](https://code.claude.com/docs/en/sub-agents).
- Skills can preload into subagents, and a skill with `context: fork` can spawn as an isolated subagent directly (e.g., `agent: Explore` for a read-only research pass) [[4]](https://code.claude.com/docs/en/skills).

## Hooks

Hooks are shell commands (or MCP tool calls) Claude Code runs automatically at lifecycle points, giving deterministic, non-LLM control over agent behavior — enforcement rather than a request buried in a prompt. The reference lists 30+ event types by phase [[3]](https://code.claude.com/docs/en/hooks):

- **Session lifecycle**: `SessionStart`, `Setup` (one-time CI/scripted prep), `SessionEnd`
- **Per-turn**: `UserPromptSubmit`, `UserPromptExpansion`, `Stop`, `StopFailure`
- **Tool execution loop**: `PreToolUse` (can block/rewrite a call before it runs — the primary security checkpoint), `PostToolUse`, `PostToolUseFailure`, `PostToolBatch`, `PermissionRequest`, `PermissionDenied`
- **Agent/team events**: `SubagentStart`, `SubagentStop`, `TeammateIdle`, `TaskCreated`, `TaskCompleted`
- **Config/environment**: `ConfigChange`, `InstructionsLoaded`, `CwdChanged`, `FileChanged`, `Notification`, `MessageDisplay`
- **Context management**: `PreCompact`, `PostCompact`
- **Worktrees**: `WorktreeCreate`, `WorktreeRemove`
- **MCP**: `Elicitation`, `ElicitationResult`

Documented patterns: blocking dangerous `rm` commands before execution; auto-formatting/linting after every `Edit`/`Write`; injecting live git branch + open-issue counts into context at `SessionStart`; auto-approving trusted `Bash` invocations (e.g., `npm test`) via `PermissionRequest`; redacting secrets from tool output; firing desktop notifications on permission prompts; calling an MCP `validate_write` tool before a risky edit lands [[3]](https://code.claude.com/docs/en/hooks). Exit code 0 = success (stdout JSON parsed for `hookSpecificOutput`), exit code 2 = blocking error, any other = non-blocking error [[3]](https://code.claude.com/docs/en/hooks). Hooks are fully supported in the **Agent SDK** as in-process callback functions (Python/TypeScript) rather than shell commands [[16]](https://code.claude.com/docs/en/agent-sdk/overview).

## Skills

A Skill is a directory containing `SKILL.md` (YAML frontmatter + Markdown instructions), optionally bundled with scripts, templates, and reference docs. Skills follow the open [Agent Skills](https://agentskills.io) standard, extended by Claude Code with invocation control, subagent execution, and dynamic context injection [[4]](https://code.claude.com/docs/en/skills).

**Progressive disclosure** is the core design principle: at startup, only each skill's *name and description* load into the system prompt; the full `SKILL.md` body loads only when invoked; deeper bundled reference files load only if the instructions point to them. This three-level architecture keeps context cost near-zero for unused skills [[5]](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills) [[4]](https://code.claude.com/docs/en/skills).

Notable mechanics:
- **Custom commands have merged into skills** — `.claude/commands/deploy.md` and `.claude/skills/deploy/SKILL.md` both produce `/deploy`; skills add a directory for supporting files, invocation-control frontmatter, and dynamic context injection [[4]](https://code.claude.com/docs/en/skills).
- **Dynamic context injection**: an inline `` !`command` `` in a skill body runs a shell command *before* Claude sees the prompt and splices the output in — e.g., pulling `git diff HEAD` or `gh pr diff` into a skill so instructions arrive pre-loaded with live data [[4]](https://code.claude.com/docs/en/skills).
- **`context: fork`**: runs the skill's content as the prompt for an isolated subagent rather than inline [[4]](https://code.claude.com/docs/en/skills).
- Four skill locations with override precedence — Enterprise > Personal (`~/.claude/skills/`) > Project (`.claude/skills/`) > bundled — plus namespaced Plugin skills and **nested per-directory skills** for monorepos (a package's own `.claude/skills/` activates only when Claude touches files in that package) [[4]](https://code.claude.com/docs/en/skills).
- `disable-model-invocation: true` restricts a skill to manual `/name` use only (side-effecting workflows like `/deploy`); `user-invocable: false` restricts it to model-only invocation (background knowledge) [[4]](https://code.claude.com/docs/en/skills).
- Anthropic ships a `skill-creator` plugin that automates writing evals for a skill: generates test cases, runs isolated with/without-skill comparisons, grades pass rate, and tunes the `description` for better auto-trigger accuracy [[4]](https://code.claude.com/docs/en/skills).
- The docs' worked example bundles a Python script that generates a self-contained interactive HTML codebase visualizer (collapsible file tree, size bar chart) — skills can ship and run arbitrary scripts, not just prompts [[4]](https://code.claude.com/docs/en/skills).
- Bundled skills ship out of the box (`/code-review`, `/debug`, `/batch`, `/loop`, `/run`, `/verify`, `/dataviz`, etc.); `/run-skill-generator` records a project's real launch recipe (install commands, env vars, launch script) as a reusable `.claude/skills/run-<name>/` skill so every future agent launches the app the same way [[4]](https://code.claude.com/docs/en/skills).

## MCP server integrations — the ecosystem

The Model Context Protocol (MCP) is an open standard, not Anthropic-proprietary, for connecting AI tools to external systems; Claude Code can connect to "hundreds of external tools and data sources" through it [[8]](https://code.claude.com/docs/en/mcp). Official example/reference servers (filesystem, git, fetch, memory, sequential-thinking) live in `modelcontextprotocol/servers` [[21]](https://github.com/modelcontextprotocol/servers) [[22]](https://modelcontextprotocol.io/examples).

Real examples straight from Claude Code's docs of what this enables:
- **Jira**: "Add the feature described in JIRA issue ENG-4521 and create a PR on GitHub" [[8]](https://code.claude.com/docs/en/mcp)
- **Sentry + Statsig**: "Check Sentry and Statsig to check the usage of feature ENG-4521" [[8]](https://code.claude.com/docs/en/mcp)
- **PostgreSQL**: "Find emails of 10 random users who used feature ENG-4521, based on our PostgreSQL database" [[8]](https://code.claude.com/docs/en/mcp)
- **Figma + Slack**: "Update our standard email template based on the new Figma designs that were posted in Slack" [[8]](https://code.claude.com/docs/en/mcp)
- **Gmail, GitHub, Notion, Stripe, PayPal, HubSpot, Asana** all appear as worked `claude mcp add --transport http` examples [[8]](https://code.claude.com/docs/en/mcp)

Technical details: transports are stdio (local process), HTTP (recommended for remote/cloud services, supports OAuth 2.0), SSE (deprecated in favor of HTTP), and WebSocket (servers that push events unprompted) [[8]](https://code.claude.com/docs/en/mcp). Servers can be scoped **local** (private, current project), **project** (`.mcp.json`, checked into version control, shared with the team, requires first-use approval), or **user** (private, all projects) [[8]](https://code.claude.com/docs/en/mcp). OAuth 2.0 auto-discovers for remote servers returning `401`/`403`, and `claude mcp login <name>` runs the flow directly from the shell [[8]](https://code.claude.com/docs/en/mcp). Anthropic ships an `mcp-server-dev` plugin that scaffolds a new remote HTTP or local stdio MCP server conversationally [[8]](https://code.claude.com/docs/en/mcp). Beyond query/response, an MCP server can act as a **channel**, pushing external events (Telegram/Discord/webhook) *into* a running session so Claude reacts while the user is away [[8]](https://code.claude.com/docs/en/mcp) [[15]](https://code.claude.com/docs/en/channels). The Agent SDK's MCP example wires up the community [Playwright MCP server](https://github.com/microsoft/playwright-mcp) in ~10 lines for full programmatic browser automation [[16]](https://code.claude.com/docs/en/agent-sdk/overview).

## Plugins & marketplace

Plugins are self-contained, shareable bundles of skills, agents, hooks, MCP servers, LSP servers, background monitors, and default settings, distributed via **marketplaces** — Git-hosted catalogs defined by `.claude-plugin/marketplace.json` [[6]](https://code.claude.com/docs/en/plugins) [[7]](https://code.claude.com/docs/en/plugin-marketplaces).

Plugin anatomy (root-level, alongside `.claude-plugin/plugin.json`):

| Directory/file | Purpose |
|---|---|
| `skills/` | `<name>/SKILL.md` — invocable/reference content |
| `commands/` | Legacy flat-file skills |
| `agents/` | Custom subagent definitions |
| `hooks/hooks.json` | Event handlers |
| `.mcp.json` | MCP server configs |
| `.lsp.json` | Language Server Protocol configs for real-time code intelligence |
| `monitors/monitors.json` | Background log/status watchers that push notifications into the session automatically |
| `bin/` | Executables added to the Bash tool's `PATH` while the plugin is active |
| `settings.json` | Can set a plugin's custom agent as the session's *default* main agent |

Anthropic runs two public marketplaces: **`claude-plugins-official`** (curated, auto-registered on first interactive launch) and **`claude-community`** (public third-party submissions, automated safety screening + review, pinned to commit SHAs, synced nightly) [[6]](https://code.claude.com/docs/en/plugins). As of mid-2026 the official marketplace lists 200+ plugins, roughly twenty first-party (dev-workflow tools, `frontend-design`, `skill-creator`, output styles, eleven language servers) (secondary source) [[20]](https://github.com/anthropics/claude-plugins-official). Notable first-party plugins: `code-review` (parallel-agent diff review), `skill-creator`, `mcp-server-dev`, and the **channel plugins** `telegram`, `discord`, `imessage`, `fakechat` [[4]](https://code.claude.com/docs/en/skills) [[15]](https://code.claude.com/docs/en/channels). Plugins can be tested locally with `claude --plugin-dir ./my-plugin` (including a `.zip` archive) or from a hosted URL with `--plugin-url`, without any marketplace registration [[6]](https://code.claude.com/docs/en/plugins).

## Building your own apps with the Claude Agent SDK

The Agent SDK is "Claude Code as a library" — the same tools, agent loop, and context management, programmable in Python (`pip install claude-agent-sdk`, requires 3.10+) and TypeScript (`npm install @anthropic-ai/claude-agent-sdk`, bundles a native Claude Code binary) [[16]](https://code.claude.com/docs/en/agent-sdk/overview).

```python
async for message in query(
    prompt="Find and fix the bug in auth.py",
    options=ClaudeAgentOptions(allowed_tools=["Read", "Edit", "Bash"]),
):
    print(message)
```

Full capability parity with the CLI, exposed programmatically [[16]](https://code.claude.com/docs/en/agent-sdk/overview):
- **Built-in tools**: Read, Write, Edit, Bash, Monitor (watch a background script, react per output line), Glob, Grep, WebSearch, WebFetch, AskUserQuestion.
- **Hooks** as in-process callbacks (`PreToolUse`, `PostToolUse`, `Stop`, `SessionStart`, `SessionEnd`, `UserPromptSubmit`, etc.) — e.g., an audit-log hook appending every file edit to a log.
- **Subagents** defined inline via `AgentDefinition` (Python) / object literal (TypeScript), invoked through the `Agent` tool; messages carry `parent_tool_use_id` for tracing which subagent produced what.
- **MCP** — connect any server (Playwright MCP wired in for browser automation is the worked example).
- **Permissions** — fine-grained `allowed_tools`/`disallowed_tools`, e.g. a read-only reviewer agent.
- **Sessions** — capture a `session_id`, `resume=session_id` later with full prior context; sessions can be forked to explore alternate approaches.
- Loads the same filesystem-based config as the CLI (`.claude/skills/`, `.claude/commands/`, `CLAUDE.md`, plugins) unless `setting_sources` is restricted.

Anthropic distinguishes three tiers: the low-level **Client SDK** (you implement the tool-execution loop), the **Agent SDK** (Claude runs the loop, in your own process/infrastructure), and **Managed Agents** (a hosted REST API where Anthropic runs the agent *and* the sandbox) — "a common path is to prototype with the Agent SDK locally, then move to Managed Agents for production" [[16]](https://code.claude.com/docs/en/agent-sdk/overview).

Anthropic's official demo repo, `claude-agent-sdk-demos`, ships eight working example apps [[18]](https://github.com/anthropics/claude-agent-sdk-demos): an **email-agent** (IMAP inbox assistant with agentic search), **excel-demo** (spreadsheet manipulation), **hello-world** / **hello-world-v2** (minimal starter; V2 shows the newer session `send()`/`stream()` API), a **research-agent** (breaks a query into subtopics, spawns *parallel* researcher subagents, synthesizes a report — the same architecture as Anthropic's internal multi-agent research system, below), **ask-user-question-previews** (renders `AskUserQuestion` options as HTML preview cards, showing plan mode steering toward clarifying questions), **simple-chatapp** (React + Express chat UI over WebSocket with streaming), and a **resume-generator** (web-searches a person and assembles a `.docx` résumé from LinkedIn/GitHub/news). Claude Code's own GitHub Actions integration is itself built on the Agent SDK [[10]](https://code.claude.com/docs/en/github-actions). Branding rules for SDK-built products: "Claude Agent" or "{YourAgentName} Powered by Claude" are permitted; "Claude Code" or Claude-Code-branded visuals are not [[16]](https://code.claude.com/docs/en/agent-sdk/overview).

## Automation & CI/CD

**Headless mode** (`claude -p "..."`) runs the full agent loop non-interactively, Unix-pipeline style [[1]](https://code.claude.com/docs/en/overview):
```bash
tail -200 app.log | claude -p "Slack me if you see any anomalies"
claude -p "translate new strings into French and raise a PR for review"
git diff main --name-only | claude -p "review these changed files for security issues"
```
Supports `text`, `json`, and `stream-json` output formats for pipeline consumption.

**GitHub Actions**: the official `anthropics/claude-code-action` wraps install/auth/execution as one reusable step [[10]](https://code.claude.com/docs/en/github-actions) [[19]](https://github.com/anthropics/claude-code-action). `/install-github-app` sets it up interactively. It auto-detects two modes: responding to `@claude` mentions in issues/PRs, or running immediately as a scheduled/triggered automation with a fixed `prompt`. A workflow can invoke an installed **plugin's skill** directly (e.g., `plugins: "code-review@claude-code-plugins"`, `prompt: "/code-review:code-review ..."`), so the same skill used interactively runs unattended in CI [[10]](https://code.claude.com/docs/en/github-actions). Enterprise setups can route through Amazon Bedrock or Google Cloud's Agent Platform via OIDC federated auth [[10]](https://code.claude.com/docs/en/github-actions). GitLab CI/CD is supported as a parallel path [[1]](https://code.claude.com/docs/en/overview).

**Routines** (research preview, mid-2026) are a saved configuration (prompt + repos + MCP connectors) that runs unattended on Anthropic-managed cloud infrastructure — it keeps working with the laptop closed [[14]](https://code.claude.com/docs/en/routines). Three combinable trigger types [[14]](https://code.claude.com/docs/en/routines):
- **Scheduled** — recurring cadence (hourly minimum) or a one-off future timestamp, created conversationally (`/schedule "daily PR review at 9am"`) or via `claude.ai/code/routines`.
- **API** — POST to a per-routine authenticated `/fire` endpoint, returns a live session URL; built for alerting systems, deploy pipelines, internal tools.
- **GitHub event** — fires a fresh session on `pull_request.*`/`release.*` events, filterable by author, title, body, branch, labels, draft/merged state.

Documented example routines: nightly backlog triage (labels/assigns issues, posts a Slack summary); alert-triage (correlates a Sentry stack trace with recent commits, opens a draft-fix PR); deploy-verification (runs smoke checks post-deploy, posts go/no-go to a release channel); and a "library port" routine that mirrors a merged PR from one SDK repo into a parallel SDK in another language [[14]](https://code.claude.com/docs/en/routines). By default routines can only push to `claude/`-prefixed branches, a guardrail against touching protected branches [[14]](https://code.claude.com/docs/en/routines).

## Multi-agent orchestration

Claude Code has four distinct, composable layers of parallelism [[2]](https://code.claude.com/docs/en/sub-agents) [[11]](https://code.claude.com/docs/en/agent-teams) [[9]](https://code.claude.com/docs/en/workflows):

| Mechanism | Who holds the plan | Communication | Best for |
|---|---|---|---|
| **Subagents** | Main agent, turn by turn | Report back to caller only | Quick, focused workers (research, verification) |
| **Agent teams** *(experimental)* | Lead agent, live | Teammates message each other directly, shared task list | Parallel review, adversarial debugging, feature work needing discussion |
| **Dynamic workflows** | A JavaScript script Claude writes | Script variables — nothing hits main context until the end | Dozens-to-hundreds of agents; codebase-wide sweeps, large migrations |
| **Background agents (`claude agents` / agent view)** | You, dispatching independently | None between agents | Many unrelated fire-and-forget sessions |

**Agent teams** (experimental, opt-in via `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`): one lead session spawns named teammates, each a full independent Claude Code instance with its own context window, that self-coordinate through a file-locked shared task list and direct peer messaging (not just reporting to the lead) [[11]](https://code.claude.com/docs/en/agent-teams). Documented patterns:
- **Parallel code review**: three teammates each apply a different lens (security / performance / test coverage) to the same PR simultaneously; the lead synthesizes [[11]](https://code.claude.com/docs/en/agent-teams).
- **Adversarial debugging**: "Spawn 5 agent teammates to investigate different hypotheses. Have them talk to each other to try to disprove each other's theories, like a scientific debate" — explicitly designed to counteract the anchoring bias of sequential single-agent investigation [[11]](https://code.claude.com/docs/en/agent-teams).
- Teammates can require **plan approval** from the lead before implementing, display in split panes via tmux/iTerm2, and reuse a subagent-type definition as a teammate role. Limitations: no nested teams, one team per session, no in-process background subagents from within a teammate, split panes unsupported in VS Code/Windows Terminal/Ghostty [[11]](https://code.claude.com/docs/en/agent-teams).

**Dynamic workflows** (v2.1.154+) are the newest and most novel mechanism: Claude writes an actual JavaScript orchestration script — plain JS with top-level `await`, using `agent()` to spawn one subagent and `pipeline()` to run one per item in a list — that a separate runtime executes in the background while the session stays responsive [[9]](https://code.claude.com/docs/en/workflows). Limits: **up to 16 concurrent agents, 1,000 agents total per run**; no mid-run user input; no direct filesystem/shell access from the script itself (agents do the I/O, the script only coordinates) [[9]](https://code.claude.com/docs/en/workflows). Trigger it by including the keyword `ultracode` in a prompt, by asking in plain language ("use a workflow"), or by setting `/effort ultracode` so Claude plans a workflow for every substantive task in the session (combines `xhigh` reasoning effort with automatic workflow orchestration) [[9]](https://code.claude.com/docs/en/workflows). The bundled `/deep-research` workflow fans out web searches across multiple angles, cross-checks sources, votes on claims, and returns one cited report with unverified claims filtered rather than silently dropped [[9]](https://code.claude.com/docs/en/workflows). A completed run's script can be saved as a reusable `/<name>` command in `.claude/workflows/` (project, shared) or `~/.claude/workflows/` (personal), optionally parameterized via an `args` global — e.g. `/triage-issues` invoked with a list of issue numbers [[9]](https://code.claude.com/docs/en/workflows). A `/config` "Dynamic workflow size" setting (`small` <5 agents, `medium` <15, `large` <50, `unrestricted`) advises Claude toward a smaller default scale [[9]](https://code.claude.com/docs/en/workflows).

**Background agents / agent view** (`claude agents`): one screen listing every background session grouped by state (Needs input / Working / Completed); each is a full, detachable Claude Code conversation that keeps running without a terminal attached [[9]](https://code.claude.com/docs/en/agent-view) (persisted-fetch primary source).

Anthropic's engineering blog **"How we built our multi-agent research system"** is the canonical production case study behind this whole pattern: a lead orchestrator plans a research strategy, spawns parallel subagents that each search independently, and synthesizes the results, reporting a **90.2% performance improvement over a single agent** on complex research tasks, with token usage alone explaining roughly 80% of the performance variance across runs (secondary source — direct fetch of anthropic.com returned HTTP 403 during this research; claims reflect search-result excerpts of the primary post) [[23]](https://www.anthropic.com/engineering/multi-agent-research-system).

## IDE integrations

Claude Code runs as native integrations across every major surface, all sharing the same `CLAUDE.md`, settings, and MCP servers [[1]](https://code.claude.com/docs/en/overview):
- **VS Code** (and Cursor, via the same extension): inline diffs, plan review before edits land, auto-accept mode, @-mention files (with line ranges), conversation history, multiple parallel conversation tabs [[1]](https://code.claude.com/docs/en/overview).
- **JetBrains** (IntelliJ IDEA, PyCharm, WebStorm, etc.): plugin from the JetBrains Marketplace, requires the CLI installed separately, with interactive diff viewing and selection-context sharing [[1]](https://code.claude.com/docs/en/overview).
- **Desktop app** (macOS/Windows): visual diff review, multiple side-by-side sessions, scheduling recurring tasks, kicking off cloud sessions [[1]](https://code.claude.com/docs/en/overview).
- **Chrome/Edge browser extension**: connects to a real, visible browser window sharing the user's logged-in session state [[12]](https://code.claude.com/docs/en/chrome). Documented capabilities: live debugging by reading console errors/DOM state directly and fixing the code that caused them; design verification against a Figma mock; form/UI testing and visual-regression checks; interacting with authenticated web apps (Gmail, Notion, Google Docs) *without* building an API connector; structured data extraction from pages saved locally; multi-site task automation (e.g., cross-referencing a calendar against company websites); and recording a browser interaction as a shareable GIF [[12]](https://code.claude.com/docs/en/chrome). Read-only browser calls (screenshot, read page, console read) skip permission prompts even in plan mode; state-changing calls (click, type, navigate) require approval [[12]](https://code.claude.com/docs/en/chrome).

## Claude Code on the web / remote environments / cloud sessions

`claude.ai/code` runs Claude Code sessions entirely on Anthropic-managed cloud infrastructure — no local setup, sessions persist through browser close, monitorable from the Claude iOS app [[1]](https://code.claude.com/docs/en/overview) [[24]](https://code.claude.com/docs/en/claude-code-on-the-web).

Security architecture, per Anthropic's dedicated sandboxing post [[13]](https://www.anthropic.com/engineering/claude-code-sandboxing):
- The Bash tool runs inside an OS-level sandbox built on **Linux bubblewrap** and **macOS Seatbelt**: filesystem access limited to the working directory, network access only through a Unix domain socket to a proxy.
- Anthropic measured an **84% reduction in permission prompts** internally from sandboxing, since actions that used to need explicit approval can now run safely inside the isolation boundary.
- Even a successful prompt injection is contained — it can't steal SSH keys or exfiltrate to an attacker's server, because the sandbox has no route to reach them.
- Anthropic **open-sourced this sandboxing runtime** so other teams can build similarly-contained agents.
- On `claude.ai/code` specifically, git credentials never enter the sandbox — a custom proxy authenticates git operations on the sandbox's behalf with scoped, short-lived credentials, and outbound network traffic is domain-allowlisted [[24]](https://code.claude.com/docs/en/claude-code-on-the-web).

Portability: `--cloud` pushes a local task to the web; `--teleport` pulls a cloud/mobile-started session back into the terminal; `/desktop` hands a terminal session to the Desktop app for visual diff review; **Remote Control** drives an already-running *local* session from a phone or any browser [[1]](https://code.claude.com/docs/en/overview). **Claude Code in Slack** (being superseded by the org-wide "Claude Tag") auto-detects coding intent from an `@Claude` mention in a channel/thread, spins up a `claude.ai/code` session under the user's own GitHub identity and plan limits, posts live status updates back into the thread, and finishes with "View Session" / "Create PR" buttons [[25]](https://code.claude.com/docs/en/slack). **Channels** (research preview) push the opposite direction — external events (a Telegram/Discord/iMessage message, or a raw webhook) arrive *inside* an already-open local session so Claude reacts while the terminal is unattended; iMessage requires macOS and reads `~/Library/Messages/chat.db` directly with no bot/token needed, gated by a pairing-code allowlist; a `fakechat` plugin gives a zero-config localhost demo; channels can be two-way (Claude replies through the same chat) and can even relay permission prompts to a remote approver [[15]](https://code.claude.com/docs/en/channels).

## Notable example projects / case studies

Primary Anthropic customer case studies (claude.com/customers, secondary aggregation of primary case-study pages):
- **Rakuten** — engineers use Claude Code across the dev lifecycle (unit tests, API mocks, components, bug fixes, docs), citing a 79% cut in feature time-to-market [[26]](https://claude.com/customers/rakuten).
- **CircleCI** — built an autonomous AI agent ("Chunk") for predictive test selection, cutting time-to-feedback by an average of 75% (up to 97%); Claude Code became the daily driver for the engineering team, with 90% of engineers actively using it [[26]](https://claude.com/customers/circleci).
- **Pendo** — a two-person team (CEO + one engineer) shipped production software using the Agent SDK [[26]](https://claude.com/customers/pendo-qa).

Anthropic's own internal usage report, **"How Anthropic teams use Claude Code,"** documents cross-functional adoption: the data infrastructure team diagnosed a Kubernetes pod-IP exhaustion issue by feeding dashboard screenshots into Claude Code and having it navigate the GCP console menu-by-menu; the product team automates PR review comments via GitHub Actions; new data scientists onboard by having Claude Code read the whole codebase's `CLAUDE.md` files and explain pipeline dependencies; lawyers built phone-tree systems; marketers generated hundreds of ad variations; 65% of the product team's code is created via their internal `@Claude`-tagging flow (secondary summary of primary Anthropic report) [[27]](https://claude.com/blog/how-anthropic-teams-use-claude-code).

Anthropic's **`anthropics/claude-quickstarts`** repo (formerly `anthropic-quickstarts`) ships deployable full-stack reference apps built on the Claude API, including a Customer Support Agent (Claude + knowledge base) and a Financial Data Analyst (Next.js + Recharts + PDF.js, chat-driven financial data visualization) (secondary source, README summaries via search) [[28]](https://github.com/anthropics/claude-quickstarts). The bundled **`/deep-research`** dynamic workflow is itself a shippable case study of the pattern: fan-out web research, adversarial cross-checking, and claim-level citation, all as a rerunnable, inspectable script rather than an opaque agent loop [[9]](https://code.claude.com/docs/en/workflows).

## What's new and cutting-edge (per the CHANGELOG, mid-2026)

Pulled directly from `anthropics/claude-code/CHANGELOG.md` [[17]](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md):
- **Claude Sonnet 5** shipped with native 1M-token context (v2.1.200–201).
- **Subagents now run in the background by default**; nested spawning goes up to 5 levels deep with reduced re-delegation.
- **`SessionStart` hooks can reload skills and set the session title programmatically** (`reloadSkills`, `sessionTitle` hook outputs).
- **Workflow-spawned agents emit OpenTelemetry attributes** (`workflow.run_id`, `workflow.name`) for observability, plus a "Dynamic workflow size" `/config` setting controlling how many agents a workflow spawns by default.
- **Session working directories are now exposed to MCP via `roots/list`** with change notifications.
- A new **`/dataviz` skill** ships bundled for chart/dashboard design guidance.
- Background sessions auto-recover from stale daemon tokens; permission-mode terminology changed from "default" to "Manual."

## Concrete project ideas

Specific, buildable-this-week ideas, each tied to a capability above:

1. **A Sentry-to-PR autopilot** — a Routine with a GitHub trigger + Sentry MCP connector that, on a new production error, correlates the stack trace with recent commits and opens a draft fix PR automatically (mirrors Anthropic's documented "alert triage" routine) [[14]](https://code.claude.com/docs/en/routines).
2. **A self-authoring "run recipe" skill** — run `/run-skill-generator` once on a gnarly project so it records a per-project `.claude/skills/run-<name>/` skill; every future agent (and teammate) launches the app correctly without rediscovering the setup [[4]](https://code.claude.com/docs/en/skills).
3. **An adversarial-debugging agent team** — a project skill that spawns 4-5 teammates to each investigate a competing root-cause hypothesis for a flaky bug and argue it out via `SendMessage`, converging on a documented consensus [[11]](https://code.claude.com/docs/en/agent-teams).
4. **A domain-specific `/deep-research`-style workflow** — ask Claude to write a dynamic workflow for a recurring research task (e.g., "cross-check every dependency's CVE status across changelogs and NVD"), save it as `/audit-deps`, and rerun it whenever `package.json` changes [[9]](https://code.claude.com/docs/en/workflows).
5. **A Chrome-driven visual regression skill** — a skill with `allowed-tools` for the Chrome MCP tools that screenshots key pages before/after a change and flags visual diffs, chained into a `/verify` step before commit [[12]](https://code.claude.com/docs/en/chrome).
6. **A Telegram/Discord "ask my codebase" bridge** — install the official `telegram` or `discord` channel plugin so you can text a running Claude Code session questions about a build failure from your phone and get answers routed back to the same chat [[15]](https://code.claude.com/docs/en/channels).
7. **A headless SDK triage bot for support tickets** — a small TypeScript/Python service using the Agent SDK with a custom MCP server for your ticketing system, running `query()` per new ticket to draft categorization + a first-response suggestion, deployable as a scheduled job or webhook handler [[16]](https://code.claude.com/docs/en/agent-sdk/overview).
8. **A cross-repo library port Routine** — a GitHub-triggered Routine on `pull_request.closed` (merged) in a primary SDK repo that ports each change to a parallel SDK in another language and opens a matching PR [[14]](https://code.claude.com/docs/en/routines).
9. **A migration workflow with isolated per-file copies** — for a large mechanical refactor (e.g., styled-components → Tailwind across hundreds of components), ask for a dynamic workflow that processes each file in its own isolated copy and verifies the result before merging — a directly-documented example prompt [[9]](https://code.claude.com/docs/en/workflows).
10. **A plugin bundling your team's whole workflow** — package a `code-review` skill, a `security-reviewer` subagent, a `PostToolUse` lint/format hook, and your internal Jira/Slack MCP servers into one plugin, publish to a private marketplace repo, and have every teammate `/plugin install yourorg-plugin@yourorg-marketplace` for consistent tooling [[6]](https://code.claude.com/docs/en/plugins) [[7]](https://code.claude.com/docs/en/plugin-marketplaces).
11. **A "daily standup" Routine** — a scheduled Routine (`/schedule daily PR review at 9am`) that reads merged PRs and open issues via GitHub/Linear connectors overnight and posts a groomed summary to Slack before the team's day starts [[14]](https://code.claude.com/docs/en/routines).
12. **A GitHub Actions bot gated on a label** — customize the `claude-code-action` workflow to trigger on an `ai-fix` label rather than `@claude` mentions, and wire the official `code-review` plugin's skill into `pull_request` events for automatic multi-angle review comments without a human invoking anything [[10]](https://code.claude.com/docs/en/github-actions).

---

## References

1. [Overview — Claude Code Docs](https://code.claude.com/docs/en/overview)
2. [Create custom subagents — Claude Code Docs](https://code.claude.com/docs/en/sub-agents)
3. [Hooks reference — Claude Code Docs](https://code.claude.com/docs/en/hooks)
4. [Extend Claude with skills — Claude Code Docs](https://code.claude.com/docs/en/skills)
5. [Equipping agents for the real world with Agent Skills — Anthropic Engineering](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
6. [Create plugins — Claude Code Docs](https://code.claude.com/docs/en/plugins)
7. [Create and distribute a plugin marketplace — Claude Code Docs](https://code.claude.com/docs/en/plugin-marketplaces)
8. [Connect Claude Code to tools via MCP — Claude Code Docs](https://code.claude.com/docs/en/mcp)
9. [Orchestrate subagents at scale with dynamic workflows — Claude Code Docs](https://code.claude.com/docs/en/workflows) (also covers [Manage multiple agents with agent view](https://code.claude.com/docs/en/agent-view))
10. [Claude Code GitHub Actions — Claude Code Docs](https://code.claude.com/docs/en/github-actions)
11. [Orchestrate teams of Claude Code sessions (Agent Teams) — Claude Code Docs](https://code.claude.com/docs/en/agent-teams)
12. [Use Claude Code with Chrome — Claude Code Docs](https://code.claude.com/docs/en/chrome)
13. [Making Claude Code more secure and autonomous with sandboxing — Anthropic Engineering](https://www.anthropic.com/engineering/claude-code-sandboxing)
14. [Automate work with routines — Claude Code Docs](https://code.claude.com/docs/en/routines)
15. [Push events into a running session with channels — Claude Code Docs](https://code.claude.com/docs/en/channels)
16. [Agent SDK overview — Claude Code Docs](https://code.claude.com/docs/en/agent-sdk/overview)
17. [CHANGELOG.md — anthropics/claude-code (GitHub)](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md)
18. [claude-agent-sdk-demos — GitHub](https://github.com/anthropics/claude-agent-sdk-demos)
19. [claude-code-action — GitHub](https://github.com/anthropics/claude-code-action)
20. [claude-plugins-official — GitHub](https://github.com/anthropics/claude-plugins-official)
21. [modelcontextprotocol/servers — GitHub](https://github.com/modelcontextprotocol/servers)
22. [Example Servers — Model Context Protocol](https://modelcontextprotocol.io/examples)
23. [How we built our multi-agent research system — Anthropic Engineering](https://www.anthropic.com/engineering/multi-agent-research-system) (secondary source: direct fetch returned HTTP 403 during this research; claims sourced from search-result excerpts of the primary post)
24. [Use Claude Code on the web — Claude Code Docs](https://code.claude.com/docs/en/claude-code-on-the-web)
25. [Claude Code in Slack — Claude Code Docs](https://code.claude.com/docs/en/slack)
26. Customer case studies (secondary aggregation): [Rakuten](https://claude.com/customers/rakuten), [CircleCI](https://claude.com/customers/circleci), [Pendo](https://claude.com/customers/pendo-qa)
27. [How Anthropic teams use Claude Code — Claude/Anthropic Blog](https://claude.com/blog/how-anthropic-teams-use-claude-code) (secondary summary; original also at anthropic.com/news)
28. [anthropics/claude-quickstarts — GitHub](https://github.com/anthropics/claude-quickstarts) (secondary source, README summaries via search, not independently fetched)

*Note on sourcing: a handful of anthropic.com/engineering and anthropic.com/news URLs returned HTTP 403 to automated fetches during this research pass; those claims are attributed to the named primary source via search-result excerpts and are flagged "(secondary source)" inline. Everything under `code.claude.com/docs/` and `github.com/anthropics/` was fetched and quoted/paraphrased directly from the live primary source.*

# What Cool/Interesting Things Can Be Built With Claude Code?

*Research notes — compiled July 2026. Sources are primary (Anthropic/Claude Code docs, GitHub, MCP spec) unless explicitly marked "(secondary source)."*

## Executive summary

Claude Code has grown from a terminal coding assistant into a full **extensible agent platform**. The extension surface breaks into seven composable layers — CLAUDE.md, Skills, Subagents, Agent teams, MCP, Hooks, and Plugins/Marketplaces — each solving a different problem (always-on context, on-demand knowledge, isolated workers, peer coordination, external tool access, deterministic automation, and packaging/distribution, respectively) ([Extend Claude Code](https://code.claude.com/docs/en/features-overview)). On top of the CLI, the same agent loop ships as a headless mode (`claude -p`) and as the **Claude Agent SDK** (Python/TypeScript) for embedding Claude-Code-grade autonomy into your own products ([Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)). Recent (late-2025/2026) additions push well past "autocomplete for code": **dynamic workflows** that let Claude write and run JavaScript orchestration scripts spawning up to 1,000 subagents ([Workflows](https://code.claude.com/docs/en/workflows)); **agent teams** where independently-running Claude sessions message each other and self-coordinate on a shared task list ([Agent teams](https://code.claude.com/docs/en/agent-teams)); **background agents** managed from a single `claude agents` dashboard ([Agent view](https://code.claude.com/docs/en/agent-view)); **channels**, which let external systems (Telegram, Discord, iMessage, webhooks) push events straight into a running session ([Channels](https://code.claude.com/docs/en/channels)); **Claude Code on the web**, a cloud-hosted, persistent-session version at claude.ai/code ([Claude Code on the web](https://code.claude.com/docs/en/claude-code-on-the-web)); and a first-party **GitHub Actions integration** for `@claude`-driven autonomous PRs and CI automation ([GitHub Actions](https://code.claude.com/docs/en/github-actions)). Anthropic itself uses this architecture internally — its published multi-agent research system (orchestrator + parallel subagents) reports a **90.2% performance improvement over a single agent** on complex research tasks ([Anthropic Engineering: multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)). Below is a category-by-category tour of what's buildable, followed by concrete project ideas.

---

## 1. Custom subagents

Subagents are specialized AI workers with their own context window, system prompt, tool access, and permissions, defined as Markdown files with YAML frontmatter in `.claude/agents/` (project) or `~/.claude/agents/` (personal) ([Create custom subagents](https://code.claude.com/docs/en/sub-agents)). Claude delegates to a subagent automatically when a task matches its description, or you can invoke one explicitly.

What they're for, per the docs:
- **Preserve context** — exploration/search work stays out of the main conversation; only a summary returns.
- **Enforce constraints** — restrict which tools a given worker can use.
- **Reuse configurations** — user-level subagents work across every project.
- **Specialize behavior** — narrow system prompts for a single domain (security review, test-writing, docs).
- **Control cost** — route routine work to a cheaper/faster model like Haiku.

As of recent releases, **subagents run in the background by default**, so the main session keeps working and gets notified when they finish (v2.1.198, [CHANGELOG](https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md)). Subagents can also preload specific Skills via a `skills:` frontmatter field, and can be spawned with `context: fork` from inside a skill ([Extend Claude Code](https://code.claude.com/docs/en/features-overview)).

## 2. Skills

A Skill is a `SKILL.md` file (instructions/knowledge/workflow) that Claude loads automatically when relevant, or that you invoke directly with `/skill-name`. Claude Code Skills follow the open [Agent Skills](https://agentskills.io) standard, which works across multiple AI tools, and Claude Code extends it with invocation control, subagent execution, and dynamic context injection ([Extend Claude with skills](https://code.claude.com/docs/en/skills)).

Key mechanics:
- Skill bodies load **on demand** — only the name/description sit in context at session start, so long reference material (an API style guide, a full deployment runbook) is nearly free until used.
- `disable-model-invocation: true` hides a skill from Claude entirely until the user explicitly runs it — useful for skills with side effects.
- A skill can run in an isolated context via `context: fork`, effectively becoming a subagent.
- Custom slash commands (`.claude/commands/*.md`) and skills have been merged — both produce a `/name` invocation.
- Claude Code ships **bundled skills** out of the box, e.g. `/deploy`-style playbooks, `/code-review`, `/debug`, and the newer `/dataviz` chart-design skill (added v2.1.198) ([CHANGELOG](https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md)).

## 3. Hooks

Hooks are deterministic automation attached to lifecycle events — a script, HTTP request, LLM prompt, or subagent that fires guaranteed, not "requested." The docs frame the distinction sharply: *"An instruction like 'never edit .env' in CLAUDE.md or a skill is a request, not a guarantee. A PreToolUse hook that blocks the edit is enforcement."* ([Extend Claude Code](https://code.claude.com/docs/en/features-overview))

Claude Code fires hooks at roughly two dozen distinct lifecycle points, including ([Hooks](https://code.claude.com/docs/en/hooks)):
- **Session-level**: `SessionStart`, `Setup`, `SessionEnd`
- **Turn-level**: `UserPromptSubmit`, `Stop`, `StopFailure`
- **Tool-level** (fire on every tool call in the agentic loop): `PreToolUse` (can block a call — the primary security checkpoint), `PostToolUse`, `PostToolUseFailure`, `PostToolBatch`, `PermissionRequest`, `PermissionDenied`
- **Environment-reactive**: `FileChanged`, `CwdChanged`, `ConfigChange`, `WorktreeCreate`/`WorktreeRemove`
- **Team/workflow**: `SubagentStart`/`SubagentStop`, `TeammateIdle`, `TaskCreated`/`TaskCompleted`
- **MCP**: `Elicitation`/`ElicitationResult` for mid-tool-call user input requests

Practical patterns documented: a `PreToolUse` hook that greps a shell command for `rm -rf` and denies it; a `PostToolUse` hook that runs a linter/formatter after every `Edit`/`Write`; a `SessionStart` hook that primes Claude with current git branch, uncommitted diffs, and assigned GitHub issues; a hook that calls an MCP `security_scan` tool after every file write. Hooks add **zero context cost** unless they explicitly return output.

## 4. MCP server integrations — the ecosystem

The **Model Context Protocol (MCP)** is the open standard Claude Code uses to connect to "hundreds of external tools and data sources" ([Connect Claude Code to tools via MCP](https://code.claude.com/docs/en/mcp)). Docs describe MCP servers as giving Claude Code "access to your tools, databases, and APIs" and list example prompts it enables directly:
- *"Add the feature described in JIRA issue ENG-4521 and create a PR on GitHub."*
- *"Check Sentry and Statsig to check the usage of the feature described in ENG-4521."*
- *"Find emails of 10 random users who used feature ENG-4521, based on our PostgreSQL database."*
- *"Update our standard email template based on the new Figma designs that were posted in Slack."*
- *"Create Gmail drafts inviting these 10 users to a feedback session about the new feature."*

An MCP server can also act as a **channel**, pushing messages into a session so Claude reacts to Telegram/Discord/webhook events while the user is away (see §9).

Real, currently-connectable MCP servers in this environment alone (a representative slice of the ecosystem) include Figma, GitHub, Notion, Supabase, Vercel, Lovable, Canva, Google Drive/Calendar/Gmail, Spotify, and dozens more vertical/data servers — each exposing dozens of purpose-built tools rather than one generic "call API" tool. MCP itself is a protocol-level spec (clients, servers, transports over stdio/HTTP) maintained independently and adopted by Claude Code as a first-class extension mechanism ([modelcontextprotocol.io](https://modelcontextprotocol.io/introduction) — could not be fetched directly for this report due to a 403; treat MCP-spec-level claims here as summarized from Anthropic's MCP docs and general MCP awareness rather than a direct primary-source quote).

The [Agent SDK MCP example](https://code.claude.com/docs/en/agent-sdk/overview) shows wiring up the community [Playwright MCP server](https://github.com/microsoft/playwright-mcp) in ~10 lines to give a programmatic agent full browser automation, and links to the community server index at [github.com/modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) ("hundreds more").

## 5. Plugins & marketplaces

A **plugin** bundles skills, subagents, hooks, MCP servers, LSP servers, background monitors, and default settings into one installable, shareable unit ([Create plugins](https://code.claude.com/docs/en/plugins)). Plugin skills are namespaced (`/my-plugin:hello`) so multiple plugins can coexist without collisions.

Plugin anatomy (root-level directories, `.claude-plugin/plugin.json` manifest):

| Directory/file | Purpose |
|---|---|
| `skills/` | `<name>/SKILL.md` — the plugin's invocable/reference content |
| `agents/` | Custom subagent definitions |
| `hooks/hooks.json` | Event handlers |
| `.mcp.json` | MCP server configs |
| `.lsp.json` | Language-server configs for code intelligence |
| `monitors/monitors.json` | Background log/file watchers that notify Claude as events arrive |
| `bin/` | Executables added to Bash's `PATH` while the plugin is active |
| `settings.json` | Can set a plugin's custom agent as the session's *default* main agent |

Distribution is via **marketplaces** — git-hosted `marketplace.json` catalogs. Anthropic runs two: `claude-plugins-official` (curated, auto-registered on first interactive launch) and `claude-community` (public third-party submissions, reviewed + safety-screened, pinned to commit SHAs) ([Create plugins](https://code.claude.com/docs/en/plugins), [Create and distribute a marketplace](https://code.claude.com/docs/en/plugin-marketplaces)). Anyone can spin up a private marketplace for an internal team.

Notable official plugins found during this research: the **Telegram**, **Discord**, and **iMessage** channel plugins (see §9), pre-built **LSP (code intelligence) plugins** for common languages, and a **`fakechat`** demo plugin for testing the channels flow with zero external setup.

## 6. Building your own apps with the Claude Agent SDK

The **Claude Agent SDK** (Python `claude-agent-sdk`, TypeScript `@anthropic-ai/claude-agent-sdk`) exposes "the same tools, agent loop, and context management that power Claude Code," programmable as a library ([Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)):

```python
async for message in query(
    prompt="Find and fix the bug in auth.py",
    options=ClaudeAgentOptions(allowed_tools=["Read", "Edit", "Bash"]),
):
    print(message)
```

Everything that makes Claude Code powerful is exposed programmatically:
- **Built-in tools**: Read, Write, Edit, Bash, Monitor (watch a background script and react per output line), Glob, Grep, WebSearch, WebFetch, AskUserQuestion.
- **Hooks**: callback functions for `PreToolUse`, `PostToolUse`, `Stop`, `SessionStart`, `SessionEnd`, `UserPromptSubmit`, etc. — e.g. an audit-log hook that appends every file edit to a log file.
- **Subagents**: define `AgentDefinition`s programmatically (description, prompt, allowed tools) and dispatch to them via the `Agent` tool.
- **MCP**: connect any MCP server (the docs' worked example wires up Playwright MCP for full browser automation in ~10 lines).
- **Permissions**: fine-grained tool allow/deny, e.g. a read-only reviewer agent that can't modify files.
- **Sessions**: capture a `session_id` and resume/fork it later with full prior context.
- It also loads Claude Code's filesystem-based config (Skills, legacy Commands, CLAUDE.md memory, Plugins) from `.claude/` and `~/.claude/` by default, controllable via `setting_sources`.

Anthropic explicitly positions three tiers: the **Client SDK** (you write the tool loop yourself), the **Agent SDK** (Claude runs the loop, in your process/infra), and **Managed Agents** (a hosted REST API where Anthropic runs the agent *and* a per-session sandbox) — "a common path is to prototype with the Agent SDK locally, then move to Managed Agents for production."

Anthropic's own **example agents** repo demonstrates the range of what's buildable: an IMAP **email assistant**, an **Excel** file-editing demo, a **multi-agent research system** that breaks a topic into subtopics and spawns parallel researcher subagents, a WebSocket-driven **branding assistant** that renders HTML preview cards for `AskUserQuestion` choices, a full **React+Express chat app** backed by the SDK, and a **resume generator** that web-searches a person and writes a formatted `.docx` ([anthropics/claude-agent-sdk-demos](https://github.com/anthropics/claude-agent-sdk-demos)).

Branding note: Anthropic restricts naming — SDK-built products may say "Claude Agent" or "{YourAgentName} Powered by Claude," but not "Claude Code" or Claude-Code-branded visual elements ([Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)).

## 7. Automation & CI/CD

### Headless mode (`claude -p`)
Non-interactive mode runs the full agent loop from a script or pipe, with structured output support ([Run Claude Code programmatically](https://code.claude.com/docs/en/headless)):
- `--output-format json|stream-json` for machine-readable results (including `total_cost_usd` per invocation) or token-level streaming.
- `--json-schema` to force a specific structured-output shape.
- `--bare` to skip auto-discovery of hooks/skills/plugins/MCP/CLAUDE.md for reproducible CI runs — "the recommended mode for scripted and SDK calls."
- `--continue`/`--resume <session_id>` to chain multi-step scripted conversations.
- Documented patterns: piping a build-error log into Claude for root-cause analysis (`cat build-error.txt | claude -p ... > output.txt`); wiring Claude into `package.json` as a typo linter on `git diff`; a PR-review script that pipes `gh pr diff` into Claude with an appended "you are a security engineer" system prompt.

### GitHub Actions
The official [`anthropics/claude-code-action`](https://github.com/anthropics/claude-code-action) (built on the Agent SDK) lets any `@claude` mention in an issue/PR comment trigger autonomous work: analyze code, create PRs, implement features, fix bugs — "all while following your project's standards" ([Claude Code GitHub Actions](https://code.claude.com/docs/en/github-actions)). Setup is a one-command `/install-github-app`. The action auto-detects interactive mode (`@claude` mentions) vs. automation mode (prompt-driven, e.g. scheduled). Example configs from the docs:
- A daily cron job that posts a commit/issue summary using `claude_args: "--model opus"`.
- A `pull_request` trigger that installs the `code-review` plugin and runs its skill on every new/updated PR.
- Enterprise setups routing through Amazon Bedrock or Google Cloud's Agent Platform via OIDC, for teams that need data residency control.

### Claude Code on the web — auto-fix PRs
Cloud-hosted sessions (claude.ai/code) persist even after closing the browser and are monitorable from the mobile app. A documented capability is **auto-fix pull requests** — automatically responding to CI failures and review comments on an open PR ([Claude Code on the web](https://code.claude.com/docs/en/claude-code-on-the-web)).

### GitLab CI/CD
Docs also reference a parallel **GitLab CI/CD** integration path alongside GitHub Actions (linked from the headless-mode docs), though this report did not fetch that page directly.

## 8. Multi-agent orchestration

Claude Code now has *four* distinct ways to parallelize work, each suited to a different shape of task ([Extend Claude Code](https://code.claude.com/docs/en/features-overview), [Agent teams](https://code.claude.com/docs/en/agent-teams), [Workflows](https://code.claude.com/docs/en/workflows)):

| Mechanism | Who holds the plan | Communication | Best for |
|---|---|---|---|
| **Subagents** | Main agent, turn by turn | Report back to caller only | Quick, focused workers (research, verification) |
| **Agent teams** *(experimental)* | Lead agent, live | Teammates message each other directly, shared task list | Parallel review, adversarial debugging, new-feature work needing discussion |
| **Dynamic workflows** | A JavaScript script Claude writes | Script variables (nothing hits main context until the end) | Dozens-to-hundreds of agents; codebase-wide sweeps, large migrations |
| **Background agents (`claude agents`)** | You, dispatching independently | None between agents | Many unrelated fire-and-forget sessions |

**Agent teams** (gated behind `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`) let one lead session spawn named teammates — each a full independent Claude Code instance with its own context window — that self-coordinate via a shared, file-locked task list and direct peer messaging. The docs' flagship example spawns 5 teammates to investigate a bug via **competing hypotheses that actively try to disprove each other**, "like a scientific debate," specifically to counteract the anchoring bias of sequential single-agent investigation. Split-pane display mode (tmux/iTerm2) lets you watch every teammate's terminal simultaneously.

**Dynamic workflows** (v2.1.154+) are the newest and most novel piece: Claude writes an actual JavaScript orchestration script (`agent()`, `pipeline()` primitives, top-level `await`) that a separate runtime executes in the background, fanning out up to **16 concurrent / 1,000 total agents per run**. Six composable patterns cover most use cases: classify-and-act, fan-out-and-synthesize, adversarial verification, deep verification, generate-and-filter, and sorting/ranking. The bundled `/deep-research` workflow demonstrates this: it fans out web searches across multiple angles, cross-checks sources, votes on claims, and returns one cited report with unverified claims filtered out — driven entirely by a saved, rerunnable script. A workflow's launch can also be triggered implicitly via `/effort ultracode`, which combines maximum reasoning effort with automatic workflow planning for every substantive task in a session.

Anthropic's own production validation of this pattern: the **multi-agent research system** post describes a lead orchestrator (Opus) spawning parallel Sonnet subagents that each act as intelligent search filters, reporting back for synthesis — measured at a **90.2% performance improvement** over a single Opus agent on complex research tasks, with "token usage by itself" explaining 80% of the performance variance. Early failure modes documented: agents spawning 50 subagents for trivial queries, endless web scouring for nonexistent sources, and subagents distracting each other with excessive status updates — all addressed primarily through prompt engineering rather than architecture changes (via [WebSearch summary](https://www.anthropic.com/engineering/multi-agent-research-system) — the page itself returned HTTP 403 on direct fetch during this research, so this paragraph is sourced from search-result excerpts of the primary post rather than a direct quote; flagging per the "secondary if primary unavailable" rule, though the URL is Anthropic's own engineering blog).

## 9. IDE integrations

- **VS Code** (and forks: Cursor, Devin Desktop, Kiro): a native extension with side-by-side diff review before edits land, `@`-mention of files/line-ranges, checkpoints (rewind conversation, code, or both to any prior message), a built-in local MCP server (`ide`) that exposes `getDiagnostics` and Jupyter `executeCode` tools back to the CLI, session history synced with cloud (claude.ai) sessions, and `@browser` commands that drive a connected Chrome extension for testing/debugging web apps without leaving the editor ([Use Claude Code in VS Code](https://code.claude.com/docs/en/ide-integrations)).
- **JetBrains** (IntelliJ, PyCharm, WebStorm, etc.) — interactive diff viewing and selection-context sharing, per the docs index.
- **Claude in Chrome** — a browser extension that clicks buttons, fills forms, extracts data, and runs multi-step workflows by observing the page and driving Chrome's automation APIs; reached general availability per the changelog (v2.1.198: *"Claude in Chrome is now generally available"*) ([CHANGELOG](https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md); background from [Piloting Claude in Chrome](https://www.anthropic.com/news/claude-for-chrome), secondary-confirmed via search).

## 10. Claude Code on the web / remote & background environments

Several distinct "away from your terminal" surfaces now exist, each suited to a different interaction pattern ([Channels](https://code.claude.com/docs/en/channels) has a helpful comparison table):

- **Claude Code on the web** (claude.ai/code) — runs tasks in a fresh Anthropic-managed cloud sandbox cloned from GitHub; persists across browser closes; monitorable from the Claude mobile app; supports setup scripts, configurable network access, and moving a task between web and terminal via `--cloud`/`--teleport` ([Claude Code on the web](https://code.claude.com/docs/en/claude-code-on-the-web)).
- **Claude in Slack / Claude Tag** — `@Claude`-mention in a Slack thread auto-detects coding intent and spins up a Claude Code web session under the user's own GitHub/plan, posting live progress and a "Create PR" button back into the thread ([Claude Code in Slack](https://code.claude.com/docs/en/slack)).
- **Agent view (`claude agents`)** — a single-screen dashboard listing every background session by state (Needs input / Working / Completed); each is a full, detachable conversation ([Manage multiple agents with agent view](https://code.claude.com/docs/en/agent-view)).
- **Remote Control** — drive an existing *local* session from claude.ai or the Claude mobile app.
- **Channels** *(research preview, v2.1.80+)* — the inverse direction: an MCP server that **pushes** events (chat messages, CI results, monitoring alerts, arbitrary webhooks) into an already-running local session so Claude reacts while the terminal is unattended. Ships with ready-made Telegram, Discord, and iMessage plugins (bot-token or, for iMessage, direct macOS Messages-DB access via AppleScript), each gated by a sender allowlist established through a pairing-code flow. A `fakechat` plugin gives a zero-config localhost demo. Channels can be two-way (Claude replies through the same chat) and can even relay permission prompts to a remote approver ([Push events into a running session with channels](https://code.claude.com/docs/en/channels)).
- **Scheduled tasks** — referenced as a complementary "poll on a timer" alternative to channels' push model (linked from the channels doc; not independently fetched for this report).

## 11. Notable example projects / case studies

- **[anthropics/claude-agent-sdk-demos](https://github.com/anthropics/claude-agent-sdk-demos)** — official SDK example gallery: IMAP email assistant, Excel-file agent, multi-agent research system, WebSocket branding assistant with rendered HTML preview cards, full React+Express chat app, and a resume generator that researches a person via web search and outputs a `.docx`.
- **[anthropics/claude-quickstarts](https://github.com/anthropics/claude-quickstarts)** (formerly `anthropic-quickstarts`) — deployable full-stack reference apps built on the Claude API, including a **Customer Support Agent** (Claude + a knowledge base) and a **Financial Data Analyst** (Next.js 14 + Recharts + PDF.js, chat-driven financial data visualization) ([repo](https://github.com/anthropics/claude-quickstarts), README summaries via search).
- **Anthropic's internal multi-agent research system** — the clearest published case study of Claude Code's own orchestration patterns applied at scale in production, with a measured 90.2% quality improvement from going single-agent → orchestrator+subagents ([Anthropic Engineering blog](https://www.anthropic.com/engineering/multi-agent-research-system)).
- **`/deep-research`** — Claude Code's own bundled dynamic workflow is itself a shippable case study: fan-out web research, adversarial cross-checking, and claim-level citation, all as a rerunnable, inspectable script rather than an opaque agent loop.
- **[anthropics/claude-code-action](https://github.com/anthropics/claude-code-action)** — the GitHub Actions integration is itself a full open-source reference implementation of "Agent SDK embedded in CI," worth reading for anyone building a similar bot for another platform (GitLab, Bitbucket, etc.).

---

## Concrete project ideas (buildable this week)

1. **A Telegram/Discord "ops bot" via Channels** — install the official Telegram or Discord channel plugin, pair your account, and have a long-running Claude Code session watch a repo. Text it from your phone ("what broke in prod?") and it investigates against your real, already-checked-out files and replies in-chat. ([Channels docs](https://code.claude.com/docs/en/channels))

2. **A webhook-triggered incident responder** — build a custom channel (per the Channels reference) that forwards Sentry/PagerDuty alerts into a running session; Claude reads the stack trace, greps the codebase, and posts a draft fix or root-cause summary back to the alert thread.

3. **A `/deep-research`-style workflow tailored to your domain** — ask Claude to write a dynamic workflow for a recurring research task specific to your work (e.g., "cross-check every dependency's CVE status across changelogs and NVD"), then save it as a reusable `/audit-deps` command.

4. **An adversarial code-review agent team** — spawn a 3-teammate agent team on every nontrivial PR: one security-focused, one performance-focused, one test-coverage-focused, synthesized by the lead. Wire it into a `PostToolUse`/`Stop` hook so it runs automatically before you push. (Pattern straight from the [agent teams docs](https://code.claude.com/docs/en/agent-teams).)

5. **A CI "typo/security linter" via headless mode** — add a `package.json` script that pipes `git diff main` into `claude -p --bare` with an appended reviewer system prompt and JSON schema output, gating merges on structured findings ([headless mode docs](https://code.claude.com/docs/en/headless)).

6. **A custom Slack/Discord support bot built on the Agent SDK** — use the Python or TypeScript SDK directly (not Claude Code the CLI) to build a support agent with a narrow tool allowlist (Read-only + your ticketing MCP server), branded as your own product per Anthropic's SDK branding rules.

7. **A plugin that bundles your team's whole workflow** — package your CLAUDE.md conventions, a `/deploy` skill, a pre-commit lint hook, and your internal Jira/Confluence MCP server into one plugin, host it on a private marketplace repo, and have every teammate `/plugin install` it in one command ([Create plugins](https://code.claude.com/docs/en/plugins), [Marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)).

8. **A migration workflow** — for a large mechanical refactor (e.g., styled-components → Tailwind across hundreds of components), ask for a dynamic workflow that processes each file in an isolated copy and verifies the result before merging — directly mirrors the documented example prompt.

9. **A GitHub Actions bot that only responds to labeled issues** — customize the `claude-code-action` workflow to trigger on an `ai-fix` label rather than `@claude` mentions, scoping autonomous PR creation to pre-triaged work.

10. **A browser-testing subagent using Playwright MCP** — wire the Playwright MCP server into a dedicated `browser-tester` subagent (`tools:` restricted to it) so any main-session task can delegate "click through this flow and screenshot failures" without polluting the main context window.

11. **A VS Code-native Jupyter data-science copilot** — use the built-in `ide` MCP server's `executeCode` tool (with its mandatory confirmation dialog) to have Claude propose and run notebook cells directly, iterating on an analysis with the diagnostics/diff review loop already wired in.

12. **A resume-workflow-generator business idea, SDK-style** — take the SDK demos' resume-generator pattern and generalize it into a small internal tool: point it at a name + company, have it web-search, synthesize, and emit a formatted document, all via 30-40 lines against the Agent SDK.

---

## References

1. [Extend Claude Code — feature overview](https://code.claude.com/docs/en/features-overview)
2. [Create custom subagents](https://code.claude.com/docs/en/sub-agents)
3. [Hooks reference](https://code.claude.com/docs/en/hooks)
4. [Extend Claude with skills](https://code.claude.com/docs/en/skills)
5. [Connect Claude Code to tools via MCP](https://code.claude.com/docs/en/mcp)
6. [Create plugins](https://code.claude.com/docs/en/plugins)
7. [Create and distribute a plugin marketplace](https://code.claude.com/docs/en/plugin-marketplaces)
8. [Orchestrate teams of Claude Code sessions (Agent teams)](https://code.claude.com/docs/en/agent-teams)
9. [Orchestrate subagents at scale with dynamic workflows](https://code.claude.com/docs/en/workflows)
10. [Manage multiple agents with agent view](https://code.claude.com/docs/en/agent-view)
11. [Push events into a running session with channels](https://code.claude.com/docs/en/channels)
12. [Use Claude Code on the web](https://code.claude.com/docs/en/claude-code-on-the-web)
13. [Claude Code in Slack](https://code.claude.com/docs/en/slack)
14. [Claude Code GitHub Actions](https://code.claude.com/docs/en/github-actions)
15. [Run Claude Code programmatically (headless mode)](https://code.claude.com/docs/en/headless)
16. [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)
17. [Use Claude Code in VS Code](https://code.claude.com/docs/en/ide-integrations)
18. [Claude Code CHANGELOG.md (anthropics/claude-code)](https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md)
19. [anthropics/claude-code GitHub repo](https://github.com/anthropics/claude-code)
20. [anthropics/claude-code-action GitHub repo](https://github.com/anthropics/claude-code-action)
21. [anthropics/claude-agent-sdk-demos GitHub repo](https://github.com/anthropics/claude-agent-sdk-demos)
22. [anthropics/claude-quickstarts GitHub repo](https://github.com/anthropics/claude-quickstarts)
23. [Anthropic Engineering: How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) (fetched via search-result excerpt; direct page fetch returned HTTP 403 during research)
24. [Piloting Claude in Chrome — Anthropic News](https://www.anthropic.com/news/claude-for-chrome) (secondary-confirmed via search; not directly fetched)
25. [Model Context Protocol — modelcontextprotocol.io](https://modelcontextprotocol.io/introduction) (direct fetch returned HTTP 403 during research; MCP-spec claims in §4 reflect general MCP/Anthropic-docs knowledge rather than a direct quote from this page)


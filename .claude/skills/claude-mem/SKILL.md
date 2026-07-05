---
name: claude-mem
description: Persistent memory for Claude Code. Compresses past sessions into searchable memories and restores relevant context at session start, so Claude remembers prior work across conversations. Use when the user wants to set up claude-mem, install persistent/cross-session memory, save or recall context from earlier sessions, search past work, or asks "what did we do last time", "remember this", "load my memory", "restore context".
---

# claude-mem

Persistent, cross-session memory for Claude Code. `claude-mem` archives each session's
transcript, compresses it into concise memories, indexes them, and injects the relevant
ones back at the start of new sessions — so context survives `/clear`, `/compact`, and
brand-new conversations.

## What it does

- **Archive** — captures the session transcript when a session ends.
- **Compress** — distills the transcript into short, structured memory entries
  (decisions, facts, file locations, TODOs) instead of raw logs.
- **Index** — stores memories in a local searchable store (per-project + global).
- **Restore** — a SessionStart hook loads the most relevant memories into context
  automatically at the start of the next session.
- **Search** — recall specific past work on demand.

Memory lives locally (default under `~/.claude-mem/`); nothing is committed to the repo.

## Setup

Install and wire up the Claude Code hooks:

```bash
npx claude-mem@latest install
```

This installs the CLI and registers the SessionStart / SessionEnd hooks in your Claude
Code settings so archiving and restoring happen automatically. Verify with:

```bash
npx claude-mem@latest status
npx claude-mem@latest doctor    # diagnose hook / config issues
```

## Everyday use

Once installed, memory is automatic — no action needed to save or restore. Use the CLI
when you want to inspect or query it directly:

```bash
npx claude-mem@latest search "auth flow"     # recall past work by keyword
npx claude-mem@latest list                    # list recent memories
npx claude-mem@latest load                     # print restorable context for this project
npx claude-mem@latest compress                 # compress the current/last session now
```

Inside a session, natural-language triggers work too: "remember this", "what did we
decide last time", "load my memory for this project", "search my memory for X".

## When to reach for it

- **Yes** — starting a new session on an existing project and wanting prior context back;
  recalling a decision, file location, or TODO from an earlier conversation; setting up
  a project so future sessions retain memory.
- **No** — single self-contained tasks; anything the user wants kept out of persistent
  storage. Memory is local, but confirm before archiving sessions that touched secrets.

## Notes

- Storage is local and per-user; keep `~/.claude-mem/` out of version control.
- If restore isn't firing, run `doctor` — it's almost always a missing/duplicated hook
  entry in `~/.claude/settings.json`.
- Uninstall cleanly with `npx claude-mem@latest uninstall` (removes the registered hooks).

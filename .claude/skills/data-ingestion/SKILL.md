---
name: data-ingestion
description: Master orchestration for the knowledge-base pipelines — runs sync-claude-sessions, sync-ecosystem-data, and sync-curated-content in succession, then reconciles the wiki index. Use for the scheduled data-ingestion routine or when the user says "ingest data" / "run the pipelines".
---

# Data Ingestion (Master Orchestration)

Run all knowledge-base sync pipelines in succession. This is the command the
**Data Ingestion routine** fires (Tuesday and Friday mornings) — it must run
end-to-end without asking questions.

## Process

1. **Sync sessions.** Follow `.claude/skills/sync-claude-sessions/SKILL.md`.
2. **Sync ecosystem data.** Follow `.claude/skills/sync-ecosystem-data/SKILL.md`.
3. **Sync curated content.** Follow `.claude/skills/sync-curated-content/SKILL.md`.
4. **Reconcile the wiki.** After all three:
   - Verify every file written this run has a row in `wiki/index.md`; add any
     missing rows.
   - If 3+ indexed entries now share a theme without a topic page, create
     `wiki/<topic>.md` and register it in the **Topic Pages** table.

## Failure handling

A failing pipeline (missing connector, empty source, tool error) must not stop
the run: note the failure, continue with the next pipeline, and include it in
the report.

## Report

End with a single consolidated summary:

```
## Data Ingestion — YYYY-MM-DD
- Sessions:  <n digested | skipped: reason>
- Ecosystem: <sources synced | skipped: reason>
- Curated:   <claims extracted | skipped: reason>
- Wiki:      <rows added, topic pages created/updated>
```

Do not commit unless the user asks; the improvement loop reviews these files
before they're worth committing.

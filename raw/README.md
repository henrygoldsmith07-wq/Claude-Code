# /raw — Unstructured Knowledge Store

Append-only store for unstructured resources: session digests, meeting logs,
email/newsletter extracts, code exports, raw text dumps.

## Rules

- Files land here via `/add-new-resource` or the sync pipelines — never edit a raw file in place
- Naming: `YYYY-MM-DD_<source>_<topic>.md` (e.g. `2026-07-12_session_auth-refactor.md`)
- Every file added here MUST be indexed in `/wiki/index.md` in the same operation
- Claude reads `/wiki` first and only opens raw files the index points at — never bulk-parse this folder

## Subfolders

| Folder | Fed by | Contents |
|--------|--------|----------|
| `sessions/` | `/sync-claude-sessions` | Digests of Claude Code CLI session history |
| `ecosystem/` | `/sync-ecosystem-data` | Meeting transcripts, email signals, workspace data |
| `curated/` | `/sync-curated-content` | Newsletter and outside-learning extracts |

Files added manually via `/add-new-resource` go in the root of `/raw`.

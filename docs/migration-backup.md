# Migration & Backup Quality

For every database-backed app.

---

## 1. Rules

| Rule | Why |
|------|-----|
| **Migrations are reviewed diffs, not imperative scripts you run by hand** | A migration that cannot be read as a diff cannot be reviewed. |
| **Re-runnable guards** | Every DDL uses `if not exists` / `drop policy if exists` / `create or replace` so the migration can be re-applied on a fresh project and retried after a partial failure. |
| **Preserve constraints** | CHECK lengths, UNIQUE on token hashes, foreign keys with `on delete cascade` — a migration that drops a constraint must name it and justify it. |
| **Verify RLS after migration** | A migration touching policies or grants must be followed by an RLS re-verification (test + manual spot check). |
| **Document backup/export/recovery** | If user data cannot be recovered, state that. If it can, state how. |

## 2. Per-app state

### Revise — Supabase replica (IndexedDB is primary)

- Device IndexedDB drains an outbox into Supabase; Supabase is a replica, not the source.
- Schema: 10 tables scoped by `user_id = auth.uid()` (RLS policies + touch triggers).
- Migration test: `tests/cloud-data-integration.test.js` + `tests/migration-runner.test.js` (required check `integration-contracts (forq-cloud-and-migrations)` covers the runner harness).
- Backup: Supabase project backups; per-user export via sync layer. Losing Supabase does not lose data while a device retains its IndexedDB primary.

### Noticed (mental-load-tracker) — Supabase authoritative

- Schema: single reviewed `schema.sql` plus the v1→v2 secure-households migration (code-based households → authenticated membership).
- RLS: `force row level security`, security-definer membership helpers, SHA-256 invitation tokens, no client DELETE on items.
- Tests: `tests/application.test.mjs` asserts RPC usage + policy text; `tests/security.integration.mjs` runs against live Supabase; `supabase/tests/governance.sql` for db tests.
- Backup: Supabase daily backups; per-household export still to add before data grows.
- Recovery: one-time `claim_legacy_household` bridge; afterwards membership is invitation-only.

### Daily Debate — Supabase authoritative

- Schema: five migrations (`001`–`005`), no squashed `schema.sql`.
- Gap: add a reviewed synthesis or verify via `supabase db diff`; add a security test mirroring Noticed/Revise.

### Habit — migrating from permissive to authenticated isolation

- History: single-user anon-key model with intentionally permissive RLS (documented in schema header).
- Now: `supabase/migrations/20260821000000_secure_habit_isolation.sql` introduces authenticated isolation, with `tests/rls.test.ts`, `tests/security.integration.mjs`, and `supabase/tests/habit_isolation.sql`.
- Action: re-verify RLS after applying; update the schema header that documents the old permissive stance; keep the JSON export path working through the migration.

## 3. How to verify a migration

```bash
# 1. Apply to a fresh project
supabase db reset --linked   # or apply schema.sql to an empty project

# 2. Run the security/integration tests
node --test apps/mental-load-tracker/tests/security.integration.mjs
npm --prefix apps/food-shopping-os test -- --run tests/cloud-data-integration.test.js

# 3. Spot-check RLS as a non-member (SQL editor, authenticated role)
select * from items;                  # expect 0 rows for non-member
select * from household_memberships;  # expect only own rows

# 4. Verify tokens are stored hashed
select token_hash from household_invitations;  # expect digest bytes, never raw
```

## 4. Checklists

**Adding a migration:**

- [ ] Uses `if not exists` / `create or replace` / `drop … if exists`
- [ ] Preserves or tightens constraints and RLS — never widens without a review note
- [ ] States whether it is destructive and how to recover
- [ ] A test asserts the new policy/constraint exists
- [ ] CODEOWNERS covers the path (`**/supabase/migrations/**` already does)

**For a user who loses access:**

- Revise: re-authenticate → re-sync pulls from Supabase; device remains primary.
- Noticed: re-invite via create/accept invitation RPCs.
- Habit: restore from Supabase backup or use in-app export/import; document self-serve export in the README.

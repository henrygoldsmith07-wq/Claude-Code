# Noticed

A shared board for the invisible labor of running a household. Log the
things you notice need doing — no categorizing, no assigning, no due date —
and see it side by side, once a week, with what your partner noticed and
what actually got resolved.

## Security model

Noticed uses Supabase Auth email/password accounts. A signed-in user can see
only households where `household_memberships.user_id = auth.uid()`; the
browser never authorizes access by household code, UUID, or local storage.

Household creation is an authenticated RPC that atomically creates the
household and its owner membership. Owners can create one-time invitation
links. Invitation tokens have 256 bits of entropy, are stored only as SHA-256
digests, expire after seven days, and can be revoked. Accepting an invitation
requires an authenticated account and creates a member row.

Items are protected by membership-derived RLS for select/insert/update; browser
deletion is deliberately disabled because Supabase Postgres Changes cannot
filter delete events by column. Their `household_id` and `created_by` values are immutable on update. The
Realtime publication is not treated as a security boundary: Supabase
evaluates the same RLS visibility for each Postgres Changes event, and the UI
also refreshes membership state so removal takes effect without relying on
client state.

## Setup

```bash
npm install
cp .env.example .env.local
```

1. Create a project at [supabase.com](https://supabase.com).
2. Enable email/password signups in Authentication → Providers. Keep email
   confirmation enabled in production.
3. For a new database, run `supabase/schema.sql` in the Supabase SQL editor
   or apply it through the Supabase CLI.
4. For an existing v1 database, run the same idempotent schema once during a
   maintenance window. It copies the old `households.code` into an internal
   `legacy_code` column, removes its `NOT NULL` requirement, and keeps old
   items in place. Each existing household must then be claimed once by an
   authenticated user through the “Migrate an existing household code” flow;
   the first claim creates the owner membership and permanently locks that
   legacy claim. New households never use a code.
5. Add the project URL and anon public key to `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

6. Enable Realtime for `public.items` in Database → Replication. Realtime is
   optional for correctness; the app polls every 20 seconds as a fallback.

```bash
npm run dev
```

## Verification

```bash
npm run lint
npm run type-check
npm run test:app
npm run test:db
npm run test:e2e
```

`test:db` runs the SQL security suite when the Supabase CLI is installed.
`test:security` runs the two-client Postgres/Realtime adversarial test when
`SUPABASE_TEST_URL`, `SUPABASE_TEST_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` point at a disposable project. Full E2E account
coverage additionally uses `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD`.

## Product scope

The weekly in-app view remains deliberately small: no scores, leaderboard,
notifications, or historical analytics. Authentication, membership,
invitation, and revocation exist only to make that shared board safe to use.

# Security Standard

Audit and enforcement for the monorepo. Prioritises actual vulnerabilities over theoretical hardening.

---

## 1. Inventory — what matters in this repo

| Surface | Where it lives | Current controls |
|---------|----------------|------------------|
| **Auth** | Supabase Auth (Revise, Daily Debate, Noticed, Habit), anon-key single-user (Habit legacy mode), local-first no-auth (Forq, Arise, French, Rapport, Reflect) | Supabase `auth.uid()` + RLS; local-first apps store on device only |
| **Authorisation / RLS / Tenancy** | `supabase/schema.sql` / `migrations/*.sql` per app | Revise: per-user `user_id = auth.uid()`; Noticed: household membership + RPC-only writes + hashed invitations; Habit: migration to authenticated isolation in progress (`20260821000000_secure_habit_isolation.sql`) |
| **Provider secrets** | `ANTHROPIC_API_KEY`, `OPENAI_COMPATIBLE_*`, `GROQ_API_KEY` | Server-side only; no SDK in the client bundle; keys never serialised into responses |
| **Public keys** | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Scoped by RLS; not a tenancy boundary on its own |
| **Uploads** | OCR image (Revise — base64 in POST, not persisted), past-paper text extraction | Size caps: image ≤8 MB base64, notes ≤20k chars, paper ≤60k chars; images not stored server-side |
| **External URLs** | User evidence URLs (Daily Debate), generated citations | `https:` only, length ≤600, no embedded credentials, private/link-local hosts rejected (`isPrivateHost`); no server-side fetch of arbitrary user URLs elsewhere |
| **SSRF** | Any server-side `fetch(url)` where `url` is user/model-supplied | Daily Debate retrieval validates scheme + host allow-lists + private-range rejection; Forq provider integrations use hostname allow-lists (`.openfoodfacts.org`); enforced by `scripts/security-audit.mjs` |
| **Rate limiting** | Per-app token buckets (Revise, Rapport, Daily Debate, Reflect, Forq API) | In-process per instance; `429` with `retry-after`. Not distributed — put a real limiter in front behind multiple instances |
| **Deletion** | Noticed: no client `DELETE` on items (intentional); Revise: user-scoped delete; local-first apps delete locally | Documented per app in [Migration & Backup](./migration-backup.md) |
| **Exports** | Reflect: encrypted export; Habit: export/import UI; Revise: local export/import | Recovery paths documented per app |
| **Logs** | Structured JSON lines (`AI_LOG=1`), route error logs | No sensitive content by construction (see [Observability](./observability.md)) |

---

## 2. Finding hierarchy

1. **Vulnerabilities that bypass tenancy (RLS)** — highest priority.
2. **Secrets in client bundle or logs** — must not happen.
3. **Unvalidated external-URL fetch (SSRF)** — must not happen.
4. **Missing rate limiting on AI/DB endpoints**.
5. **Hardening** (CSP, HSTS, cookie flags) — lowest unless an incident shows otherwise.

---

## 3. RLS verification

Every database-backed app must:

- Keep `supabase/schema.sql` (or `migrations/*.sql`) as the reviewed source of truth.
- Have a test that asserts RLS policies exist (`tests/security.integration.mjs`, `tests/rls.test.ts`).
- Verify RLS after any migration that touches policies or table grants.
- Never rely on anon-key privacy alone when a table holds cross-user data.

### Current RLS audit (2026-08-21)

| App | Schema | RLS | Gap |
|-----|--------|-----|-----|
| **Revise** | `supabase/schema.sql` (10 tables) | `user_id = auth.uid()` per table | ✅ |
| **Daily Debate** | `supabase/migrations/001–005` | Migrations present; no squashed schema | Add reviewed `schema.sql` synthesis |
| **Noticed** | `schema.sql` + secure-households migration | Membership-scoped, `force RLS`, hashed invitations, no client DELETE | ✅ |
| **Habit** | `schema.sql` + isolation migration | Historically permissive (`using true`); authenticated isolation landing | Re-verify after migration |
| **Rapport** | `migrations/0001_init.sql` | Single migration; review for user scoping | Add reviewed schema + security test |

---

## 4. Rate limiting

- Every AI route must call its rate limiter and return `429` with `retry-after`.
- Limits are coarse and in-process; they protect one instance from one client. They do not replace edge/WAF limiting for production.

Wired: Revise, Rapport, Daily Debate solo routes, Reflect reflect route (checked by `scripts/security-audit.mjs`).

---

## 5. Uploads & external URLs

- Cap payloads (8 MB base64 images; 20–60k chars text).
- Validate URL shape: `https:` only, length cap, no credentials, no private/link-local hosts.
- Never `fetch()` a user-supplied URL without an allow-list or private-range block.

---

## 6. Deletion / exports / logs

- Document what can be deleted and by whom.
- Document backup/export/recovery per app ([Migration & Backup](./migration-backup.md)).
- Logs must not contain user content — use `packages/observability` record types.

---

## 7. Dependency scanning

- No high-severity **production** vulnerability ships without triage.
- Weekly prod-only audit via `.github/workflows/security.yml` (advisory triage, not a hard block on dev-only warnings).
- Dependabot covers every app lockfile plus GitHub Actions.

---

## 8. How to verify

```bash
node scripts/security-audit.mjs     # static checks; also runs inside engineering-gates
node scripts/check-codeowners.mjs   # sensitive-surface ownership
```

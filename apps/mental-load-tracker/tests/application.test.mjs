import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function source(relativePath) {
  return readFile(path.join(appRoot, relativePath), "utf8");
}

test("the browser does not carry the old household-code authorization model", async () => {
  const [page, board, household, identity] = await Promise.all([
    source("src/app/page.tsx"),
    source("src/components/Board.tsx"),
    source("src/lib/household.ts"),
    readFile(path.join(appRoot, "src/lib/identity.ts"), "utf8").catch(() => ""),
  ]);

  assert.doesNotMatch(page, /useStoredIdentity|householdCode|joinCode/);
  assert.doesNotMatch(board, /household code|useStoredIdentity/iu);
  assert.doesNotMatch(household, /from\("households"\).*\.eq\("code"/su);
  assert.equal(identity, "", "the deleted local identity module must stay deleted");
});

test("item writes use server-side membership-aware RPCs", async () => {
  const items = await source("src/lib/items.ts");
  const schema = await source("supabase/schema.sql");

  assert.match(items, /rpc\("create_item"/);
  assert.match(items, /rpc\("set_item_resolved"/);
  assert.match(schema, /create policy "Members can read items"/);
  assert.match(schema, /where m\.household_id = items\.household_id/);
  assert.match(schema, /grant select, insert, update on public\.items to authenticated/);
  assert.doesNotMatch(schema, /grant select, insert, update, delete on public\.items/);
});

test("the client only receives a raw invitation token at creation time", async () => {
  const household = await source("src/lib/household.ts");
  const invitePanel = await source("src/components/InvitePanel.tsx");
  const schema = await source("supabase/schema.sql");

  assert.match(household, /create_household_invitation/);
  assert.match(invitePanel, /invite=.*encodeURIComponent/);
  assert.match(schema, /token_hash bytea not null unique/);
  assert.match(schema, /revoke all on public\.household_invitations from public, anon, authenticated/);
});

test("the canonical migration is byte-identical to schema.sql and stays idempotent", async () => {
  const [schema, migration] = await Promise.all([
    source("supabase/schema.sql"),
    source("supabase/migrations/20260820000000_secure_households.sql"),
  ]);

  assert.equal(
    migration,
    schema,
    "the migration must be a verbatim copy of the canonical schema",
  );
  for (const policy of [
    "Members can read households",
    "Members can read items",
    "Members can insert items",
    "Members can update items",
    "Users can read their memberships",
    "Household owners can read audit events",
  ]) {
    assert.ok(
      schema.includes(`drop policy if exists "${policy}"`),
      `re-applying the schema needs a drop guard for "${policy}"`,
    );
  }
  assert.match(schema, /create table if not exists/g);
});

test("the audit trail is write-protected and owner-readable only", async () => {
  const schema = await source("supabase/schema.sql");

  assert.match(schema, /create table if not exists public\.household_audit_events/);
  assert.match(
    schema,
    /alter table public\.household_audit_events force row level security/,
  );
  assert.match(schema, /create policy "Household owners can read audit events"/);
  // No INSERT policy exists and clients hold no INSERT grant, so events can
  // only come from the SECURITY DEFINER RPCs.
  assert.doesNotMatch(schema, /on public\.household_audit_events for insert/);
  assert.doesNotMatch(
    schema,
    /grant insert on public\.household_audit_events to authenticated/,
  );
  assert.match(
    schema,
    /revoke all on function public\.record_household_event\(uuid, text, uuid, uuid, jsonb\)/,
  );
  // Audit payloads are size-bounded so they cannot smuggle content.
  assert.match(schema, /household_audit_events_detail_size/);
});

test("membership lifecycle RPCs exist with least-privilege grants", async () => {
  const schema = await source("supabase/schema.sql");

  for (const fn of [
    "transfer_household_ownership(uuid, uuid)",
    "leave_household(uuid)",
    "delete_household(uuid)",
  ]) {
    assert.ok(schema.includes(`grant execute on function public.${fn} to authenticated`));
    assert.ok(
      schema.includes(`revoke all on function public.${fn} from public, anon, authenticated`),
    );
  }
  assert.match(schema, /'ownership_transferred'/);
  assert.match(schema, /'household_deleted'/);
});

test("abuse limits and idempotent writes are enforced server-side", async () => {
  const schema = await source("supabase/schema.sql");

  assert.match(schema, /rate limit exceeded: too many items created/);
  assert.match(schema, /invitation limit reached/);
  assert.match(schema, /please wait before creating another invitation/);
  assert.match(schema, /client_nonce uuid/);
  assert.match(schema, /items_creator_nonce_uidx/);
  assert.match(schema, /on conflict \(created_by, client_nonce\) where client_nonce is not null/);
  assert.match(schema, /item client_nonce is immutable/);
});

test("membership changes are published for realtime without weakening RLS", async () => {
  const schema = await source("supabase/schema.sql");

  assert.match(
    schema,
    /alter publication supabase_realtime add table public\.household_memberships;/,
  );
  assert.match(schema, /alter table public\.household_memberships replica identity full;/);
});

test("connection primitives converge state under duplicate, delayed, and out-of-order events", async () => {
  const connection = await import("../src/lib/connection.mjs");

  assert.equal(connection.shouldResubscribe("CHANNEL_ERROR"), true);
  assert.equal(connection.shouldResubscribe("TIMED_OUT"), true);
  assert.equal(connection.shouldResubscribe("SUBSCRIBED"), false);

  const backoffs = [0, 1, 2, 10].map((attempt) => connection.nextBackoffMs(attempt, 100, 5_000));
  assert.deepEqual(backoffs.map((ms) => ms >= 0 && ms <= 5_000), [true, true, true, true]);
  assert.ok(backoffs[3] >= backoffs[1], "backoff grows with attempts");

  assert.equal(connection.isRetryableWriteError("Fetch failed: network down"), true);
  assert.equal(connection.isRetryableWriteError("item text must be between 1 and 280"), false);

  const server = [
    { id: "b", created_at: "2026-01-02T00:00:00Z", text: "second" },
    { id: "a", created_at: "2026-01-01T00:00:00Z", text: "first" },
  ];
  const pending = [
    { nonce: "n1", text: "unsaved", createdAt: "2026-01-03T00:00:00Z", noticedBy: "A", color: "#6366f1" },
  ];
  const merged = connection.convergeItems(server, pending, new Set());
  assert.deepEqual(merged.map((item) => item.id), ["pending:n1", "b", "a"]);
  assert.equal(merged[0].pending, true);

  const confirmed = connection.convergeItems(server, pending, new Set(["n1"]));
  assert.deepEqual(confirmed.map((item) => item.id), ["b", "a"]);

  // Out-of-order arrival still converges to the same list.
  const shuffled = connection.convergeItems(
    [server[1], server[0]],
    [...pending].reverse(),
    new Set(),
  );
  assert.deepEqual(shuffled.map((item) => item.id), merged.map((item) => item.id));

  const coalescer = connection.createEventCoalescer(500);
  assert.equal(coalescer(1_000), true);
  assert.equal(coalescer(1_200), false, "duplicate events inside the window coalesce");
  assert.equal(coalescer(1_600), true);

  const sequence = connection.createSequenceTracker();
  assert.equal(sequence(1), "in-order");
  assert.equal(sequence(1), "duplicate");
  assert.equal(sequence(0), "out-of-order");
  assert.equal(sequence(2), "in-order");
});

test("diagnostics structurally cannot record user content", async () => {
  const { createDiagnostics } = await import("../src/lib/diagnostics.mjs");

  const lines = [];
  const diagnostics = createDiagnostics({
    sink: (line) => lines.push(JSON.parse(line)),
  });

  const recorded = diagnostics.record({
    class: "write-failure",
    context: "items:create",
    outcome: "queued",
    // Attempted content smuggling — every one of these must be dropped.
    text: "secret task contents",
    payload: { token: "invite-token-value" },
    message: "household name leak",
  });

  assert.ok(recorded);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].text, undefined);
  assert.equal(lines[0].payload, undefined);
  assert.equal(lines[0].message, undefined);
  assert.equal(lines[0].class, "write-failure");

  assert.equal(diagnostics.record({ context: "no-class" }), null);
  assert.equal(diagnostics.record({ class: "unknown-class", context: "x" }).class, "supabase-query-failure");

  assert.equal(diagnostics.isRlsDenial('new row violates row-level security policy'), true);
  assert.equal(diagnostics.isRlsDenial("not a household member"), true);
  assert.equal(diagnostics.isRlsDenial("network timeout"), false);

  diagnostics.record({ class: "rls-denied", context: "items:refresh" });
  assert.deepEqual(diagnostics.snapshot(), {
    "write-failure|items:create|queued": 1,
    "supabase-query-failure|x|": 1,
    "rls-denied|items:refresh|": 1,
  });
});

test("the board surfaces offline and unsynced states to the user", async () => {
  const board = await source("src/components/Board.tsx");
  const items = await source("src/lib/items.ts");

  assert.match(board, /role="status"/);
  assert.match(board, /waiting to sync/);
  assert.match(items, /flushPendingWrites/);
  assert.match(items, /p_client_nonce/);
  assert.match(items, /visibilitychange/);
  assert.match(items, /addEventListener\("online"/);
});

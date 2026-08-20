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

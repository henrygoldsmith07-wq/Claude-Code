import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_TEST_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.SUPABASE_TEST_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const canRun = Boolean(url && anonKey && serviceRoleKey);

function firstRow(data) {
  return Array.isArray(data) ? data[0] ?? null : data;
}

async function expectNoRows(query, message) {
  const { data, error } = await query;
  assert.ifError(error);
  assert.deepEqual(data, [], message);
}

function waitForSubscription(channel, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} did not subscribe`)), 8_000);
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(timer);
        resolve();
      } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
        clearTimeout(timer);
        reject(new Error(`${label} subscription status: ${status}`));
      }
    });
  });
}

test(
  "membership RLS blocks cross-household CRUD, UUID guessing, and Realtime leakage",
  { skip: !canRun ? "set SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY" : false },
  async (t) => {
    const admin = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const password = "Security-test-password-123!";
    const emailA = `noticed-rls-a-${suffix}@example.test`;
    const emailB = `noticed-rls-b-${suffix}@example.test`;
    let userA;
    let userB;
    let householdA;
    let householdB;
    let itemA;
    let itemB;
    const channels = [];
    let clientA;
    let clientB;

    t.after(async () => {
      for (const channel of channels) await channel.unsubscribe();
      if (householdA || householdB) {
        await admin.from("households").delete().in("id", [householdA, householdB].filter(Boolean));
      }
      if (userA) await admin.auth.admin.deleteUser(userA);
      if (userB) await admin.auth.admin.deleteUser(userB);
    });

    const createdA = await admin.auth.admin.createUser({ email: emailA, password, email_confirm: true });
    assert.ifError(createdA.error);
    userA = createdA.data.user.id;
    const createdB = await admin.auth.admin.createUser({ email: emailB, password, email_confirm: true });
    assert.ifError(createdB.error);
    userB = createdB.data.user.id;

    clientA = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
    clientB = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const signedInA = await clientA.auth.signInWithPassword({ email: emailA, password });
    const signedInB = await clientB.auth.signInWithPassword({ email: emailB, password });
    assert.ifError(signedInA.error);
    assert.ifError(signedInB.error);

    const createdHouseholdA = await clientA.rpc("create_household", {
      p_display_name: "User A",
      p_color: "#6366f1",
    });
    assert.ifError(createdHouseholdA.error);
    householdA = firstRow(createdHouseholdA.data).household_id;

    const createdHouseholdB = await clientB.rpc("create_household", {
      p_display_name: "User B",
      p_color: "#ec4899",
    });
    assert.ifError(createdHouseholdB.error);
    householdB = firstRow(createdHouseholdB.data).household_id;

    const invite = await clientA.rpc("create_household_invitation", { p_household_id: householdA });
    assert.ifError(invite.error);
    const inviteRow = firstRow(invite.data);
    assert.equal(inviteRow.token.length, 64);
    const joined = await clientB.rpc("accept_household_invitation", {
      p_token: inviteRow.token,
      p_display_name: "User B",
      p_color: "#ec4899",
    });
    assert.ifError(joined.error);

    const itemFromA = await clientA.rpc("create_item", {
      p_household_id: householdA,
      p_text: "Visible only to household A members",
    });
    assert.ifError(itemFromA.error);
    itemA = firstRow(itemFromA.data).id;

    const itemFromB = await clientB.rpc("create_item", {
      p_household_id: householdB,
      p_text: "Visible only to household B members",
    });
    assert.ifError(itemFromB.error);
    itemB = firstRow(itemFromB.data).id;

    await expectNoRows(
      clientA.from("items").select("*").eq("id", itemB),
      "A cannot read B by a known item UUID",
    );
    await expectNoRows(
      clientA.from("items").select("*").eq("id", "00000000-0000-0000-0000-000000000001"),
      "guessing another UUID returns no data",
    );

    const forbiddenInsert = await clientA.from("items").insert({
      household_id: householdB,
      text: "cross-household insert",
      noticed_by: "User A",
      noticed_by_color: "#6366f1",
    });
    assert.ok(forbiddenInsert.error, "A cannot insert into B");

    const forbiddenUpdate = await clientA
      .from("items")
      .update({ text: "cross-household update" })
      .eq("id", itemB)
      .select("id");
    assert.ifError(forbiddenUpdate.error);
    assert.deepEqual(forbiddenUpdate.data, [], "A cannot update B");

    const forbiddenDelete = await clientA.from("items").delete().eq("id", itemB).select("id");
    assert.ok(forbiddenDelete.error, "A cannot delete B");

    const tenantMove = await clientA
      .from("items")
      .update({ household_id: householdB })
      .eq("id", itemA)
      .select("id");
    assert.ok(tenantMove.error, "changing household_id is rejected");

    const events = [];
    const maliciousChannel = clientA
      .channel(`security-probe-b-${householdB}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "items", filter: `household_id=eq.${householdB}` },
        () => events.push("unexpected-b-event"),
      );
    channels.push(maliciousChannel);
    await waitForSubscription(maliciousChannel, "A's B probe");
    const bSecondItem = await clientB.rpc("create_item", {
      p_household_id: householdB,
      p_text: "Realtime probe for B",
    });
    assert.ifError(bSecondItem.error);
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    assert.deepEqual(events, [], "A cannot receive B's Realtime changes");

    const removedEvents = [];
    const memberChannel = clientB
      .channel(`security-probe-removed-${householdA}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "items", filter: `household_id=eq.${householdA}` },
        () => removedEvents.push("unexpected-removed-event"),
      );
    channels.push(memberChannel);
    await waitForSubscription(memberChannel, "B's member probe");

    const removed = await clientA.rpc("remove_household_member", {
      p_household_id: householdA,
      p_user_id: userB,
    });
    assert.ifError(removed.error);
    assert.equal(removed.data, true);

    await expectNoRows(
      clientB.from("items").select("*").eq("id", itemA),
      "removed members immediately lose item reads",
    );
    const removedUpdate = await clientB.from("items").update({ text: "removed" }).eq("id", itemA).select("id");
    assert.ifError(removedUpdate.error);
    assert.deepEqual(removedUpdate.data, [], "removed members cannot update");
    const removedDelete = await clientB.from("items").delete().eq("id", itemA).select("id");
    assert.ok(removedDelete.error, "removed members cannot delete");

    const newAItem = await clientA.rpc("create_item", {
      p_household_id: householdA,
      p_text: "Post-removal Realtime probe",
    });
    assert.ifError(newAItem.error);
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    assert.deepEqual(removedEvents, [], "removed members cannot receive later Realtime changes");
  },
);

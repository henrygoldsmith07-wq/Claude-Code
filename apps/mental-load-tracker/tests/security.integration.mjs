import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_TEST_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.SUPABASE_TEST_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const canRun = Boolean(url && anonKey && serviceRoleKey);
const skipReason = canRun
  ? false
  : "set SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY";

const PASSWORD = "Security-test-password-123!";

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

function waitForEvent(events, label, timeoutMs = 8_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const poll = setInterval(() => {
      if (events.length > 0) {
        clearInterval(poll);
        resolve();
      } else if (Date.now() > deadline) {
        clearInterval(poll);
        reject(new Error(`${label}: no realtime event arrived`));
      }
    }, 100);
  });
}

function anonymousClient() {
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function createSignedInUser(admin, suffix, label) {
  const email = `noticed-${label}-${suffix}@example.test`;
  const created = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  assert.ifError(created.error);
  const client = anonymousClient();
  const signedIn = await client.auth.signInWithPassword({ email, password: PASSWORD });
  assert.ifError(signedIn.error);
  return { userId: created.data.user.id, client };
}

test(
  "membership RLS blocks cross-household CRUD, UUID guessing, and Realtime leakage",
  { skip: skipReason },
  async (t) => {
    const admin = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

    const a = await createSignedInUser(admin, suffix, "rls-a");
    userA = a.userId;
    clientA = a.client;
    const b = await createSignedInUser(admin, suffix, "rls-b");
    userB = b.userId;
    clientB = b.client;

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
    await expectNoRows(
      clientA.from("households").select("*").eq("id", householdB),
      "A cannot read B's household row by its UUID",
    );
    await expectNoRows(
      clientA.from("household_memberships").select("*").eq("household_id", householdB),
      "A cannot enumerate B's members",
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

    const membershipAlteration = await clientA
      .from("household_memberships")
      .update({ role: "owner" })
      .eq("household_id", householdB)
      .eq("user_id", userB)
      .select("user_id");
    assert.ok(
      membershipAlteration.error || membershipAlteration.data.length === 0,
      "A cannot alter B's membership rows",
    );

    const selfPromotion = await clientA
      .from("household_memberships")
      .update({ role: "owner", household_id: householdB })
      .eq("user_id", userA)
      .select("household_id");
    assert.ok(
      selfPromotion.error || selfPromotion.data.length === 0,
      "A cannot move or promote its own membership into B",
    );

    const crossInvite = await clientA.rpc("create_household_invitation", {
      p_household_id: householdB,
    });
    assert.ok(crossInvite.error, "A cannot create invitations for B");

    const crossRemoval = await clientA.rpc("remove_household_member", {
      p_household_id: householdB,
      p_user_id: userB,
    });
    assert.ok(crossRemoval.error, "A cannot remove members from B");

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

test(
  "invitation lifecycle rejects revoked, reused, guessed, orphaned, and anonymous acceptance",
  { skip: skipReason },
  async (t) => {
    const admin = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const households = [];
    const users = [];

    t.after(async () => {
      if (households.length > 0) {
        await admin.from("households").delete().in("id", households);
      }
      for (const userId of users) await admin.auth.admin.deleteUser(userId).catch(() => {});
    });

    // Expiry behaviour is safe by construction.
    {
      const owner = await createSignedInUser(admin, suffix, "inv-expiry");
      users.push(owner.userId);
      const household = firstRow(
        (await owner.client.rpc("create_household", { p_display_name: "Expiry", p_color: "#6366f1" })).data,
      ).household_id;
      households.push(household);
      const invite = firstRow(
        (await owner.client.rpc("create_household_invitation", { p_household_id: household })).data,
      );
      const expiresInMs = new Date(invite.expires_at).getTime() - Date.now();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      assert.ok(
        expiresInMs > sevenDays - 5 * 60 * 1000 && expiresInMs <= sevenDays + 5 * 60 * 1000,
        "invitations expire in about seven days, never longer",
      );
    }

    // Revoked invitations stop working immediately.
    {
      const owner = await createSignedInUser(admin, suffix, "inv-revoked");
      users.push(owner.userId);
      const household = firstRow(
        (await owner.client.rpc("create_household", { p_display_name: "Revoke", p_color: "#6366f1" })).data,
      ).household_id;
      households.push(household);
      const invite = firstRow(
        (await owner.client.rpc("create_household_invitation", { p_household_id: household })).data,
      );
      const revoked = await owner.client.rpc("revoke_household_invitation", {
        p_household_id: household,
        p_invitation_id: invite.invitation_id,
      });
      assert.equal(revoked.data, true);

      const joiner = await createSignedInUser(admin, suffix, "inv-revoked-joiner");
      users.push(joiner.userId);
      const attempt = await joiner.client.rpc("accept_household_invitation", {
        p_token: invite.token,
        p_display_name: "Late",
        p_color: "#ec4899",
      });
      assert.ok(attempt.error, "a revoked invitation cannot be accepted");
    }

    // Double acceptance: the second use of the same token fails.
    {
      const owner = await createSignedInUser(admin, suffix, "inv-double");
      users.push(owner.userId);
      const household = firstRow(
        (await owner.client.rpc("create_household", { p_display_name: "Double", p_color: "#6366f1" })).data,
      ).household_id;
      households.push(household);
      const invite = firstRow(
        (await owner.client.rpc("create_household_invitation", { p_household_id: household })).data,
      );
      const first = await createSignedInUser(admin, suffix, "inv-double-first");
      users.push(first.userId);
      const accepted = await first.client.rpc("accept_household_invitation", {
        p_token: invite.token,
        p_display_name: "First",
        p_color: "#10b981",
      });
      assert.ifError(accepted.error);
      const second = await createSignedInUser(admin, suffix, "inv-double-second");
      users.push(second.userId);
      const rejected = await second.client.rpc("accept_household_invitation", {
        p_token: invite.token,
        p_display_name: "Second",
        p_color: "#ef4444",
      });
      assert.ok(rejected.error, "an already-used invitation cannot be accepted again");
    }

    // Simultaneous acceptance: exactly one concurrent call wins.
    {
      const owner = await createSignedInUser(admin, suffix, "inv-race");
      users.push(owner.userId);
      const household = firstRow(
        (await owner.client.rpc("create_household", { p_display_name: "Race", p_color: "#6366f1" })).data,
      ).household_id;
      households.push(household);
      const invite = firstRow(
        (await owner.client.rpc("create_household_invitation", { p_household_id: household })).data,
      );
      const contenderA = await createSignedInUser(admin, suffix, "inv-race-a");
      users.push(contenderA.userId);
      const contenderB = await createSignedInUser(admin, suffix, "inv-race-b");
      users.push(contenderB.userId);
      const attempts = await Promise.allSettled([
        contenderA.client.rpc("accept_household_invitation", {
          p_token: invite.token,
          p_display_name: "Racer A",
          p_color: "#0ea5e9",
        }),
        contenderB.client.rpc("accept_household_invitation", {
          p_token: invite.token,
          p_display_name: "Racer B",
          p_color: "#f59e0b",
        }),
      ]);
      const fulfilled = attempts.filter((r) => r.status === "fulfilled" && !r.value.error);
      assert.equal(fulfilled.length, 1, "exactly one simultaneous acceptance wins");
      const memberships = await admin
        .from("household_memberships")
        .select("user_id")
        .eq("household_id", household);
      assert.equal(memberships.data.length, 2, "the household gains only one new member");
    }

    // Guessed tokens and unauthenticated acceptance fail closed.
    {
      const guesser = await createSignedInUser(admin, suffix, "inv-guess");
      users.push(guesser.userId);
      const guessed =
        randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "").slice(0, 32);
      assert.equal(guessed.length, 64);
      const attempt = await guesser.client.rpc("accept_household_invitation", {
        p_token: guessed,
        p_display_name: "Guesser",
        p_color: "#6366f1",
      });
      assert.ok(attempt.error, "a guessed token is rejected");
      assert.match(
        attempt.error.message,
        /invalid, expired, already used, or revoked/,
        "rejections do not reveal why a token failed",
      );

      const anonymous = anonymousClient();
      const anonAttempt = await anonymous.rpc("accept_household_invitation", {
        p_token: guessed,
        p_display_name: "Anon",
        p_color: "#6366f1",
      });
      assert.ok(anonAttempt.error, "anonymous visitors cannot accept invitations");
    }

    // A deleted household invalidates its outstanding invitations.
    {
      const owner = await createSignedInUser(admin, suffix, "inv-deleted-hh");
      users.push(owner.userId);
      const household = firstRow(
        (await owner.client.rpc("create_household", { p_display_name: "Doomed", p_color: "#6366f1" })).data,
      ).household_id;
      const invite = firstRow(
        (await owner.client.rpc("create_household_invitation", { p_household_id: household })).data,
      );
      await admin.from("households").delete().eq("id", household);
      const joiner = await createSignedInUser(admin, suffix, "inv-deleted-hh-joiner");
      users.push(joiner.userId);
      const attempt = await joiner.client.rpc("accept_household_invitation", {
        p_token: invite.token,
        p_display_name: "Stranded",
        p_color: "#ec4899",
      });
      assert.ok(attempt.error, "invitations die with their household");
    }

    // Deleting the inviter cascades their outstanding invitations away.
    {
      const owner = await createSignedInUser(admin, suffix, "inv-gone-inviter");
      const household = firstRow(
        (await owner.client.rpc("create_household", { p_display_name: "Ghosted", p_color: "#6366f1" })).data,
      ).household_id;
      households.push(household);
      await owner.client.rpc("create_household_invitation", { p_household_id: household });
      await admin.auth.admin.deleteUser(owner.userId);
      const remaining = await admin
        .from("household_invitations")
        .select("id")
        .eq("household_id", household);
      assert.ifError(remaining.error);
      assert.equal(remaining.data.length, 0, "removing the inviter revokes their invitations");
    }
  },
);

test(
  "membership removal propagates over Realtime and boards converge after reconnects",
  { skip: skipReason },
  async (t) => {
    const admin = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    let household;
    const users = [];
    const channels = [];

    t.after(async () => {
      for (const channel of channels) await channel.unsubscribe().catch(() => {});
      if (household) await admin.from("households").delete().eq("id", household);
      for (const userId of users) await admin.auth.admin.deleteUser(userId).catch(() => {});
    });

    const owner = await createSignedInUser(admin, suffix, "rt-owner");
    users.push(owner.userId);
    household = firstRow(
      (await owner.client.rpc("create_household", { p_display_name: "Realtime", p_color: "#6366f1" })).data,
    ).household_id;

    const member = await createSignedInUser(admin, suffix, "rt-member");
    users.push(member.userId);
    const invite = firstRow(
      (await owner.client.rpc("create_household_invitation", { p_household_id: household })).data,
    );
    const joined = await member.client.rpc("accept_household_invitation", {
      p_token: invite.token,
      p_display_name: "Member",
      p_color: "#ec4899",
    });
    assert.ifError(joined.error);

    await member.client.rpc("create_item", {
      p_household_id: household,
      p_text: "before the drop",
      p_client_nonce: randomUUID(),
    });

    // Simulate a dropped websocket: writes continue server-side while the
    // subscriber is away, then the resubscribed channel catches up.
    const catchUpEvents = [];
    const itemsChannel = member.client
      .channel(`catchup-${household}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "items", filter: `household_id=eq.${household}` },
        (payload) => catchUpEvents.push(payload),
      );
    channels.push(itemsChannel);
    await waitForSubscription(itemsChannel, "member items channel");

    const missedWrite = await owner.client.rpc("create_item", {
      p_household_id: household,
      p_text: "written while the member was offline",
      p_client_nonce: randomUUID(),
    });
    assert.ifError(missedWrite.error);
    await waitForEvent(catchUpEvents, "resync after reconnect");
    const refreshed = await member.client
      .from("items")
      .select("id,text")
      .eq("household_id", household);
    assert.ifError(refreshed.error);
    assert.equal(refreshed.data.length, 2, "the board converges after a reconnect");

    // Duplicate retries converge on one row thanks to the idempotency nonce.
    const nonce = randomUUID();
    await member.client.rpc("create_item", {
      p_household_id: household,
      p_text: "retry me once",
      p_client_nonce: nonce,
    });
    const retry = await member.client.rpc("create_item", {
      p_household_id: household,
      p_text: "retry me once",
      p_client_nonce: nonce,
    });
    assert.ifError(retry.error);
    const deduped = await admin
      .from("items")
      .select("id")
      .eq("household_id", household)
      .eq("text", "retry me once");
    assert.equal(deduped.data.length, 1, "duplicate retries produce a single row");

    // Membership removal now arrives as a Realtime event, not just via polling.
    const membershipEvents = [];
    const membershipChannel = member.client
      .channel(`membership-${member.userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "household_memberships",
          filter: `user_id=eq.${member.userId}`,
        },
        (payload) => membershipEvents.push(payload),
      );
    channels.push(membershipChannel);
    await waitForSubscription(membershipChannel, "member membership channel");

    const removal = await owner.client.rpc("remove_household_member", {
      p_household_id: household,
      p_user_id: member.userId,
    });
    assert.ifError(removal.error);
    await waitForEvent(membershipEvents, "membership removal event");
    assert.ok(membershipEvents.length >= 1, "removal reaches the affected client live");
  },
);

test(
  "household lifecycle: leaving, ownership transfer, deletion cascades, and rate limits",
  { skip: skipReason },
  async (t) => {
    const admin = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const users = [];
    let household;

    t.after(async () => {
      if (household) {
        await admin.from("households").delete().eq("id", household).catch(() => {});
      }
      for (const userId of users) await admin.auth.admin.deleteUser(userId).catch(() => {});
    });

    const owner = await createSignedInUser(admin, suffix, "lc-owner");
    users.push(owner.userId);
    household = firstRow(
      (await owner.client.rpc("create_household", { p_display_name: "Lifecycle", p_color: "#6366f1" })).data,
    ).household_id;

    const member = await createSignedInUser(admin, suffix, "lc-member");
    users.push(member.userId);
    const invite = firstRow(
      (await owner.client.rpc("create_household_invitation", { p_household_id: household })).data,
    );
    const joined = await member.client.rpc("accept_household_invitation", {
      p_token: invite.token,
      p_display_name: "Leaver",
      p_color: "#ec4899",
    });
    assert.ifError(joined.error);

    // Members can leave on their own.
    const left = await member.client.rpc("leave_household", { p_household_id: household });
    assert.ifError(left.error);
    const afterLeave = await admin
      .from("household_memberships")
      .select("user_id")
      .eq("household_id", household)
      .eq("user_id", member.userId);
    assert.equal(afterLeave.data.length, 0, "leaving removes the membership row");

    // Rejoin for the transfer scenario. The invite cooldown from the first
    // join may still be running, so poll until it lifts (bounded).
    let reinvite = null;
    for (let waitedMs = 0; waitedMs <= 70_000 && !reinvite; waitedMs += 5_000) {
      if (waitedMs > 0) await new Promise((resolve) => setTimeout(resolve, 5_000));
      const attempt = await owner.client.rpc("create_household_invitation", {
        p_household_id: household,
      });
      if (!attempt.error && firstRow(attempt.data)) reinvite = firstRow(attempt.data);
    }
    assert.ok(reinvite, "owner can invite again after the cooldown");
    const rejoined = await member.client.rpc("accept_household_invitation", {
      p_token: reinvite.token,
      p_display_name: "Heir",
      p_color: "#0ea5e9",
    });
    assert.ifError(rejoined.error);

    // An owner with other members must transfer or delete before leaving.
    const blocked = await owner.client.rpc("leave_household", { p_household_id: household });
    assert.ok(blocked.error, "an owner with members cannot just leave");
    assert.match(blocked.error.message, /transfer|delete/i);

    // Transfer works and leaves exactly one owner.
    const transferred = await owner.client.rpc("transfer_household_ownership", {
      p_household_id: household,
      p_new_owner_user_id: member.userId,
    });
    assert.ifError(transferred.error);
    const ownersNow = await admin
      .from("household_memberships")
      .select("user_id")
      .eq("household_id", household)
      .eq("role", "owner");
    assert.deepEqual(
      ownersNow.data.map((row) => row.user_id),
      [member.userId],
      "exactly the recipient owns the household",
    );

    const formerOwnerLeft = await owner.client.rpc("leave_household", { p_household_id: household });
    assert.ifError(formerOwnerLeft.error);

    // The new owner deletes everything; dependent records cascade.
    await member.client.rpc("create_item", {
      p_household_id: household,
      p_text: "to be cascaded",
      p_client_nonce: randomUUID(),
    });
    const deletedHouseholdId = household;
    const deleted = await member.client.rpc("delete_household", { p_household_id: household });
    assert.ifError(deleted.error);
    household = null;
    const leftoverItems = await admin.from("items").select("id").eq("text", "to be cascaded");
    assert.equal(leftoverItems.data.length, 0, "deleting the household removes its items");
    const leftoverMemberships = await admin
      .from("household_memberships")
      .select("user_id")
      .eq("household_id", deletedHouseholdId);
    assert.equal(leftoverMemberships.data.length, 0, "deleting the household removes all memberships");

    // Audit history was purged with the household (privacy by deletion).
    const audit = await admin
      .from("household_audit_events")
      .select("id")
      .eq("detail->>reason", "deleted by owner");
    assert.equal(audit.data.length, 0, "audit rows do not outlive the deleted household");

    // Invite cooldown is enforced per household.
    {
      const cooldownOwner = await createSignedInUser(admin, suffix, "lc-cooldown");
      users.push(cooldownOwner.userId);
      const cooldownHousehold = firstRow(
        (
          await cooldownOwner.client.rpc("create_household", {
            p_display_name: "Cooldown",
            p_color: "#f59e0b",
          })
        ).data,
      ).household_id;
      await cooldownOwner.client.rpc("create_household_invitation", {
        p_household_id: cooldownHousehold,
      });
      const immediate = await cooldownOwner.client.rpc("create_household_invitation", {
        p_household_id: cooldownHousehold,
      });
      assert.match(String(immediate.error?.message ?? ""), /wait/i, "invite creation has a cooldown");
      await admin.from("households").delete().eq("id", cooldownHousehold);
    }

    // Idempotent retries with nonces, then the write throttle.
    {
      const writer = await createSignedInUser(admin, suffix, "lc-throttle");
      users.push(writer.userId);
      const throttleHousehold = firstRow(
        (
          await writer.client.rpc("create_household", {
            p_display_name: "Throttle",
            p_color: "#10b981",
          })
        ).data,
      ).household_id;
      const nonce = randomUUID();
      const firstWrite = await writer.client.rpc("create_item", {
        p_household_id: throttleHousehold,
        p_text: "flaky network retry probe",
        p_client_nonce: nonce,
      });
      assert.ifError(firstWrite.error);
      const duplicateWrite = await writer.client.rpc("create_item", {
        p_household_id: throttleHousehold,
        p_text: "flaky network retry probe",
        p_client_nonce: nonce,
      });
      assert.ifError(duplicateWrite.error);
      assert.equal(
        firstRow(firstWrite.data).id,
        firstRow(duplicateWrite.data).id,
        "a retried write returns the original row",
      );

      let throttled = null;
      for (let i = 0; i < 31 && !throttled; i += 1) {
        const result = await writer.client.rpc("create_item", {
          p_household_id: throttleHousehold,
          p_text: `burst ${i}`,
          p_client_nonce: randomUUID(),
        });
        if (result.error) throttled = result.error;
      }
      assert.match(String(throttled?.message ?? ""), /rate limit/i, "write bursts are throttled");
      await admin.from("households").delete().eq("id", throttleHousehold);
    }
  },
);

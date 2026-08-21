-- Governance coverage for Noticed: audit trail privacy, membership lifecycle,
-- abuse limits, deletion/orphan behaviour, and post-migration invariants.
-- Run with `supabase test db`.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(65);

select set_config('test.user_a', gen_random_uuid()::text, false);
select set_config('test.user_b', gen_random_uuid()::text, false);
select set_config('test.user_c', gen_random_uuid()::text, false);
select set_config('test.user_d', gen_random_uuid()::text, false);

do $$
declare
  v_h1 uuid;
  v_h2 uuid;
  v_h3 uuid;
  v_item_d uuid;
begin
  insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
  values
    (current_setting('test.user_a')::uuid, 'authenticated', 'authenticated', 'gov-a@example.test', '', now()),
    (current_setting('test.user_b')::uuid, 'authenticated', 'authenticated', 'gov-b@example.test', '', now()),
    (current_setting('test.user_c')::uuid, 'authenticated', 'authenticated', 'gov-c@example.test', '', now()),
    (current_setting('test.user_d')::uuid, 'authenticated', 'authenticated', 'gov-d@example.test', '', now());

  insert into public.households (name) values ('Governance one') returning id into v_h1;
  insert into public.households (name) values ('Governance two') returning id into v_h2;
  insert into public.households (name) values ('Governance three') returning id into v_h3;

  -- H1 starts with a single owner; B joins through an invitation in this file.
  insert into public.household_memberships (household_id, user_id, role, display_name, color)
  values
    (v_h1, current_setting('test.user_a')::uuid, 'owner', 'User A', '#6366f1'),
    (v_h2, current_setting('test.user_c')::uuid, 'owner', 'User C', '#0ea5e9'),
    (v_h3, current_setting('test.user_d')::uuid, 'owner', 'User D', '#10b981');

  insert into public.items (household_id, text, noticed_by, created_by)
  values (v_h3, 'D item', 'User D', current_setting('test.user_d')::uuid)
  returning id into v_item_d;

  perform set_config('test.h1', v_h1::text, false);
  perform set_config('test.h2', v_h2::text, false);
  perform set_config('test.item_d', v_item_d::text, false);
end
$$;

set local role authenticated;

---------------------------------------------------------------
-- Invite lifecycle and the audit trail
---------------------------------------------------------------

select set_config('request.jwt.claim.sub', current_setting('test.user_a'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('test.user_a'), 'role', 'authenticated')::text,
  true
);

select set_config(
  'test.t1',
  (select token from public.create_household_invitation(current_setting('test.h1')::uuid)),
  false
);

select is(
  length(current_setting('test.t1')),
  64,
  'invitation tokens carry 256 bits of entropy'
);

select is(
  (
    select count(*)
    from public.household_audit_events
    where household_id = current_setting('test.h1')::uuid
      and action = 'invite_created'
      and actor_user_id = current_setting('test.user_a')::uuid
  ),
  1::bigint,
  'creating an invitation is audited'
);

select throws_ok(
  format('select * from public.create_household_invitation(%L)', current_setting('test.h1')),
  'P0001',
  'please wait before creating another invitation',
  'invitation creation enforces a cooldown'
);

reset role;
update public.household_invitations
set created_at = created_at - interval '5 minutes'
where household_id = current_setting('test.h1')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.user_a'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.user_a'), 'role', 'authenticated')::text, true);

select set_config(
  'test.t2',
  (select token from public.create_household_invitation(current_setting('test.h1')::uuid)),
  false
);

select is(length(current_setting('test.t2')), 64, 'the cooldown lifts after it passes');

reset role;
set local role postgres;
select set_config('request.jwt.claim.sub', current_setting('test.user_a'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.user_a'), 'role', 'authenticated')::text, true);

select throws_ok(
  format(
    'do $$ begin
       for i in 1..4 loop
         update public.household_invitations
           set created_at = created_at - interval ''5 minutes''
           where household_id = %L;
         perform public.create_household_invitation(%L);
       end loop;
     end $$;',
    current_setting('test.h1'), current_setting('test.h1')
  ),
  'P0001',
  'invitation limit reached: revoke an active invitation first',
  'households cannot accumulate unlimited pending invitations'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.user_b'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.user_b'), 'role', 'authenticated')::text, true);

select is(
  (
    select household_id
    from public.accept_household_invitation(current_setting('test.t2'), 'User B', '#ec4899')
  ),
  current_setting('test.h1')::uuid,
  'an invited user joins the household'
);

select is(
  (
    select count(*)
    from public.household_audit_events
    where household_id = current_setting('test.h1')::uuid
      and action = 'member_joined'
      and target_user_id = current_setting('test.user_b')::uuid
  ),
  1::bigint,
  'joining through an invitation is audited'
);

select is(
  (
    select count(*)
    from public.household_audit_events
    where household_id = current_setting('test.h1')::uuid
      and action = 'invite_accepted'
      and target_user_id = current_setting('test.user_b')::uuid
  ),
  1::bigint,
  'invitation acceptance is audited'
);

select throws_ok(
  format(
    'select * from public.accept_household_invitation(%L, ''User B'', ''#ec4899'')',
    current_setting('test.t2')
  ),
  null,
  null,
  'a used invitation cannot be accepted twice'
);

select is(
  (select count(*) from public.household_audit_events),
  0::bigint,
  'non-owner members cannot read the audit trail'
);

select throws_ok(
  format(
    'insert into public.household_audit_events (household_id, action) values (%L, ''member_joined'')',
    current_setting('test.h1')
  ),
  '42501',
  null,
  'clients cannot forge audit events'
);

---------------------------------------------------------------
-- Removal, transfer, leaving
---------------------------------------------------------------

select set_config('request.jwt.claim.sub', current_setting('test.user_a'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.user_a'), 'role', 'authenticated')::text, true);

select is(
  public.remove_household_member(
    current_setting('test.h1')::uuid,
    current_setting('test.user_b')::uuid
  ),
  true,
  'owners can remove members'
);

select is(
  (
    select count(*)
    from public.household_audit_events
    where action = 'member_removed'
      and actor_user_id = current_setting('test.user_a')::uuid
      and target_user_id = current_setting('test.user_b')::uuid
  ),
  1::bigint,
  'member removal is audited'
);

select set_config('request.jwt.claim.sub', current_setting('test.user_b'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.user_b'), 'role', 'authenticated')::text, true);

select throws_ok(
  format('select public.leave_household(%L)', current_setting('test.h1')),
  '42501',
  'not a household member',
  'removed members cannot use the leave path retroactively'
);

reset role;
update public.household_invitations
set created_at = created_at - interval '5 minutes'
where household_id = current_setting('test.h1')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.user_a'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.user_a'), 'role', 'authenticated')::text, true);

select set_config(
  'test.t3',
  (select token from public.create_household_invitation(current_setting('test.h1')::uuid)),
  false
);

select set_config('request.jwt.claim.sub', current_setting('test.user_b'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.user_b'), 'role', 'authenticated')::text, true);

select is(
  (
    select household_id
    from public.accept_household_invitation(current_setting('test.t3'), 'User B', '#ec4899')
  ),
  current_setting('test.h1')::uuid,
  'a removed member can be invited again'
);

select public.create_item(current_setting('test.h1')::uuid, 'cascade probe');

select set_config('request.jwt.claim.sub', current_setting('test.user_a'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.user_a'), 'role', 'authenticated')::text, true);

select is(
  public.transfer_household_ownership(
    current_setting('test.h1')::uuid,
    current_setting('test.user_b')::uuid
  ),
  true,
  'owners can transfer ownership to a member'
);

select is(
  (
    select count(*)
    from public.household_memberships
    where household_id = current_setting('test.h1')::uuid
      and role = 'owner'
      and user_id = current_setting('test.user_b')::uuid
  ),
  1::bigint,
  'the recipient becomes the single owner'
);

select is(
  (
    select count(*)
    from public.household_memberships
    where household_id = current_setting('test.h1')::uuid
      and role = 'owner'
  ),
  1::bigint,
  'transfers preserve the one-owner invariant'
);

select is(
  (
    select count(*)
    from public.household_audit_events
    where action = 'role_changed'
      and target_user_id = current_setting('test.user_b')::uuid
      and detail ->> 'to' = 'owner'
  ),
  1::bigint,
  'role promotion is audited'
);

select is(
  (
    select count(*)
    from public.household_audit_events
    where action = 'ownership_transferred'
      and target_user_id = current_setting('test.user_b')::uuid
  ),
  1::bigint,
  'ownership changes are audited'
);

select is(
  public.leave_household(current_setting('test.h1')::uuid),
  true,
  'a demoted former owner can leave'
);

select is(
  (
    select count(*)
    from public.household_memberships
    where household_id = current_setting('test.h1')::uuid
      and user_id = current_setting('test.user_a')::uuid
  ),
  0::bigint,
  'leaving removes the membership row'
);

select is(
  (
    select count(*)
    from public.household_audit_events
    where action = 'member_removed'
      and target_user_id = current_setting('test.user_a')::uuid
      and detail ->> 'how' = 'left'
  ),
  1::bigint,
  'leaving voluntarily is audited'
);

select set_config('request.jwt.claim.sub', current_setting('test.user_b'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.user_b'), 'role', 'authenticated')::text, true);

select throws_ok(
  format(
    'select public.transfer_household_ownership(%L, %L)',
    current_setting('test.h1'), current_setting('test.user_c')
  ),
  'P0001',
  'ownership transfer requires an existing member',
  'ownership cannot be handed to a non-member'
);

---------------------------------------------------------------
-- Abuse limits
---------------------------------------------------------------

select throws_ok(
  format(
    'do $$ begin
       for i in 1..31 loop
         perform public.create_item(%L, ''throttle '' || i);
       end loop;
     end $$;',
    current_setting('test.h1')
  ),
  'P0001',
  'rate limit exceeded: too many items created',
  'item creation is throttled per account (one durable item already exists)'
);

---------------------------------------------------------------
-- Household deletion and orphans
---------------------------------------------------------------

select is(
  public.delete_household(current_setting('test.h1')::uuid),
  true,
  'the owner can delete the household'
);

select is(
  (select count(*) from public.items where household_id = current_setting('test.h1')::uuid),
  0::bigint,
  'deleting the household removes its items'
);

select is(
  (
    select count(*)
    from public.household_memberships
    where household_id = current_setting('test.h1')::uuid
  ),
  0::bigint,
  'deleting the household removes its memberships'
);

select is(
  (
    select count(*)
    from public.household_invitations
    where household_id = current_setting('test.h1')::uuid
  ),
  0::bigint,
  'deleting the household removes its invitations'
);

select is(
  (
    select count(*)
    from public.household_audit_events
    where household_id = current_setting('test.h1')::uuid
  ),
  0::bigint,
  'deleting the household purges its audit history instead of leaking tenant metadata'
);

select throws_ok(
  'select public.delete_household(''00000000-0000-0000-0000-000000000009''::uuid)',
  '42501',
  null,
  'guessed household identifiers cannot be deleted'
);

---------------------------------------------------------------
-- Removed inviter cascade and account deletion orphans
---------------------------------------------------------------

select set_config('request.jwt.claim.sub', current_setting('test.user_c'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.user_c'), 'role', 'authenticated')::text, true);

select is(
  length(
    (
      select token
      from public.create_household_invitation(current_setting('test.h2')::uuid)
    )
  ),
  64,
  'another owner can create an invitation'
);

reset role;
delete from auth.users where id = current_setting('test.user_c')::uuid;

select is(
  (
    select count(*)
    from public.household_invitations
    where household_id = current_setting('test.h2')::uuid
  ),
  0::bigint,
  'deleting the inviter revokes their outstanding invitations'
);

delete from auth.users where id = current_setting('test.user_d')::uuid;

select is(
  (
    select count(*)
    from public.items
    where id = current_setting('test.item_d')::uuid
  ),
  1::bigint,
  'account deletion keeps household items'
);

select is(
  (
    select created_by
    from public.items
    where id = current_setting('test.item_d')::uuid
  ),
  null,
  'deleted accounts are detached from items rather than orphaning them'
);

select is(
  (
    select count(*)
    from public.household_memberships
    where user_id in (current_setting('test.user_c')::uuid, current_setting('test.user_d')::uuid)
  ),
  0::bigint,
  'account deletion removes memberships'
);

---------------------------------------------------------------
-- Migration quality invariants
---------------------------------------------------------------

select is(
  (
    select bool_and(relrowsecurity and relforcerowsecurity)
    from pg_class
    where oid in (
      'public.households'::regclass,
      'public.household_memberships'::regclass,
      'public.household_invitations'::regclass,
      'public.items'::regclass,
      'public.household_audit_events'::regclass
    )
  ),
  true,
  'every tenant table keeps RLS enabled and forced'
);

select is(
  (select relreplident from pg_class where oid = 'public.items'::regclass)::text,
  'f',
  'items use full replica identity for reliable Realtime payloads'
);

select is(
  (select relreplident from pg_class where oid = 'public.household_memberships'::regclass)::text,
  'f',
  'memberships use full replica identity so removals propagate'
);

select is(
  (
    select count(*)
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename in ('items', 'household_memberships')
  ),
  2::bigint,
  'items and memberships are both published behind RLS'
);

select is(
  to_regclass('public.items_creator_nonce_uidx') is not null
    and to_regclass('public.items_creator_created_at_idx') is not null
    and to_regclass('public.household_memberships_one_owner_uidx') is not null
    and to_regclass('public.household_invitations_pending_idx') is not null
    and to_regclass('public.households_legacy_code_uidx') is not null
    and to_regclass('public.household_audit_events_household_idx') is not null,
  true,
  'security- and performance-critical indexes exist'
);

select is(
  (
    select count(*)
    from public.items i
    left join public.households h on h.id = i.household_id
    where h.id is null
  ),
  0::bigint,
  'no orphaned items exist'
);

select is(
  (
    select count(*)
    from public.household_memberships m
    left join public.households h on h.id = m.household_id
    where h.id is null
  ),
  0::bigint,
  'no orphaned memberships exist'
);

select is(
  (
    select count(*)
    from public.household_invitations i
    left join public.households h on h.id = i.household_id
    where h.id is null
  ),
  0::bigint,
  'no orphaned invitations exist'
);

select is(
  has_table_privilege('anon', 'public.households', 'SELECT')
    or has_table_privilege('anon', 'public.household_memberships', 'SELECT')
    or has_table_privilege('anon', 'public.household_invitations', 'SELECT')
    or has_table_privilege('anon', 'public.items', 'SELECT')
    or has_table_privilege('anon', 'public.household_audit_events', 'SELECT'),
  false,
  'anonymous roles hold no table privileges'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.create_item(uuid, text, uuid)',
    'EXECUTE'
  ),
  true,
  'authenticated users can execute the item RPC'
);

select is(
  has_function_privilege('anon', 'public.create_item(uuid, text, uuid)', 'EXECUTE'),
  false,
  'anonymous users cannot execute the item RPC'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.record_household_event(uuid, text, uuid, uuid, jsonb)',
    'EXECUTE'
  ),
  false,
  'the audit recorder stays private'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public' and tablename = 'items'
  ),
  3::bigint,
  'items expose exactly the three membership-scoped policies'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public' and tablename = 'household_audit_events'
  ),
  1::bigint,
  'audit events expose a single owner-only read policy'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public' and tablename = 'household_invitations'
  ),
  0::bigint,
  'invitations remain fully function-gated with no table policies'
);

select * from finish();
rollback;

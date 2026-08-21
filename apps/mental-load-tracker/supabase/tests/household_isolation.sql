-- Adversarial RLS coverage for Noticed.
-- Run with `supabase test db` against a Supabase local project or a disposable
-- test project. The test role must be able to create rows in auth.users.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(33);

select set_config('test.user_a', gen_random_uuid()::text, false);
select set_config('test.user_b', gen_random_uuid()::text, false);

do $$
declare
  v_household_a uuid;
  v_household_b uuid;
  v_item_a uuid;
  v_item_b uuid;
begin
  insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
  values
    (current_setting('test.user_a')::uuid, 'authenticated', 'authenticated', 'rls-a@example.test', '', now()),
    (current_setting('test.user_b')::uuid, 'authenticated', 'authenticated', 'rls-b@example.test', '', now());

  insert into public.households (name) values ('A household') returning id into v_household_a;
  insert into public.households (name) values ('B household') returning id into v_household_b;

  insert into public.household_memberships (household_id, user_id, role, display_name, color)
  values
    (v_household_a, current_setting('test.user_a')::uuid, 'owner', 'User A', '#6366f1'),
    (v_household_a, current_setting('test.user_b')::uuid, 'member', 'User B', '#ec4899'),
    (v_household_b, current_setting('test.user_b')::uuid, 'owner', 'User B', '#ec4899');

  insert into public.items (household_id, text, noticed_by, created_by)
  values (v_household_a, 'A item', 'User A', current_setting('test.user_a')::uuid)
  returning id into v_item_a;

  insert into public.items (household_id, text, noticed_by, created_by)
  values (v_household_b, 'B item', 'User B', current_setting('test.user_b')::uuid)
  returning id into v_item_b;

  -- Expired invitation with a known token (all ones).
  insert into public.household_invitations (
    household_id, invited_by, token_hash, expires_at
  ) values (
    v_household_a,
    current_setting('test.user_a')::uuid,
    digest(repeat('1', 64), 'sha256'),
    now() - interval '1 hour'
  );

  -- Valid invitation with a known token (all twos) for the double-acceptance test.
  insert into public.household_invitations (
    household_id, invited_by, token_hash, expires_at
  ) values (
    v_household_a,
    current_setting('test.user_a')::uuid,
    digest(repeat('2', 64), 'sha256'),
    now() + interval '7 days'
  );

  perform set_config('test.household_a', v_household_a::text, false);
  perform set_config('test.household_b', v_household_b::text, false);
  perform set_config('test.item_a', v_item_a::text, false);
  perform set_config('test.item_b', v_item_b::text, false);
end
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.user_a'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('test.user_a'), 'role', 'authenticated')::text,
  true
);

select is(
  (select count(*) from public.households where id = current_setting('test.household_b')::uuid),
  0::bigint,
  'user A cannot read household B'
);

select is(
  (select count(*) from public.items where household_id = current_setting('test.household_b')::uuid),
  0::bigint,
  'user A cannot read household B items'
);

select throws_ok(
  format(
    'insert into public.items (household_id, text, noticed_by) values (%L, %L, %L)',
    current_setting('test.household_b'), 'forbidden insert', 'User A'
  ),
  '42501',
  'new row violates row-level security policy for table "items"',
  'user A cannot insert a household B item'
);

select is(
  (with changed as (
    update public.items set text = 'forbidden update'
    where id = current_setting('test.item_b')::uuid
    returning id
  ) select count(*) from changed),
  0::bigint,
  'user A cannot update a household B item'
);

select throws_ok(
  format(
    'delete from public.items where id = %L',
    current_setting('test.item_b')
  ),
  '42501',
  null,
  'user A cannot delete a household B item'
);

select is(
  (select count(*) from public.items where id = '00000000-0000-0000-0000-000000000001'::uuid),
  0::bigint,
  'guessing an item UUID does not grant access'
);

select is(
  (select count(*) from public.households where id = '00000000-0000-0000-0000-000000000002'::uuid),
  0::bigint,
  'guessing a household UUID does not grant access'
);

select is(
  (
    select count(*)
    from public.household_memberships
    where household_id = current_setting('test.household_b')::uuid
  ),
  0::bigint,
  'user A cannot enumerate household B members'
);

select throws_ok(
  format(
    'update public.household_memberships set role = ''owner'' where household_id = %L',
    current_setting('test.household_b')
  ),
  '42501',
  null,
  'user A cannot alter household B memberships'
);

select throws_ok(
  format(
    'insert into public.household_memberships (household_id, user_id, role, display_name, color) values (%L, %L, ''member'', ''Intruder'', ''#6366f1'')',
    current_setting('test.household_b'), current_setting('test.user_a')
  ),
  '42501',
  null,
  'user A cannot insert itself into household B'
);

select throws_ok(
  format(
    'select * from public.create_household_invitation(%L)',
    current_setting('test.household_b')
  ),
  '42501',
  null,
  'a non-owner cannot create invitations for household B'
);

select throws_ok(
  format(
    'select public.remove_household_member(%L, %L)',
    current_setting('test.household_b'), current_setting('test.user_b')
  ),
  '42501',
  null,
  'user A cannot remove members from household B'
);

select throws_ok(
  format(
    'update public.items set household_id = %L where id = %L',
    current_setting('test.household_b'), current_setting('test.item_a')
  ),
  '42501',
  'new row violates row-level security policy for table "items"',
  'changing household_id manually cannot bypass RLS'
);

select is(
  (select household_id from public.items where id = current_setting('test.item_a')::uuid),
  current_setting('test.household_a')::uuid,
  'a failed tenant move leaves the item in its original household'
);

select set_config('request.jwt.claim.sub', current_setting('test.user_b'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.user_b'), 'role', 'authenticated')::text, true);

select is(
  (select count(*) from public.items where id = current_setting('test.item_a')::uuid),
  1::bigint,
  'a current member can read the shared household item'
);

select set_config('request.jwt.claim.sub', current_setting('test.user_a'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.user_a'), 'role', 'authenticated')::text, true);

select set_config(
  'test.invite_first',
  (
    select invitation_id::text || '|' || token
    from public.create_household_invitation(current_setting('test.household_a')::uuid)
  ),
  false
);

do $$
begin
  perform set_config(
    'test.invitation_id',
    split_part(current_setting('test.invite_first'), '|', 1),
    false
  );
  perform set_config(
    'test.revoked_token',
    split_part(current_setting('test.invite_first'), '|', 2),
    false
  );
end
$$;

select is(
  length(current_setting('test.revoked_token')),
  64,
  'owner invitations return a high-entropy token'
);

select is(
  public.revoke_household_invitation(
    current_setting('test.household_a')::uuid,
    current_setting('test.invitation_id')::uuid
  ),
  true,
  'owners can revoke pending invitations'
);

select throws_ok(
  format(
    'select * from public.household_invitations where household_id = %L',
    current_setting('test.household_a')
  ),
  '42501',
  null,
  'invitation token hashes are not directly readable by clients'
);

select set_config('request.jwt.claim.sub', current_setting('test.user_b'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.user_b'), 'role', 'authenticated')::text, true);

select throws_ok(
  'select * from public.accept_household_invitation(repeat(''0'', 64), ''User B'', ''#ec4899'')',
  null,
  null,
  'invalid or revoked invitations cannot be accepted'
);

select throws_ok(
  'select * from public.accept_household_invitation(repeat(''1'', 64), ''User B'', ''#ec4899'')',
  null,
  null,
  'expired invitations cannot be accepted'
);

select throws_ok(
  format(
    'select * from public.accept_household_invitation(%L, ''User B'', ''#ec4899'')',
    current_setting('test.revoked_token')
  ),
  null,
  null,
  'revoked invitations cannot be accepted'
);

select is(
  (
    select household_id
    from public.accept_household_invitation(repeat('2', 64), 'User B', '#ec4899')
  ),
  current_setting('test.household_a')::uuid,
  'a valid invitation is accepted exactly once'
);

select throws_ok(
  'select * from public.accept_household_invitation(repeat(''2'', 64), ''User B'', ''#ec4899'')',
  null,
  null,
  'double acceptance is refused'
);

select set_config('request.jwt.claim.sub', current_setting('test.user_a'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.user_a'), 'role', 'authenticated')::text, true);

select is(
  public.remove_household_member(
    current_setting('test.household_a')::uuid,
    current_setting('test.user_b')::uuid
  ),
  true,
  'owners can remove a member'
);

select set_config('request.jwt.claim.sub', current_setting('test.user_b'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.user_b'), 'role', 'authenticated')::text, true);

select is(
  (select count(*) from public.households where id = current_setting('test.household_a')::uuid),
  0::bigint,
  'removed members immediately lose household reads'
);

select is(
  (select count(*) from public.items where id = current_setting('test.item_a')::uuid),
  0::bigint,
  'removed members immediately lose item reads'
);

select is(
  (with changed as (
    update public.items set text = 'removed update'
    where id = current_setting('test.item_a')::uuid
    returning id
  ) select count(*) from changed),
  0::bigint,
  'removed members cannot update existing items'
);

select throws_ok(
  format(
    'delete from public.items where id = %L',
    current_setting('test.item_a')
  ),
  '42501',
  null,
  'removed members cannot delete existing items'
);

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is(
  (select count(*) from public.households),
  0::bigint,
  'anonymous users cannot enumerate households'
);

select throws_ok(
  'insert into public.households (name) values (''anonymous'')',
  '42501',
  null,
  'anonymous users cannot create households'
);

select throws_ok(
  'select * from public.accept_household_invitation(repeat(''3'', 64), ''Anon'', ''#6366f1'')',
  '42501',
  null,
  'anonymous visitors cannot accept invitations'
);

reset role;
set local role authenticated;
select is(
  (select relrowsecurity from pg_class where oid = 'public.items'::regclass),
  true,
  'items keep RLS enabled for Realtime filtering'
);

select is(
  (select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'items'),
  1::bigint,
  'items are in the Realtime publication behind RLS'
);

select * from finish();
rollback;

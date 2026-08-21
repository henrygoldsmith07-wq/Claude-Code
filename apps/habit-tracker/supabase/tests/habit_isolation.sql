-- Adversarial RLS coverage for Habit (authenticated per-user isolation).
-- Run with `supabase test db` or psql against a disposable project.
-- Mirrors mental-load-tracker household_isolation.sql but for per-user habits.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(24);

select set_config('test.user_a', gen_random_uuid()::text, false);
select set_config('test.user_b', gen_random_uuid()::text, false);

do $$
declare
  v_habit_a uuid;
  v_habit_b uuid;
  v_checkin_a uuid;
  v_checkin_b uuid;
begin
  insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
  values
    (current_setting('test.user_a')::uuid, 'authenticated', 'authenticated', 'habit-rls-a@example.test', crypt('pass', gen_salt('bf')), now()),
    (current_setting('test.user_b')::uuid, 'authenticated', 'authenticated', 'habit-rls-b@example.test', crypt('pass', gen_salt('bf')), now());

  insert into public.habits (id, user_id, name, target_per_week, colour, sort_order)
  values (gen_random_uuid(), current_setting('test.user_a')::uuid, 'A habit', 3, '#6366f1', 0)
  returning id into v_habit_a;

  insert into public.habits (id, user_id, name, target_per_week, colour, sort_order)
  values (gen_random_uuid(), current_setting('test.user_b')::uuid, 'B habit', 3, '#ec4899', 0)
  returning id into v_habit_b;

  insert into public.checkins (habit_id, day, completed)
  values (v_habit_a, '2025-06-10', true)
  returning id into v_checkin_a;

  insert into public.checkins (habit_id, day, completed)
  values (v_habit_b, '2025-06-11', true)
  returning id into v_checkin_b;

  perform set_config('test.habit_a', v_habit_a::text, false);
  perform set_config('test.habit_b', v_habit_b::text, false);
  perform set_config('test.checkin_a', v_checkin_a::text, false);
  perform set_config('test.checkin_b', v_checkin_b::text, false);
end
$$;

-- Authenticated as User A
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.user_a'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.user_a'), 'role', 'authenticated')::text, true);

select is(
  (select count(*) from public.habits where id = current_setting('test.habit_b')::uuid),
  0::bigint,
  'user A cannot read habit B'
);
select is(
  (select count(*) from public.habits),
  1::bigint,
  'user A sees only own habits'
);
select is(
  (select count(*) from public.checkins where habit_id = current_setting('test.habit_b')::uuid),
  0::bigint,
  'user A cannot read B check-ins'
);
select is(
  (select count(*) from public.checkins where habit_id = current_setting('test.habit_a')::uuid),
  1::bigint,
  'user A can read own check-ins'
);

select throws_ok(
  format('insert into public.checkins (habit_id, day, completed) values (%L, %L, true)', current_setting('test.habit_b'), '2025-06-12'),
  '42501',
  'new row violates row-level security policy for table "checkins"',
  'user A cannot create check-ins for B habits (guessed habit_id)'
);

select is(
  (with changed as (
    update public.habits set name = 'hacked'
    where id = current_setting('test.habit_b')::uuid
    returning id
  ) select count(*) from changed),
  0::bigint,
  'user A cannot update B habit'
);

select is(
  (with changed as (
    update public.checkins set completed = false
    where id = current_setting('test.checkin_b')::uuid
    returning id
  ) select count(*) from changed),
  0::bigint,
  'user A cannot update B check-in'
);

select throws_ok(
  format('delete from public.habits where id = %L', current_setting('test.habit_b')),
  '42501',
  null,
  'user A cannot delete B habit'
);

select throws_ok(
  format('delete from public.checkins where id = %L', current_setting('test.checkin_b')),
  '42501',
  null,
  'user A cannot delete B check-in'
);

select is(
  (select count(*) from public.habits where id = '00000000-0000-0000-0000-000000000001'::uuid),
  0::bigint,
  'guessing a habit UUID does not grant access'
);

select throws_ok(
  format('update public.habits set user_id = %L where id = %L', current_setting('test.user_b'), current_setting('test.habit_a')),
  '23514',
  'habit user_id is immutable',
  'changing habit user_id is rejected'
);

select throws_ok(
  format('update public.checkins set habit_id = %L where id = %L', current_setting('test.habit_b'), current_setting('test.checkin_a')),
  '23514',
  'checkin habit_id is immutable',
  'moving a check-in to another habit is rejected'
);

select is(
  (select user_id from public.habits where id = current_setting('test.habit_a')::uuid),
  current_setting('test.user_a')::uuid,
  'failed owner change leaves habit owned by A'
);

-- Filtering/inference check: B's data does not leak via filtered selects
select is(
  (select count(*) from public.habits where id = current_setting('test.habit_b')::uuid and name = 'B habit'),
  0::bigint,
  'user A cannot infer B rows through filters'
);

-- As User B can read own
select set_config('request.jwt.claim.sub', current_setting('test.user_b'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.user_b'), 'role', 'authenticated')::text, true);
select is(
  (select count(*) from public.habits where id = current_setting('test.habit_b')::uuid),
  1::bigint,
  'user B can read own habit'
);

-- Anonymous blocked
reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is(
  (select count(*) from public.habits),
  0::bigint,
  'anonymous cannot list habits'
);
select is(
  (select count(*) from public.checkins),
  0::bigint,
  'anonymous cannot list check-ins'
);
select throws_ok(
  'insert into public.habits (name, target_per_week) values (''anon'', 3)',
  '42501',
  null,
  'anonymous cannot insert habits'
);
select throws_ok(
  'insert into public.checkins (habit_id, day) values (''00000000-0000-0000-0000-000000000001'', ''2025-06-10'')',
  '42501',
  null,
  'anonymous cannot insert check-ins'
);

-- RLS remains enabled
reset role;
set local role authenticated;
select is(
  (select relrowsecurity from pg_class where oid = 'public.habits'::regclass),
  true,
  'habits keep RLS enabled'
);
select is(
  (select relforcerowsecurity from pg_class where oid = 'public.habits'::regclass),
  true,
  'habits force RLS'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.checkins'::regclass),
  true,
  'checkins keep RLS enabled'
);

select * from finish();
rollback;

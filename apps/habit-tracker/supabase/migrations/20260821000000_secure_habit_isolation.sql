-- Migration: secure habit isolation (v1 -> v2, 2026-08-21)
-- Replaces permissive anon RLS with authenticated ownership.
-- Steps mandated by the spec:
--   1. add nullable ownership
--   2. backfill safely where ownership is known
--   3. verify
--   4. make ownership required (if safe)
--   5. enable restrictive RLS
--   6. prevent orphan rows

begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- 1. Add nullable user_id if missing (idempotent for v1).
alter table public.habits add column if not exists user_id uuid references auth.users (id) on delete cascade;

-- Also ensure schema drift is healed for any v1 installation.
alter table public.habits add column if not exists colour text;
alter table public.habits add column if not exists sort_order integer;
alter table public.habits add column if not exists archived boolean;
alter table public.habits add column if not exists created_at timestamptz;
update public.habits set colour = '#6366f1' where colour is null;
update public.habits set sort_order = 0 where sort_order is null;
update public.habits set archived = false where archived is null;
update public.habits set created_at = now() where created_at is null;

-- 2. Backfill safely where ownership is known.
-- v1 had no user_id at all, so ownership is never known automatically.
-- Do NOT silently assign orphan rows to arbitrary accounts.
-- If any rows have user_id is null they remain orphan and will be invisible
-- under the new policies. Operators must decide: assign to a real user or
-- delete. The verification step below surfaces the count.
-- (No automatic UPDATE here — intentional.)

-- 3. Verify: log counts for operator visibility.
do $$
declare
  orphan_habits integer;
begin
  select count(*) into orphan_habits from public.habits where user_id is null;
  raise notice 'Habit migration: % orphan habits (user_id is null) will be invisible after RLS switch', orphan_habits;
  if orphan_habits > 0 then
    raise warning 'Orphan habits exist: % rows have null user_id. They will not be accessible to any user. Assign them or delete them before enforcing NOT NULL.', orphan_habits;
  end if;
end
$$;

-- 4. Make ownership required only if no orphan remains.
-- This prevents silently locking orphan data behind a constraint that can never be satisfied.
do $$
begin
  if (select count(*) from public.habits where user_id is null) = 0 then
    alter table public.habits alter column user_id set default auth.uid();
    alter table public.habits alter column user_id set not null;
    raise notice 'Habit migration: user_id set to NOT NULL';
  else
    raise notice 'Habit migration: leaving user_id nullable until orphans are resolved';
  end if;
exception when others then
  raise warning 'Habit migration: could not set NOT NULL: %', sqlerrm;
end
$$;

create index if not exists habits_user_id_idx on public.habits (user_id, sort_order, created_at);

-- Ownership immutability helpers (same as in schema.sql)
create or replace function public.prevent_habit_owner_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
    raise exception 'habit user_id is immutable' using errcode = '23514';
  end if;
  return new;
end
$$;

drop trigger if exists habits_prevent_owner_change on public.habits;
create trigger habits_prevent_owner_change
before update on public.habits
for each row execute function public.prevent_habit_owner_change();

create or replace function public.prevent_checkin_habit_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.habit_id is distinct from old.habit_id then
    raise exception 'checkin habit_id is immutable' using errcode = '23514';
  end if;
  return new;
end
$$;

drop trigger if exists checkins_prevent_habit_change on public.checkins;
create trigger checkins_prevent_habit_change
before update on public.checkins
for each row execute function public.prevent_checkin_habit_change();

create or replace function public.is_habit_owner(p_habit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1 from public.habits h
      where h.id = p_habit_id and h.user_id = auth.uid()
    )
$$;

-- 5. Enable restrictive RLS (drop permissive first)
drop policy if exists "anon can manage habits" on public.habits;
drop policy if exists "anon can manage checkins" on public.checkins;
drop policy if exists "Users can select own habits" on public.habits;
drop policy if exists "Users can insert own habits" on public.habits;
drop policy if exists "Users can update own habits" on public.habits;
drop policy if exists "Users can delete own habits" on public.habits;
drop policy if exists "Users can select own checkins" on public.checkins;
drop policy if exists "Users can insert own checkins" on public.checkins;
drop policy if exists "Users can update own checkins" on public.checkins;
drop policy if exists "Users can delete own checkins" on public.checkins;

alter table public.habits enable row level security;
alter table public.habits force row level security;
alter table public.checkins enable row level security;
alter table public.checkins force row level security;

create policy "Users can select own habits"
  on public.habits for select to authenticated using (user_id = auth.uid());
create policy "Users can insert own habits"
  on public.habits for insert to authenticated with check (user_id = auth.uid());
create policy "Users can update own habits"
  on public.habits for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users can delete own habits"
  on public.habits for delete to authenticated using (user_id = auth.uid());

create policy "Users can select own checkins"
  on public.checkins for select to authenticated using (public.is_habit_owner(habit_id));
create policy "Users can insert own checkins"
  on public.checkins for insert to authenticated with check (public.is_habit_owner(habit_id));
create policy "Users can update own checkins"
  on public.checkins for update to authenticated using (public.is_habit_owner(habit_id)) with check (public.is_habit_owner(habit_id));
create policy "Users can delete own checkins"
  on public.checkins for delete to authenticated using (public.is_habit_owner(habit_id));

-- 6. Prevent orphan rows going forward and revoke anon grants
revoke all on public.habits from public, anon, authenticated;
revoke all on public.checkins from public, anon, authenticated;
grant select, insert, update, delete on public.habits to authenticated;
grant select, insert, update, delete on public.checkins to authenticated;
revoke all on function public.prevent_habit_owner_change() from public, anon, authenticated;
revoke all on function public.prevent_checkin_habit_change() from public, anon, authenticated;
revoke all on function public.is_habit_owner(uuid) from public, anon, authenticated;
grant execute on function public.is_habit_owner(uuid) to authenticated;

commit;

-- Habit — secure authenticated habit tracker (Option A: Authenticated Cloud Sync).
-- Run in Supabase SQL editor (or via `supabase db push`) to provision a fresh project.
-- Existing v1 installations (permissive anon RLS, no user_id) must run
-- supabase/migrations/20260821000000_secure_habit_isolation.sql once.
-- Every row is owned by auth.uid(). Anonymous access is denied.

begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- Habits: one row per habit per user. Ownership is explicit.
create table if not exists public.habits (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null,
  target_per_week integer not null default 3 check (target_per_week between 1 and 7),
  colour text not null default '#6366f1' check (colour ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order integer not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  constraint habits_name_length check (char_length(btrim(name)) between 1 and 80)
);

-- Migrate v1 table that lacked user_id.
alter table public.habits add column if not exists user_id uuid references auth.users (id) on delete cascade;
alter table public.habits add column if not exists colour text;
alter table public.habits add column if not exists sort_order integer;
alter table public.habits add column if not exists archived boolean;
alter table public.habits add column if not exists created_at timestamptz;

update public.habits set colour = '#6366f1' where colour is null;
update public.habits set sort_order = 0 where sort_order is null;
update public.habits set archived = false where archived is null;
update public.habits set created_at = now() where created_at is null;

alter table public.habits alter column colour set default '#6366f1';
alter table public.habits alter column colour set not null;
alter table public.habits alter column sort_order set default 0;
alter table public.habits alter column sort_order set not null;
alter table public.habits alter column archived set default false;
alter table public.habits alter column archived set not null;
alter table public.habits alter column created_at set default now();
alter table public.habits alter column created_at set not null;

-- v1 rows with null user_id are orphaned (no owner). They remain but are
-- invisible under the restrictive policies below. The migration handles
-- cleanup: see supabase/migrations/20260821000000_secure_habit_isolation.sql
-- which verifies no orphan survives before enforcing NOT NULL where possible.
-- For fresh installs we enforce NOT NULL immediately.
do $$
begin
  if (select count(*) from public.habits where user_id is null) = 0 then
    begin
      alter table public.habits alter column user_id set default auth.uid();
      alter table public.habits alter column user_id set not null;
    exception when others then null;
    end;
  end if;
end
$$;

create index if not exists habits_user_id_idx on public.habits (user_id, sort_order, created_at);
create index if not exists habits_sort_idx on public.habits (sort_order, created_at);

-- Checkins: one row per habit per day. Ownership derives from parent habit.
create table if not exists public.checkins (
  id uuid primary key default extensions.gen_random_uuid(),
  habit_id uuid not null references public.habits (id) on delete cascade,
  day date not null,
  completed boolean not null default true,
  created_at timestamptz not null default now(),
  unique (habit_id, day)
);

create index if not exists checkins_habit_day_idx on public.checkins (habit_id, day desc);

-- Prevent cross-tenant moves: habit_id and user_id are immutable after creation.
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

revoke all on function public.prevent_habit_owner_change() from public, anon, authenticated;
revoke all on function public.prevent_checkin_habit_change() from public, anon, authenticated;

-- Ownership helper for RLS: does the habit belong to the current user?
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

revoke all on function public.is_habit_owner(uuid) from public, anon, authenticated;

-- Remove insecure v1 policies (if they exist) and any prior secure policies before reinstalling.
drop policy if exists "anon can manage habits" on public.habits;
drop policy if exists "anon can manage checkins" on public.checkins;
drop policy if exists "Users can manage own habits" on public.habits;
drop policy if exists "Users can select own habits" on public.habits;
drop policy if exists "Users can insert own habits" on public.habits;
drop policy if exists "Users can update own habits" on public.habits;
drop policy if exists "Users can delete own habits" on public.habits;
drop policy if exists "Users can manage own checkins" on public.checkins;
drop policy if exists "Users can select own checkins" on public.checkins;
drop policy if exists "Users can insert own checkins" on public.checkins;
drop policy if exists "Users can update own checkins" on public.checkins;
drop policy if exists "Users can delete own checkins" on public.checkins;

alter table public.habits enable row level security;
alter table public.habits force row level security;
alter table public.checkins enable row level security;
alter table public.checkins force row level security;

-- Strict per-user policies: each user can only work with rows they own.
create policy "Users can select own habits"
  on public.habits for select to authenticated
  using (user_id = auth.uid());

create policy "Users can insert own habits"
  on public.habits for insert to authenticated
  with check (user_id = auth.uid());

create policy "Users can update own habits"
  on public.habits for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete own habits"
  on public.habits for delete to authenticated
  using (user_id = auth.uid());

-- Checkins derive ownership from the parent habit.
create policy "Users can select own checkins"
  on public.checkins for select to authenticated
  using (public.is_habit_owner(habit_id));

create policy "Users can insert own checkins"
  on public.checkins for insert to authenticated
  with check (public.is_habit_owner(habit_id));

create policy "Users can update own checkins"
  on public.checkins for update to authenticated
  using (public.is_habit_owner(habit_id))
  with check (public.is_habit_owner(habit_id));

create policy "Users can delete own checkins"
  on public.checkins for delete to authenticated
  using (public.is_habit_owner(habit_id));

-- Least-privilege grants: no anon access at all, authenticated only via RLS.
revoke all on public.habits from public, anon, authenticated;
revoke all on public.checkins from public, anon, authenticated;

grant select, insert, update, delete on public.habits to authenticated;
grant select, insert, update, delete on public.checkins to authenticated;

revoke all on function public.is_habit_owner(uuid) from public, anon;
grant execute on function public.is_habit_owner(uuid) to authenticated;

commit;

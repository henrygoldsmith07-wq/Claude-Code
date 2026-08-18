-- Habit — a quiet habit tracker.
-- Run in the Supabase SQL editor (or via `supabase db push`) to provision.
-- This app has no user accounts (same rationale as Noticed): a personal
-- habit log owned by the anon key. RLS is intentionally permissive — access
-- control relies on the project's anon key being private, not on per-user
-- scoping. Do not store sensitive data in this app.

create table if not exists habits (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- How many days per week the habit should be done (1-7).
  target_per_week integer not null default 3 check (target_per_week between 1 and 7),
  colour text not null default '#6366f1',
  sort_order integer not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists checkins (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references habits (id) on delete cascade,
  -- The local calendar day, as a date. One row per habit per day.
  day date not null,
  completed boolean not null default true,
  created_at timestamptz not null default now(),
  unique (habit_id, day)
);

create index if not exists checkins_habit_day_idx on checkins (habit_id, day desc);
create index if not exists habits_sort_idx on habits (sort_order, created_at);

alter table habits enable row level security;
alter table checkins enable row level security;

create policy "anon can manage habits"
  on habits for all
  using (true)
  with check (true);

create policy "anon can manage checkins"
  on checkins for all
  using (true)
  with check (true);

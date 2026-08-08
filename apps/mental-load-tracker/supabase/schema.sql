-- Noticed: shared household "invisible labor" tracker.
-- Run in the Supabase SQL editor (or via `supabase db push`) to provision the project.
-- After running this, also enable Realtime for the `items` table (Database ->
-- Replication in the Supabase dashboard) so both partners see updates live.
-- The app still works without it — it polls periodically as a fallback.

create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  text text not null,
  noticed_by text not null,
  noticed_by_color text not null default '#6366f1',
  created_at timestamptz not null default now(),
  resolved boolean not null default false,
  resolved_by text,
  resolved_at timestamptz
);

create index if not exists items_household_id_idx on items (household_id);

alter table households enable row level security;
alter table items enable row level security;

-- This app has no user accounts. A household is identified by a short join
-- code (like a shared room code), not an authenticated session, so these
-- policies are intentionally permissive for the anon key. Access control
-- relies on the code/household id being hard to guess, not on RLS scoping
-- per-user. Do not store sensitive data in this app.
create policy "Anyone with the anon key can read households"
  on households for select
  using (true);

create policy "Anyone with the anon key can create households"
  on households for insert
  with check (true);

create policy "Anyone with the anon key can manage items"
  on items for all
  using (true)
  with check (true);

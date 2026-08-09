-- Daily snapshots of generated news summaries. Backs the historical timeline
-- and lets scheduled pre-caching serve pages instantly without re-calling the
-- LLM. One row per place (world or a country) per calendar day.
create table if not exists public.news_snapshots (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('world', 'country')),
  code text not null,
  snapshot_date date not null,
  generated_at timestamptz not null default now(),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (scope, code, snapshot_date)
);

-- Fast "latest / by-date" lookups per place.
create index if not exists news_snapshots_lookup
  on public.news_snapshots (scope, code, snapshot_date desc);

-- Aggregated, non-personal news is safe to read publicly; writes only ever
-- happen server-side with the service-role key (which bypasses RLS).
alter table public.news_snapshots enable row level security;

create policy "public can read news snapshots"
  on public.news_snapshots
  for select
  to anon, authenticated
  using (true);

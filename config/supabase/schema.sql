-- Podcast repurposing tool schema.
-- Run in the Supabase SQL editor (or via `supabase db push`) to provision the project.

create table if not exists episodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  title text not null,
  transcript text not null,
  created_at timestamptz not null default now()
);

create table if not exists episode_outputs (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references episodes (id) on delete cascade,
  blog_post text not null,
  show_notes text not null,
  social_snippets jsonb not null,
  chapters jsonb not null,
  created_at timestamptz not null default now()
);

alter table episodes enable row level security;
alter table episode_outputs enable row level security;

create policy "Users manage their own episodes"
  on episodes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage outputs for their own episodes"
  on episode_outputs for all
  using (exists (
    select 1 from episodes
    where episodes.id = episode_outputs.episode_id
    and episodes.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from episodes
    where episodes.id = episode_outputs.episode_id
    and episodes.user_id = auth.uid()
  ));

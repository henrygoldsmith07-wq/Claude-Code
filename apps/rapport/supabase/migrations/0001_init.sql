-- ---------------------------------------------------------------------------
-- Rapport sync schema.
--
-- The server stores one opaque blob per user. It holds no reflection text, no
-- skill estimates and no goals in readable form: the payload is sealed with
-- AES-GCM under a key derived from the user's passphrase on their device.
--
-- The schema is deliberately minimal. Every column that is not ciphertext is
-- one the server genuinely needs to serve a row (the owner, when it changed,
-- and which scoring-model version wrote it). There is no display name, no
-- activity log and no social graph — a table that cannot hold those cannot
-- leak them.
-- ---------------------------------------------------------------------------

create table if not exists public.rapport_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- {ciphertext, iv, salt, version} — base64, unreadable server-side.
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  -- Scoring-model version at write time, so a newer client knows to recompute.
  version integer not null default 1,
  created_at timestamptz not null default now()
);

comment on table public.rapport_state is
  'One end-to-end encrypted blob per user. Server cannot decrypt.';
comment on column public.rapport_state.payload is
  'AES-GCM sealed export. Keys are derived client-side from a passphrase that is never transmitted.';

-- Guard against a client accidentally writing plaintext: the payload must look
-- like a sealed envelope and nothing else.
alter table public.rapport_state
  drop constraint if exists rapport_state_payload_is_sealed;
alter table public.rapport_state
  add constraint rapport_state_payload_is_sealed check (
    payload ? 'ciphertext' and payload ? 'iv' and payload ? 'salt'
    and jsonb_typeof(payload -> 'ciphertext') = 'string'
    and jsonb_typeof(payload -> 'iv') = 'string'
    and jsonb_typeof(payload -> 'salt') = 'string'
  );

alter table public.rapport_state enable row level security;

-- A user can see and change exactly their own row, and nothing else. There is
-- no policy granting any cross-user read, which is what makes "no public social
-- graph by default" a property of the database rather than of the UI.
drop policy if exists "own row select" on public.rapport_state;
create policy "own row select" on public.rapport_state
  for select using (auth.uid() = user_id);

drop policy if exists "own row insert" on public.rapport_state;
create policy "own row insert" on public.rapport_state
  for insert with check (auth.uid() = user_id);

drop policy if exists "own row update" on public.rapport_state;
create policy "own row update" on public.rapport_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own row delete" on public.rapport_state;
create policy "own row delete" on public.rapport_state
  for delete using (auth.uid() = user_id);

-- Keep updated_at honest regardless of what the client sends.
create or replace function public.rapport_touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists rapport_state_touch on public.rapport_state;
create trigger rapport_state_touch
  before update on public.rapport_state
  for each row execute function public.rapport_touch_updated_at();

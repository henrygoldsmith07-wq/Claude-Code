-- Noticed: authenticated, membership-scoped household tracker.
--
-- This file is safe to run against a fresh project and is deliberately
-- idempotent enough to be used from the Supabase SQL editor. Existing v1
-- installations should run supabase/migrations/20260820000000_secure_households.sql
-- once so their code-based households are preserved through the legacy claim
-- flow described in the README.

begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

do $$
begin
  create type public.household_role as enum ('owner', 'member');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.households (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null default 'Our household',
  -- Only populated by the one-time migration from the old code-based model.
  -- New households never use a bearer code for authorization.
  legacy_code text,
  legacy_claimed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint households_name_length check (char_length(btrim(name)) between 1 and 80)
);

-- Make the script safe to apply over the original v1 table, which had a
-- non-null `code` column and no name column.
alter table public.households add column if not exists name text;
alter table public.households add column if not exists legacy_code text;
alter table public.households add column if not exists legacy_claimed_at timestamptz;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'households'
      and column_name = 'code'
  ) then
    update public.households
    set legacy_code = coalesce(legacy_code, code);

    alter table public.households alter column code drop not null;
  end if;
end
$$;

update public.households
set name = 'Our household'
where name is null or char_length(btrim(name)) = 0;

alter table public.households alter column name set default 'Our household';
alter table public.households alter column name set not null;

create unique index if not exists households_legacy_code_uidx
  on public.households (legacy_code)
  where legacy_code is not null;

create table if not exists public.household_memberships (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.household_role not null default 'member',
  display_name text not null,
  color text not null default '#6366f1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (household_id, user_id),
  constraint household_memberships_display_name_length
    check (char_length(btrim(display_name)) between 1 and 30),
  constraint household_memberships_color_format
    check (color ~ '^#[0-9A-Fa-f]{6}$')
);

create unique index if not exists household_memberships_one_owner_uidx
  on public.household_memberships (household_id)
  where role = 'owner';

create index if not exists household_memberships_user_id_idx
  on public.household_memberships (user_id);

create table if not exists public.household_invitations (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  invited_by uuid not null references auth.users (id) on delete cascade,
  -- The raw token is returned only by create_household_invitation. The
  -- database stores only a SHA-256 digest, so a table read cannot be used as
  -- an invitation credential.
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists household_invitations_household_id_idx
  on public.household_invitations (household_id, created_at desc);

create index if not exists household_invitations_pending_idx
  on public.household_invitations (household_id, expires_at)
  where accepted_at is null and revoked_at is null;

create table if not exists public.items (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  text text not null,
  noticed_by text not null,
  noticed_by_color text not null default '#6366f1',
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  resolved boolean not null default false,
  resolved_by text,
  resolved_by_user_id uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  constraint items_text_length check (char_length(btrim(text)) between 1 and 280),
  constraint items_noticed_by_length check (char_length(btrim(noticed_by)) between 1 and 30)
);

-- Add the provenance columns to existing v1 items without changing their
-- household ownership. Historical anonymous rows remain readable only by
-- authenticated members of their household and get created_by = null.
alter table public.items add column if not exists created_by uuid
  references auth.users (id) on delete set null;
alter table public.items add column if not exists resolved_by_user_id uuid
  references auth.users (id) on delete set null;

alter table public.items alter column created_by set default auth.uid();

create index if not exists items_household_id_idx on public.items (household_id);
create index if not exists items_created_by_idx on public.items (created_by);

-- Realtime must be enabled for the table, but the publication is not an
-- authorization boundary. Postgres Changes evaluates the subscriber's RLS
-- policies for each row; the policies below are the boundary.
alter table public.items replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.items;
    exception
      when duplicate_object then null;
    end;
  end if;
end
$$;

create or replace function public.set_membership_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists household_memberships_set_updated_at on public.household_memberships;
create trigger household_memberships_set_updated_at
before update on public.household_memberships
for each row execute function public.set_membership_updated_at();

create or replace function public.prevent_item_tenant_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.household_id is distinct from old.household_id then
    raise exception 'item household_id is immutable' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and new.created_by is distinct from old.created_by then
    raise exception 'item created_by is immutable' using errcode = '23514';
  end if;

  return new;
end
$$;

drop trigger if exists items_prevent_tenant_change on public.items;
create trigger items_prevent_tenant_change
before update on public.items
for each row execute function public.prevent_item_tenant_change();

-- These helpers are intentionally private. They are used by SECURITY DEFINER
-- RPCs, not exposed as a client-side membership oracle.
create or replace function public.is_household_member(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.household_memberships m
      where m.household_id = p_household_id
        and m.user_id = auth.uid()
    )
$$;

create or replace function public.is_household_owner(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.household_memberships m
      where m.household_id = p_household_id
        and m.user_id = auth.uid()
        and m.role = 'owner'
    )
$$;

revoke all on function public.is_household_member(uuid) from public, anon, authenticated;
revoke all on function public.is_household_owner(uuid) from public, anon, authenticated;
revoke all on function public.set_membership_updated_at() from public, anon, authenticated;
revoke all on function public.prevent_item_tenant_change() from public, anon, authenticated;

-- Household creation is atomic: a new household is never visible without its
-- first owner membership. There is no direct INSERT policy on households.
create or replace function public.create_household(
  p_display_name text,
  p_color text default '#6366f1'
)
returns table (household_id uuid, household_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household_id uuid;
  v_name text := 'Our household';
  v_display_name text := btrim(coalesce(p_display_name, ''));
  v_color text := coalesce(p_color, '#6366f1');
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if char_length(v_display_name) not between 1 and 30 then
    raise exception 'display name must be between 1 and 30 characters';
  end if;

  if v_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'color must be a six-digit hex color';
  end if;

  insert into public.households (name)
  values (v_name)
  returning id into v_household_id;

  insert into public.household_memberships (
    household_id, user_id, role, display_name, color
  ) values (
    v_household_id, auth.uid(), 'owner', v_display_name, v_color
  );

  return query select v_household_id, v_name;
end
$$;

-- Invitation tokens are 256 bits of entropy and are stored only as digests.
-- The raw value is returned once to the authenticated owner.
create or replace function public.create_household_invitation(
  p_household_id uuid
)
returns table (invitation_id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_invitation_id uuid;
  v_expires_at timestamptz := now() + interval '7 days';
begin
  if not public.is_household_owner(p_household_id) then
    raise exception 'only the household owner can create invitations' using errcode = '42501';
  end if;

  insert into public.household_invitations (
    household_id, invited_by, token_hash, expires_at
  ) values (
    p_household_id, auth.uid(), extensions.digest(v_token, 'sha256'), v_expires_at
  ) returning id into v_invitation_id;

  return query select v_invitation_id, v_token, v_expires_at;
end
$$;

create or replace function public.list_household_invitations(
  p_household_id uuid
)
returns table (
  invitation_id uuid,
  created_at timestamptz,
  expires_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_household_owner(p_household_id) then
    raise exception 'only the household owner can list invitations' using errcode = '42501';
  end if;

  return query
  select i.id, i.created_at, i.expires_at, i.accepted_at, i.revoked_at
  from public.household_invitations i
  where i.household_id = p_household_id
  order by i.created_at desc;
end
$$;

create or replace function public.revoke_household_invitation(
  p_household_id uuid,
  p_invitation_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if not public.is_household_owner(p_household_id) then
    raise exception 'only the household owner can revoke invitations' using errcode = '42501';
  end if;

  update public.household_invitations
  set revoked_at = coalesce(revoked_at, now())
  where id = p_invitation_id
    and household_id = p_household_id
    and accepted_at is null
    and revoked_at is null;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end
$$;

create or replace function public.accept_household_invitation(
  p_token text,
  p_display_name text,
  p_color text default '#6366f1'
)
returns table (household_id uuid, household_name text, role public.household_role)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := btrim(coalesce(p_token, ''));
  v_display_name text := btrim(coalesce(p_display_name, ''));
  v_color text := coalesce(p_color, '#6366f1');
  v_invitation public.household_invitations;
  v_household_name text;
  v_existing_role public.household_role;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if char_length(v_token) <> 64 then
    raise exception 'invitation is invalid, expired, already used, or revoked';
  end if;

  if char_length(v_display_name) not between 1 and 30 then
    raise exception 'display name must be between 1 and 30 characters';
  end if;

  if v_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'color must be a six-digit hex color';
  end if;

  select i.* into v_invitation
  from public.household_invitations i
  where i.token_hash = extensions.digest(v_token, 'sha256')
    and i.accepted_at is null
    and i.revoked_at is null
    and i.expires_at > now()
  for update;

  if not found then
    raise exception 'invitation is invalid, expired, already used, or revoked';
  end if;

  select h.name into v_household_name
  from public.households h
  where h.id = v_invitation.household_id;

  select m.role into v_existing_role
  from public.household_memberships m
  where m.household_id = v_invitation.household_id
    and m.user_id = auth.uid();

  if v_existing_role is null then
    insert into public.household_memberships (
      household_id, user_id, role, display_name, color
    ) values (
      v_invitation.household_id, auth.uid(), 'member', v_display_name, v_color
    );
    v_existing_role := 'member';
  end if;

  update public.household_invitations
  set accepted_at = now(), accepted_by = auth.uid()
  where id = v_invitation.id;

  return query select v_invitation.household_id, v_household_name, v_existing_role;
end
$$;

create or replace function public.remove_household_member(
  p_household_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  if not public.is_household_owner(p_household_id) then
    raise exception 'only the household owner can remove members' using errcode = '42501';
  end if;

  delete from public.household_memberships
  where household_id = p_household_id
    and user_id = p_user_id
    and role = 'member';

  get diagnostics v_deleted = row_count;
  return v_deleted = 1;
end
$$;

-- Item writes go through these functions in the UI so display metadata comes
-- from the authenticated membership row rather than from client state. The
-- table policies below remain restrictive for direct and adversarial calls.
create or replace function public.create_item(
  p_household_id uuid,
  p_text text
)
returns public.items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membership public.household_memberships;
  v_item public.items;
  v_text text := btrim(coalesce(p_text, ''));
begin
  if not public.is_household_member(p_household_id) then
    raise exception 'not a household member' using errcode = '42501';
  end if;

  if char_length(v_text) not between 1 and 280 then
    raise exception 'item text must be between 1 and 280 characters';
  end if;

  select m.* into v_membership
  from public.household_memberships m
  where m.household_id = p_household_id
    and m.user_id = auth.uid();

  insert into public.items (
    household_id, text, noticed_by, noticed_by_color, created_by
  ) values (
    p_household_id, v_text, v_membership.display_name, v_membership.color, auth.uid()
  ) returning * into v_item;

  return v_item;
end
$$;

create or replace function public.set_item_resolved(
  p_item_id uuid,
  p_resolved boolean
)
returns public.items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.items;
  v_membership public.household_memberships;
begin
  select i.* into v_item
  from public.items i
  where i.id = p_item_id;

  if not found or not public.is_household_member(v_item.household_id) then
    raise exception 'item not found' using errcode = '42501';
  end if;

  select m.* into v_membership
  from public.household_memberships m
  where m.household_id = v_item.household_id
    and m.user_id = auth.uid();

  update public.items
  set resolved = p_resolved,
      resolved_by = case when p_resolved then v_membership.display_name else null end,
      resolved_by_user_id = case when p_resolved then auth.uid() else null end,
      resolved_at = case when p_resolved then now() else null end
  where id = p_item_id
  returning * into v_item;

  return v_item;
end
$$;

-- A one-time, authenticated migration bridge for v1 rows. Because v1 had no
-- user identity, the first authenticated person who presents the old code
-- becomes the owner. The claim locks the household immediately; subsequent
-- callers cannot take it over. New households have no legacy_code and cannot
-- use this path.
create or replace function public.claim_legacy_household(
  p_legacy_code text,
  p_display_name text,
  p_color text default '#6366f1'
)
returns table (household_id uuid, household_name text, role public.household_role)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := upper(btrim(coalesce(p_legacy_code, '')));
  v_display_name text := btrim(coalesce(p_display_name, ''));
  v_color text := coalesce(p_color, '#6366f1');
  v_household public.households;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if char_length(v_display_name) not between 1 and 30 then
    raise exception 'display name must be between 1 and 30 characters';
  end if;

  if v_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'color must be a six-digit hex color';
  end if;

  select h.* into v_household
  from public.households h
  where upper(h.legacy_code) = v_code
    and h.legacy_claimed_at is null
    and not exists (
      select 1 from public.household_memberships m where m.household_id = h.id
    )
  for update;

  if not found then
    raise exception 'legacy household could not be claimed';
  end if;

  insert into public.household_memberships (
    household_id, user_id, role, display_name, color
  ) values (
    v_household.id, auth.uid(), 'owner', v_display_name, v_color
  );

  update public.households
  set legacy_claimed_at = now()
  where id = v_household.id;

  return query select v_household.id, v_household.name, 'owner'::public.household_role;
end
$$;

-- Remove every old policy before installing the authenticated policy set.
drop policy if exists "Anyone with the anon key can read households" on public.households;
drop policy if exists "Anyone with the anon key can create households" on public.households;
drop policy if exists "Anyone with the anon key can manage items" on public.items;
drop policy if exists "Members can read households" on public.households;
drop policy if exists "Members can read items" on public.items;
drop policy if exists "Members can insert items" on public.items;
drop policy if exists "Members can update items" on public.items;
drop policy if exists "Members can delete items" on public.items;
drop policy if exists "Users can read their memberships" on public.household_memberships;

alter table public.households enable row level security;
alter table public.households force row level security;
alter table public.household_memberships enable row level security;
alter table public.household_memberships force row level security;
alter table public.household_invitations enable row level security;
alter table public.household_invitations force row level security;
alter table public.items enable row level security;
alter table public.items force row level security;

create policy "Members can read households"
  on public.households for select to authenticated
  using (
    exists (
      select 1
      from public.household_memberships m
      where m.household_id = households.id
        and m.user_id = auth.uid()
    )
  );

create policy "Users can read their memberships"
  on public.household_memberships for select to authenticated
  using (user_id = auth.uid());

create policy "Members can read items"
  on public.items for select to authenticated
  using (
    exists (
      select 1
      from public.household_memberships m
      where m.household_id = items.household_id
        and m.user_id = auth.uid()
    )
  );

create policy "Members can insert items"
  on public.items for insert to authenticated
  with check (
    (created_by is null or created_by = auth.uid())
    and exists (
      select 1
      from public.household_memberships m
      where m.household_id = items.household_id
        and m.user_id = auth.uid()
    )
  );

create policy "Members can update items"
  on public.items for update to authenticated
  using (
    exists (
      select 1
      from public.household_memberships m
      where m.household_id = items.household_id
        and m.user_id = auth.uid()
    )
  )
  with check (
    (created_by is null or created_by = auth.uid())
    and exists (
      select 1
      from public.household_memberships m
      where m.household_id = items.household_id
        and m.user_id = auth.uid()
    )
  );

-- Table grants are least-privilege as well as RLS-restricted. In particular,
-- invitations never have a client table grant; their raw token is returned by
-- the owner-only function and invitation metadata is returned by a safe list
-- function.
revoke all on public.households from public, anon, authenticated;
revoke all on public.household_memberships from public, anon, authenticated;
revoke all on public.household_invitations from public, anon, authenticated;
revoke all on public.items from public, anon, authenticated;

grant select on public.households to authenticated;
grant select on public.household_memberships to authenticated;
-- Client deletion is intentionally disabled. Supabase Postgres Changes cannot
-- filter DELETE events by column, so allowing browser deletes would create an
-- unnecessary cross-tenant event surface. The product has no delete action;
-- resolving/reopening is an update and remains membership-scoped.
grant select, insert, update on public.items to authenticated;

revoke all on function public.create_household(text, text) from public, anon, authenticated;
revoke all on function public.create_household_invitation(uuid) from public, anon, authenticated;
revoke all on function public.list_household_invitations(uuid) from public, anon, authenticated;
revoke all on function public.revoke_household_invitation(uuid, uuid) from public, anon, authenticated;
revoke all on function public.accept_household_invitation(text, text, text) from public, anon, authenticated;
revoke all on function public.remove_household_member(uuid, uuid) from public, anon, authenticated;
revoke all on function public.create_item(uuid, text) from public, anon, authenticated;
revoke all on function public.set_item_resolved(uuid, boolean) from public, anon, authenticated;
revoke all on function public.claim_legacy_household(text, text, text) from public, anon, authenticated;

grant execute on function public.create_household(text, text) to authenticated;
grant execute on function public.create_household_invitation(uuid) to authenticated;
grant execute on function public.list_household_invitations(uuid) to authenticated;
grant execute on function public.revoke_household_invitation(uuid, uuid) to authenticated;
grant execute on function public.accept_household_invitation(text, text, text) to authenticated;
grant execute on function public.remove_household_member(uuid, uuid) to authenticated;
grant execute on function public.create_item(uuid, text) to authenticated;
grant execute on function public.set_item_resolved(uuid, boolean) to authenticated;
grant execute on function public.claim_legacy_household(text, text, text) to authenticated;

commit;

-- Multi-tenant organization workspace and scoped roles.
-- Additive migration: existing arena sessions remain valid without an organization_id.

insert into public.roles (code, label, description, sort_order)
values
  ('platform_admin', 'Platform Admin', 'Mengelola seluruh platform OTTOPLAY', 0),
  ('organization_owner', 'Organization Owner', 'Pemilik organisasi atau venue', 10),
  ('organization_admin', 'Organization Admin', 'Mengelola anggota, venue, dan event organisasi', 20),
  ('event_manager', 'Event Manager', 'Membuat dan menjalankan event', 30),
  ('scorer', 'Scorer', 'Mengisi skor pertandingan secara live', 40),
  ('coach', 'Coach', 'Melihat pemain dan statistik organisasi', 50),
  ('viewer', 'Viewer', 'Melihat event dan leaderboard tanpa mengubah data', 60)
on conflict (code) do update set
  label = excluded.label,
  description = excluded.description,
  sort_order = excluded.sort_order;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  primary_color text,
  secondary_color text,
  sport_label text,
  timezone text not null default 'Asia/Jakarta',
  subscription_plan text not null default 'free',
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint organizations_subscription_plan_check check (subscription_plan in ('free', 'club', 'pro', 'enterprise'))
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_code text not null references public.roles(code) on update cascade,
  status text not null default 'active',
  invited_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz not null default now(),
  primary key (organization_id, user_id),
  constraint organization_members_status_check check (status in ('invited', 'active', 'suspended')),
  constraint organization_members_role_check check (role_code in (
    'organization_owner', 'organization_admin', 'event_manager', 'scorer', 'coach', 'player', 'viewer'
  ))
);

create table if not exists public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text,
  role_code text not null references public.roles(code) on update cascade,
  token_hash text not null unique,
  invited_by uuid not null references auth.users(id) on delete restrict,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint organization_invites_role_check check (role_code in (
    'organization_admin', 'event_manager', 'scorer', 'coach', 'player', 'viewer'
  ))
);

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  address text,
  timezone text not null default 'Asia/Jakarta',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.courts (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  name text not null,
  sport text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (venue_id, name)
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  venue_id uuid references public.venues(id) on delete set null,
  name text not null,
  sport text not null default 'padel',
  format text not null default 'americano',
  status text not null default 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_status_check check (status in ('draft', 'registration', 'live', 'completed', 'cancelled'))
);

create table if not exists public.event_players (
  event_id uuid not null references public.events(id) on delete cascade,
  player_user_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  seed integer,
  status text not null default 'registered',
  created_at timestamptz not null default now(),
  primary key (event_id, display_name),
  constraint event_players_status_check check (status in ('invited', 'registered', 'waitlisted', 'checked_in', 'withdrawn'))
);

create table if not exists public.event_staff (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_code text not null default 'event_manager' references public.roles(code) on update cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id),
  constraint event_staff_role_check check (role_code in ('event_manager', 'scorer', 'coach', 'viewer'))
);

alter table public.kocok_arena_meta
  add column if not exists organization_id uuid references public.organizations(id) on delete set null;
alter table public.kocok_arena_meta
  add column if not exists event_id uuid references public.events(id) on delete set null;

create index if not exists organization_members_user_idx
  on public.organization_members (user_id, status);
create index if not exists organization_invites_org_idx
  on public.organization_invites (organization_id, expires_at);
create index if not exists venues_org_idx
  on public.venues (organization_id, is_active);
create index if not exists courts_venue_idx
  on public.courts (venue_id, is_active);
create index if not exists events_org_idx
  on public.events (organization_id, starts_at desc);
create index if not exists event_players_event_idx
  on public.event_players (event_id, status);
create index if not exists event_staff_user_idx
  on public.event_staff (user_id);
create index if not exists arena_meta_org_idx
  on public.kocok_arena_meta (organization_id, last_seen desc);
create index if not exists arena_meta_event_idx
  on public.kocok_arena_meta (event_id, last_seen desc);

create or replace function public.is_organization_member(
  p_organization_id uuid,
  p_roles text[] default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and (p_roles is null or om.role_code = any (p_roles))
  );
$$;

create or replace function public.is_organization_admin(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_organization_member(
    p_organization_id,
    array['organization_owner', 'organization_admin']::text[]
  );
$$;

create or replace function public.create_organization(
  p_name text,
  p_slug text,
  p_timezone text default 'Asia/Jakarta'
)
returns public.organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org public.organizations;
begin
  if auth.uid() is null then
    raise exception 'Login diperlukan' using errcode = '42501';
  end if;
  if nullif(trim(p_name), '') is null or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Nama atau slug organisasi tidak valid' using errcode = '22023';
  end if;

  insert into public.organizations (name, slug, timezone, created_by)
  values (trim(p_name), lower(trim(p_slug)), coalesce(nullif(trim(p_timezone), ''), 'Asia/Jakarta'), auth.uid())
  returning * into v_org;

  insert into public.organization_members (organization_id, user_id, role_code)
  values (v_org.id, auth.uid(), 'organization_owner');

  return v_org;
end;
$$;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_invites enable row level security;
alter table public.venues enable row level security;
alter table public.courts enable row level security;
alter table public.events enable row level security;
alter table public.event_players enable row level security;
alter table public.event_staff enable row level security;

create policy organizations_select_member on public.organizations
  for select to authenticated
  using (public.is_organization_member(id));
create policy organizations_insert_owner on public.organizations
  for insert to authenticated
  with check (created_by = auth.uid());
create policy organizations_update_admin on public.organizations
  for update to authenticated
  using (public.is_organization_admin(id))
  with check (public.is_organization_admin(id));

create policy organization_members_select_member on public.organization_members
  for select to authenticated
  using (public.is_organization_member(organization_id));
create policy organization_members_insert_admin on public.organization_members
  for insert to authenticated
  with check (public.is_organization_admin(organization_id));
create policy organization_members_update_admin on public.organization_members
  for update to authenticated
  using (public.is_organization_admin(organization_id))
  with check (public.is_organization_admin(organization_id));
create policy organization_members_delete_admin on public.organization_members
  for delete to authenticated
  using (public.is_organization_admin(organization_id));

create policy organization_invites_member on public.organization_invites
  for all to authenticated
  using (public.is_organization_admin(organization_id))
  with check (public.is_organization_admin(organization_id));

create policy venues_member on public.venues
  for select to authenticated
  using (public.is_organization_member(organization_id));
create policy venues_admin_write on public.venues
  for all to authenticated
  using (public.is_organization_admin(organization_id))
  with check (public.is_organization_admin(organization_id));

create policy courts_member on public.courts
  for select to authenticated
  using (exists (
    select 1 from public.venues v
    where v.id = venue_id and public.is_organization_member(v.organization_id)
  ));
create policy courts_admin_write on public.courts
  for all to authenticated
  using (exists (
    select 1 from public.venues v
    where v.id = venue_id and public.is_organization_admin(v.organization_id)
  ))
  with check (exists (
    select 1 from public.venues v
    where v.id = venue_id and public.is_organization_admin(v.organization_id)
  ));

create policy events_member on public.events
  for select to authenticated
  using (public.is_organization_member(organization_id));
create policy events_manager_write on public.events
  for all to authenticated
  using (public.is_organization_member(organization_id, array['organization_owner', 'organization_admin', 'event_manager']::text[]))
  with check (public.is_organization_member(organization_id, array['organization_owner', 'organization_admin', 'event_manager']::text[]));

create policy event_players_member on public.event_players
  for select to authenticated
  using (exists (
    select 1 from public.events e
    where e.id = event_id and public.is_organization_member(e.organization_id)
  ));
create policy event_players_manager_write on public.event_players
  for all to authenticated
  using (exists (
    select 1 from public.events e
    where e.id = event_id and public.is_organization_member(e.organization_id, array['organization_owner', 'organization_admin', 'event_manager']::text[])
  ))
  with check (exists (
    select 1 from public.events e
    where e.id = event_id and public.is_organization_member(e.organization_id, array['organization_owner', 'organization_admin', 'event_manager']::text[])
  ));

create policy event_staff_member on public.event_staff
  for select to authenticated
  using (exists (
    select 1 from public.events e
    where e.id = event_id and public.is_organization_member(e.organization_id)
  ));
create policy event_staff_admin_write on public.event_staff
  for all to authenticated
  using (exists (
    select 1 from public.events e
    where e.id = event_id and public.is_organization_admin(e.organization_id)
  ))
  with check (exists (
    select 1 from public.events e
    where e.id = event_id and public.is_organization_admin(e.organization_id)
  ));

create policy arena_meta_org_member on public.kocok_arena_meta
  for select to authenticated
  using (organization_id is not null and public.is_organization_member(organization_id));

revoke all on public.organizations, public.organization_members, public.organization_invites,
  public.venues, public.courts, public.events, public.event_players, public.event_staff
  from anon;
grant select, insert, update on public.organizations to authenticated;
grant select, insert, update, delete on public.organization_members to authenticated;
grant select, insert, update, delete on public.organization_invites to authenticated;
grant select, insert, update, delete on public.venues, public.courts, public.events,
  public.event_players, public.event_staff to authenticated;
grant execute on function public.is_organization_member(uuid, text[]) to authenticated;
grant execute on function public.is_organization_admin(uuid) to authenticated;
grant execute on function public.create_organization(text, text, text) to authenticated;

create trigger organizations_updated_at before update on public.organizations
  for each row execute function public.update_updated_at_column();
create trigger venues_updated_at before update on public.venues
  for each row execute function public.update_updated_at_column();
create trigger events_updated_at before update on public.events
  for each row execute function public.update_updated_at_column();

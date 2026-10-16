-- Public event registration keeps casual players out of workspace membership.
alter table public.events
  add column if not exists public_code text,
  add column if not exists max_players integer,
  add column if not exists public_results boolean not null default true;

update public.events
set public_code = 'event-' || substr(replace(id::text, '-', ''), 1, 10)
where public_code is null;

alter table public.events
  alter column public_code set default ('event-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  alter column public_code set not null;

create unique index if not exists events_public_code_idx on public.events(public_code);

alter table public.event_players
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists photo_url text,
  add column if not exists registration_token_hash text,
  add column if not exists consent_to_show_name boolean not null default true,
  add column if not exists registered_at timestamptz not null default now(),
  add column if not exists checked_in_at timestamptz;

create unique index if not exists event_players_registration_token_idx
  on public.event_players(registration_token_hash)
  where registration_token_hash is not null;

create or replace function public.register_event_guest(
  p_public_code text,
  p_display_name text,
  p_phone text default null,
  p_email text default null,
  p_photo_url text default null,
  p_consent_to_show_name boolean default true
)
returns table (
  event_id uuid,
  event_name text,
  public_code text,
  player_id uuid,
  display_name text,
  registration_token text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_event public.events;
  v_player_id uuid;
  v_token text;
  v_name text := nullif(trim(p_display_name), '');
  v_email text := nullif(lower(trim(p_email)), '');
  v_phone text := nullif(trim(p_phone), '');
begin
  if v_name is null or length(v_name) < 2 or length(v_name) > 80 then
    raise exception 'Nama peserta harus 2 sampai 80 karakter' using errcode = '22023';
  end if;

  select * into v_event
  from public.events e
  where e.public_code = lower(trim(p_public_code))
    and e.status in ('registration', 'live')
  limit 1;

  if not found then
    raise exception 'Event tidak tersedia untuk pendaftaran' using errcode = 'P0002';
  end if;

  if v_event.max_players is not null
     and (select count(*) from public.event_players ep where ep.event_id = v_event.id and ep.status <> 'withdrawn') >= v_event.max_players
  then
    raise exception 'Pendaftaran event sudah penuh' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.event_players ep
    where ep.event_id = v_event.id
      and ep.status <> 'withdrawn'
      and lower(ep.display_name) = lower(v_name)
  ) then
    raise exception 'Nama tersebut sudah terdaftar di event ini' using errcode = '23505';
  end if;

  v_token := encode(gen_random_bytes(18), 'hex');
  insert into public.event_players (
    event_id, player_user_id, display_name, email, phone, photo_url,
    registration_token_hash, consent_to_show_name, status, registered_at
  ) values (
    v_event.id, auth.uid(), v_name, v_email, v_phone, nullif(trim(p_photo_url), ''),
    encode(extensions.digest(v_token, 'sha256'), 'hex'), coalesce(p_consent_to_show_name, true), 'registered', now()
  );

  return query select v_event.id, v_event.name, v_event.public_code, null::uuid, v_name, v_token;
end;
$$;

create or replace function public.get_public_event(
  p_public_code text,
  p_registration_token text default null
)
returns table (
  event jsonb,
  players jsonb,
  me jsonb,
  matches jsonb,
  history jsonb
)
language sql
security definer
set search_path = public, extensions
as $$
  with selected_event as (
    select e.*, v.name as venue_name, o.name as organization_name
    from public.events e
    join public.organizations o on o.id = e.organization_id
    left join public.venues v on v.id = e.venue_id
    where e.public_code = lower(trim(p_public_code))
      and e.public_results = true
      and e.status in ('registration', 'live', 'completed')
    limit 1
  ),
  arena_link as (
    select m.access_key
    from public.kocok_arena_meta m
    join selected_event e on e.id = m.event_id
    order by m.last_seen desc
    limit 1
  )
  select
    (select jsonb_build_object(
      'id', e.id, 'name', e.name, 'public_code', e.public_code, 'sport', e.sport,
      'format', e.format, 'status', e.status, 'starts_at', e.starts_at, 'ends_at', e.ends_at,
      'venue_name', e.venue_name, 'organization_name', e.organization_name,
      'max_players', e.max_players
    ) from selected_event e) as event,
    coalesce((select jsonb_agg(jsonb_build_object(
      'display_name', ep.display_name, 'status', ep.status, 'seed', ep.seed,
      'registered_at', ep.registered_at, 'checked_in_at', ep.checked_in_at
    ) order by ep.seed nulls last, ep.registered_at)
      from public.event_players ep join selected_event e on e.id = ep.event_id
      where ep.status <> 'withdrawn' and ep.consent_to_show_name), '[]'::jsonb) as players,
    (select to_jsonb(ep) - 'registration_token_hash' - 'email' - 'phone' - 'photo_url'
      from public.event_players ep join selected_event e on e.id = ep.event_id
      where p_registration_token is not null
        and ep.registration_token_hash = encode(extensions.digest(trim(p_registration_token), 'sha256'), 'hex')
      limit 1) as me,
    coalesce((select jsonb_agg(to_jsonb(km) order by km.round, km.court)
      from public.kocok_arena_matches km join arena_link al on al.access_key = km.access_key), '[]'::jsonb) as matches,
    coalesce((select jsonb_agg(to_jsonb(kh) order by kh.finished_at desc)
      from public.kocok_arena_history kh join arena_link al on al.access_key = kh.access_key), '[]'::jsonb) as history;
$$;

revoke all on function public.register_event_guest(text, text, text, text, text, boolean) from public;
grant execute on function public.register_event_guest(text, text, text, text, text, boolean) to anon, authenticated;
revoke all on function public.get_public_event(text, text) from public;
grant execute on function public.get_public_event(text, text) to anon, authenticated;

-- Add operational event registration flow: waitlist, guest check-in, and promotion.
create or replace function public.register_event_guest(
  p_public_code text,
  p_display_name text,
  p_gender text,
  p_phone text default null,
  p_email text default null,
  p_photo_url text default null,
  p_consent_to_show_name boolean default true,
  p_tier text default 'intermediate'
)
returns table (
  event_id uuid,
  event_name text,
  public_code text,
  player_id uuid,
  display_name text,
  registration_token text,
  registration_status text
)
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_event public.events;
  v_token text;
  v_name text := nullif(trim(p_display_name), '');
  v_gender text := lower(nullif(trim(p_gender), ''));
  v_email text := nullif(lower(trim(p_email)), '');
  v_phone text := nullif(trim(p_phone), '');
  v_tier text := lower(coalesce(nullif(trim(p_tier), ''), 'intermediate'));
  v_status text := 'registered';
  v_active_count integer;
begin
  if v_name is null or length(v_name) < 2 or length(v_name) > 80 then
    raise exception 'Nama peserta harus 2 sampai 80 karakter' using errcode = '22023';
  end if;
  if v_gender not in ('male', 'female') then
    raise exception 'Jenis kelamin peserta wajib dipilih' using errcode = '22023';
  end if;
  if v_tier not in ('newbie', 'beginner', 'intermediate', 'advanced', 'pro', 'elite') then
    raise exception 'Tier peserta tidak valid' using errcode = '22023';
  end if;
  select * into v_event from public.events e
  where e.public_code = lower(trim(p_public_code)) and e.status = 'registration' limit 1;
  if not found then raise exception 'Event tidak tersedia untuk pendaftaran' using errcode = 'P0002'; end if;

  if exists (
    select 1 from public.event_players ep
    where ep.event_id = v_event.id
      and ep.status <> 'withdrawn'
      and lower(ep.display_name) = lower(v_name)
  ) then
    raise exception 'Nama tersebut sudah terdaftar di event ini' using errcode = '23505';
  end if;

  select count(*)::integer into v_active_count
  from public.event_players ep
  where ep.event_id = v_event.id and ep.status in ('registered', 'checked_in');
  if v_event.max_players is not null and v_active_count >= v_event.max_players then
    v_status := 'waitlisted';
  end if;

  v_token := encode(gen_random_bytes(18), 'hex');
  insert into public.event_players (
    event_id, player_user_id, display_name, gender, tier, email, phone, photo_url,
    registration_token_hash, consent_to_show_name, status, registered_at
  ) values (
    v_event.id, auth.uid(), v_name, v_gender, v_tier, v_email, v_phone, nullif(trim(p_photo_url), ''),
    encode(extensions.digest(v_token, 'sha256'), 'hex'), coalesce(p_consent_to_show_name, true), v_status, now()
  );
  return query select v_event.id, v_event.name, v_event.public_code, null::uuid, v_name, v_token, v_status;
end;
$$;

-- Keep the legacy overload private to avoid unauthenticated registrations without gender.
revoke all on function public.register_event_guest(text, text, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.register_event_guest(text, text, text, text, text, boolean, text) from public, anon, authenticated;
revoke all on function public.register_event_guest(text, text, text, text, text, text, boolean, text) from public, anon, authenticated;
grant execute on function public.register_event_guest(text, text, text, text, text, text, boolean, text) to anon, authenticated;

create or replace function public.check_in_event_guest(
  p_public_code text,
  p_registration_token text
)
returns table (display_name text, status text, checked_in_at timestamptz)
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_event_id uuid;
begin
  if nullif(trim(p_registration_token), '') is null then
    raise exception 'Token pendaftaran tidak valid' using errcode = '22023';
  end if;
  select e.id into v_event_id from public.events e
  where e.public_code = lower(trim(p_public_code)) and e.status in ('registration', 'live') limit 1;
  if v_event_id is null then raise exception 'Event tidak tersedia' using errcode = 'P0002'; end if;

  return query
  update public.event_players
  set status = 'checked_in', checked_in_at = coalesce(checked_in_at, now())
  where event_id = v_event_id
    and registration_token_hash = encode(extensions.digest(trim(p_registration_token), 'sha256'), 'hex')
    and status = 'registered'
  returning event_players.display_name, event_players.status, event_players.checked_in_at;
  if not found then
    raise exception 'Peserta tidak ditemukan atau masih waitlist' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.check_in_event_guest(text, text) from public;
grant execute on function public.check_in_event_guest(text, text) to anon, authenticated;

create or replace function public.promote_event_waitlist(
  p_event_id uuid,
  p_limit integer default 1
)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
  v_active_count integer;
  v_capacity integer;
  v_promoted integer := 0;
begin
  if auth.uid() is null then raise exception 'Login diperlukan'; end if;
  select e.organization_id, e.max_players into v_organization_id, v_capacity
  from public.events e where e.id = p_event_id and e.status = 'registration';
  if v_organization_id is null then raise exception 'Event tidak ditemukan atau sudah dimulai'; end if;
  if not public.has_org_permission(auth.uid(), v_organization_id, 'events.manage') then
    raise exception 'Akses ditolak';
  end if;
  if v_capacity is null then return 0; end if;
  select count(*)::integer into v_active_count from public.event_players
  where event_id = p_event_id and status in ('registered', 'checked_in');
  p_limit := greatest(coalesce(p_limit, 1), 0);

  with promoted as (
    select ctid from public.event_players
    where event_id = p_event_id and status = 'waitlisted'
    order by registered_at asc
    limit least(p_limit, greatest(v_capacity - v_active_count, 0))
  )
  update public.event_players ep
  set status = 'registered'
  from promoted
  where ep.ctid = promoted.ctid;
  get diagnostics v_promoted = row_count;
  return v_promoted;
end;
$$;
revoke all on function public.promote_event_waitlist(uuid, integer) from public, anon;
grant execute on function public.promote_event_waitlist(uuid, integer) to authenticated;


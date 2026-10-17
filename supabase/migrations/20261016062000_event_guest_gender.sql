alter table public.event_players add column if not exists gender text;

alter table public.event_players drop constraint if exists event_players_gender_check;
alter table public.event_players add constraint event_players_gender_check
  check (gender is null or gender in ('male', 'female'));

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
  registration_token text
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
  where e.public_code = lower(trim(p_public_code)) and e.status in ('registration', 'live') limit 1;
  if not found then raise exception 'Event tidak tersedia untuk pendaftaran' using errcode = 'P0002'; end if;
  if v_event.max_players is not null and (select count(*) from public.event_players ep where ep.event_id = v_event.id and ep.status <> 'withdrawn') >= v_event.max_players then
    raise exception 'Pendaftaran event sudah penuh' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.event_players ep where ep.event_id = v_event.id and ep.status <> 'withdrawn' and lower(ep.display_name) = lower(v_name)) then
    raise exception 'Nama tersebut sudah terdaftar di event ini' using errcode = '23505';
  end if;
  v_token := encode(gen_random_bytes(18), 'hex');
  insert into public.event_players (event_id, player_user_id, display_name, gender, tier, email, phone, photo_url, registration_token_hash, consent_to_show_name, status, registered_at)
  values (v_event.id, auth.uid(), v_name, v_gender, v_tier, v_email, v_phone, nullif(trim(p_photo_url), ''), encode(extensions.digest(v_token, 'sha256'), 'hex'), coalesce(p_consent_to_show_name, true), 'registered', now());
  return query select v_event.id, v_event.name, v_event.public_code, null::uuid, v_name, v_token;
end;
$$;

revoke all on function public.register_event_guest(text, text, text, text, text, boolean, text) from public;
revoke all on function public.register_event_guest(text, text, text, text, text, text, boolean, text) from public;
grant execute on function public.register_event_guest(text, text, text, text, text, text, boolean, text) to anon, authenticated;

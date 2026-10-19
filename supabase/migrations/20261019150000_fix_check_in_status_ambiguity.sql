-- Fix check-in RPC output parameter collision with event_players.status.
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

  select e.id into v_event_id
  from public.events e
  where e.public_code = lower(trim(p_public_code))
    and e.status in ('registration', 'live')
  limit 1;

  if v_event_id is null then
    raise exception 'Event tidak tersedia' using errcode = 'P0002';
  end if;

  return query
  update public.event_players as ep
  set status = 'checked_in', checked_in_at = coalesce(ep.checked_in_at, now())
  where ep.event_id = v_event_id
    and ep.registration_token_hash = encode(extensions.digest(trim(p_registration_token), 'sha256'), 'hex')
    and ep.status = 'registered'
  returning ep.display_name, ep.status, ep.checked_in_at;

  if not found then
    raise exception 'Peserta tidak ditemukan atau masih waitlist' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.check_in_event_guest(text, text) from public;
grant execute on function public.check_in_event_guest(text, text) to anon, authenticated;

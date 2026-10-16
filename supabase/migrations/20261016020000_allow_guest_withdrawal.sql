create or replace function public.withdraw_event_guest(
  p_public_code text,
  p_registration_token text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_event_id uuid;
begin
  if nullif(trim(p_registration_token), '') is null then
    return false;
  end if;

  select e.id into v_event_id
  from public.events e
  where e.public_code = lower(trim(p_public_code))
    and e.status in ('registration', 'live')
  limit 1;

  if v_event_id is null then
    return false;
  end if;

  update public.event_players
  set status = 'withdrawn'
  where event_id = v_event_id
    and registration_token_hash = encode(extensions.digest(trim(p_registration_token), 'sha256'), 'hex')
    and status <> 'withdrawn';

  return found;
end;
$$;

revoke all on function public.withdraw_event_guest(text, text) from public;
grant execute on function public.withdraw_event_guest(text, text) to anon, authenticated;

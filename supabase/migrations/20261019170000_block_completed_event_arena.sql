-- Prevent reopening or mutating an Arena session after its event is completed.
create or replace function public.kocok_save_state(p_code text, p_pin text, p_state jsonb)
returns timestamptz
language plpgsql security definer
set search_path to public, extensions
as $$
declare
  v_key text := public.kocok_access_key(p_code, p_pin);
  v_now timestamptz := now();
  v_org uuid;
  v_event uuid;
  v_requested_org uuid;
  v_requested_event uuid;
  v_event_status text;
  v_finished boolean := lower(coalesce(p_state->>'finished', 'false')) = 'true';
begin
  if p_code is null or trim(p_code) = '' or p_pin is null or trim(p_pin) = '' then
    raise exception 'Kode dan PIN wajib diisi';
  end if;

  if (p_state->>'organization_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    v_requested_org := (p_state->>'organization_id')::uuid;
    if auth.uid() is null or not public.is_organization_member(
      v_requested_org,
      array['organization_owner', 'organization_admin', 'event_manager', 'scorer']::text[]
    ) then
      raise exception 'Akses Arena event ditolak' using errcode = '42501';
    end if;
    v_org := v_requested_org;
  end if;

  if (p_state->>'event_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    v_requested_event := (p_state->>'event_id')::uuid;
    select e.status into v_event_status
    from public.events e
    where e.id = v_requested_event and e.organization_id = v_org;
    if v_org is null or v_event_status is null then
      raise exception 'Event Arena tidak valid untuk organisasi ini' using errcode = '22023';
    end if;
    if v_event_status = 'completed' then
      raise exception 'Event sudah selesai; Arena tidak dapat dibuka atau diubah lagi' using errcode = '55000';
    end if;
    v_event := v_requested_event;
  end if;

  insert into public.kocok_arena_venues (access_key, current_state, updated_at)
  values (v_key, p_state, v_now)
  on conflict (access_key) do update
    set current_state = excluded.current_state, updated_at = excluded.updated_at;

  insert into public.kocok_arena_meta (access_key, code, sport, owner_id, organization_id, event_id, last_seen)
  values (v_key, upper(trim(p_code)), nullif(p_state->>'sport', ''), auth.uid(), v_org, v_event, v_now)
  on conflict (access_key) do update
    set code = excluded.code,
        sport = coalesce(excluded.sport, public.kocok_arena_meta.sport),
        owner_id = coalesce(public.kocok_arena_meta.owner_id, excluded.owner_id),
        organization_id = coalesce(excluded.organization_id, public.kocok_arena_meta.organization_id),
        event_id = coalesce(excluded.event_id, public.kocok_arena_meta.event_id),
        last_seen = excluded.last_seen;

  if v_event is not null then
    update public.events
    set status = case when v_finished then 'completed' else 'live' end,
        updated_at = v_now
    where id = v_event and status in ('draft', 'registration', 'live');
  end if;

  return v_now;
end;
$$;

revoke all on function public.kocok_save_state(text, text, jsonb) from public;
grant execute on function public.kocok_save_state(text, text, jsonb) to anon, authenticated;

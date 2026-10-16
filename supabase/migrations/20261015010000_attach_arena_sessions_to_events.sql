-- Attach Arena sessions to organization events without changing the existing session API.
create or replace function public.kocok_save_state(p_code text, p_pin text, p_state jsonb)
returns timestamp with time zone
language plpgsql security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_key text := public.kocok_access_key(p_code, p_pin);
  v_now timestamptz := now();
  v_org uuid;
  v_event uuid;
begin
  if p_code is null or trim(p_code) = '' or p_pin is null or trim(p_pin) = '' then
    raise exception 'Kode dan PIN wajib diisi';
  end if;

  insert into public.kocok_arena_venues (access_key, current_state, updated_at)
  values (v_key, p_state, v_now)
  on conflict (access_key) do update
    set current_state = excluded.current_state, updated_at = excluded.updated_at;

  begin
    if auth.uid() is not null
       and (p_state->>'organization_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then
      v_org := (p_state->>'organization_id')::uuid;
      if not public.is_organization_member(v_org) then v_org := null; end if;
    end if;
    if v_org is not null
       and (p_state->>'event_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       and exists (select 1 from public.events e where e.id = (p_state->>'event_id')::uuid and e.organization_id = v_org)
    then
      v_event := (p_state->>'event_id')::uuid;
    end if;

    insert into public.kocok_arena_meta (access_key, code, sport, owner_id, organization_id, event_id, last_seen)
    values (v_key, upper(trim(p_code)), nullif(p_state->>'sport', ''), auth.uid(), v_org, v_event, v_now)
    on conflict (access_key) do update
      set code = excluded.code,
          sport = coalesce(excluded.sport, public.kocok_arena_meta.sport),
          owner_id = coalesce(public.kocok_arena_meta.owner_id, excluded.owner_id),
          organization_id = coalesce(excluded.organization_id, public.kocok_arena_meta.organization_id),
          event_id = coalesce(excluded.event_id, public.kocok_arena_meta.event_id),
          last_seen = excluded.last_seen;
  exception when others then
    null;
  end;

  return v_now;
end;
$function$;

create or replace function public.kocok_archive_tournament(p_code text, p_pin text, p_summary jsonb)
returns bigint
language plpgsql security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_key text := public.kocok_access_key(p_code, p_pin);
  v_id bigint;
  v_org uuid;
  v_event uuid;
begin
  insert into public.kocok_arena_venues (access_key, current_state)
  values (v_key, null)
  on conflict (access_key) do nothing;

  insert into public.kocok_arena_history (access_key, summary)
  values (v_key, p_summary)
  returning id into v_id;

  begin
    if auth.uid() is not null
       and (p_summary->>'organization_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then
      v_org := (p_summary->>'organization_id')::uuid;
      if not public.is_organization_member(v_org) then v_org := null; end if;
    end if;
    if v_org is not null
       and (p_summary->>'event_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       and exists (select 1 from public.events e where e.id = (p_summary->>'event_id')::uuid and e.organization_id = v_org)
    then
      v_event := (p_summary->>'event_id')::uuid;
    end if;

    insert into public.kocok_arena_meta (access_key, code, sport, owner_id, organization_id, event_id)
    values (v_key, upper(trim(p_code)), nullif(p_summary->>'sport', ''), auth.uid(), v_org, v_event)
    on conflict (access_key) do update
      set code = excluded.code,
          sport = coalesce(excluded.sport, public.kocok_arena_meta.sport),
          owner_id = coalesce(public.kocok_arena_meta.owner_id, excluded.owner_id),
          organization_id = coalesce(excluded.organization_id, public.kocok_arena_meta.organization_id),
          event_id = coalesce(excluded.event_id, public.kocok_arena_meta.event_id),
          last_seen = now();
  exception when others then
    null;
  end;

  return v_id;
end;
$function$;

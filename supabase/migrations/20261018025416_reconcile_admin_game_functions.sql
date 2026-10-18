-- Reconcile admin game functions without brittle text replacement.
-- Safe to run on existing development and production databases.

create or replace function public.admin_list_games(
  p_status text default 'all', p_search text default null, p_limit integer default 200)
returns jsonb
language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 200), 1), 500);
  v_search text := nullif(trim(p_search), '');
  v_counts jsonb;
  v_items jsonb;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then
    raise exception 'Akses ditolak' using errcode = '42501';
  end if;
  if v_search is not null then
    v_search := replace(replace(replace(v_search, '\\', '\\\\'), '%', '\\%'), '_', '\\_');
  end if;

  with base as (
    select 'v:' || v.access_key as game_key,
           case when v.updated_at > now() - interval '20 minutes' then 'live' else 'idle' end as g_status,
           v.access_key as akey, v.current_state as st, v.updated_at as last_at, null::timestamptz as fin_at
    from public.kocok_arena_venues v
    where v.current_state is not null
      and coalesce(v.current_state->>'finished', 'false') <> 'true'
      and not exists (
        select 1 from public.kocok_arena_history h3
        where h3.access_key = v.access_key and h3.finished_at >= v.updated_at
      )
    union all
    select 'h:' || h.id::text, 'finished', h.access_key, h.summary, h.finished_at, h.finished_at
    from public.kocok_arena_history h
    union all
    select 'v:' || v.access_key, 'finished', v.access_key, v.current_state, v.updated_at, v.updated_at
    from public.kocok_arena_venues v
    where coalesce(v.current_state->>'finished', 'false') = 'true'
      and not exists (select 1 from public.kocok_arena_history h2 where h2.access_key = v.access_key)
  ), rws as (
    select b.*, m.code as m_code, m.sport as m_sport, pr.username as owner_name,
           case when jsonb_typeof(b.st->'players') = 'array' then jsonb_array_length(b.st->'players') else 0 end as n_players
    from base b
    left join public.kocok_arena_meta m on m.access_key = b.akey
    left join public.profiles pr on pr.id = m.owner_id
  ), cnt as (
    select jsonb_build_object(
      'live', count(*) filter (where g_status = 'live'),
      'idle', count(*) filter (where g_status = 'idle'),
      'finished', count(*) filter (where g_status = 'finished'),
      'all', count(*)) as c
    from rws
  ), picked as (
    select * from rws r
    where (coalesce(p_status, 'all') = 'all' or r.g_status = p_status)
      and (v_search is null
           or coalesce(r.m_code, '') ilike '%' || v_search || '%'
           or r.akey ilike v_search || '%'
           or coalesce(r.owner_name, '') ilike '%' || v_search || '%'
           or coalesce((r.st->'players')::text, '') ilike '%' || v_search || '%')
    order by (r.g_status = 'live') desc, r.last_at desc nulls last
    limit v_limit
  )
  select (select c from cnt),
         coalesce((select jsonb_agg(jsonb_build_object(
           'game_key', p.game_key,
           'status', p.g_status,
           'key_short', left(p.akey, 6),
           'code', p.m_code,
           'sport', p.m_sport,
           'mode', p.st->>'mode',
           'format', p.st->>'format',
           'players', p.n_players,
           'courts', case when (p.st->>'courtsRequested') ~ '^[0-9]+$' then (p.st->>'courtsRequested')::int end,
           'round', case when (p.st->>'round') ~ '^[0-9]+$' then (p.st->>'round')::int end,
           'owner', p.owner_name,
           'last_activity_at', p.last_at,
           'finished_at', p.fin_at,
           'auto_closed', coalesce(p.st->>'autoClosed', 'false') = 'true'
         ) order by (p.g_status = 'live') desc, p.last_at desc nulls last) from picked p), '[]'::jsonb)
  into v_counts, v_items;

  return jsonb_build_object('counts', v_counts, 'items', v_items);
end;
$$;

create or replace function public.admin_get_game(p_game_key text)
returns jsonb
language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  v_state jsonb; v_key text; v_last timestamptz; v_status text; v_fin timestamptz;
  v_code text; v_sport text; v_owner text;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then
    raise exception 'Akses ditolak' using errcode = '42501';
  end if;

  if p_game_key like 'v:%' then
    select v.access_key, v.current_state, v.updated_at into v_key, v_state, v_last
    from public.kocok_arena_venues v where v.access_key = substr(p_game_key, 3);
    if not found then raise exception 'Permainan tidak ditemukan' using errcode = 'P0002'; end if;
    v_status := case when coalesce(v_state->>'finished', 'false') = 'true' then 'finished'
                      when v_last > now() - interval '20 minutes' then 'live' else 'idle' end;
    if v_status = 'finished' then v_fin := v_last; end if;
  elsif p_game_key ~ '^h:[0-9]+$' then
    select h.access_key, h.summary, h.finished_at into v_key, v_state, v_last
    from public.kocok_arena_history h where h.id = substr(p_game_key, 3)::bigint;
    if not found then raise exception 'Permainan tidak ditemukan' using errcode = 'P0002'; end if;
    v_status := 'finished'; v_fin := v_last;
  else
    raise exception 'Kunci permainan tidak valid' using errcode = '22023';
  end if;

  if v_status <> 'finished' and exists (
    select 1 from public.kocok_arena_history h4
    where h4.access_key = v_key and h4.finished_at >= v_last
  ) then
    v_status := 'finished';
    v_fin := v_last;
  end if;

  select m.code, m.sport, pr.username into v_code, v_sport, v_owner
  from public.kocok_arena_meta m left join public.profiles pr on pr.id = m.owner_id
  where m.access_key = v_key;

  return jsonb_build_object(
    'game_key', p_game_key, 'status', v_status, 'key_short', left(v_key, 6),
    'code', v_code, 'sport', v_sport, 'owner', v_owner,
    'last_activity_at', v_last, 'finished_at', v_fin,
    'auto_closed', coalesce(v_state->>'autoClosed', 'false') = 'true',
    'state', jsonb_build_object(
      'mode', v_state->'mode', 'format', v_state->'format', 'round', v_state->'round',
      'courtsRequested', v_state->'courtsRequested', 'players', v_state->'players',
      'pairs', v_state->'pairs', 'pairMembers', v_state->'pairMembers', 'paused', v_state->'paused',
      'current', v_state->'current', 'currentSitOut', v_state->'currentSitOut',
      'leaderboard', v_state->'leaderboard', 'matchHistory', v_state->'matchHistory',
      'sessionDurationMin', v_state->'sessionDurationMin', 'sessionEndAt', v_state->'sessionEndAt'
    )
  );
end;
$$;

revoke all on function public.admin_list_games(text, text, integer) from public, anon;
grant execute on function public.admin_list_games(text, text, integer) to authenticated;
revoke all on function public.admin_get_game(text) from public, anon;
grant execute on function public.admin_get_game(text) to authenticated;

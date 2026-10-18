-- Connect guest registrations to authenticated player identity and expose safe cross-event stats.
create or replace function public.claim_event_guest(
  p_public_code text,
  p_registration_token text
)
returns boolean
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_player public.event_players;
begin
  if auth.uid() is null then raise exception 'Login diperlukan' using errcode = '42501'; end if;
  select ep.* into v_player
  from public.event_players ep
  join public.events e on e.id = ep.event_id
  where e.public_code = lower(trim(p_public_code))
    and ep.registration_token_hash = encode(extensions.digest(trim(p_registration_token), 'sha256'), 'hex')
    and ep.status <> 'withdrawn'
  limit 1;
  if not found then raise exception 'Pendaftaran tidak ditemukan' using errcode = 'P0002'; end if;
  if v_player.player_user_id is not null and v_player.player_user_id <> auth.uid() then
    raise exception 'Pendaftaran sudah terhubung ke akun lain' using errcode = '23505';
  end if;
  update public.event_players set player_user_id = auth.uid() where event_id = v_player.event_id and display_name = v_player.display_name;
  return true;
end;
$$;
revoke all on function public.claim_event_guest(text, text) from public, anon;
grant execute on function public.claim_event_guest(text, text) to authenticated;

create or replace function public.get_player_dashboard()
returns table (profile jsonb, summary jsonb, sports jsonb, events jsonb, matches jsonb)
language sql security definer
set search_path = public
as $$
with mine as (
  select ep.event_id, ep.display_name, ep.status, ep.tier, ep.gender, ep.registered_at,
         e.name as event_name, e.sport, e.format, e.status as event_status, e.starts_at, e.public_code,
         m.access_key
  from public.event_players ep
  join public.events e on e.id = ep.event_id
  left join public.kocok_arena_meta m on m.event_id = ep.event_id
  where ep.player_user_id = auth.uid() and ep.status <> 'withdrawn'
), played as (
  select distinct on (km.id)
    km.id, km.played_at, km.round, km.court, km.score_a, km.score_b, km.winner,
    mi.event_id, mi.event_name, mi.sport, mi.format, mi.event_status, mi.starts_at, mi.public_code,
    case when mi.display_name = any(km.team_a) then 'A' when mi.display_name = any(km.team_b) then 'B' end as side,
    mi.display_name
  from public.kocok_arena_matches km
  join mine mi on mi.access_key = km.access_key
  where km.score_a is not null and km.score_b is not null
  order by km.id, mi.registered_at desc
), result_rows as (
  select p.*,
    case when p.winner is null then 'draw' when p.winner = p.side then 'win' else 'loss' end as result
  from played p
  where p.side is not null
), event_stats as (
  select event_id, event_name, sport, format, event_status, starts_at, public_code,
    count(*)::int as matches,
    count(*) filter (where result = 'win')::int as wins,
    count(*) filter (where result = 'loss')::int as losses,
    count(*) filter (where result = 'draw')::int as draws
  from result_rows group by event_id, event_name, sport, format, event_status, starts_at, public_code
), sport_stats as (
  select sport, count(*)::int as matches,
    count(*) filter (where result = 'win')::int as wins,
    count(*) filter (where result = 'loss')::int as losses,
    count(*) filter (where result = 'draw')::int as draws
  from result_rows group by sport order by sport
), totals as (
  select count(*)::int as matches,
    count(*) filter (where result = 'win')::int as wins,
    count(*) filter (where result = 'loss')::int as losses,
    count(*) filter (where result = 'draw')::int as draws
  from result_rows
), latest_profile as (
  select p.id, p.username, p.display_name, p.is_active
  from public.profiles p where p.id = auth.uid()
)
select
  coalesce((select to_jsonb(latest_profile) from latest_profile), jsonb_build_object('id', auth.uid())),
  (select jsonb_build_object('events', (select count(distinct event_id)::int from mine), 'matches', totals.matches, 'wins', totals.wins, 'losses', totals.losses, 'draws', totals.draws) from totals),
  coalesce((select jsonb_agg(to_jsonb(sport_stats) order by sport_stats.sport) from sport_stats), '[]'::jsonb),
  coalesce((select jsonb_agg(to_jsonb(event_stats) order by event_stats.starts_at desc nulls last) from event_stats), '[]'::jsonb),
  coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'event_name', x.event_name, 'sport', x.sport, 'round', x.round, 'court', x.court, 'score_a', x.score_a, 'score_b', x.score_b, 'result', x.result, 'played_at', x.played_at) order by x.played_at desc) from (select * from result_rows order by played_at desc limit 20) x), '[]'::jsonb);
$$;
revoke all on function public.get_player_dashboard() from public, anon;
grant execute on function public.get_player_dashboard() to authenticated;




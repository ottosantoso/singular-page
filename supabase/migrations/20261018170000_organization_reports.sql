-- Organization reports with role-scoped, filterable aggregates.
create or replace function public.get_organization_report(
  p_organization_id uuid,
  p_event_id uuid default null,
  p_venue_id uuid default null,
  p_sport text default null,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_report jsonb;
begin
  if auth.uid() is null then raise exception 'Login diperlukan' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.role_code in ('organization_owner', 'organization_admin')
  ) then raise exception 'Akses laporan ditolak' using errcode = '42501'; end if;

  with scoped_events as (
    select e.* from public.events e
    where e.organization_id = p_organization_id
      and (p_event_id is null or e.id = p_event_id)
      and (p_venue_id is null or e.venue_id = p_venue_id)
      and (p_sport is null or p_sport = '' or e.sport = p_sport)
      and (p_from is null or coalesce(e.starts_at, e.created_at) >= p_from)
      and (p_to is null or coalesce(e.starts_at, e.created_at) < p_to)
  ), scoped_players as (
    select ep.* from public.event_players ep join scoped_events se on se.id = ep.event_id where ep.status <> 'withdrawn'
  ), scoped_matches as (
    select km.*, m.event_id, se.venue_id, se.name as event_name, se.sport
    from public.kocok_arena_matches km
    join public.kocok_arena_meta m on m.access_key = km.access_key
    join scoped_events se on se.id = m.event_id
    where km.score_a is not null and km.score_b is not null
  ), summary as (
    select
      (select count(*)::int from scoped_events) as events,
      (select count(*)::int from scoped_players) as participants,
      (select count(*)::int from scoped_matches) as matches,
      (select count(*)::int from scoped_players where status = 'checked_in') as checked_in,
      (select count(*)::int from scoped_players where status in ('registered','checked_in')) as registered,
      (select count(*)::int from scoped_players where status = 'waitlisted') as waitlisted,
      (select count(*)::int from scoped_matches where winner = 'A') as team_a_wins,
      (select count(*)::int from scoped_matches where winner = 'B') as team_b_wins
  ), by_event as (
    select se.id, se.name, se.sport, se.status, count(distinct sp.id)::int as participants,
      count(distinct sp.id) filter (where sp.status = 'checked_in')::int as checked_in,
      count(distinct sm.id)::int as matches
    from scoped_events se
    left join scoped_players sp on sp.event_id = se.id
    left join scoped_matches sm on sm.event_id = se.id
    group by se.id, se.name, se.sport, se.status
  ), by_sport as (
    select sport, count(*)::int as matches, count(distinct event_id)::int as events
    from scoped_matches group by sport order by sport
  ), by_venue as (
    select v.id, v.name, count(distinct se.id)::int as events, count(distinct sm.id)::int as matches
    from public.venues v
    join scoped_events se on se.venue_id = v.id
    left join scoped_matches sm on sm.event_id = se.id
    group by v.id, v.name order by v.name
  ), by_court as (
    select c.id, c.name, v.name as venue_name, count(distinct sm.id)::int as matches
    from public.courts c join public.venues v on v.id = c.venue_id
    join scoped_events se on se.venue_id = v.id
    left join scoped_matches sm on sm.event_id = se.id and sm.court = substring(c.name from '[0-9]+')::int
    where v.organization_id = p_organization_id
    group by c.id, c.name, v.name order by v.name, c.name
  )
  select jsonb_build_object(
    'summary', (select to_jsonb(summary) from summary),
    'by_event', coalesce((select jsonb_agg(to_jsonb(by_event)) from by_event), '[]'::jsonb),
    'by_sport', coalesce((select jsonb_agg(to_jsonb(by_sport)) from by_sport), '[]'::jsonb),
    'by_venue', coalesce((select jsonb_agg(to_jsonb(by_venue)) from by_venue), '[]'::jsonb),
    'by_court', coalesce((select jsonb_agg(to_jsonb(by_court)) from by_court), '[]'::jsonb)
  ) into v_report;
  return v_report;
end;
$$;
revoke all on function public.get_organization_report(uuid, uuid, uuid, text, timestamptz, timestamptz) from public, anon;
grant execute on function public.get_organization_report(uuid, uuid, uuid, text, timestamptz, timestamptz) to authenticated;

-- Include organization branding in the public event payload.
create or replace function public.get_public_event(
  p_public_code text,
  p_registration_token text default null
)
returns table (event jsonb, players jsonb, me jsonb, matches jsonb, history jsonb)
language sql security definer
set search_path = public, extensions
as $$
with selected_event as (
  select e.*, v.name as venue_name, o.name as organization_name, o.logo_url, o.banner_url, o.primary_color, o.secondary_color
  from public.events e join public.organizations o on o.id = e.organization_id left join public.venues v on v.id = e.venue_id
  where e.public_code = lower(trim(p_public_code)) and e.public_results = true and e.status in ('registration', 'live', 'completed') limit 1
), arena_link as (
  select m.access_key from public.kocok_arena_meta m join selected_event e on e.id = m.event_id order by m.last_seen desc limit 1
)
select
  (select jsonb_build_object('id',e.id,'name',e.name,'public_code',e.public_code,'sport',e.sport,'format',e.format,'status',e.status,'starts_at',e.starts_at,'ends_at',e.ends_at,'venue_name',e.venue_name,'organization_name',e.organization_name,'logo_url',e.logo_url,'banner_url',e.banner_url,'primary_color',e.primary_color,'secondary_color',e.secondary_color,'max_players',e.max_players) from selected_event e),
  coalesce((select jsonb_agg(jsonb_build_object('display_name',ep.display_name,'gender',ep.gender,'tier',ep.tier,'status',ep.status,'seed',ep.seed,'registered_at',ep.registered_at,'checked_in_at',ep.checked_in_at) order by ep.seed nulls last,ep.registered_at) from public.event_players ep join selected_event e on e.id=ep.event_id where ep.status <> 'withdrawn' and ep.consent_to_show_name),'[]'::jsonb),
  (select to_jsonb(ep) - 'registration_token_hash' - 'email' - 'phone' - 'photo_url' from public.event_players ep join selected_event e on e.id=ep.event_id where p_registration_token is not null and ep.registration_token_hash=encode(extensions.digest(trim(p_registration_token),'sha256'),'hex') limit 1),
  coalesce((select jsonb_agg(to_jsonb(km) order by km.round,km.court) from public.kocok_arena_matches km join arena_link al on al.access_key=km.access_key),'[]'::jsonb),
  coalesce((select jsonb_agg(to_jsonb(kh) order by kh.finished_at desc) from public.kocok_arena_history kh join arena_link al on al.access_key=kh.access_key),'[]'::jsonb);
$$;
revoke all on function public.get_public_event(text,text) from public;
grant execute on function public.get_public_event(text,text) to anon, authenticated;

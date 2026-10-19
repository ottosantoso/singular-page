-- Platform subscription mode and database-enforced quotas.
create table if not exists public.platform_settings (
  id boolean primary key default true check (id),
  subscription_enabled boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.platform_settings (id, subscription_enabled) values (true, false) on conflict (id) do nothing;
alter table public.subscription_plans add column if not exists max_members integer not null default 50;
alter table public.organization_subscriptions add column if not exists override_max_members integer;
update public.subscription_plans set max_members = case code when 'free' then 50 when 'club' then 200 when 'pro' then 1000 else 999999 end;

create or replace function public.get_subscription_mode()
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object('subscription_enabled', subscription_enabled, 'updated_at', updated_at)
  from public.platform_settings where id = true;
$$;

create or replace function public.platform_set_subscription_mode(p_enabled boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'platform_admin') then raise exception 'Akses platform admin diperlukan' using errcode = '42501'; end if;
  insert into public.platform_settings (id, subscription_enabled, updated_by, updated_at) values (true, p_enabled, auth.uid(), now())
  on conflict (id) do update set subscription_enabled = excluded.subscription_enabled, updated_by = auth.uid(), updated_at = now();
  return public.get_subscription_mode();
end;
$$;

create or replace function public.get_organization_quota(p_organization_id uuid)
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'organization_id', s.organization_id, 'plan_code', s.plan_code, 'status', s.status,
    'subscription_enabled', coalesce((select subscription_enabled from public.platform_settings where id = true), false),
    'max_venues', coalesce(s.override_max_venues, p.max_venues), 'max_courts', coalesce(s.override_max_courts, p.max_courts),
    'max_active_events', coalesce(s.override_max_active_events, p.max_active_events), 'max_players_per_event', coalesce(s.override_max_players_per_event, p.max_players_per_event),
    'max_staff', coalesce(s.override_max_staff, p.max_staff), 'max_members', coalesce(s.override_max_members, p.max_members),
    'override_active', (s.override_max_venues is not null or s.override_max_courts is not null or s.override_max_active_events is not null or s.override_max_players_per_event is not null or s.override_max_staff is not null or s.override_max_members is not null)
  ) from public.organization_subscriptions s join public.subscription_plans p on p.code = s.plan_code where s.organization_id = p_organization_id;
$$;

create or replace function public.platform_set_organization_quota(p_organization_id uuid,p_plan_code text,p_status text default 'active',p_max_venues integer default null,p_max_courts integer default null,p_max_active_events integer default null,p_max_players_per_event integer default null,p_max_staff integer default null,p_note text default null,p_max_members integer default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_result jsonb;
begin
  if not public.has_role(auth.uid(),'platform_admin') then raise exception 'Akses platform admin diperlukan' using errcode='42501'; end if;
  if not exists(select 1 from public.subscription_plans where code=p_plan_code and is_active) then raise exception 'Paket subscription tidak valid'; end if;
  insert into public.organization_subscriptions(organization_id,plan_code,status,override_max_venues,override_max_courts,override_max_active_events,override_max_players_per_event,override_max_staff,override_max_members,note,updated_by)
  values(p_organization_id,p_plan_code,p_status,p_max_venues,p_max_courts,p_max_active_events,p_max_players_per_event,p_max_staff,p_max_members,p_note,auth.uid())
  on conflict(organization_id) do update set plan_code=excluded.plan_code,status=excluded.status,override_max_venues=excluded.override_max_venues,override_max_courts=excluded.override_max_courts,override_max_active_events=excluded.override_max_active_events,override_max_players_per_event=excluded.override_max_players_per_event,override_max_staff=excluded.override_max_staff,override_max_members=excluded.override_max_members,note=excluded.note,updated_by=auth.uid(),updated_at=now();
  update public.organizations set subscription_plan=p_plan_code,updated_at=now() where id=p_organization_id;
  select public.get_organization_quota(p_organization_id) into v_result; return v_result;
end;
$$;

create or replace function public.enforce_organization_quota()
returns trigger language plpgsql security definer set search_path = public as $$
declare q jsonb; enabled boolean; current_count integer; limit_count integer; org_id uuid; v_event_id uuid;
begin
  select coalesce(subscription_enabled, false) into enabled from public.platform_settings where id = true;
  if not enabled then return coalesce(new, old); end if;
  if tg_table_name = 'venues' then org_id := new.organization_id; q := public.get_organization_quota(org_id); if q is null then return new; end if; select count(*) into current_count from public.venues v where v.organization_id = org_id and v.is_active; limit_count := (q->>'max_venues')::int; if tg_op = 'INSERT' and current_count >= limit_count then raise exception 'Quota venue organisasi sudah tercapai'; end if;
  elsif tg_table_name = 'courts' then select v.organization_id into org_id from public.venues v where v.id = new.venue_id; q := public.get_organization_quota(org_id); if q is null then return new; end if; select count(*) into current_count from public.courts c where c.venue_id = new.venue_id and c.is_active; limit_count := (q->>'max_courts')::int; if tg_op = 'INSERT' and current_count >= limit_count then raise exception 'Quota court organisasi sudah tercapai'; end if;
  elsif tg_table_name = 'events' then org_id := new.organization_id; q := public.get_organization_quota(org_id); if q is null then return new; end if; select count(*) into current_count from public.events e where e.organization_id = org_id and e.status not in ('completed','cancelled'); limit_count := (q->>'max_active_events')::int; if tg_op = 'INSERT' and current_count >= limit_count then raise exception 'Quota event aktif organisasi sudah tercapai'; end if;
  elsif tg_table_name = 'event_players' then v_event_id := new.event_id; select e.organization_id into org_id from public.events e where e.id = v_event_id; q := public.get_organization_quota(org_id); if q is null then return new; end if; select count(*) into current_count from public.event_players ep where ep.event_id = v_event_id and ep.status <> 'withdrawn'; limit_count := (q->>'max_players_per_event')::int; if tg_op = 'INSERT' and current_count >= limit_count then raise exception 'Quota peserta event sudah tercapai'; end if;
  elsif tg_table_name = 'organization_members' then org_id := new.organization_id; q := public.get_organization_quota(org_id); if q is null then return new; end if; select count(*) into current_count from public.organization_members om where om.organization_id = org_id and om.status in ('active','invited'); limit_count := (q->>'max_members')::int; if tg_op = 'INSERT' and current_count >= limit_count then raise exception 'Quota anggota organisasi sudah tercapai'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_venues_quota on public.venues;
drop trigger if exists enforce_courts_quota on public.courts;
drop trigger if exists enforce_events_quota on public.events;
drop trigger if exists enforce_event_players_quota on public.event_players;
drop trigger if exists enforce_members_quota on public.organization_members;
create trigger enforce_venues_quota before insert on public.venues for each row execute function public.enforce_organization_quota();
create trigger enforce_courts_quota before insert on public.courts for each row execute function public.enforce_organization_quota();
create trigger enforce_events_quota before insert on public.events for each row execute function public.enforce_organization_quota();
create trigger enforce_event_players_quota before insert on public.event_players for each row execute function public.enforce_organization_quota();
create trigger enforce_members_quota before insert on public.organization_members for each row execute function public.enforce_organization_quota();

grant execute on function public.get_subscription_mode(), public.platform_set_subscription_mode(boolean) to authenticated;
revoke all on function public.get_subscription_mode(), public.platform_set_subscription_mode(boolean) from public, anon;

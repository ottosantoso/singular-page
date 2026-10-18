-- Manual subscription billing and organization quota management.
create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  price_monthly numeric(12,2) not null default 0,
  max_venues integer not null default 1,
  max_courts integer not null default 2,
  max_active_events integer not null default 2,
  max_players_per_event integer not null default 32,
  max_staff integer not null default 5,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_plans_limits_check check (max_venues >= 0 and max_courts >= 0 and max_active_events >= 0 and max_players_per_event >= 0 and max_staff >= 0)
);

insert into public.subscription_plans (code, name, price_monthly, max_venues, max_courts, max_active_events, max_players_per_event, max_staff)
values
  ('free', 'Free', 0, 1, 2, 2, 32, 5),
  ('club', 'Club', 299000, 2, 8, 10, 100, 15),
  ('pro', 'Pro', 799000, 5, 30, 50, 300, 50),
  ('enterprise', 'Enterprise', 0, 999999, 999999, 999999, 999999, 999999)
on conflict (code) do update set name = excluded.name, price_monthly = excluded.price_monthly,
  max_venues = excluded.max_venues, max_courts = excluded.max_courts,
  max_active_events = excluded.max_active_events, max_players_per_event = excluded.max_players_per_event,
  max_staff = excluded.max_staff, updated_at = now();

create table if not exists public.organization_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  plan_code text not null references public.subscription_plans(code),
  status text not null default 'trialing',
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  trial_ends_at timestamptz,
  override_max_venues integer,
  override_max_courts integer,
  override_max_active_events integer,
  override_max_players_per_event integer,
  override_max_staff integer,
  note text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_subscriptions_status_check check (status in ('trialing', 'active', 'past_due', 'cancelled', 'expired')),
  constraint organization_subscriptions_overrides_check check (
    coalesce(override_max_venues, 0) >= 0 and coalesce(override_max_courts, 0) >= 0 and
    coalesce(override_max_active_events, 0) >= 0 and coalesce(override_max_players_per_event, 0) >= 0 and
    coalesce(override_max_staff, 0) >= 0
  )
);

insert into public.organization_subscriptions (organization_id, plan_code, status)
select o.id, case when o.subscription_plan in ('free','club','pro','enterprise') then o.subscription_plan else 'free' end, 'active'
from public.organizations o
on conflict (organization_id) do nothing;

create table if not exists public.subscription_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subscription_id uuid references public.organization_subscriptions(id) on delete set null,
  invoice_number text not null unique,
  plan_code text not null references public.subscription_plans(code),
  amount numeric(12,2) not null default 0,
  period_start timestamptz not null,
  period_end timestamptz not null,
  due_at timestamptz not null,
  status text not null default 'pending_payment',
  notes text,
  paid_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_invoices_status_check check (status in ('draft','pending_payment','proof_submitted','under_review','paid','rejected','expired','cancelled'))
);

create table if not exists public.payment_proofs (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.subscription_invoices(id) on delete cascade,
  file_path text not null,
  transferred_amount numeric(12,2),
  transferred_at timestamptz,
  sender_name text,
  note text,
  status text not null default 'submitted',
  submitted_by uuid not null references auth.users(id) on delete restrict,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint payment_proofs_status_check check (status in ('submitted','approved','rejected'))
);

create or replace function public.get_organization_quota(p_organization_id uuid)
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'organization_id', s.organization_id,
    'plan_code', s.plan_code,
    'status', s.status,
    'max_venues', coalesce(s.override_max_venues, p.max_venues),
    'max_courts', coalesce(s.override_max_courts, p.max_courts),
    'max_active_events', coalesce(s.override_max_active_events, p.max_active_events),
    'max_players_per_event', coalesce(s.override_max_players_per_event, p.max_players_per_event),
    'max_staff', coalesce(s.override_max_staff, p.max_staff),
    'override_active', (s.override_max_venues is not null or s.override_max_courts is not null or s.override_max_active_events is not null or s.override_max_players_per_event is not null or s.override_max_staff is not null)
  )
  from public.organization_subscriptions s join public.subscription_plans p on p.code = s.plan_code
  where s.organization_id = p_organization_id;
$$;

create or replace function public.platform_set_organization_quota(
  p_organization_id uuid,
  p_plan_code text,
  p_status text default 'active',
  p_max_venues integer default null,
  p_max_courts integer default null,
  p_max_active_events integer default null,
  p_max_players_per_event integer default null,
  p_max_staff integer default null,
  p_note text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_result jsonb;
begin
  if not public.has_role(auth.uid(), 'platform_admin') then raise exception 'Akses platform admin diperlukan' using errcode = '42501'; end if;
  if not exists (select 1 from public.subscription_plans where code = p_plan_code and is_active) then raise exception 'Paket subscription tidak valid'; end if;
  insert into public.organization_subscriptions (organization_id, plan_code, status, override_max_venues, override_max_courts, override_max_active_events, override_max_players_per_event, override_max_staff, note, updated_by)
  values (p_organization_id, p_plan_code, p_status, p_max_venues, p_max_courts, p_max_active_events, p_max_players_per_event, p_max_staff, p_note, auth.uid())
  on conflict (organization_id) do update set plan_code = excluded.plan_code, status = excluded.status, override_max_venues = excluded.override_max_venues, override_max_courts = excluded.override_max_courts, override_max_active_events = excluded.override_max_active_events, override_max_players_per_event = excluded.override_max_players_per_event, override_max_staff = excluded.override_max_staff, note = excluded.note, updated_by = auth.uid(), updated_at = now();
  update public.organizations set subscription_plan = p_plan_code, updated_at = now() where id = p_organization_id;
  select public.get_organization_quota(p_organization_id) into v_result;
  return v_result;
end;
$$;

create or replace function public.platform_list_subscription_plans()
returns setof public.subscription_plans language sql security definer set search_path = public as $$
  select p from public.subscription_plans p where public.has_role(auth.uid(), 'platform_admin') order by p.price_monthly, p.name;
$$;

create or replace function public.create_subscription_invoice(p_organization_id uuid, p_plan_code text, p_period_start timestamptz, p_period_end timestamptz, p_due_at timestamptz, p_notes text default null)
returns public.subscription_invoices language plpgsql security definer set search_path = public as $$
declare v_invoice public.subscription_invoices; v_number text;
begin
  if not exists (select 1 from public.organization_members where organization_id = p_organization_id and user_id = auth.uid() and status = 'active' and role_code in ('organization_owner','organization_admin')) then raise exception 'Akses invoice ditolak' using errcode = '42501'; end if;
  select 'INV-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)) into v_number;
  insert into public.subscription_invoices (organization_id, subscription_id, invoice_number, plan_code, amount, period_start, period_end, due_at, notes)
  select p_organization_id, s.id, v_number, p.code, p.price_monthly, p_period_start, p_period_end, p_due_at, p_notes from public.subscription_plans p left join public.organization_subscriptions s on s.organization_id = p_organization_id where p.code = p_plan_code returning * into v_invoice;
  return v_invoice;
end;
$$;

create or replace function public.platform_review_payment(p_invoice_id uuid, p_status text, p_note text default null)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'platform_admin') then raise exception 'Akses platform admin diperlukan' using errcode = '42501'; end if;
  if p_status not in ('paid','rejected') then raise exception 'Status review tidak valid'; end if;
  update public.subscription_invoices set status = p_status, paid_at = case when p_status = 'paid' then now() else null end, verified_by = auth.uid(), notes = coalesce(p_note, notes), updated_at = now() where id = p_invoice_id;
  if p_status = 'paid' then update public.organization_subscriptions s set status = 'active', starts_at = now(), ends_at = i.period_end, updated_by = auth.uid(), updated_at = now() from public.subscription_invoices i where i.id = p_invoice_id and s.organization_id = i.organization_id; end if;
  return found;
end;
$$;

alter table public.subscription_plans enable row level security;
alter table public.organization_subscriptions enable row level security;
alter table public.subscription_invoices enable row level security;
alter table public.payment_proofs enable row level security;
create policy subscription_plans_read_active on public.subscription_plans for select to authenticated using (is_active or public.has_role(auth.uid(), 'platform_admin'));
create policy organization_subscriptions_read_member on public.organization_subscriptions for select to authenticated using (exists (select 1 from public.organization_members om where om.organization_id = organization_subscriptions.organization_id and om.user_id = auth.uid() and om.status = 'active') or public.has_role(auth.uid(), 'platform_admin'));
create policy invoices_read_member on public.subscription_invoices for select to authenticated using (exists (select 1 from public.organization_members om where om.organization_id = subscription_invoices.organization_id and om.user_id = auth.uid() and om.status = 'active' and om.role_code in ('organization_owner','organization_admin')) or public.has_role(auth.uid(), 'platform_admin'));
create policy payment_proofs_read_owner_or_platform on public.payment_proofs for select to authenticated using (submitted_by = auth.uid() or public.has_role(auth.uid(), 'platform_admin') or exists (select 1 from public.subscription_invoices i join public.organization_members om on om.organization_id = i.organization_id where i.id = payment_proofs.invoice_id and om.user_id = auth.uid() and om.status = 'active' and om.role_code in ('organization_owner','organization_admin')));

revoke all on table public.subscription_plans, public.organization_subscriptions, public.subscription_invoices, public.payment_proofs from anon;
grant select on public.subscription_plans, public.organization_subscriptions, public.subscription_invoices, public.payment_proofs to authenticated;
revoke all on function public.get_organization_quota(uuid), public.platform_set_organization_quota(uuid,text,text,integer,integer,integer,integer,integer,text), public.platform_list_subscription_plans(), public.create_subscription_invoice(uuid,text,timestamptz,timestamptz,timestamptz,text), public.platform_review_payment(uuid,text,text) from public, anon;
grant execute on function public.get_organization_quota(uuid), public.platform_set_organization_quota(uuid,text,text,integer,integer,integer,integer,integer,text), public.platform_list_subscription_plans(), public.create_subscription_invoice(uuid,text,timestamptz,timestamptz,timestamptz,text), public.platform_review_payment(uuid,text,text) to authenticated;

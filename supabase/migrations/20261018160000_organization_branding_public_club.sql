-- Organization branding assets and public club profile support.
alter table public.organizations add column if not exists banner_url text;
alter table public.organizations add column if not exists public_description text;

insert into storage.buckets (id, name, public)
values ('organization-branding', 'organization-branding', true)
on conflict (id) do update set public = excluded.public;

create policy "organization branding public read"
on storage.objects for select
to public
using (bucket_id = 'organization-branding');

create policy "organization branding admin upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'organization-branding'
  and exists (
    select 1 from public.organization_members om
    where om.organization_id = split_part(name, '/', 1)::uuid
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.role_code in ('organization_owner', 'organization_admin')
  )
);

create policy "organization branding admin update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'organization-branding'
  and exists (
    select 1 from public.organization_members om
    where om.organization_id = split_part(name, '/', 1)::uuid
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.role_code in ('organization_owner', 'organization_admin')
  )
)
with check (bucket_id = 'organization-branding');

create policy "organization branding admin delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'organization-branding'
  and exists (
    select 1 from public.organization_members om
    where om.organization_id = split_part(name, '/', 1)::uuid
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.role_code in ('organization_owner', 'organization_admin')
  )
);

create or replace function public.get_public_organization(p_slug text)
returns table (organization jsonb, venues jsonb, events jsonb)
language sql security definer
set search_path = public
as $$
with org as (
  select o.* from public.organizations o where o.slug = lower(trim(p_slug)) and o.is_active limit 1
)
select
  (select jsonb_build_object('id', o.id, 'name', o.name, 'slug', o.slug, 'logo_url', o.logo_url, 'banner_url', o.banner_url, 'primary_color', o.primary_color, 'secondary_color', o.secondary_color, 'sport_label', o.sport_label, 'public_description', o.public_description) from org o),
  coalesce((select jsonb_agg(jsonb_build_object('name', v.name, 'address', v.address, 'timezone', v.timezone) order by v.name) from public.venues v join org o on o.id = v.organization_id where v.is_active), '[]'::jsonb),
  coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'name', e.name, 'sport', e.sport, 'format', e.format, 'status', e.status, 'starts_at', e.starts_at, 'public_code', e.public_code, 'max_players', e.max_players) order by e.starts_at desc nulls last) from public.events e join org o on o.id = e.organization_id where e.status in ('registration', 'live', 'completed') and e.public_results), '[]'::jsonb);
$$;
revoke all on function public.get_public_organization(text) from public;
grant execute on function public.get_public_organization(text) to anon, authenticated;

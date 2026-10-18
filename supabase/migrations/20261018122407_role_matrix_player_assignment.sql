-- Complete the organization role matrix: platform admin may assign player memberships.
create or replace function public.platform_set_membership_role(
  p_user_id uuid,
  p_organization_id uuid,
  p_role_code text,
  p_enabled boolean default true
)
returns boolean
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then
    raise exception 'Akses ditolak';
  end if;
  if p_role_code not in ('organization_owner', 'organization_admin', 'event_manager', 'scorer', 'coach', 'player', 'viewer') then
    raise exception 'Role organisasi tidak valid';
  end if;
  if not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'Organisasi tidak ditemukan';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'User tidak ditemukan';
  end if;

  if p_enabled then
    insert into public.organization_members (organization_id, user_id, role_code, status, invited_by)
    values (p_organization_id, p_user_id, p_role_code, 'active', auth.uid())
    on conflict (organization_id, user_id) do update
      set role_code = excluded.role_code, status = 'active', invited_by = excluded.invited_by;
  else
    update public.organization_members
    set status = 'suspended'
    where organization_id = p_organization_id and user_id = p_user_id;
  end if;
  return true;
end;
$$;

revoke all on function public.platform_set_membership_role(uuid, uuid, text, boolean) from public, anon;
grant execute on function public.platform_set_membership_role(uuid, uuid, text, boolean) to authenticated;
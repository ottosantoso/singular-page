-- New self-registered accounts start as a safe, read-only viewer.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_username text;
begin
  v_username := coalesce(nullif(trim(new.raw_user_meta_data->>'username'), ''), split_part(new.email, '@', 1));
  if exists (select 1 from public.profiles where lower(username) = lower(v_username)) then
    v_username := v_username || '_' || substr(new.id::text, 1, 4);
  end if;
  insert into public.profiles (id, username, display_name)
  values (new.id, v_username, coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), v_username))
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role_code)
  values (new.id, 'viewer')
  on conflict do nothing;
  return new;
end;
$$;

create or replace function public.platform_list_users()
returns table (
  user_id uuid,
  email text,
  email_confirmed_at timestamptz,
  username text,
  display_name text,
  is_active boolean,
  global_roles jsonb,
  memberships jsonb
)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then
    raise exception 'Akses ditolak' using errcode = '42501';
  end if;

  return query
  select
    u.id,
    u.email::text,
    u.email_confirmed_at,
    p.username,
    p.display_name,
    p.is_active,
    coalesce((
      select jsonb_agg(ur.role_code order by ur.role_code)
      from public.user_roles ur
      where ur.user_id = u.id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'organization_id', om.organization_id,
        'organization_name', o.name,
        'role_code', om.role_code,
        'status', om.status
      ) order by o.name)
      from public.organization_members om
      join public.organizations o on o.id = om.organization_id
      where om.user_id = u.id
    ), '[]'::jsonb)
  from auth.users u
  join public.profiles p on p.id = u.id
  order by p.username;
end;
$$;

create or replace function public.platform_list_organizations()
returns table (organization_id uuid, organization_name text, slug text)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then
    raise exception 'Akses ditolak' using errcode = '42501';
  end if;

  return query
  select o.id, o.name, o.slug
  from public.organizations o
  where o.is_active
  order by o.name;
end;
$$;

create or replace function public.platform_set_user_status(
  p_user_id uuid,
  p_is_active boolean
)
returns boolean
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then
    raise exception 'Akses ditolak' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() and not p_is_active then
    raise exception 'Akun platform admin yang sedang dipakai tidak boleh dinonaktifkan';
  end if;

  update public.profiles set is_active = p_is_active where id = p_user_id;
  return found;
end;
$$;

create or replace function public.platform_set_user_role(
  p_user_id uuid,
  p_role_code text,
  p_enabled boolean default true
)
returns boolean
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then
    raise exception 'Akses ditolak' using errcode = '42501';
  end if;
  if p_role_code not in ('viewer', 'platform_admin') then
    raise exception 'Role global tidak valid; role organisasi diatur per workspace';
  end if;
  if p_user_id = auth.uid() and p_role_code = 'platform_admin' and not p_enabled then
    raise exception 'Role platform admin yang sedang dipakai tidak boleh dicabut';
  end if;

  if p_enabled then
    insert into public.user_roles (user_id, role_code)
    values (p_user_id, p_role_code)
    on conflict do nothing;
  else
    delete from public.user_roles
    where user_id = p_user_id and role_code = p_role_code;
  end if;
  return true;
end;
$$;

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
    raise exception 'Akses ditolak' using errcode = '42501';
  end if;
  if p_role_code not in ('organization_owner', 'organization_admin', 'event_manager', 'scorer', 'coach', 'viewer') then
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

revoke all on function public.platform_list_users() from public, anon;
revoke all on function public.platform_list_organizations() from public, anon;
revoke all on function public.platform_set_user_status(uuid, boolean) from public, anon;
revoke all on function public.platform_set_user_role(uuid, text, boolean) from public, anon;
revoke all on function public.platform_set_membership_role(uuid, uuid, text, boolean) from public, anon;
grant execute on function public.platform_list_users() to authenticated;
grant execute on function public.platform_list_organizations() to authenticated;
grant execute on function public.platform_set_user_status(uuid, boolean) to authenticated;
grant execute on function public.platform_set_user_role(uuid, text, boolean) to authenticated;
grant execute on function public.platform_set_membership_role(uuid, uuid, text, boolean) to authenticated;

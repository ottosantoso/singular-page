create or replace function public.has_role(_user_id uuid, _role text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = _user_id
      and p.is_active
      and (ur.role_code = _role or (_role = 'admin' and ur.role_code = 'platform_admin'))
  );
$$;

revoke all on function public.has_role(uuid, text) from public, anon;
grant execute on function public.has_role(uuid, text) to authenticated;

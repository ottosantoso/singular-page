create or replace function public.accept_organization_invite(p_token text)
returns table (organization_id uuid, organization_name text, role_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.organization_invites;
  v_hash text;
begin
  if auth.uid() is null then
    raise exception 'Login diperlukan' using errcode = '42501';
  end if;
  if nullif(trim(p_token), '') is null then
    raise exception 'Token undangan tidak valid' using errcode = '22023';
  end if;

  v_hash := encode(extensions.digest(trim(p_token), 'sha256'), 'hex');
  select * into v_invite
  from public.organization_invites
  where (token_hash = v_hash or token_hash = trim(p_token))
    and accepted_at is null
    and expires_at > now()
  limit 1;

  if not found then
    raise exception 'Undangan tidak ditemukan atau sudah kedaluwarsa' using errcode = 'P0002';
  end if;
  if v_invite.email is not null
     and lower(v_invite.email) <> lower(coalesce((select email from auth.users where id = auth.uid()), ''))
  then
    raise exception 'Email akun tidak cocok dengan undangan' using errcode = '42501';
  end if;

  insert into public.organization_members (organization_id, user_id, role_code, status, invited_by)
  values (v_invite.organization_id, auth.uid(), v_invite.role_code, 'active', v_invite.invited_by)
  on conflict (organization_id, user_id) do update
    set role_code = excluded.role_code,
        status = 'active',
        invited_by = excluded.invited_by;

  update public.organization_invites
  set accepted_at = now()
  where id = v_invite.id;

  return query
  select o.id, o.name, v_invite.role_code
  from public.organizations o
  where o.id = v_invite.organization_id;
end;
$$;

revoke all on function public.accept_organization_invite(text) from public;
grant execute on function public.accept_organization_invite(text) to authenticated;

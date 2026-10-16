-- Members of the same organization may see each other's basic display identity.
-- No email or auth metadata is exposed through profiles.
create policy profiles_select_same_organization on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.has_role(auth.uid(), 'admin')
    or exists (
      select 1
      from public.organization_members target_member
      join public.organization_members viewer_member
        on viewer_member.organization_id = target_member.organization_id
      where target_member.user_id = profiles.id
        and viewer_member.user_id = auth.uid()
        and target_member.status = 'active'
        and viewer_member.status = 'active'
    )
  );

-- =====================================================================
-- Admin, user, dan role + pemantauan permainan (read-only)
-- Sudah diterapkan ke Supabase dengan versi 20261013052243.
-- File ini hanya salinan di repo supaya riwayat skema ikut ter-versi.
-- User uji (shn_admin) SENGAJA tidak ada di sini: dibuat terpisah, jangan simpan password di git.
-- =====================================================================

-- 1. MASTER ROLE ------------------------------------------------------
create table public.roles (
  code text primary key,
  label text not null,
  description text,
  sort_order integer not null default 0
);
insert into public.roles (code, label, description, sort_order) values
  ('admin',  'Admin',  'Akses penuh: pantau semua permainan, kelola user dan role', 1),
  ('host',   'Host',   'Membuat dan menjalankan permainan', 2),
  ('player', 'Player', 'Pemain biasa', 3);

-- 2. PROFIL USER (auth.users dikelola Supabase Auth) -------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  display_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profiles_username_key on public.profiles (lower(username));
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.update_updated_at_column();

-- 3. ROLE PER USER (sengaja tabel terpisah, bukan kolom di profil) ----
create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_code text not null references public.roles(code) on update cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, role_code)
);
create index user_roles_role_idx on public.user_roles (role_code);

-- 4. CEK ROLE (security definer: dipakai policy & fungsi admin) --------
create or replace function public.has_role(_user_id uuid, _role text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = _user_id and ur.role_code = _role and p.is_active
  );
$$;

-- 5. USER BARU -> PROFIL + ROLE 'player' -------------------------------
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
  insert into public.user_roles (user_id, role_code) values (new.id, 'player') on conflict do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 6. RLS + HAK AKSES ----------------------------------------------------
alter table public.roles enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

revoke all on public.roles, public.profiles, public.user_roles from anon, authenticated;
grant select on public.roles to authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select, insert, delete on public.user_roles to authenticated;

create policy roles_select on public.roles for select to authenticated using (true);
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy user_roles_insert_admin on public.user_roles for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));
create policy user_roles_delete_admin on public.user_roles for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

revoke all on function public.has_role(uuid, text) from public, anon;
grant execute on function public.has_role(uuid, text) to authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- 7. METADATA SESI (kode, olahraga, host) per access_key ---------------
-- access_key adalah hash kode+PIN. Kode bukan rahasia, PIN tidak pernah disimpan.
create table public.kocok_arena_meta (
  access_key text primary key references public.kocok_arena_venues(access_key) on delete cascade,
  code text,
  sport text,
  owner_id uuid references auth.users(id) on delete set null,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
alter table public.kocok_arena_meta enable row level security;
revoke all on public.kocok_arena_meta from anon, authenticated;

-- 8. FUNGSI LAMA: perilaku TETAP, hanya ditambah pencatatan metadata ----
-- Blok metadata dibungkus exception handler: kalau gagal, simpan skor tetap berhasil.
create or replace function public.kocok_save_state(p_code text, p_pin text, p_state jsonb)
returns timestamp with time zone
language plpgsql security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_key text := public.kocok_access_key(p_code, p_pin);
  v_now timestamptz := now();
begin
  if p_code is null or trim(p_code) = '' or p_pin is null or trim(p_pin) = '' then
    raise exception 'Kode dan PIN wajib diisi';
  end if;
  insert into public.kocok_arena_venues (access_key, current_state, updated_at)
  values (v_key, p_state, v_now)
  on conflict (access_key) do update
    set current_state = excluded.current_state, updated_at = excluded.updated_at;

  begin
    insert into public.kocok_arena_meta (access_key, code, sport, owner_id, last_seen)
    values (v_key, upper(trim(p_code)), nullif(p_state->>'sport', ''), auth.uid(), v_now)
    on conflict (access_key) do update
      set code = excluded.code,
          sport = coalesce(excluded.sport, public.kocok_arena_meta.sport),
          owner_id = coalesce(public.kocok_arena_meta.owner_id, excluded.owner_id),
          last_seen = excluded.last_seen;
  exception when others then
    null;
  end;

  return v_now;
end;
$function$;

create or replace function public.kocok_archive_tournament(p_code text, p_pin text, p_summary jsonb)
returns bigint
language plpgsql security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_key text := public.kocok_access_key(p_code, p_pin);
  v_id bigint;
begin
  insert into public.kocok_arena_venues (access_key, current_state)
  values (v_key, null)
  on conflict (access_key) do nothing;

  insert into public.kocok_arena_history (access_key, summary)
  values (v_key, p_summary)
  returning id into v_id;

  begin
    insert into public.kocok_arena_meta (access_key, code, sport, owner_id)
    values (v_key, upper(trim(p_code)), nullif(p_summary->>'sport', ''), auth.uid())
    on conflict (access_key) do update
      set code = excluded.code,
          sport = coalesce(excluded.sport, public.kocok_arena_meta.sport),
          owner_id = coalesce(public.kocok_arena_meta.owner_id, excluded.owner_id),
          last_seen = now();
  exception when others then
    null;
  end;

  return v_id;
end;
$function$;

-- 9. FUNGSI ADMIN (HANYA BACA) -----------------------------------------
-- Live = belum selesai & ada aktivitas <= 20 menit. Idle = belum selesai tapi sepi.
create or replace function public.admin_list_games(
  p_status text default 'all', p_search text default null, p_limit integer default 200)
returns jsonb
language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 200), 1), 500);
  v_search text := nullif(trim(p_search), '');
  v_counts jsonb;
  v_items jsonb;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then
    raise exception 'Akses ditolak' using errcode = '42501';
  end if;
  if v_search is not null then
    v_search := replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_');
  end if;

  with base as (
    select 'v:' || v.access_key as game_key,
           case when v.updated_at > now() - interval '20 minutes' then 'live' else 'idle' end as g_status,
           v.access_key as akey, v.current_state as st, v.updated_at as last_at, null::timestamptz as fin_at
    from public.kocok_arena_venues v
    where v.current_state is not null and coalesce(v.current_state->>'finished', 'false') <> 'true'
    union all
    select 'h:' || h.id::text, 'finished', h.access_key, h.summary, h.finished_at, h.finished_at
    from public.kocok_arena_history h
    union all
    select 'v:' || v.access_key, 'finished', v.access_key, v.current_state, v.updated_at, v.updated_at
    from public.kocok_arena_venues v
    where coalesce(v.current_state->>'finished', 'false') = 'true'
      and not exists (select 1 from public.kocok_arena_history h2 where h2.access_key = v.access_key)
  ), rws as (
    select b.*, m.code as m_code, m.sport as m_sport, pr.username as owner_name,
           case when jsonb_typeof(b.st->'players') = 'array' then jsonb_array_length(b.st->'players') else 0 end as n_players
    from base b
    left join public.kocok_arena_meta m on m.access_key = b.akey
    left join public.profiles pr on pr.id = m.owner_id
  ), cnt as (
    select jsonb_build_object(
      'live', count(*) filter (where g_status = 'live'),
      'idle', count(*) filter (where g_status = 'idle'),
      'finished', count(*) filter (where g_status = 'finished'),
      'all', count(*)) as c
    from rws
  ), picked as (
    select * from rws r
    where (coalesce(p_status, 'all') = 'all' or r.g_status = p_status)
      and (v_search is null
           or coalesce(r.m_code, '') ilike '%' || v_search || '%'
           or r.akey ilike v_search || '%'
           or coalesce(r.owner_name, '') ilike '%' || v_search || '%'
           or coalesce((r.st->'players')::text, '') ilike '%' || v_search || '%')
    order by (r.g_status = 'live') desc, r.last_at desc nulls last
    limit v_limit
  )
  select (select c from cnt),
         coalesce((select jsonb_agg(jsonb_build_object(
           'game_key', p.game_key,
           'status', p.g_status,
           'key_short', left(p.akey, 6),
           'code', p.m_code,
           'sport', p.m_sport,
           'mode', p.st->>'mode',
           'format', p.st->>'format',
           'players', p.n_players,
           'courts', case when (p.st->>'courtsRequested') ~ '^[0-9]+$' then (p.st->>'courtsRequested')::int end,
           'round', case when (p.st->>'round') ~ '^[0-9]+$' then (p.st->>'round')::int end,
           'owner', p.owner_name,
           'last_activity_at', p.last_at,
           'finished_at', p.fin_at
         ) order by (p.g_status = 'live') desc, p.last_at desc nulls last) from picked p), '[]'::jsonb)
  into v_counts, v_items;

  return jsonb_build_object('counts', v_counts, 'items', v_items);
end;
$$;

create or replace function public.admin_get_game(p_game_key text)
returns jsonb
language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  v_state jsonb; v_key text; v_last timestamptz; v_status text; v_fin timestamptz;
  v_code text; v_sport text; v_owner text;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then
    raise exception 'Akses ditolak' using errcode = '42501';
  end if;

  if p_game_key like 'v:%' then
    select v.access_key, v.current_state, v.updated_at into v_key, v_state, v_last
    from public.kocok_arena_venues v where v.access_key = substr(p_game_key, 3);
    if not found then raise exception 'Permainan tidak ditemukan' using errcode = 'P0002'; end if;
    v_status := case when coalesce(v_state->>'finished', 'false') = 'true' then 'finished'
                      when v_last > now() - interval '20 minutes' then 'live' else 'idle' end;
    if v_status = 'finished' then v_fin := v_last; end if;
  elsif p_game_key ~ '^h:[0-9]+$' then
    select h.access_key, h.summary, h.finished_at into v_key, v_state, v_last
    from public.kocok_arena_history h where h.id = substr(p_game_key, 3)::bigint;
    if not found then raise exception 'Permainan tidak ditemukan' using errcode = 'P0002'; end if;
    v_status := 'finished'; v_fin := v_last;
  else
    raise exception 'Kunci permainan tidak valid' using errcode = '22023';
  end if;

  select m.code, m.sport, pr.username into v_code, v_sport, v_owner
  from public.kocok_arena_meta m left join public.profiles pr on pr.id = m.owner_id
  where m.access_key = v_key;

  return jsonb_build_object(
    'game_key', p_game_key, 'status', v_status, 'key_short', left(v_key, 6),
    'code', v_code, 'sport', v_sport, 'owner', v_owner,
    'last_activity_at', v_last, 'finished_at', v_fin,
    'state', jsonb_build_object(
      'mode', v_state->'mode', 'format', v_state->'format', 'round', v_state->'round',
      'courtsRequested', v_state->'courtsRequested', 'players', v_state->'players',
      'pairs', v_state->'pairs', 'pairMembers', v_state->'pairMembers', 'paused', v_state->'paused',
      'current', v_state->'current', 'currentSitOut', v_state->'currentSitOut',
      'leaderboard', v_state->'leaderboard', 'matchHistory', v_state->'matchHistory',
      'sessionDurationMin', v_state->'sessionDurationMin', 'sessionEndAt', v_state->'sessionEndAt'
    )
  );
end;
$$;

revoke all on function public.admin_list_games(text, text, integer) from public, anon;
revoke all on function public.admin_get_game(text) from public, anon;
grant execute on function public.admin_list_games(text, text, integer) to authenticated;
grant execute on function public.admin_get_game(text) to authenticated;

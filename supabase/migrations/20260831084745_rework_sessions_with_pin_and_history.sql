-- Hapus tabel lama (akses cuma pakai kode, gampang ditebak lewat anon key publik)
drop table if exists public.kocok_arena_sessions;

create extension if not exists pgcrypto with schema extensions;

-- Tabel utama: 1 baris per "arena" (kode + pin), simpan turnamen yang lagi jalan
create table public.kocok_arena_venues (
  access_key text primary key,
  current_state jsonb,
  updated_at timestamptz not null default now()
);

-- Riwayat turnamen yang sudah selesai/diarsipkan, per arena
create table public.kocok_arena_history (
  id bigint generated always as identity primary key,
  access_key text not null references public.kocok_arena_venues(access_key) on delete cascade,
  finished_at timestamptz not null default now(),
  summary jsonb not null
);

create index on public.kocok_arena_history (access_key, finished_at desc);

alter table public.kocok_arena_venues enable row level security;
alter table public.kocok_arena_history enable row level security;

-- Sengaja TIDAK dikasih policy untuk anon/authenticated di tabel ini,
-- jadi default-deny. Satu-satunya jalan akses adalah lewat function
-- SECURITY DEFINER di bawah, yang mewajibkan kode + PIN yang cocok.
revoke all on public.kocok_arena_venues from anon, authenticated;
revoke all on public.kocok_arena_history from anon, authenticated;

create or replace function public.kocok_access_key(p_code text, p_pin text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(extensions.digest(lower(trim(p_code)) || '::' || trim(p_pin), 'sha256'), 'hex')
$$;

create or replace function public.kocok_save_state(p_code text, p_pin text, p_state jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = public, extensions
as $$
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
  return v_now;
end;
$$;

create or replace function public.kocok_load_state(p_code text, p_pin text)
returns jsonb
language sql
security definer
set search_path = public, extensions
as $$
  select current_state from public.kocok_arena_venues
  where access_key = public.kocok_access_key(p_code, p_pin);
$$;

create or replace function public.kocok_get_updated_at(p_code text, p_pin text)
returns timestamptz
language sql
security definer
set search_path = public, extensions
as $$
  select updated_at from public.kocok_arena_venues
  where access_key = public.kocok_access_key(p_code, p_pin);
$$;

create or replace function public.kocok_archive_tournament(p_code text, p_pin text, p_summary jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
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

  return v_id;
end;
$$;

create or replace function public.kocok_list_history(p_code text, p_pin text)
returns table(id bigint, finished_at timestamptz, summary jsonb)
language sql
security definer
set search_path = public, extensions
as $$
  select h.id, h.finished_at, h.summary
  from public.kocok_arena_history h
  where h.access_key = public.kocok_access_key(p_code, p_pin)
  order by h.finished_at desc
  limit 200;
$$;

grant execute on function public.kocok_save_state(text, text, jsonb) to anon;
grant execute on function public.kocok_load_state(text, text) to anon;
grant execute on function public.kocok_get_updated_at(text, text) to anon;
grant execute on function public.kocok_archive_tournament(text, text, jsonb) to anon;
grant execute on function public.kocok_list_history(text, text) to anon;
;

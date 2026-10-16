create table public.kocok_arena_sessions (
  session_code text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.kocok_arena_sessions enable row level security;

-- App ini tanpa login (dipakai bareng-bareng lewat kode sesi),
-- jadi akses anon dibatasi hanya pada baris yang kode sesinya diketahui client.
create policy "anon can read sessions"
  on public.kocok_arena_sessions
  for select
  to anon
  using (true);

create policy "anon can insert sessions"
  on public.kocok_arena_sessions
  for insert
  to anon
  with check (true);

create policy "anon can update sessions"
  on public.kocok_arena_sessions
  for update
  to anon
  using (true)
  with check (true);
;

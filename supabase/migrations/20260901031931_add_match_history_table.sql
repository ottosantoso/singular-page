-- Riwayat per-pertandingan (bukan cuma ringkasan akhir turnamen).
-- 1 baris = 1 match di 1 court pada 1 ronde.
create table public.kocok_arena_matches (
  id bigint generated always as identity primary key,
  access_key text not null references public.kocok_arena_venues(access_key) on delete cascade,
  round int not null,
  court int not null,
  team_a text[] not null,
  team_b text[] not null,
  score_a int,
  score_b int,
  winner text, -- 'A', 'B', atau null kalau seri/belum ada skor
  played_at timestamptz not null default now()
);

create index on public.kocok_arena_matches (access_key, played_at desc);
create index on public.kocok_arena_matches (access_key, round);

alter table public.kocok_arena_matches enable row level security;

-- Sama seperti tabel lain: default-deny untuk anon/authenticated,
-- akses cuma lewat function SECURITY DEFINER yang mewajibkan kode+PIN cocok.
revoke all on public.kocok_arena_matches from anon, authenticated;

create or replace function public.kocok_log_matches(p_code text, p_pin text, p_round int, p_matches jsonb)
returns int
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_key text := public.kocok_access_key(p_code, p_pin);
  v_match jsonb;
  v_count int := 0;
  v_score_a int;
  v_score_b int;
  v_winner text;
begin
  -- p_matches: array of {court, teamA:[...], teamB:[...], scoreA, scoreB}
  for v_match in select * from jsonb_array_elements(p_matches)
  loop
    v_score_a := nullif(v_match->>'scoreA','')::int;
    v_score_b := nullif(v_match->>'scoreB','')::int;
    v_winner := case
      when v_score_a is not null and v_score_b is not null and v_score_a > v_score_b then 'A'
      when v_score_a is not null and v_score_b is not null and v_score_b > v_score_a then 'B'
      else null
    end;

    insert into public.kocok_arena_matches (access_key, round, court, team_a, team_b, score_a, score_b, winner)
    values (
      v_key,
      p_round,
      coalesce((v_match->>'court')::int, 0),
      (select array_agg(x) from jsonb_array_elements_text(v_match->'teamA') x),
      (select array_agg(x) from jsonb_array_elements_text(v_match->'teamB') x),
      v_score_a,
      v_score_b,
      v_winner
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.kocok_list_matches(p_code text, p_pin text, p_limit int default 500)
returns table(id bigint, round int, court int, team_a text[], team_b text[], score_a int, score_b int, winner text, played_at timestamptz)
language sql
security definer
set search_path = public, extensions
as $$
  select m.id, m.round, m.court, m.team_a, m.team_b, m.score_a, m.score_b, m.winner, m.played_at
  from public.kocok_arena_matches m
  where m.access_key = public.kocok_access_key(p_code, p_pin)
  order by m.played_at desc
  limit p_limit;
$$;

grant execute on function public.kocok_log_matches(text, text, int, jsonb) to anon;
grant execute on function public.kocok_list_matches(text, text, int) to anon;
;

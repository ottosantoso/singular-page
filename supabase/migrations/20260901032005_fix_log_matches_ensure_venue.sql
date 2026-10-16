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
  insert into public.kocok_arena_venues (access_key, current_state)
  values (v_key, null)
  on conflict (access_key) do nothing;

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

grant execute on function public.kocok_log_matches(text, text, int, jsonb) to anon;
;

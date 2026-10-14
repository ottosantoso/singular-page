-- Sudah diterapkan ke Supabase dengan versi 20261014023534 (salinan di repo).
-- Perbaikan panel admin setelah ada penutupan otomatis sesi (close_abandoned_arena_sessions):
--  1) sesi yang sudah diarsip SETELAH penyimpanan terakhir tidak lagi dihitung sebagai live/idle (hindari duplikat)
--  2) tandai arsip hasil penutupan otomatis (auto_closed)
-- Fungsi ditambal di tempat (replace pada definisi yang ada); gagal keras kalau teks tidak cocok.
-- Harus dijalankan SETELAH 20261013052243_admin_auth_roles_monitoring.sql.
do $$
declare
  d text; o text;
begin
  -- admin_list_games
  d := pg_get_functiondef('public.admin_list_games(text,text,integer)'::regprocedure);
  o := d;
  d := replace(d,
    E'where v.current_state is not null and coalesce(v.current_state->>''finished'', ''false'') <> ''true''\n    union all',
    E'where v.current_state is not null and coalesce(v.current_state->>''finished'', ''false'') <> ''true''\n      and not exists (select 1 from public.kocok_arena_history h3\n                      where h3.access_key = v.access_key and h3.finished_at >= v.updated_at)\n    union all');
  if d = o then raise exception 'admin_list_games: bagian filter arsip tidak ditemukan'; end if;
  o := d;
  d := replace(d, E'''finished_at'', p.fin_at', E'''finished_at'', p.fin_at,\n           ''auto_closed'', coalesce(p.st->>''autoClosed'', ''false'') = ''true''');
  if d = o then raise exception 'admin_list_games: bagian auto_closed tidak ditemukan'; end if;
  execute d;

  -- admin_get_game
  d := pg_get_functiondef('public.admin_get_game(text)'::regprocedure);
  o := d;
  d := replace(d,
    E'  select m.code, m.sport, pr.username into v_code, v_sport, v_owner',
    E'  if v_status <> ''finished'' and exists (select 1 from public.kocok_arena_history h4\n                                        where h4.access_key = v_key and h4.finished_at >= v_last) then\n    v_status := ''finished''; v_fin := v_last;\n  end if;\n\n  select m.code, m.sport, pr.username into v_code, v_sport, v_owner');
  if d = o then raise exception 'admin_get_game: bagian cek arsip tidak ditemukan'; end if;
  o := d;
  d := replace(d, E'''finished_at'', v_fin,', E'''finished_at'', v_fin,\n    ''auto_closed'', coalesce(v_state->>''autoClosed'', ''false'') = ''true'',');
  if d = o then raise exception 'admin_get_game: bagian auto_closed tidak ditemukan'; end if;
  execute d;
end
$$;

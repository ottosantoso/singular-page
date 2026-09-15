-- Langkah 10: perketat RLS — cabut hak DELETE dari anon di tabel yang sudah ada.
-- SELECT/INSERT/UPDATE TIDAK diubah sama sekali, jadi tidak ada fungsi yang ada sekarang yang rusak.
-- (arena_player_stats dari migration Langkah 5 sudah aman sejak awal, tidak perlu disentuh di sini.)

DROP POLICY IF EXISTS "arena_rooms_public_all" ON public.arena_rooms;
CREATE POLICY "arena_rooms_select" ON public.arena_rooms
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "arena_rooms_insert" ON public.arena_rooms
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "arena_rooms_update" ON public.arena_rooms
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "arena_players_public_all" ON public.arena_players;
CREATE POLICY "arena_players_select" ON public.arena_players
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "arena_players_insert" ON public.arena_players
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "arena_players_update" ON public.arena_players
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "arena_matches_public_all" ON public.arena_matches;
CREATE POLICY "arena_matches_select" ON public.arena_matches
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "arena_matches_insert" ON public.arena_matches
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "arena_matches_update" ON public.arena_matches
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Catatan: SELECT/INSERT/UPDATE masih terbuka untuk siapapun yang punya anon key
-- (belum ada sistem autentikasi per-pengguna). Ini perbaikan bertahap pertama;
-- verifikasi PIN lewat Postgres function bisa didiskusikan terpisah nanti kalau traffic ramai.

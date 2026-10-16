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
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);;

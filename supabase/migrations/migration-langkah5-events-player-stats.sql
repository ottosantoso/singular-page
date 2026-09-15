-- Langkah 5 prep: kolom events (rally log per match) + tabel statistik per pemain
-- Dibuat manual lebih awal supaya Lovable nanti tinggal PAKAI, tidak perlu generate migration sendiri.

ALTER TABLE public.arena_matches
  ADD COLUMN IF NOT EXISTS events JSONB NOT NULL DEFAULT '[]';

CREATE TABLE IF NOT EXISTS public.arena_player_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  arena_code TEXT NOT NULL REFERENCES public.arena_rooms(code) ON DELETE CASCADE,
  sport TEXT NOT NULL DEFAULT 'padel',
  player_name TEXT NOT NULL,
  round INTEGER NOT NULL DEFAULT 1,
  point_count INTEGER NOT NULL DEFAULT 0,
  out_count INTEGER NOT NULL DEFAULT 0,
  foul_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS arena_player_stats_code_idx
  ON public.arena_player_stats (arena_code, player_name);

GRANT SELECT, INSERT, UPDATE ON public.arena_player_stats TO anon, authenticated;
GRANT ALL ON public.arena_player_stats TO service_role;

ALTER TABLE public.arena_player_stats ENABLE ROW LEVEL SECURITY;

-- Sengaja TIDAK kasih DELETE ke anon dari awal (langsung sesuai target Langkah 10,
-- supaya tabel baru ini tidak perlu diperbaiki lagi nanti).
CREATE POLICY "arena_player_stats_select" ON public.arena_player_stats
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "arena_player_stats_insert" ON public.arena_player_stats
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "arena_player_stats_update" ON public.arena_player_stats
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

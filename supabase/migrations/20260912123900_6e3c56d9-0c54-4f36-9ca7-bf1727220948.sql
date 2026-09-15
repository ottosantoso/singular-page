ALTER TABLE public.arena_matches ADD COLUMN IF NOT EXISTS events JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.arena_player_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  arena_code TEXT NOT NULL REFERENCES public.arena_rooms(code) ON DELETE CASCADE,
  sport TEXT NOT NULL DEFAULT 'padel',
  player_name TEXT NOT NULL,
  round INTEGER NOT NULL DEFAULT 1,
  point_count INTEGER NOT NULL DEFAULT 0,
  out_count INTEGER NOT NULL DEFAULT 0,
  foul_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.arena_player_stats TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.arena_player_stats TO anon;
GRANT ALL ON public.arena_player_stats TO service_role;

ALTER TABLE public.arena_player_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "arena_player_stats_public_all"
  ON public.arena_player_stats
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_arena_player_stats_lookup
  ON public.arena_player_stats (arena_code, sport, player_name, round);

CREATE TRIGGER arena_player_stats_updated_at
  BEFORE UPDATE ON public.arena_player_stats
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
CREATE TABLE public.arena_rooms (
  code TEXT PRIMARY KEY,
  name TEXT,
  sport TEXT NOT NULL DEFAULT 'padel',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.arena_rooms TO anon, authenticated;
GRANT ALL ON public.arena_rooms TO service_role;
ALTER TABLE public.arena_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "arena_rooms_public_all" ON public.arena_rooms FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.arena_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  arena_code TEXT NOT NULL REFERENCES public.arena_rooms(code) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (arena_code, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.arena_players TO anon, authenticated;
GRANT ALL ON public.arena_players TO service_role;
ALTER TABLE public.arena_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "arena_players_public_all" ON public.arena_players FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.arena_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  arena_code TEXT NOT NULL REFERENCES public.arena_rooms(code) ON DELETE CASCADE,
  round INTEGER NOT NULL DEFAULT 1,
  court INTEGER NOT NULL DEFAULT 1,
  team_a TEXT[] NOT NULL DEFAULT '{}',
  team_b TEXT[] NOT NULL DEFAULT '{}',
  score_a INTEGER NOT NULL DEFAULT 0,
  score_b INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX arena_matches_code_idx ON public.arena_matches (arena_code, round);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.arena_matches TO anon, authenticated;
GRANT ALL ON public.arena_matches TO service_role;
ALTER TABLE public.arena_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "arena_matches_public_all" ON public.arena_matches FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER arena_rooms_updated_at BEFORE UPDATE ON public.arena_rooms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER arena_matches_updated_at BEFORE UPDATE ON public.arena_matches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
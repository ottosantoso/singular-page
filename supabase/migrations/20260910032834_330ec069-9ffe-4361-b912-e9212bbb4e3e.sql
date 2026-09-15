ALTER TABLE public.arena_matches ADD COLUMN IF NOT EXISTS sport TEXT NOT NULL DEFAULT 'padel';
CREATE INDEX IF NOT EXISTS arena_matches_sport_code_idx ON public.arena_matches (sport, arena_code);
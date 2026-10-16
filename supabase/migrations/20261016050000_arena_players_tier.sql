-- Tier pemain (Newbie..Elite) untuk format Ying Yang.
-- Opsional: NULL = host tidak mengisi tier (dianggap Intermediate saat pengacakan Ying Yang).
ALTER TABLE public.arena_players
  ADD COLUMN IF NOT EXISTS tier text;

ALTER TABLE public.arena_players
  DROP CONSTRAINT IF EXISTS arena_players_tier_check;

ALTER TABLE public.arena_players
  ADD CONSTRAINT arena_players_tier_check
  CHECK (tier IS NULL OR tier IN ('newbie', 'beginner', 'intermediate', 'advanced', 'pro', 'elite'));

COMMENT ON COLUMN public.arena_players.tier IS
  'Level pemain: newbie, beginner, intermediate, advanced, pro, elite. Dipakai format Ying Yang untuk menyeimbangkan tim.';

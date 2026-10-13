-- Poin 2: skor live disimpan ke arena_matches dengan status, tanpa menghapus data lama.
-- status: 'live' (ronde berjalan), 'final' (ronde ditutup), 'auto_closed' (ditutup otomatis karena ditinggal).
-- slot_key: kunci idempoten "ronde-lapangan" untuk upsert. Baris lama bernilai NULL, jadi tidak bentrok dan tidak ada yang dihapus.
ALTER TABLE public.arena_matches
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'final',
  ADD COLUMN IF NOT EXISTS slot_key text;

DO $$
BEGIN
  ALTER TABLE public.arena_matches
    ADD CONSTRAINT arena_matches_status_check CHECK (status IN ('live', 'final', 'auto_closed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS arena_matches_slot_key_uidx
  ON public.arena_matches (arena_code, slot_key);

CREATE INDEX IF NOT EXISTS arena_matches_live_updated_idx
  ON public.arena_matches (updated_at) WHERE status = 'live';

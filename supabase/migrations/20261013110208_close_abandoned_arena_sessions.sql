CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.close_abandoned_arena_sessions(
  p_idle interval DEFAULT interval '6 hours',
  p_lookback interval DEFAULT interval '3 days'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_closed_matches integer := 0;
  v_archived integer := 0;
BEGIN
  UPDATE public.arena_matches
     SET status = 'auto_closed'
   WHERE status = 'live'
     AND updated_at < now() - p_idle;
  GET DIAGNOSTICS v_closed_matches = ROW_COUNT;

  WITH stale AS (
    SELECT v.access_key, v.current_state
      FROM public.kocok_arena_venues v
     WHERE jsonb_typeof(v.current_state) = 'object'
       AND coalesce(v.current_state->>'finished', 'false') <> 'true'
       AND v.updated_at < now() - p_idle
       AND v.updated_at > now() - p_lookback
       AND CASE WHEN jsonb_typeof(v.current_state->'matchHistory') = 'array'
                THEN jsonb_array_length(v.current_state->'matchHistory') ELSE 0 END > 0
       AND NOT EXISTS (
         SELECT 1 FROM public.kocok_arena_history h
          WHERE h.access_key = v.access_key
            AND h.finished_at >= v.updated_at
       )
  ), ins AS (
    INSERT INTO public.kocok_arena_history (access_key, summary)
    SELECT access_key,
           current_state || jsonb_build_object('finished', true, 'autoClosed', true, 'autoClosedAt', now())
      FROM stale
    RETURNING 1
  )
  SELECT count(*) INTO v_archived FROM ins;

  RETURN jsonb_build_object('closed_matches', v_closed_matches, 'archived_sessions', v_archived);
END;
$$;

REVOKE ALL ON FUNCTION public.close_abandoned_arena_sessions(interval, interval) FROM PUBLIC, anon, authenticated;

SELECT cron.schedule(
  'close-abandoned-arena-sessions',
  '*/30 * * * *',
  $cron$SELECT public.close_abandoned_arena_sessions();$cron$
);;

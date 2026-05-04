REVOKE EXECUTE ON FUNCTION public.recompute_match_scores(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_match_events_score_sync() FROM PUBLIC, anon, authenticated;
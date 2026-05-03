INSERT INTO public.api_football_config (club_id, api_team_id, api_season, sync_enabled)
VALUES ('3170935c-baa8-4542-8198-8e0b4d32dcd8', 9336, 2025, true)
ON CONFLICT (club_id) DO UPDATE
  SET api_team_id = EXCLUDED.api_team_id,
      api_season = EXCLUDED.api_season,
      sync_enabled = true;
ALTER TABLE public.api_football_config
  ADD COLUMN IF NOT EXISTS fussball_de_staffel_id text,
  ADD COLUMN IF NOT EXISTS fussball_de_url text,
  ADD COLUMN IF NOT EXISTS club_website_url text,
  ADD COLUMN IF NOT EXISTS scrape_enabled boolean NOT NULL DEFAULT false;

UPDATE public.api_football_config
SET
  fussball_de_staffel_id = '02TF1DUQMO00003CVS5489BTVTLPPK10-G',
  fussball_de_url = 'https://www.fussball.de/spieltag/u-19-a-jun-bayernliga-bayern-a-junioren-bayernliga-a-junioren-saison2526-bayern/-/staffel/02TF1DUQMO00003CVS5489BTVTLPPK10-G',
  club_website_url = 'https://sva01.de/jugendmannschaften/u19-aktuell/',
  scrape_enabled = true
WHERE club_id = '3170935c-baa8-4542-8198-8e0b4d32dcd8';
---
name: Gamechanger Features
description: Live-Coaching, Schiri-Assist, Highlight-Reels, Pre-Match-Briefing, API-Football Auto-Suggest
type: feature
---
**Live-Coaching (`live-coaching-advice` EF + LiveCoachingPanel):** Trainer kann während Spiel Mikro-Empfehlungen anfordern. Aggregiert events + frame_positions, sendet an Gemini 2.5 Flash, persistiert in `live_coaching_advice` Tabelle. Urgency low/medium/high mit Farbcodierung. Verfügbar im Cockpit-Tab.

**Schiri-Assist (`analyze-foul-probability` EF + FoulProbabilityPanel):** Akzeptiert 1-4 Base64-Frames einer Zweikampfszene, Gemini Vision liefert probability/severity/team. Persistiert in `foul_probability_events`. Disclaimer: kein Ersatz für Schiedsrichter. Im Cockpit-Tab unter dem Reel-Generator sichtbar.

**Highlight-Reels (`generate-highlight-reel` EF + HighlightReelGenerator):** Bewertet alle match_events nach Highlight-Score (Goal=100, Big-Chance=60, Save=40), wählt nach Format/Dauer 5-12 Szenen. Storyboard mit Intro/Outro + Vereinslogo + Captions. Square/Portrait/Landscape. Persistiert in `highlight_reels`. Caption-Export via Clipboard. Video-Render erfolgt clientseitig (z.B. Remotion in zukünftiger Iteration).

**Pre-Match-Briefing (`generate-prematch-briefing` EF + PreMatchBriefing):** Ruft `match-preparation` als Sub-Call, generiert kompaktes 3-Seiten-Briefing (Gegner-DNA, Threats, Matchplan in 4 Phasen). PDF-Export via window.print(). Sichtbar in MatchPrep wenn `?match=<id>` in URL.

**API-Football Auto-Suggest in NewMatch:** Bei Gegnereingabe ≥3 Zeichen wird `api-football?action=search_team` automatisch aufgerufen. Auswahl speichert `opponent_logo_url` + `opponent_api_team_id` direkt in matches. Künftig: opponent_recent_form auto-fetch via `next_fixtures`.

**Tabellen:** `live_coaching_advice`, `foul_probability_events`, `highlight_reels`, `prematch_briefings` — alle mit RLS auf eigene Vereinszugehörigkeit (matches.home_club_id → profiles.club_id).

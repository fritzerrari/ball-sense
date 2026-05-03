---
name: Press Release System
description: AI-generated pre/post-match press releases via generate-press-release EF, persisted in press_releases table with tone/length variants
type: feature
---
**Edge Function `generate-press-release`:** Erstellt Vorbericht (kind=pre_match) oder Spielbericht (kind=post_match) via Lovable AI Gateway (Gemini 2.5 Flash) mit Tool-Calling für strukturiertes JSON (headline/lead/body_html/suggested_quotes).

**Datenquellen:**
- Pre-Match: `season_hub_cache` (Tabelle, Form, nächster Gegner) + `match-preparation` Sub-Call
- Post-Match: `match_events` + `player_match_stats` + `match_lineups` (Top-Performer nach Rating)

**Tonalitäten:** neutral / enthusiastic / analytical
**Längen:** short (~300 W) / medium (~600 W) / long (~1200 W)

**Tabelle `press_releases`:** match_id, club_id, kind, language, headline, lead, body_html, quotes (jsonb Array {author,text}), tone, length, status (draft/approved/published), generated_by_ai, manually_edited. RLS auf get_user_club_id().

**UI `PressReleaseGenerator`:** Eingebettet im MatchReport-Tab "Presse". Trainer-Zitate optional als Input (max 2). Aktionen: Bearbeiten (markiert manually_edited=true), Kopieren als Plaintext, WhatsApp via openWhatsAppShare, mailto:, HTML-Download mit Press-Stylesheet.

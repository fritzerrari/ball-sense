---
name: P3 Extensions (Voice/Wrapped/Portal)
description: Voice-Events via Gemini multimodal, Saison-Wrapped intern, Spieler-Portal mit Auth-Invite
type: feature
---
- **Voice-Events**: VoiceEventButton in HelperQuickEvents → voice-event-parse Edge Function (Gemini 2.5 Flash multimodal audio) → ParsedEvent-Vorschlag mit confidence → User bestätigt → camera-ops log-event.
- **Saison-Wrapped**: /season/wrapped, season-wrapped Edge Function aggregiert player_match_stats + matches, kein Public-Sharing (intern-only).
- **Spieler-Portal**: Echte Auth-Accounts via player-portal-invite Edge Function (supabase.auth.admin.inviteUserByEmail / generateLink magiclink). Tabelle player_portal_invites, Trigger link_player_portal_invite verknüpft beim Profile-Insert automatisch user_id ↔ player_portal_player_id. Read-Only RLS via current_portal_player_id() helper. Route /player-portal.

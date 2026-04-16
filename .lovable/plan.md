

# Robuste Kamera-Session-Persistenz

## Problem
Wenn ein Helfer-Handy die Seite refresht, geht der `sessionToken` verloren (nur in React State). Bei erneutem Code-Eingeben wird ein **neuer** `camera_access_sessions`-Eintrag mit höherem `camera_index` erstellt → das System glaubt, eine neue Kamera sei dazugekommen.

## Lösung
Zwei Ebenen: **Client-seitig** den Session-Token in `localStorage` persistieren und bei Reload automatisch wiederherstellen. **Server-seitig** bei `lookup` prüfen, ob bereits eine aktive Session für denselben Code + Match existiert, und diese wiederverwenden statt eine neue zu erstellen.

## Änderungen

### 1. `src/pages/CameraTrackingPage.tsx` — Session-Recovery bei Reload
- Nach erfolgreichem `handleCodeSuccess`: `sessionToken`, `matchId` und `cameraIndex` in `localStorage` speichern (Key: `fieldiq_camera_session`)
- Beim Mount: Prüfen ob eine gespeicherte Session existiert → `validate`-Action aufrufen → bei Erfolg direkt Phase `"setup"` setzen (Code-Eingabe überspringen)
- Bei `release`/Session-Ende: localStorage-Eintrag löschen

### 2. `supabase/functions/camera-access/index.ts` — Lookup mit Reuse
- Bei `action: "lookup"`: Vor dem Erstellen einer neuen Session prüfen, ob bereits eine **aktive, nicht abgelaufene** Session für denselben `code_id` + `match_id` existiert
- Falls ja: Neuen `session_token_hash` setzen (Update statt Insert), bestehenden `camera_index` beibehalten, alten Token ersetzen
- Falls nein: Wie bisher neue Session erstellen
- Dadurch bleibt der `camera_index` stabil, auch bei mehrfachem Code-Eingeben

### 3. `src/components/CameraCodeEntry.tsx` — Minimale Anpassung
- Keine strukturelle Änderung nötig, aber beim Auto-Fill aus URL-Parameter ebenfalls localStorage-Recovery bevorzugen

## Technische Details

**localStorage-Schema:**
```json
{
  "matchId": "uuid",
  "sessionToken": "hex-string",
  "cameraIndex": 0,
  "code": "123456",
  "createdAt": "2025-01-01T..."
}
```

**Edge Function Reuse-Logik (Pseudocode):**
```sql
-- Prüfe existierende Session für code_id + match_id
SELECT id, camera_index FROM camera_access_sessions
WHERE code_id = :code_id AND match_id = :match_id
AND expires_at > now()
LIMIT 1;

-- Falls gefunden: Update session_token_hash + last_used_at
-- Falls nicht: Insert wie bisher
```

Dies stellt sicher, dass selbst bei Refresh oder erneutem Code-Eingeben die gleiche Kamera-Position beibehalten wird.


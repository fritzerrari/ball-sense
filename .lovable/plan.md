

# Stabilisierung & Feature-Erweiterungen

## Probleme und Fixes

### 1. PWA-Installationshinweis trotz installierter App
**Problem**: `Login.tsx` zeigt den Install-Screen basierend auf `isMobile && !isStandalone && !installSkipped`. Aber `isStandalone` wird nur einmal beim Mount gecheckt. Wenn der User die App bereits installiert hat und sie im Browser oeffnet, sieht er trotzdem den Screen. Zusaetzlich: `sessionStorage` wird bei jedem neuen Tab zurueckgesetzt.

**Fix**: 
- `isStandalone` Check ist korrekt (prueft `display-mode: standalone`). Wenn die App installiert ist und der User sie OEffnet, ist `isStandalone = true` — das funktioniert.
- Das eigentliche Problem: Wenn der User die App im Browser oeffnet (nicht ueber die installierte PWA), wird der Hinweis erneut gezeigt weil `sessionStorage` pro Session ist.
- Fix: `localStorage` statt `sessionStorage` fuer `pwa-install-skipped`, mit 30-Tage-Ablauf. Plus: Wenn App bereits installiert ist (`isStandalone`), zeige stattdessen 3 grosse Buttons: **Kamera**, **Login**, **Registrierung**.

**Datei**: `src/pages/Login.tsx`

### 2. Match Events werden in der Analyse ignoriert
**Problem**: `generate-insights` fetcht KEINE `match_events`. Die manuell erfassten Tore, Karten, Ecken werden nirgendwo in die KI-Analyse eingespeist.

**Fix**: In `generate-insights/index.ts` vor dem AI-Call die `match_events` aus der DB laden und als zusaetzlichen Kontext mitgeben. Die Events enthalten: Tore, Torschuesse, Karten, Ecken — mit Minute und Team.

**Datei**: `supabase/functions/generate-insights/index.ts`

### 3. Spielererkennung verbessern (flexible Teamgroessen)
**Problem**: Der Prompt in `analyze-match` geht implizit von 11v11 aus. Bei 3v3, 5v5, 7v7 oder Trainingsspielen werden zu wenig oder zu viele Spieler erkannt. Schiedsrichter und Linienrichter werden mitgezaehlt.

**Fix**: Prompt in `analyze-match/index.ts` erweitern:
- Explizit anweisen: "Zaehle KEINE Schiedsrichter, Linienrichter oder andere Offizielle (typisch: schwarze Kleidung, isolierte Position)."
- "Das Spielformat ist unbekannt. Erkenne die tatsaechliche Anzahl Spieler pro Team (3v3 bis 11v11). Melde die erkannte Teamgroesse."
- Neues Feld `team_size_detected` im Schema (z.B. `{ home: 7, away: 7 }`)
- "Wenn weniger Spieler sichtbar sind als erwartet, schaetze aufgrund der Formation und des sichtbaren Feldausschnitts die wahrscheinliche Gesamtzahl."

**Datei**: `supabase/functions/analyze-match/index.ts`

### 4. Kamera-Orientierung erkennen
**Problem**: Der Prompt fragt nicht nach der Kameraausrichtung (quer, laengs, schraeg). Das beeinflusst die Koordinaten-Interpretation massiv.

**Fix**: Prompt erweitern mit:
- "Erkenne die Kamera-Perspektive: Ist die Kamera QUER (Seitenansicht, typisch Mittellinie), LAENGS (hinter dem Tor), SCHRAEG (Eckfahne), oder TEILAUSSCHNITT (nur ein Bereich)? Dies bestimmt wie x/y Koordinaten zu interpretieren sind."
- Neues Schema-Feld `camera_perspective` mit `{ orientation: "landscape_side" | "landscape_behind_goal" | "diagonal" | "partial", coverage_description: "...", estimated_pitch_coverage_pct: number }`
- Der Insights-Prompt muss die Perspektive bei Positionsberechnungen beruecksichtigen.

**Datei**: `supabase/functions/analyze-match/index.ts`

### 5. Kamera-Code als direkter Deep-Link
**Problem**: Aktuell wird der Code per WhatsApp mit einem Link zu `/camera` geteilt. Der Helfer muss den Code manuell eintippen.

**Fix**: 
- Code-Share URL aendern zu: `https://ball-sense.lovable.app/camera?code=XXXXXX`
- In `CameraCodeEntry.tsx`: URL-Parameter `code` auslesen und automatisch submitten
- In `CameraCodeShare.tsx`: WhatsApp-Link und Kopier-Funktion aktualisieren

**Dateien**: `src/components/CameraCodeShare.tsx`, `src/components/CameraCodeEntry.tsx`

### 6. Fehlercheck: `training_recommendations` Tabelle
**Problem**: `generate-insights` macht `DELETE` und `INSERT` auf `training_recommendations`, aber die RLS-Policies erlauben nur `SELECT` fuer Club-Members. Der Service-Role-Key umgeht RLS, also funktioniert es serverseitig — aber pruefen ob die Tabelle korrekt existiert.

**Status**: Tabelle existiert (Migration gefunden), Service-Role-Key wird verwendet — kein Problem.

## Implementation (6 Dateien)

| Datei | Aenderung |
|---|---|
| `src/pages/Login.tsx` | localStorage statt sessionStorage; installierte App: 3 Buttons statt Install-Screen |
| `supabase/functions/generate-insights/index.ts` | match_events laden und als Kontext an AI uebergeben |
| `supabase/functions/analyze-match/index.ts` | Prompt: flexible Teamgroesse, Schiri-Ausschluss, Kamera-Orientierung, neue Schema-Felder |
| `src/components/CameraCodeShare.tsx` | Deep-Link mit Code in URL, WhatsApp-Text aktualisieren |
| `src/components/CameraCodeEntry.tsx` | URL-Parameter `code` auslesen und auto-submit |
| `src/components/MobileInstallFab.tsx` | Konsistenz mit neuem localStorage-Ansatz |

Keine DB-Migration noetig.


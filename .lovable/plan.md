

## Analyse der Frage

Der Nutzer steht real am Spielfeld und kommt mit seinem Handy nicht so weit zurück / so hoch, dass das **ganze Feld** ins Bild passt. Das ist ein häufiges Problem bei Amateurplätzen ohne Tribüne.

## Was die App heute schon kann (recherchiert)

Beim Blick in die bestehende Architektur (`mem://features/camera-setup-logic`, `mem://features/field-calibration`, `src/lib/types.ts` mit `FieldCoverage`) sehe ich:

- Es gibt bereits den Datentyp **`FieldCoverage`** mit den Werten `"full" | "left_half" | "right_half" | "custom"`.
- Es gibt bereits **`field_rect`** und **`zoom_level`** im `CalibrationData`-Interface.
- Die Auto-Kalibrierung über `detect-field-corners` läuft beim Aufnahmestart automatisch.
- Es werden offiziell **1–3 Smartphones** unterstützt (Mittellinie, plus optional zwei Hälften).

Das heißt: Die **Datengrundlage** für Teilfeld-Aufnahmen ist da, sie wird aber im UI heute nicht aktiv als Lösung angeboten und der Nutzer wird nicht erklärend geführt.

## Empfohlene Lösung — drei Antwort-Wege im UI

Statt nur eine Antwort zu geben, schlage ich vor, dem Nutzer **drei konkrete Wege** direkt im Recording-Setup anzubieten:

### Weg 1: Halbfeld-Modus (1 Handy, halbe Coverage)
- Nutzer wählt aktiv **„Linke Hälfte"** oder **„Rechte Hälfte"**.
- Auto-Kalibrierung erkennt nur die sichtbare Hälfte, `coverage = "left_half"` / `"right_half"` wird gespeichert.
- Analyse läuft normal, aber Kennzahlen werden mit **Halbfeld-Hinweis** versehen (z. B. „Nur Heim-Defensive analysiert").
- Pässe/Events außerhalb des Bildes werden klar als „nicht erfasst" markiert statt geraten.

### Weg 2: Zwei-Handy-Setup (volle Coverage)
- Erstes Handy filmt eine Hälfte selbst, zweites Handy via **Helfer-Code** die andere.
- Bestehender Helfer-Flow + bestehende Frame-Merging-Logik (`_cam0`, `_cam1`) macht das technisch schon möglich.
- Im UI klare Anleitung: „Stell beide Handys hinter beide Tore, je 45°-Winkel zur Mittellinie."

### Weg 3: Weitwinkel + bessere Position (kein Hardware-Wechsel)
- Hinweis auf den **0.5x-Weitwinkel-Toggle** (gerade gefixt für Pixel 8a).
- Tipps zur Position: höher stehen (Auto/Bank/Zaun), weiter weg, quer halten.
- `CameraSetupOverlay` zeigt diese Tipps schon — wir verstärken den Punkt „nicht das ganze Feld? → Weitwinkel + erhöhen".

## Was ich konkret bauen würde

**Phase A — Sofort sichtbare UX (klein, hoher Nutzen):**

1. **Neue Komponente `FieldCoverageHelp.tsx`** als ausklappbarer „Mein Feld passt nicht ins Bild?"-Hinweis im `CameraSetupOverlay`.
2. **`MatchRecordingChoice.tsx`** ergänzen: Unter „Ich filme selbst" eine kleine Zusatzzeile „Auch nur eine Hälfte möglich".
3. **`CameraSetupOverlay.tsx`** ergänzen um einen sichtbaren Mode-Selector: **Ganzes Feld / Linke Hälfte / Rechte Hälfte**, gespeichert in `coverage`.

**Phase B — Coverage in Analyse durchziehen:**

4. **`CameraTrackingPage.tsx`** speichert die gewählte `coverage` in `match.calibration` (Feld existiert bereits in `CalibrationData`).
5. **`MatchReport.tsx` / `DataQualityPanel.tsx`** zeigen ein Badge „Halbfeld-Analyse" wenn `coverage !== "full"`, damit Kennzahlen korrekt eingeordnet werden.
6. **`use-match-stats.ts`**: Bei Halbfeld-Coverage werden gegnerische Kennzahlen, die ohne sichtbares Feld nicht ableitbar sind (z. B. Pressing-Höhe gegnerische Hälfte), auf `null` gesetzt statt geschätzt — passt zum bestehenden „Truth Mode" aus `mem://features/tracking-ux-transparency`.

**Phase C — Helfer-Empfehlung verstärken (optional):**

7. Im `CameraSetupOverlay` bei Auswahl „Halbfeld" zusätzlich Hinweis-Card: „Tipp: Mit einem Helfer + zweitem Handy bekommst du das ganze Feld → [Helfer-Code teilen]" → führt direkt in den bestehenden Helfer-Flow.

## Betroffene Dateien

**Neu:**
- `src/components/FieldCoverageHelp.tsx`

**Ändern:**
- `src/components/CameraSetupOverlay.tsx` — Coverage-Selector + Hilfe-Block
- `src/components/MatchRecordingChoice.tsx` — Sub-Hinweis bei Self/Helfer
- `src/pages/CameraTrackingPage.tsx` — `coverage` in Calibration persistieren
- `src/components/DataQualityPanel.tsx` — Halbfeld-Badge
- `src/pages/MatchReport.tsx` — Halbfeld-Hinweis im Header
- `src/hooks/use-match-stats.ts` — Null-Setzen nicht-erfassbarer Kennzahlen bei Halbfeld

**Unverändert:**
- Frame-Pipeline, Storage, Auto-Kalibrierung, Helfer-Flow — alles nutzt vorhandene Mechanik.

## Was sich für dich konkret ändert

- Wenn dein Handy nicht das ganze Feld sieht, wirst du im Setup **direkt gefragt**, ob du eine Hälfte oder mit Helfer das ganze Feld filmen willst.
- Halbfeld-Aufnahmen liefern **ehrliche Kennzahlen** für die sichtbare Hälfte statt geschätzter Werte für das ganze Feld.
- Im Report siehst du klar, dass es sich um eine Halbfeld-Analyse handelt — keine falschen Erwartungen.


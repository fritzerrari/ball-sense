

## Analyse: Spieler-Foto-Import — Komplettprüfung

### Gefundene Probleme

**1. Große Bilder werden uncomprimiert als Base64 gesendet**
Handy-Fotos sind oft 5-15 MB. Als Base64 wird das ~33% größer. Das führt zu:
- Timeouts bei der Edge Function (Standard: 60s)
- Unnötig lange Wartezeiten
- Mögliche Request-Size-Limits

**Fix**: Bild vor dem Senden auf max. 1600px Breite resizen und auf JPEG 0.8 Qualität komprimieren (via Canvas). Reduziert typisch von 10 MB auf ~200-400 KB.

**2. Keine Bildgröße-Validierung**
Kein Limit für die Dateigröße. Ein 20 MB RAW-Foto würde den gesamten Flow blockieren.

**Fix**: Max 20 MB Datei-Check mit Fehlermeldung.

**3. Edge Function: Kein Fallback wenn Tool-Call leer zurückkommt**
Wenn die KI kein `tool_calls` zurückgibt (z.B. bei unlesbarem Bild), kommt `players = []` ohne Fehlermeldung. Der User sieht "0 Spieler erkannt" ohne zu verstehen warum.

**Fix**: Wenn 0 Spieler erkannt, prüfen ob es ein content-response gab und eine hilfreiche Meldung anzeigen ("Keine Spieler erkannt — ist das Bild gut lesbar?").

**4. Positions-Dropdown zeigt nur Codes statt Labels**
In der Korrektur-Tabelle steht nur "TW", "IV" etc. — für den User nicht intuitiv.

**Fix**: `{pos} — {POSITION_LABELS[pos]}` im Dropdown anzeigen (wie schon im Spieler-Dialog).

**5. Kein "Zurück"-Button in Schritt 3**
Wenn das Ergebnis schlecht ist, muss der User "Abbrechen" drücken und komplett von vorn anfangen. Ein "Neues Foto" wäre besser.

**Fix**: "Neues Foto"-Button in Schritt 3, der zu Schritt 1 zurückspringt (ohne Dialog zu schließen).

**6. Duplikat-Check prüft nur existierende Nummern, nicht innerhalb des Imports**
Wenn zwei importierte Spieler die gleiche Nummer haben, wird das nicht angezeigt.

**Fix**: Auch interne Duplikate erkennen und warnen.

**7. handleBulkImport: Fehler werden verschluckt**
Im catch-Block steht nur `/* skip duplicates */`. Es wird nicht kommuniziert, wenn Spieler fehlschlagen.

**Fix**: Fehler zählen und am Ende melden: "X von Y importiert, Z fehlgeschlagen".

**8. Dialog schließt sich bei Klick auf Overlay während der Analyse**
Während Schritt 2 (KI läuft) kann der User versehentlich den Dialog schließen.

**Fix**: Dialog-Close während Schritt 2 blockieren.

---

### Plan

#### Datei 1: `src/components/RosterImportDialog.tsx`
- Bild-Komprimierung via Canvas (max 1600px, JPEG 0.8) vor dem Upload
- Dateigrößen-Check (max 20 MB)
- Positions-Dropdown mit Labels: `{pos} — {POSITION_LABELS[pos]}`
- "Neues Foto"-Button in Schritt 3
- Interne Duplikat-Erkennung (gleiche Nummern innerhalb des Imports)
- Dialog-Close blockieren während Analyse (Schritt 2)
- Bessere Fehlermeldung bei 0 erkannten Spielern

#### Datei 2: `supabase/functions/parse-roster/index.ts`
- Fallback-Parsing wenn kein Tool-Call: versuche `message.content` als JSON zu parsen
- Explizite Meldung wenn 0 Spieler erkannt

#### Datei 3: `src/pages/Players.tsx`
- `handleBulkImport`: Fehler zählen und differenziert melden


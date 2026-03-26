

# Kalibrierung, Auswechslungen, Nacherfassung & Feature-Updates

## Erkenntnisse aus der Code-Pruefung

### Kalibrierung
Die Feldkalibrierung (`FieldCalibration.tsx`) existiert als separate Seite unter `/fields/:id/calibrate`, ist aber **nicht in den Aufnahme-Workflow integriert**. Laut Memory wird die Kalibrierung beim Aufnahmestart automatisch ueber `detect-field-corners` gemacht — der User muss also NICHT manuell kalibrieren. **Problem**: Das wird dem User nirgends kommuniziert. Er sieht "Kalibrierung" in der Platz-Verwaltung und denkt er muss das tun.

### Auswechslungen
- `MatchEventQuickBar` (Kamera-Helfer): Hat NUR 8 Basis-Events (Tor, Chance, Gelb, Rot, Ecke, Foul, Abseits, Freistoss). **Keine Auswechslung.**
- `LiveEventTicker` (Trainer-View): Hat 20+ Events aber ebenfalls **keine Auswechslung** als Event-Typ.
- i18n hat Strings fuer "substitution" und "Auswechslung", aber die UI existiert nicht.

### Nacherfassung
Es gibt **keine Post-Match-Event-Editierung**. Wenn Events vergessen wurden, gibt es keinen Weg sie nachzutragen.

### Spielvorbereitung
`MatchPrep.tsx` zeigt keinen Hinweis wenn keine Spiele vorhanden sind — es wuerde einfach eine leere/generische Vorbereitung generieren.

---

## Plan

### 1. Auswechslung als Event-Typ hinzufuegen

**`LiveEventTicker.tsx`**: Neue Kategorie "Wechsel" mit Event-Typ `substitution`. Spezial-UI: Zwei Spieler-Selects (Raus + Rein) statt nur einem.

**`MatchEventQuickBar.tsx`**: Auswechslungs-Button hinzufuegen (Icon: ArrowRightLeft). Bei Klick: Einfaches Modal mit "Wer raus?" und "Wer rein?" Dropdown (oder Freitext wenn keine Spieler geladen).

### 2. Post-Match Nacherfassung

**Neue Komponente `PostMatchEventEditor.tsx`**:
- Oeffnet sich im MatchReport als "Events nacherfassen" Button
- Tabelle aller bisherigen Events mit Loeschen-Option
- "Event hinzufuegen" Form: Typ, Minute, Team, Spieler, Notiz
- Auswechslungen nachtraeglich erfassen
- Speichert direkt in `match_events` Tabelle

**Spielbericht-Foto Upload**:
- Im PostMatchEventEditor: Button "Spielbericht abfotografieren"
- Foto wird hochgeladen, KI (Gemini Vision) extrahiert: Tore, Karten, Auswechslungen, Ergebnis
- Extrahierte Events werden als Vorschlag angezeigt, User bestaetigt
- Neuer Edge Function `parse-match-report-photo` fuer die OCR/Extraktion

### 3. Kalibrierung kommunizieren

**`CameraSetupOverlay.tsx`**: Neuen Tipp hinzufuegen: "Kalibrierung passiert automatisch — du musst nichts tun. Die KI erkennt das Spielfeld im ersten Frame."

**`NewMatch.tsx`**: Nach Spiel-Erstellung Info-Toast: "Die Feldkalibrierung laeuft automatisch beim Aufnahmestart."

### 4. Spielvorbereitung: Leerzustand

**`MatchPrep.tsx`**: Wenn `recentOpponents` leer ist (keine Spiele vorhanden), zeige EmptyState: "Erstelle zuerst mindestens ein Spiel, damit die KI auf Daten zurueckgreifen kann. Die Spielvorbereitung basiert auf deiner Spielhistorie."

### 5. Feature-Seite & Demo aktualisieren

**`FeatureCards.tsx`**: Neue Features in bestehende Gruppen aufnehmen:
- Reports & Coaching: "KI-Spielvorbereitung" (Brain Icon) — "Automatischer Matchplan mit Formations-Empfehlung, Gegner-Warnungen und Aufstellungs-Tipps."
- Reports & Coaching: "Spielbericht-Scan" (Camera Icon) — "Spielbericht abfotografieren und Events automatisch nacherfassen."
- Aufnahme & Setup: "Walkie-Talkie" (Radio Icon) — "Push-to-Talk Kommunikation zwischen Trainer und Kameramann."
- Aufnahme & Setup: "Auto-Kalibrierung" erwaehnen im bestehenden Kalibrierungs-Feature

**`DemoSection.tsx`**: Auswechslungs-Event in Demo-Daten aufnehmen.

---

## Dateien

| Datei | Aenderung |
|---|---|
| `src/components/MatchEventQuickBar.tsx` | Auswechslungs-Button + Mini-Dialog |
| `src/components/LiveEventTicker.tsx` | Substitution-Event mit Doppel-Spieler-Select |
| `src/components/PostMatchEventEditor.tsx` | **NEU** — Nacherfassung + Spielbericht-Foto |
| `supabase/functions/parse-match-report-photo/index.ts` | **NEU** — Gemini Vision OCR fuer Spielberichte |
| `src/pages/MatchReport.tsx` | PostMatchEventEditor einbinden |
| `src/components/CameraSetupOverlay.tsx` | Auto-Kalibrierungs-Hinweis |
| `src/pages/MatchPrep.tsx` | Empty State wenn keine Spiele vorhanden |
| `src/components/landing/FeatureCards.tsx` | Neue Features (Spielvorbereitung, Walkie-Talkie, Scan) |
| `src/pages/NewMatch.tsx` | Toast-Hinweis zur Auto-Kalibrierung |

Keine DB-Migration noetig — `match_events` unterstuetzt bereits beliebige `event_type` Werte.


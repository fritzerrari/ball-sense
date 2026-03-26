

# Kamera-Cleanup, Profi-PDF-Export & Taktik-Generator

## 1. Automatisches Cleanup: Kamera-Sessions nach Analyse loeschen

**Problem**: `camera_access_sessions` sammeln sich an — werden nie geloescht.

**Loesung**: In `generate-insights/index.ts` nach erfolgreichem Abschluss (wo bereits Frames geloescht werden) auch die abgelaufenen Camera-Sessions fuer dieses Match loeschen:

```sql
DELETE FROM camera_access_sessions WHERE match_id = X
```

Ebenso `tracking_uploads` auf `status = 'processed'` setzen und alte `camera_access_codes` mit `active = false` markieren wenn keine offenen Matches mehr existieren.

**Datei**: `supabase/functions/generate-insights/index.ts` — ca. 5 Zeilen nach dem Frame-Cleanup ergaenzen.

---

## 2. Professioneller PDF-Export (Edge Function)

**Neue Edge Function**: `supabase/functions/generate-pdf-report/index.ts`

### Konzept
Eine Edge Function die alle Report-Daten (Sections, Insights, Training, Taktik) aus der DB laedt und ein strukturiertes Markdown-Dokument generiert, das client-seitig als professionelles PDF gedruckt wird.

### Ablauf
1. Frontend ruft Edge Function auf mit `matchId` + `reportType` (full_report | training_plan | match_prep | halftime_tactics)
2. Function laedt alle relevanten Daten (report_sections, training_recommendations, analysis_results, match_events, team_match_stats)
3. KI (Lovable AI) generiert ein druckoptimiertes HTML-Dokument mit:
   - **Deckblatt** mit Vereinsname, Gegner, Datum, Logo-Platzhalter
   - **Inhaltsverzeichnis**
   - **Executive Summary** auf einer Seite
   - **Taktische Analyse** mit Seitenumbruechen zwischen Sektionen
   - **Spieler-Bewertungen** als Tabelle
   - **Trainingsplan** mit Wochenstruktur
   - **Notiz-Bereich** (leere linierte Flaeche am Ende jeder Sektion)
   - CSS Print-Styles: `@page`, `page-break-before`, professionelle Typografie
4. Frontend oeffnet HTML in neuem Tab und triggert `window.print()` → PDF

### Report-Typen
| Typ | Inhalt |
|---|---|
| `full_report` | Kompletter Nachbericht mit allen Sektionen |
| `training_plan` | Nur Trainingsempfehlungen + Mikrozyklus |
| `match_prep` | Gegner-Analyse + Taktik-Empfehlung + Formation |
| `halftime_tactics` | Halbzeit-Anpassungen + 2. HZ Taktik-Vorschlag |

### PDF-Layout (CSS Print)
- A4-Format, 20mm Margins
- Vereinsfarben als Akzent (Header-Linie)
- Saubere Seitenumbrueche (`page-break-before: always` vor jeder Hauptsektion)
- Tabellen fuer Spielerdaten mit alternierenden Zeilen
- Grafiken als Unicode-Balken (▓░) fuer Metriken
- Notizbereich: gepunktete Linien mit "Eigene Notizen:" Header
- Footer mit Seitenzahlen und "Generiert mit FieldIQ"

**Dateien**: 
- `supabase/functions/generate-pdf-report/index.ts` (NEU)
- `supabase/config.toml` (Function-Config)

---

## 3. PDF-Download-Buttons im Frontend

**MatchReport.tsx**: Download-Dropdown im Header mit:
- "Kompletter Report (PDF)"
- "Trainingsplan (PDF)"
- "Gegner-Briefing (PDF)"

**MatchPrep Page**: "Vorbereitung als PDF" Button

**Implementierung**: Eine `usePdfExport` Hook-Funktion die die Edge Function aufruft, das HTML empfaengt und per `window.open` + `print()` als PDF ausgibt.

**Dateien**:
- `src/hooks/use-pdf-export.ts` (NEU)
- `src/pages/MatchReport.tsx` (Download-Buttons ergaenzen)
- `src/pages/MatchPrep.tsx` (Download-Button)

---

## 4. Halbzeit-Taktik & Gegner-Taktik-Generator

**Problem**: Trainer wollen konkrete taktische Vorschlaege fuer die 2. Halbzeit oder den naechsten Gegner.

**Loesung**: Der `generate-pdf-report` Endpoint mit `reportType = "halftime_tactics"` generiert:

- **2. Halbzeit Taktik** (wenn Match-Status "live" oder "halftime"):
  - Formations-Empfehlung basierend auf 1. HZ Analyse
  - Konkrete Wechselvorschlaege (basierend auf Ermuedung + Performance)
  - 3 taktische Anpassungen (z.B. "Pressing-Linie 10m hoeher", "Aussenverteidiger offensiver")
  - Gegner-Schwachstellen die in 1. HZ aufgefallen sind

- **Naechster Gegner** (wenn Match done + Gegner bekannt):
  - Nutzt `match-preparation` Daten
  - Optimale Formation gegen diesen Gegner
  - Do/Don't Liste
  - Set-Piece-Strategie

Beide nutzen den bestehenden `match-preparation` Flow + eigene Analyse-Daten als KI-Kontext.

**Datei**: Integriert in `generate-pdf-report/index.ts` (reportType-Switch)

---

## Zusammenfassung Dateien

| Datei | Aenderung |
|---|---|
| `supabase/functions/generate-insights/index.ts` | Camera-Sessions + Codes Cleanup nach Analyse |
| `supabase/functions/generate-pdf-report/index.ts` | **NEU** — PDF-Report-Generator Edge Function |
| `supabase/config.toml` | Function-Config fuer generate-pdf-report |
| `src/hooks/use-pdf-export.ts` | **NEU** — Hook fuer PDF-Export |
| `src/pages/MatchReport.tsx` | PDF-Download-Buttons im Header |
| `src/pages/MatchPrep.tsx` | PDF-Download-Button |

Keine DB-Migration noetig.




## Analyse & Plan: Umfangreiches Admin-Panel, Reporting, UX-Verbesserungen & Content-Generierung

Das ist ein sehr umfangreiches Feature-Set. Ich unterteile es in logische Arbeitspakete, die schrittweise implementiert werden sollten.

---

### Paket 1: Erweitertes Admin-Panel

**1a. Vollständige Nutzerverwaltung**
- E-Mail-Anzeige in der Nutzer-Tabelle (erfordert eine Edge Function, da `auth.users` nicht direkt per Client abfragbar ist — eine `admin-users` Edge Function mit Service Role Key liest die User-Liste)
- Nutzer sperren/entsperren (via `auth.admin.updateUserById`)
- Nutzer löschen (mit Bestätigungsdialog)
- Passwort zurücksetzen (Einladungsmail senden)
- Filter nach Rolle, Verein, Status
- Pagination

**1b. Rechtliche Dokumente verwalten**
- Neue DB-Tabelle `legal_documents` (id, slug, title, html_content, active, updated_at, updated_by)
- RLS: nur Admins dürfen CRUD
- Admin-Tab "Dokumente" mit HTML-Editor (Textarea mit Preview), Aktivierung/Deaktivierung per Toggle
- Öffentliche Route `/legal/:slug` zum Anzeigen aktiver Dokumente

**1c. Audit-Logs / Protokolle**
- Neue DB-Tabelle `audit_logs` (id, user_id, action, entity_type, entity_id, details_json, created_at)
- RLS: nur Admins lesen, alle authentifizierten User schreiben (via DB-Trigger oder manuelles Insert)
- Admin-Tab "Protokolle" mit Filterung (Zeitraum, Aktion, Nutzer), Einzellöschung und "Alle löschen"
- Wichtige Aktionen loggen: Rollenwechsel, Plan-Änderung, Dokumentbearbeitung, Login

**1d. Globale Suche & erweiterte Suche**
- Suchfeld im Admin-Header das über alle Tabs sucht (Vereine, Nutzer, Spiele)
- Erweiterte Suche mit Filtern: Datum, Status, Plan, Rolle

---

### Paket 2: Dashboard-Reporting mit Charts

**Für MatchReport und PlayerProfile:**
- Recharts-basierte Visualisierungen:
  - Distanz-Balkendiagramm (alle Spieler eines Spiels)
  - Speed-Radar-Chart pro Spieler
  - Sprint-Verteilung über Spielzeit (Liniendiagramm)
  - Ballbesitz-Donut-Chart (Heim vs Auswärts)
  - Distanz-Trend über mehrere Spiele (Liniendiagramm im PlayerProfile)
- Vergleichs-Tab mit visuellen Gegenüberstellungen statt nur Zahlen

---

### Paket 3: Upload-Verifizierung & UX

**3a. Upload-Flow verbessern (TrackingPage)**
- Mehrstufiger Fortschrittsbalken mit Statustext ("Daten komprimieren...", "Hochladen...", "Validieren...")
- Explizite Erfolgsmeldung nach Upload (grüner Fullscreen-Check mit Zusammenfassung: Frames, Dauer, Qualität)
- Fehlerbehandlung mit Retry-Button

**3b. Upload-Prüfung im Admin**
- Admin-Tab "Uploads" zeigt alle tracking_uploads mit Status, Frames, Dauer, Kamera-Index
- Statusfarben: uploaded (gelb), processing (blau), done (grün), error (rot)
- Möglichkeit, fehlerhafte Uploads zu markieren oder neu zu triggern

---

### Paket 4: Vereinslogo-Upload

- In Settings: Logo-Upload-Bereich mit Vorschau
- Upload in den bestehenden `club-logos` Storage Bucket
- URL wird in `clubs.logo_url` gespeichert
- Logo erscheint in Sidebar, Dashboard und Admin

---

### Paket 5: KI-Berichtsgenerierung

**5a. Vorbericht (Pre-Match Report)**
- Neuer Bereich auf der Match-Setup-Seite: "Vorbericht generieren"
- Prüft ob genug historische Daten vorhanden sind (mindestens 3 abgeschlossene Spiele)
- Edge Function generiert Analyse basierend auf bisherigen Statistiken beider Teams
- Download als PDF oder per Mail versendbar (Clipboard/Share API)

**5b. Spielbericht / Artikel**
- Nach Spielende: Button "Spielbericht generieren"
- Optionen: Länge (Kurz ~100 Wörter, Mittel ~300, Lang ~600), Schreibstil (Sachlich, Sportjournalistisch, Social Media)
- Hinweis-Banner: "Der generierte Inhalt wird nicht gespeichert. Kopiere oder lade ihn herunter."
- Rate-Limiting: Tabelle `report_generations` (match_id, user_id, created_at) — max 5 Generierungen pro Spiel, max 20 pro Tag pro Club
- Download als Text/PDF, Copy-to-Clipboard, Share

---

### Technische Anforderungen

**Neue DB-Tabellen (Migrationen):**
1. `legal_documents` — Rechtstexte
2. `audit_logs` — Protokolle
3. `report_generations` — Rate-Limiting für Berichte

**Neue/Erweiterte Edge Functions:**
1. `admin-users` — Nutzerliste aus auth.users lesen (Service Role)
2. `ai-assistant` erweitern — Vorbericht & Spielbericht-Generierung

**Neue Dateien:**
- `src/pages/Admin.tsx` — kompletter Rewrite mit 6+ Tabs
- `src/pages/LegalPage.tsx` — öffentliche Rechtstexte
- `src/components/AdminUsers.tsx`, `AdminLegal.tsx`, `AdminLogs.tsx`, `AdminUploads.tsx`
- `src/components/MatchCharts.tsx` — Recharts-Komponenten
- `src/components/ReportGenerator.tsx` — Bericht-UI
- `src/components/LogoUpload.tsx` — Logo-Upload-Komponente

**Geänderte Dateien:**
- `src/pages/Settings.tsx` — Logo-Upload hinzufügen
- `src/pages/MatchReport.tsx` — Charts + Berichtsgenerierung
- `src/pages/PlayerProfile.tsx` — Trend-Charts
- `src/pages/TrackingPage.tsx` — verbesserter Upload-Flow
- `src/App.tsx` — neue Routes
- `supabase/config.toml` — neue Edge Functions

---

### Empfohlene Reihenfolge

Aufgrund des Umfangs schlage ich vor, dies in 3-4 Durchgängen zu implementieren:
1. **Runde 1**: Admin-Panel (Nutzerverwaltung, Dokumente, Logs, Uploads-Tab) + globale Suche
2. **Runde 2**: Dashboard-Charts + Upload-UX + Logo-Upload
3. **Runde 3**: KI-Berichtsgenerierung (Vorbericht + Spielbericht)

Soll ich mit Runde 1 (erweitertes Admin-Panel) beginnen?


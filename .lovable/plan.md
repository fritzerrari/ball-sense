

## Plan: Vollstaendige Install-/Download-Seite mit OS-spezifischen Anleitungen und Tracking-Workflow-Guide

### Ist-Zustand
- `/install` (InstallGuide.tsx) existiert mit einer generischen 5-Schritt-Anleitung und optionaler geraetespezifischer Auswahl aus der DB
- PWA-Setup ist rudimentaer (manifest.json vorhanden, aber kein `vite-plugin-pwa` konfiguriert)
- TrackingPage hat bereits Start/Pause/Halbzeit/Ende/Wechsel/Upload-Funktionalitaet
- Kein OS-Tab-System (iOS vs Android), keine visuellen Schritt-fuer-Schritt-Screenshots-Platzhalter

### Was gebaut wird

**1. PWA-Plugin einrichten (vite-plugin-pwa)**
- `vite-plugin-pwa` in `vite.config.ts` einbinden mit korrektem Manifest, Icons, Offline-Caching und `navigateFallbackDenylist: [/^\/~oauth/]`
- `manifest.json` erweitern mit mehreren Icon-Groessen (192x192, 512x512 Platzhalter)

**2. InstallGuide.tsx komplett ueberarbeiten**
Die Seite wird in zwei Hauptbereiche aufgeteilt:

**Teil A — App installieren (OS-Tabs: iOS / Android)**
- Tab-basierte Ansicht mit betriebssystemspezifischen Schritten:
  - **iOS**: Safari oeffnen → Teilen-Button → "Zum Home-Bildschirm" → Bestaetigen → App oeffnen
  - **Android**: Chrome oeffnen → Drei-Punkte-Menue → "App installieren" / "Zum Startbildschirm" → Bestaetigen → App oeffnen
- Jeder Schritt als nummerierte Karte mit Titel, Beschreibung und Platzhalter fuer Screenshots (`image_url`)
- Automatische OS-Erkennung (`navigator.userAgent`) um den richtigen Tab vorzuselektieren
- Hinweis auf Kamera-Berechtigung je OS

**Teil B — So funktioniert das Tracking (Workflow-Guide)**
Visueller Schritt-fuer-Schritt-Guide durch den kompletten Match-Workflow:
1. **Spiel anlegen** — Gegner, Datum, Platz, Aufstellung waehlen
2. **Mannschaft aufstellen** — Startspieler (11) und Wechselspieler (bis 7) festlegen
3. **Smartphones positionieren** — 2-3 Geraete entlang der Seitenlinie, QR-Code scannen
4. **Feld kalibrieren** — Foto hochladen, 4 Eckpunkte antippen, speichern
5. **Tracking starten** — KI-Modell laed, Kamera aktivieren, Start-Button
6. **Waehrend des Spiels** — Pause/Weiter, Halbzeit-Upload, Wechselspieler melden (Spieler raus/rein + Minute)
7. **Spiel beenden & hochladen** — Ende-Button, Spieler zuordnen, Daten hochladen
8. **Report ansehen** — Heatmaps, Laufdistanzen, Sprints, Topspeed

Jeder Schritt als Collapsible/Accordion-Karte mit Icon, Titel und ausfuehrlicher Beschreibung.

**3. Geraete-Auswahl beibehalten**
- Die bestehende Marke/Modell-Auswahl aus der DB (`device_guides`) bleibt als optionale Sektion erhalten
- Wird unter den OS-Tabs angezeigt fuer geraetespezifische Besonderheiten

### Technische Umsetzung

| Datei | Aenderung |
|---|---|
| `package.json` | `vite-plugin-pwa` hinzufuegen |
| `vite.config.ts` | PWA-Plugin konfigurieren mit Manifest, Workbox, navigateFallbackDenylist |
| `public/manifest.json` | Erweiterte Icons, Categories, Screenshots-Felder |
| `src/pages/InstallGuide.tsx` | Kompletter Umbau mit Tabs-Komponente (iOS/Android), Workflow-Accordion, OS-Auto-Detection |

### Kein DB-Schema noetig
Alle Inhalte sind statisch im Frontend hinterlegt. Die bestehende `device_guides`-Tabelle wird weiterhin fuer geraetespezifische Guides genutzt.


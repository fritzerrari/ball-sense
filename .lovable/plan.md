
Ziel: Ich würde das in 6 zusammenhängenden Arbeitspaketen umsetzen, damit die App wirklich als einfache, saubere PWA funktioniert und die Tracking-/Einwilligungslogik fachlich stimmt.

1. PWA sauber fertig machen
- Die heute verteilten Installationshilfen (`PwaInstallPrompt`, `MobileInstallFab`, `/install`) zu einer einheitlichen Install-Komponente zusammenführen.
- Auf Android: echter Install-Button über `beforeinstallprompt`.
- Auf iPhone/iPad: eigener “Installieren”-Button, der eine kompakte Safari-Anleitung öffnet, weil iOS kein natives Install-Popup liefert.
- PWA abrunden:
  - Meta-Tags und Homescreen-Verhalten prüfen/ergänzen
  - Manifest für App-Feeling optimieren
  - Update-/Offline-Verhalten vereinheitlichen
  - doppelte Install-Prompts vermeiden
- Ergebnis: ein klarer Download-/Install-CTA auf Dashboard, Install-Seite und im mobilen App-Layout.

2. PWA-Menü komplett vereinfachen
Aktueller Stand:
- Das Menü in `AppLayout` ist für Desktop ok, aber für eine PWA noch zu technisch und zu wenig fokussiert.
- Admin, Installation und Kernfunktionen liegen gemischt.

Geplanter Umbau laut deiner Auswahl “Admin getrennt”:
- Mobile/PWA-Navigation auf sehr einfache Hauptpunkte reduzieren:
  - Start
  - Spiele
  - Tracking
  - Kader
  - Mehr
- “Mehr” öffnet ein übersichtliches Sheet / Menü mit:
  - Plätze
  - Einstellungen
  - Installation
  - Admin (nur wenn berechtigt)
- Desktop-Sidebar ebenfalls gruppieren:
  - Hauptfunktionen
  - Verwaltung
  - Admin
- Tracking als primäre Aktion deutlich sichtbarer machen.

3. Kalibrierungsfluss reparieren
Gefundener Fehler:
- In `TrackingPage` gibt es zwar “Verwenden & Starten”, aber wenn man die Kalibrierung über das Plätze-Menü öffnet, navigiert `FieldCalibration` nach dem Speichern immer zurück auf `/fields`.
- Dadurch fehlt genau der “Weiter”-Schritt zurück in den Tracking-Flow.

Geplante Lösung:
- Kalibrierungsseite mit Rücksprung-Logik erweitern (`returnTo` / `source` Query-Parameter).
- Wenn die Kalibrierung aus dem Tracking kommt:
  - Button: “Speichern & weiter”
  - danach direkt zurück zur Tracking-Seite
- Wenn sie normal aus dem Plätze-Menü kommt:
  - Button: “Speichern & zurück”
- Optional zusätzlich auf der Plätze-Seite einen klaren Folge-CTA anzeigen, z. B. “Jetzt Tracking starten”.

4. Einwilligungen und Tracking-Ausschlüsse korrekt einbauen
Deine Auswahl: “Nur Bestätigung”
Das heißt: keine Dokumentenverwaltung pro Spieler, aber rechtlich sichtbare Pflicht-Bestätigungen im Match-/Team-Setup.

Geplante Änderungen:
- Beim Erstellen eines Spiels/Trainings Pflicht-Bestätigungen ergänzen:
  - alle eigenen getrackten Spieler sind volljährig oder es liegt eine Eltern-Einwilligung vor
  - alle getrackten Spieler haben eingewilligt
  - falls das gegnerische Team mitgetrackt wird: dort liegt die Einwilligung ebenfalls vor
- Zusätzlich pro Spiel einzelne Spieler vom Tracking ausschließbar machen.
- Fachlich sauberster Ort dafür:
  - auf Match-Ebene Bestätigungsfelder
  - auf Aufstellungs-Ebene ein Flag wie `tracking_enabled` / `excluded_from_tracking`
- `process-tracking` berücksichtigt diese ausgeschlossenen Spieler dann automatisch nicht mehr.

5. Kamera-Zugänge als einfache Codes bauen
Wichtiger Befund:
- Die Tracking-Seite ist heute öffentlich erreichbar, aber Teile des Upload-/Registrierungsflusses setzen intern eigentlich Vereinszugriff voraus.
- Das ist funktional und sicherheitstechnisch inkonsistent.

Deine Auswahl: “Einfache Kamera-Codes”
So würde ich es lösen:
- Neuer Bereich in den Einstellungen: “Kamera-Zugänge”
- Der Vereins-Hauptnutzer kann dort bis zu 3 Kamera-Codes anlegen
  - z. B. Hauptkamera, linke Seite, rechte Seite
- Keine Voll-Logins für diese Nutzer, sondern einfache, kurze Zugangsdaten nur für Tracking
- Sicher umgesetzt:
  - Codes nie im Klartext speichern
  - Prüfung über eine Backend-Funktion
  - nach erfolgreicher Eingabe erhält das Gerät eine kurze Tracking-Freigabe für Match/Kamera
- Tracking-Links / QR-Codes führen dann auf:
  - Match/Kamera auswählen
  - Code eingeben
  - Tracking starten
- Das passt besser zur Multi-Kamera-Nutzung und behebt die heutige Bruchstelle zwischen öffentlicher Tracking-Seite und geschütztem Datenfluss.

6. Qualitäts- und Fehlerbehebungsrunde
Ich würde danach noch gezielt optimieren:
- Formularvalidierung verschärfen:
  - Match-Erstellung
  - Spieleranlage
  - Kamera-Codes
  - Einwilligungsbestätigungen
- Tracking-Endscreen weiter verschlanken:
  - ausgeschlossene Spieler klar kennzeichnen
  - nur relevante Review-Hinweise zeigen
- Upload-/Retry-Flow robuster machen
- Install-/Tracking-Fluss auf Mobile klarer formulieren
- doppelte oder irreführende Buttons entfernen

Benötigte Backend-/Datenmodell-Erweiterungen
Ich würde dafür voraussichtlich folgende strukturelle Ergänzungen einplanen:
- Match-Felder für Einwilligungs-Bestätigungen und “Gegner mittracken”
- Match-Lineup-Feld für “vom Tracking ausgeschlossen”
- Neue Tabelle für Kamera-Zugänge / Tracking-Codes
- Optional: kleiner Mechanismus, um den Vereins-Hauptnutzer sauber für diese Verwaltung zu bestimmen, falls es mehrere Vereinsnutzer gibt

Technische Umsetzung nach Dateien
- `src/components/AppLayout.tsx`
  - neues, deutlich einfacheres PWA-Menü
  - Admin separat
- `src/components/PwaInstallPrompt.tsx`
- `src/components/MobileInstallFab.tsx`
- `src/pages/InstallGuide.tsx`
  - Install-Flow vereinheitlichen
- `src/pages/FieldCalibration.tsx`
  - Rücksprung / Weiter-Button nach Kalibrierung
- `src/pages/TrackingPage.tsx`
  - Rückkehr aus Kalibrierung
  - Kamera-Code-Gate
  - ausgeschlossene Spieler / neue Hinweise
- `src/pages/NewMatch.tsx`
  - Einwilligungsbestätigungen
  - Gegner-Tracking Toggle
  - einzelne Spieler ausschließen
- `src/pages/Settings.tsx`
  - Verwaltung der 1–3 Kamera-Codes
- `supabase/functions/process-tracking/index.ts`
  - ausgeschlossene Spieler und Gegner-Tracking berücksichtigen
- Datenbank-Migrationen
  - neue Match-/Lineup-Felder
  - Kamera-Code-Tabelle
  - passende RLS-Regeln

Empfohlene Reihenfolge
1. Kalibrierungs-Weiter-Button und Rücksprung fixen
2. PWA-Install-Flow vereinheitlichen
3. PWA-Menü vereinfachen
4. Einwilligungs-Checkboxen + Spieler ausschließen
5. Kamera-Codes mit sicherem Tracking-Zugang
6. Abschlussrunde für Fehlerbehebung und UX-Polish

Wichtiger technischer Hinweis
Der Teil mit den Kamera-Codes ist mehr als nur ein UI-Feature: dafür muss ich den heutigen Tracking-Zugriff sauber umbauen, damit öffentliche Kamera-Geräte sicher und zuverlässig Daten hochladen können. Das ist der wichtigste Architekturpunkt in deiner Liste und ich würde ihn entsprechend gründlich umsetzen.

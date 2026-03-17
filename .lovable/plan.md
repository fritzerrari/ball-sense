
Ja — aktuell ist das doppelt, und fachlich sollte die Aufstellung die Hauptquelle sein.

Was ich im Code gefunden habe:
- Die Startaufstellung wird beim Anlegen eines Spiels/Trainings bereits sauber in `match_lineups` gespeichert.
- Wechsel während des Trackings werden ebenfalls schon in `match_lineups` über `subbed_in_min` / `subbed_out_min` erfasst.
- Am Ende gibt es trotzdem noch einmal eine manuelle Zuordnung in `src/pages/TrackingPage.tsx`.
- Diese End-Zuordnung ist aktuell vor allem eine UI-Prüfung und nicht als verlässliche, durchgehende Zuordnungslogik ins Backend integriert.
- Für rote Karten gibt es in den Aufstellungen aktuell noch kein Ereignismodell.

Zielbild laut deiner Auswahl „Mit Kontrolle“:
- Die Aufstellung wird automatisch übernommen.
- Wechsel, Platzverweise und ähnliche Ereignisse ändern automatisch, welche Spieler in welchem Zeitfenster aktiv sind.
- Am Ende gibt es keine komplette zweite Zuordnung mehr, sondern nur noch eine kurze Prüfansicht für Ausnahmen:
  - unklare Tracks
  - niedrige Zuordnungs-Sicherheit
  - fehlende oder doppelte Spieler
  - Sonderfälle nach Wechsel / Karte

So würde ich es umbauen:

1. Aufstellung als Single Source of Truth
- `match_lineups` bleibt die Basis für alle Spieler eines Spiels.
- Startelf/Bank/Trainingsgruppe werden nicht mehr am Ende erneut komplett abgefragt.
- Die Endansicht zeigt nur noch „automatisch übernommen“ plus Abweichungen.

2. Ereignisse sauber modellieren
- Für eine belastbare Logik brauchen wir zusätzlich ein eigenes Match-Ereignismodell, z. B. `match_events`.
- Darin werden gespeichert:
  - Wechsel
  - rote Karten
  - optional gelb-rot / Verletzung / manuelle Deaktivierung
- Damit kann das Backend exakt berechnen, welcher Spieler in welchem Zeitabschnitt auf dem Feld war.
- Das ist robuster als nur einzelne Minutenfelder auf `match_lineups`.

3. Tracking-Verarbeitung zeitbasiert machen
- `process-tracking` ordnet nicht mehr „alle Spieler gegen alle Tracks“, sondern nur die Spieler, die in dem jeweiligen Zeitfenster aktiv sind.
- Beispiel:
  - Minute 0–62: Startelf minus rote Karte
  - ab Minute 63: neuer Spieler nach Wechsel
- Dadurch sinkt die Willkür stark, weil die Kandidatenmenge je Phase kleiner und realistischer wird.

4. Endscreen von Voll-Zuordnung auf Prüfansicht umstellen
- Statt aller Tracks mit Dropdowns:
  - Liste „automatisch sicher übernommen“
  - Liste „bitte prüfen“
- Nur unsichere Fälle bleiben manuell anpassbar.
- Zusätzlich Hinweise wie:
  - „Spieler A ab 63. Minute aktiv“
  - „Spieler B nach roter Karte ab 41. Minute ausgeschlossen“

5. Trainingsmodus vereinfachen
- Für Training standardmäßig keine zweite Zuordnung.
- Nur wenn Spieler ein-/aussteigen oder die KI mehrere Kandidaten verwechselt, erscheint die Prüfansicht.
- Halbzeit- und Wechsel-UI kann im Trainingsmodus weiter reduziert werden.

Technische Umsetzung:
- Frontend:
  - `src/pages/TrackingPage.tsx`
    - Endscreen von kompletter Spielerzuordnung auf „Review nur bei Ausnahmen“ umbauen
    - zusätzlich Event-Erfassung für rote Karte / Spieler deaktivieren
  - `src/pages/NewMatch.tsx`
    - keine Grundsatzänderung, da die Aufstellung schon korrekt angelegt wird
- Backend:
  - `supabase/functions/process-tracking/index.ts`
    - aktive Spieler pro Zeitfenster aus Aufstellung + Ereignissen ableiten
    - Zuordnung nur innerhalb dieser aktiven Gruppen
    - Confidence pro Zuordnung weiterführen
- Datenmodell:
  - neue Tabelle für Spielereignisse empfohlen, z. B. `match_events`
  - RLS analog zu `match_lineups`/`matches`: nur Club-Mitglieder des Heimteams dürfen lesen/schreiben

Warum das besser ist:
- kein doppeltes Erfassen derselben Spieler
- weniger Fehler am Spielende
- Wechsel und Karten werden systematisch berücksichtigt
- deutlich weniger „willkürliche“ Zuordnung im Backend
- der Nutzer prüft nur noch Ausnahmen statt alles neu zuzuordnen

Empfohlene Reihenfolge:
1. End-Zuordnung in der UI auf „Prüfansicht“ reduzieren
2. Match-Ereignisse für rote Karten/Sonderfälle ergänzen
3. `process-tracking` auf zeitfensterbasierte aktive Spieler umbauen
4. Trainingsmodus weiter vereinfachen

Technische Details:
- Aktuell ist `match_lineups` schon nah an dem, was wir brauchen, aber für rote Karten reicht es nicht aus.
- Ein separates Ereignismodell ist sauberer als zusätzliche Sonderfelder auf der Aufstellung.
- Die bestehende RLS-Struktur für match-bezogene Tabellen passt gut als Vorlage.
- Zusätzlich sollte `process-tracking` später nicht nur den ersten Upload blind nehmen, sondern Uploads/Halbzeiten kontrollierter verarbeiten, damit Zeitfenster und Ereignisse wirklich konsistent bleiben.

Kurz gesagt:
Ja, die zweite vollständige Zuordnung am Ende sollte weg. Die Startaufstellung sollte automatisch übernommen werden, und am Ende sollte nur noch eine kontrollierte Ausnahmen-Prüfung bleiben — unter Berücksichtigung von Wechseln, roten Karten und ähnlichen Ereignissen.

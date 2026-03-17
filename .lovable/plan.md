

## Spielerbogen abfotografieren und importieren

### Konzept
Der User fotografiert einen Spielerbogen (Kaderliste, Aufstellungsbogen) mit dem Handy. Ein KI-Modell (Gemini Vision) extrahiert Name, Nummer und Position aus dem Bild. Die erkannten Spieler werden in einer editierbaren Tabelle angezeigt, wo der User korrigieren, löschen oder ergänzen kann, bevor er den Import bestätigt.

### Technische Umsetzung

#### 1. Neuer "Import"-Button auf der Spieler-Seite
- Neben dem bestehenden "Spieler hinzufügen"-Button einen **"Foto-Import"**-Button (Camera-Icon) hinzufügen
- Öffnet einen mehrstufigen Import-Dialog

#### 2. Import-Dialog (3 Schritte)
- **Schritt 1 — Foto aufnehmen/auswählen**: File-Input mit `accept="image/*"` und `capture="environment"` für direktes Kamera-Auslösen auf Mobilgeräten. Vorschau des Bildes anzeigen.
- **Schritt 2 — KI-Erkennung**: Bild wird an eine Backend-Funktion gesendet, die Gemini Vision nutzt, um Name, Nummer und Position zu extrahieren. Ladeanimation mit "Spielerbogen wird analysiert…"
- **Schritt 3 — Manuelle Korrektur**: Editierbare Tabelle mit allen erkannten Spielern. Jede Zeile hat Eingabefelder für Name, Nummer, Position (Dropdown). Zeilen können gelöscht oder hinzugefügt werden. Duplikat-Warnung wenn ein Spieler mit gleicher Nummer bereits existiert. "Alle importieren"-Button am Ende.

#### 3. Backend-Funktion (Edge Function)
- Neue Edge Function `parse-roster` die das Bild als Base64 empfängt
- Nutzt Lovable AI (Gemini 2.5 Flash) mit einem strukturierten Prompt: "Extrahiere aus diesem Spielerbogen/Kaderliste alle Spieler mit Name, Trikotnummer und Position. Antworte als JSON-Array."
- Gibt `{ players: [{ name, number, position }] }` zurück

#### 4. Betroffene Dateien
- `src/pages/Players.tsx` — Import-Button und Dialog hinzufügen
- `src/components/RosterImportDialog.tsx` — Neuer mehrstufiger Import-Dialog
- `supabase/functions/parse-roster/index.ts` — Edge Function für Bild-Analyse

#### 5. Positions-Mapping
Die KI erkennt Positionen in natürlicher Sprache ("Torwart", "Mittelfeld"). Ein Mapping übersetzt diese in die vorhandenen Positions-Codes (TW, ZM, ST etc.) aus `POSITIONS` / `POSITION_LABELS`.


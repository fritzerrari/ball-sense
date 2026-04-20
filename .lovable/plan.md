
## Ziel
Die "Was-wäre-wenn"-Szenarien (`what-if-scenario` Edge Function) liefern aktuell teils zu konkrete, scheinbar deterministische Aussagen ("2:0 statt 3:0", harte Kausalketten). Der User möchte das **analytische Niveau anheben**: vorsichtige Formulierungen, Wahrscheinlichkeiten statt Ergebnisse, Berücksichtigung von Gegenrisiken und Abhängigkeiten.

## Was wir ändern

### 1. System-Prompt in `supabase/functions/what-if-scenario/index.ts` schärfen
Der aktuelle Prompt sagt nur "Sei konkret und ehrlich". Wir präzisieren ihn um die vom User benannten Analyse-Standards:

**Neue Leitplanken im Prompt:**
- **Keine deterministischen Endergebnisse** ("2:0 statt 3:0") → stattdessen Wahrscheinlichkeiten/Tendenzen ("geringere Wahrscheinlichkeit für frühes Gegentor", "stabilerer Spielverlauf wahrscheinlich")
- **Kausalitäten absichern**: jede Folge mit Bedingung formulieren ("falls Standardsituation", "abhängig von Positionsstruktur")
- **Gegenrisiken zwingend nennen** (z. B. "weniger Fouls = evtl. weniger Aggressivität, Gegner bekommt mehr Raum")
- **Vereinfachungen vermeiden**: keine simplen 1:1-Ableitungen ("weniger Fouls = mehr Ballbesitz" ❌)
- **Analyse-Level anheben**: Formulierungen wie "kontinuierliche Spielphasen mit Potenzial zur Kontrolle" statt "mehr Kontrolle"

### 2. JSON-Schema des Tool-Calls erweitern
Aktuell: `predicted_outcome` (string) — verleitet zu konkreten Scores.

**Neu:**
- `predicted_outcome` umbenennen/präzisieren in `predicted_tendency` (string, kein konkretes Ergebnis erlaubt — Beispiel-Hinweis im `description`-Feld)
- Neues Feld: `assumptions` (array, 1–3 Einträge) — explizite Bedingungen, unter denen die Prognose gilt
- `key_changes`: jedes Item soll mit Wahrscheinlichkeits-Adverb beginnen ("wahrscheinlich", "tendenziell", "potenziell")
- `risks` von 1–2 auf **2–3 Pflichtfelder** erhöhen (Gegenrisiko + Nebeneffekt + Abhängigkeit)
- `confidence` bleibt — aber Default-Tendenz zu `low`/`medium` (Anweisung im Prompt: nur `high` bei sehr klarer Datenlage)

### 3. Frontend `WhatIfBoard.tsx` an neue Schema anpassen
- Interface `WhatIfResult` umbenennen: `predicted_outcome` → `predicted_tendency`
- Neuer Block "Annahmen" (mit `Info`-Icon) zwischen Prognose und Veränderungen
- Risiken-Block: mehrzeilig statt `risks.join(" · ")` (jetzt 2–3 Items, lesbarer als Liste)
- UI-Label "Prognose" → "Tendenz" (klarere Erwartungshaltung)

### 4. Backwards-Compat
Edge Function liest weiter `predicted_outcome` als Fallback (falls alte gecachte Antworten irgendwo persistiert sind), schreibt aber neu `predicted_tendency`. Frontend prüft beide Felder.

## Dateien
- `supabase/functions/what-if-scenario/index.ts` — Prompt + Tool-Schema
- `src/components/WhatIfBoard.tsx` — Interface, Render-Layout, Labels

## Was wir NICHT ändern
- Preset-Buttons & Custom-Prompt-Flow bleiben identisch
- Pin-to-Training Feature bleibt
- Lovable AI Gateway / Modell (`google/gemini-2.5-flash`) bleibt — die Verbesserung erfolgt rein über Prompt-Engineering

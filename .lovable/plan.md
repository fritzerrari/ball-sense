

# Workflow-Vereinfachung, Transparenz-Update & Design-Optimierung

## Kernfrage: Braucht man noch die Aufstellung?

**Nein, nicht zwingend.** Das System hat den Auto-Discovery-Modus, der Spieler automatisch erkennt. Die Aufstellung ist optional und verbessert nur die Zuordnung (Name statt "Spieler 3"). Die TransparencySection auf der Landing Page suggeriert aber noch, dass die Aufstellung Pflicht ist — das muss korrigiert werden.

Der aktuelle `NewMatch.tsx` Flow ist bereits schlank (Gegner + Datum + Platz → Upload/Aufnahme), fragt keine Aufstellung ab. Aber die Landing Page und der "Coach Guide" kommunizieren das nicht klar genug.

---

## Plan

### 1. TransparencySection aktualisieren

Die "Vor dem Spiel"-Phase korrigieren:
- "Aufstellung aus Kader wählen" → als **optional** markieren statt **manuell**
- Neuen Step ergänzen: "Oder: KI-Automatik — erkennt Spieler automatisch" (type: `auto`)
- Kamera-Setup klarer: "1–3 Smartphones aufstellen (je nach Feldgröße)"

Die "Während des Spiels"-Phase ergänzen:
- "Kamera-Code eingeben & Aufnahme starten" als manuellen Schritt hinzufügen (das fehlt komplett)

### 2. HowItWorks aktualisieren

Schritt 1 erweitern um Kamera-Code-Konzept:
- "Smartphone aufstellen, 6-stelligen Code eingeben, Aufnahme starten. 1–3 Kameras für beste Abdeckung."

### 3. WhyFieldIQ ergänzen

Einen 5. Vergleich hinzufügen, der den Prozess-Vorteil zeigt:
- **Klassisch**: "2 Stunden manuelle Aufstellung + Statistik-Eingabe"
- **FieldIQ**: "30 Sekunden Setup — die KI erkennt alles automatisch"

### 4. NewMatch.tsx — Kamera-Anzahl explizit machen

Im Upload-Schritt (Step 2) einen Hinweis ergänzen:
- Info-Card: "Mehrere Kameras? Starte weitere Aufnahmen über den Kamera-Code im Spiel-Detail."
- Visuelles Element: 1/2/3 Kamera-Icons mit kurzer Erklärung wann welche Anzahl sinnvoll ist

### 5. Design & Layout Optimierung

- **TransparencySection**: Visuellen Fortschrittsbalken zwischen den 3 Phasen ergänzen (verbindende Linie/Pfeil)
- **WhyFieldIQ**: Farblichen Kontrast zwischen "Klassisch" (grau/durchgestrichen) und "FieldIQ" (grün/primary) verstärken
- **HowItWorks**: Nummern-Badges prominenter gestalten, Step-Connector zwischen Karten auf Desktop

---

## Betroffene Dateien

| Datei | Aktion |
|---|---|
| `src/components/landing/TransparencySection.tsx` | Aufstellung → optional, KI-Auto ergänzen, Kamera-Code-Step |
| `src/components/landing/WhyFieldIQ.tsx` | 5. Vergleichskarte (Prozess-Vorteil) |
| `src/components/landing/HowItWorks.tsx` | Kamera-Code + Multi-Kamera erwähnen |
| `src/pages/NewMatch.tsx` | Kamera-Anzahl-Hinweis im Upload-Step |
| `src/lib/i18n.tsx` | Aktualisierte Keys für HowItWorks |

Keine DB-Änderungen nötig.




# Dashboard & Menu bereinigen

## Probleme (Screenshot)

1. **Doppelte Checkliste**: "Coach Guide" (MatchFlowGuide) und "Einrichtung" (SetupChecklist) zeigen beide den gleichen Fortschritt — redundant.
2. **"Feld kalibrieren"** steht als manueller Schritt im Coach Guide, obwohl die Kalibrierung automatisch laeuft.
3. **Spielvorbereitung** fehlt im Navigations-Menu (AppLayout).

## Aenderungen

### 1. SetupChecklist entfernen
- `Dashboard.tsx`: `<SetupChecklist>` Import und Verwendung (Zeile 12, 109) entfernen. Der Coach Guide deckt alles ab.

### 2. MatchFlowGuide: "Feld kalibrieren" Schritt entfernen
- `MatchFlowGuide.tsx`: Den `calibrate`-Step aus dem `steps`-Array entfernen (Zeile ~42). Bleiben 5 Schritte: Kader → Spielfeld → Spiel anlegen → Tracking → Report. Counter auf "X/5" anpassen (passiert automatisch).

### 3. Navigation: Spielvorbereitung aufnehmen
- `AppLayout.tsx`: "Spielvorbereitung" (Brain-Icon) in `mainItems` nach "Trends" einfuegen, Link zu `/match-prep`.

## Dateien

| Datei | Aenderung |
|---|---|
| `src/pages/Dashboard.tsx` | SetupChecklist entfernen |
| `src/components/MatchFlowGuide.tsx` | "Feld kalibrieren"-Schritt entfernen |
| `src/components/AppLayout.tsx` | Spielvorbereitung in Navigation |


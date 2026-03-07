

# Onboarding & Mobile-Einrichtung

## Analyse

Aktuell gibt es **keinen geführten Einrichtungsassistenten**. Nach der Registrierung landet der User direkt auf dem Dashboard und muss selbst herausfinden, dass er:
1. Spieler anlegen muss
2. Ein Spielfeld erstellen und kalibrieren muss
3. Ein Spiel anlegen muss

Auf dem Smartphone fehlt zudem ein Hinweis, die App zum Homescreen hinzuzufügen (PWA-Install).

## Plan

### 1. Onboarding-Wizard (neue Seite `/onboarding`)
Ein Schritt-für-Schritt-Assistent, der nach der ersten Registrierung automatisch angezeigt wird (wenn Verein noch keine Spieler/Felder hat):

- **Schritt 1 – Vereinsdaten prüfen**: Name, Stadt, Liga bestätigen (bereits bei Registrierung angelegt)
- **Schritt 2 – Kader anlegen**: Schnelleingabe für Spieler (Name, Nummer, Position) mit "Weiteren hinzufügen"-Button
- **Schritt 3 – Spielfeld erstellen**: Feldname eingeben, Standard-Maße vorausgefüllt
- **Schritt 4 – App installieren (PWA)**: Anleitung mit Screenshots/Icons für "Zum Homescreen hinzufügen" + PWA-Install-Prompt triggern
- **Schritt 5 – Fertig**: Zusammenfassung + Button zum Dashboard

Design: Fortschrittsbalken oben, große Touch-Targets, vollständig mobiloptimiert.

### 2. PWA-Install-Banner
- Kleiner Banner auf dem Dashboard (nur Mobile, nur wenn noch nicht installiert), der den `beforeinstallprompt`-Event nutzt
- Erklärt in einem Satz: "Installiere FieldIQ auf deinem Homescreen für den besten Zugang"

### 3. Dashboard-Checkliste
- Wenn der Verein noch Setup-Schritte offen hat (keine Spieler, kein Feld), zeigt das Dashboard eine visuelle Checkliste:
  - ✅ Verein erstellt
  - ⬜ Spieler hinzufügen
  - ⬜ Spielfeld anlegen
  - ⬜ App installieren

### 4. Routing-Logik
- Nach Registrierung → Redirect zu `/onboarding` statt `/dashboard`
- `AuthProvider` bekommt ein Flag `isNewClub` (keine Spieler + keine Felder = neu)
- `/onboarding` ist eine geschützte Route
- Wizard kann jederzeit übersprungen werden

### Dateien die erstellt/geändert werden

| Datei | Änderung |
|---|---|
| `src/pages/Onboarding.tsx` | **Neu** – Mehrstufiger Setup-Wizard |
| `src/components/PwaInstallPrompt.tsx` | **Neu** – PWA-Install-Banner-Komponente |
| `src/components/SetupChecklist.tsx` | **Neu** – Dashboard-Checkliste |
| `src/pages/Dashboard.tsx` | Checkliste einbinden |
| `src/pages/Login.tsx` | Redirect nach Registrierung zu `/onboarding` |
| `src/App.tsx` | Route `/onboarding` hinzufügen |

Keine Datenbank-Änderungen nötig – die Logik basiert auf vorhandenen Tabellen (players, fields).


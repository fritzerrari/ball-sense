

# Landing Page Erweiterungen: Wertversprechen, Transparenz & Berichte

## Was wird gemacht

### 1. Neue Sektion: "Warum FieldIQ?" (Value Proposition)
Neue Komponente `src/components/landing/WhyFieldIQ.tsx` — wird zwischen KeyNumbers und DemoSection eingefügt.

Kernbotschaft: **"Es geht nicht um 9 oder 10 Kilometer Laufdistanz. Es geht darum, WARUM dein Team in der 70. Minute die Kontrolle verliert."**

Aufbau:
- Linke Spalte: Überschrift + Einleitung ("Klassische Statistiken wie Laufdistanz oder Topspeed sagen dir, WAS passiert ist. FieldIQ sagt dir, WARUM — und was du ändern kannst.")
- Rechte Spalte: 3-4 Vergleichskarten im "Vorher/Nachher"-Stil:
  - **Klassisch**: "9.2 km Laufleistung" → **FieldIQ**: "Sprint-Intensität sinkt ab Min. 60 um 40% — Ermüdung links"
  - **Klassisch**: "23 km/h Topspeed" → **FieldIQ**: "Konter-Geschwindigkeit: 3 Spieler in 5s in Position"
  - **Klassisch**: "58% Ballbesitz" → **FieldIQ**: "Dominanz nur in HZ 1 — ab Min. 40 Kontrollverlust über links"
  - **Klassisch**: "12 Torschüsse" → **FieldIQ**: "62% Angriffe über rechts — Gegner liest euch"

### 2. Neue Sektion: "Was musst du tun?" (Transparenz)
Neue Komponente `src/components/landing/TransparencySection.tsx` — wird nach WhyFieldIQ eingefügt.

Klare Auflistung in 3 Phasen:
- **Vor dem Spiel** (2 Min): Smartphone aufstellen, Feldkalibrierung (4 Ecken antippen), Aufstellung eingeben oder aus Kader wählen
- **Während des Spiels** (optional): Events antippen (Tor, Karte, Ecke, Chance) — das löst Highlight-Clips aus. Ansonsten: nichts tun, die KI analysiert automatisch
- **Nach dem Spiel**: Aufnahme stoppen → KI analysiert in ~2 Min → Report öffnen

Visueller Stil: Step-Cards mit Icons, klare "manuell" vs. "automatisch" Labels, minimaler Text.

### 3. Gegner-Scouting in FeatureCards hervorheben
Die FeatureCard "Gegner-Scouting" existiert bereits. Erweitern um:
- Prominentere Platzierung (nach oben verschieben, `sm:col-span-2`)
- Ergänzter Text: "Analysiere den Gegner aus früheren Spielen: Bevorzugte Angriffsseite, Pressing-Verhalten, Schwachstellen — automatischer Scouting-Report mit Taktik-Empfehlung"

### 4. Berichte-Feature bestätigen & hervorheben
Die Berichte (Vor/Halbzeit/Nach, 3 Stile) sind bereits voll implementiert und in der Demo interaktiv erlebbar. Auf der Landing Page:
- In FeatureCards die "KI-Berichte in 3 Stilen"-Card updaten mit Zusatz: "Content-Generierung für Social Media, Vereinswebsite und Presse — exportierbar als PDF, teilbar per WhatsApp, E-Mail und X"
- Neuer FAQ-Eintrag: "Kann ich FieldIQ für Pressearbeit nutzen?" → "Ja, generiere Vor-, Halbzeit- und Nachberichte in 3 Stilen..."

### 5. LandingPage.tsx Seitenstruktur anpassen
Neue Reihenfolge:
```
KeyNumbers → WhyFieldIQ (NEU) → TransparencySection (NEU) → DemoSection → HowItWorks → ...
```

## Betroffene Dateien

| Datei | Aktion |
|---|---|
| `src/components/landing/WhyFieldIQ.tsx` | NEU — Value-Proposition-Sektion |
| `src/components/landing/TransparencySection.tsx` | NEU — "Was musst du tun?"-Sektion |
| `src/pages/LandingPage.tsx` | Neue Sektionen einbinden |
| `src/components/landing/FeatureCards.tsx` | Scouting + Berichte-Cards anpassen |
| `src/lib/i18n.tsx` | Neue Übersetzungs-Keys für beide Sprachen |
| `src/components/landing/FAQSection.tsx` | Neuen FAQ-Eintrag für Berichte/Presse |

## Zu den Berichten

Ja, Vor-, Halbzeit- und Nachberichte sind vollständig implementiert und funktionieren weiterhin. Die Demo zeigt sie interaktiv mit 3 Stilen (Analytisch, Social Media, Zeitung). Das Content-System (Report-Generator mit PDF-Export, Social Sharing) ist intakt. Die Landing Page wird diese Funktionalität nun prominenter kommunizieren.


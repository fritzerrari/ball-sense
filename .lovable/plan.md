

# Fehleranalyse, Optimierung & Mitbewerber-Vergleichsseite

## 1. Gefundener Fehler: `useTranslation must be used within I18nProvider`

**Ursache**: Der Fehler tritt als HMR-Artefakt (Hot Module Replacement) auf. Die `I18nProvider` umschließt die gesamte App korrekt in `main.tsx`. Der Fehler ist kein strukturelles Problem, sondern entsteht bei Hot-Reloads wenn die i18n-Modul-Referenz kurzzeitig ungültig wird. Ein harter Reload (F5) löst das Problem.

**Fix empfohlen**: Trotzdem eine defensive Absicherung einbauen — in `useTranslation()` statt `throw Error` einen Fallback-Kontext zurückgeben, der die deutschen Keys direkt liest. Das verhindert Crashes bei HMR und Edge-Cases.

## 2. Code-Review Ergebnisse

**Keine kritischen Fehler gefunden in:**
- `WhyFieldIQ.tsx` — sauber, zweisprachig, Vergleichskarten korrekt
- `TransparencySection.tsx` — 3-Phasen-Layout korrekt, Labels stimmen
- `FeatureCards.tsx` — 17 Cards, alle Icons importiert, Pressing/Scouting/Fatigue korrekt
- `FAQSection.tsx` — 8 FAQ-Einträge inkl. Presse + manueller Aufwand
- `PressingChart.tsx`, `FormationTimeline.tsx`, `FatigueIndicator.tsx` — Props-Interfaces korrekt, Recharts-Imports vorhanden
- `MatchReport.tsx` — Lazy-Imports aller 6 neuen Analyse-Komponenten korrekt

**Performance-Optimierung:**
- Alle neuen Analyse-Komponenten sind bereits lazy-loaded (gut)
- `FeatureCards.tsx` hat 17 Cards mit individuellen `motion`-Animationen + `whileHover` — bei 17 Karten auf Mobile ist das 17x IntersectionObserver. Optimierung: `viewport={{ once: true, margin: "-50px" }}` ist gesetzt (gut), aber die `whileHover`-Animation auf Touch-Geräten ist unnötig → entfernen für Mobile

## 3. Bilder/Screenshots

Die HeroSlider-Slides (TrackingSlide, CalibrationSlide, DataTransferSlide) sind **reine SVG/CSS-Mockups**, keine externen Bilder. Sie bleiben konsistent unabhängig vom Umbau. Gleiches gilt für die DemoSection — alles programmatisch generiert, keine Screenshots die veralten könnten.

## 4. Mitbewerber-Vergleichsseite — Rechtliche Einschätzung

**Grundsätzlich erlaubt** in Deutschland und der EU:
- Vergleichende Werbung ist nach § 6 UWG (Gesetz gegen unlauteren Wettbewerb) und EU-Richtlinie 2006/114/EG **zulässig**, wenn sie:
  - Objektiv und nachprüfbar ist (Fakten, keine subjektiven Behauptungen)
  - Waren/Dienstleistungen für denselben Bedarf vergleicht
  - Keine Verwechslungsgefahr erzeugt
  - Den Ruf des Mitbewerbers nicht herabsetzt oder verunglimpft
  - Keine geschützten Markenzeichen missbräuchlich verwendet

**Empfehlung für die Umsetzung:**
- Kategorien statt Markennamen verwenden: "GPS-Westen-Systeme", "Kamera-Tracking-Lösungen", "Manuelle Statistik-Apps" (es gibt bereits `landing.gpsVests` als i18n-Key)
- Objektive Kriterien: Kosten, Hardware-Bedarf, Installationsaufwand, Datenschutz, Liga-Eignung
- **Keine** Logos oder geschützten Markennamen wie "Veo", "Catapult" etc.
- Hinweis-Fußnote: "Stand: März 2026. Angaben basieren auf öffentlich verfügbaren Informationen."

**Implementierung:** Eigene Seite `/compare` (nicht Landing Page, da sie schon lang genug ist) mit sachlicher Vergleichstabelle nach Kategorien. Navigation über Footer + optional als Link in der Pricing-Section.

## Plan

### Dateien ändern

| Datei | Änderung |
|---|---|
| `src/lib/i18n.tsx` | `useTranslation` defensiv absichern — Fallback statt throw |
| `src/components/landing/FeatureCards.tsx` | `whileHover` nur auf Desktop (Responsive-Check) |
| `src/pages/ComparePage.tsx` | NEU — Sachliche Vergleichsseite nach Kategorien |
| `src/App.tsx` | Neue Route `/compare` |
| `src/components/landing/Footer.tsx` | Link zu `/compare` einfügen |
| `src/components/landing/PricingSection.tsx` | Optional: Link "Wie unterscheiden wir uns?" → `/compare` |
| `src/lib/i18n.tsx` | Neue Keys für Vergleichsseite (de + en) |

### Vergleichsseite Inhalt

Tabelle mit Spalten:
- **FieldIQ** (hervorgehoben)
- **GPS-Westen-Systeme** (z.B. Catapult-Typ)
- **Kamera-Tracking** (z.B. Veo-Typ)
- **Manuelle Statistik-Apps**

Zeilen:
- Monatliche Kosten
- Hardware-Investition
- Einrichtungsaufwand
- Taktische Analyse
- KI-Berichte
- Pressing-Analyse
- Gegner-Scouting
- DSGVO-Konformität
- Liga-Eignung

Plus: "Warum wir anders sind"-Abschnitt mit den Kern-Differenzierern aus WhyFieldIQ.


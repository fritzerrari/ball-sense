

# Komplett-Überarbeitung: Features, Demo, Anleitung + Gamechanger

## Kontext & Probleme

Die Landing Page (Features, Demo, HowItWorks, FullGuide) beschreibt ein **Multi-Kamera-Tracking-System mit On-Device YOLO/DeepSORT**, das in der Realität nicht existiert. Der aktuelle Produktkern ist: **Smartphone-Kamera filmt → Frames werden extrahiert (1 JPEG/30s) → Gemini Vision analysiert → KI-Insights + Spielzug-Replay**. 

### Hauptdiskrepanzen

| Landing Page behauptet | Realität |
|---|---|
| Multi-Kamera-Fusion, 2-3 Kameras, QR-Codes | Nicht implementiert (Edge Functions gelöscht) |
| On-Device KI-Modell (~20MB ONNX), Spieler-Tracking in Echtzeit | Frame-Capture alle 30s, Gemini Vision cloud-seitig |
| Player-Detections mit Confidence, Zuordnung, 95% Accuracy | KI schätzt ~70-80% Positionen aus Standbildern |
| Laufdistanz, Topspeed, Sprint-Tracking pro Spieler | Nicht vorhanden — nur aggregierte taktische Insights |
| Kalibrierung mit 4-Punkt-System | `FieldCalibration`-Route wurde gelöscht |
| Heatmaps pro Spieler basierend auf Tracking | Nur Demo-Daten, keine echten Heatmaps |
| 20 Abschnitte in FullGuide beschreiben Tracking-Features | ~60% der beschriebenen Features existieren nicht |

**Risiko**: Nutzer registrieren sich, erwarten Tracking-Daten, finden stattdessen KI-Bildanalyse. Das ist ein Vertrauensproblem.

## Gamechanger-Idee: Match-Trend-Dashboard

Ein **Trend-Dashboard über mehrere Spiele** — der Trainer sieht auf einen Blick, wie sich sein Team entwickelt. Kein anderes Amateurprodukt bietet das.

- Vergleich der letzten 5-10 Spiele: Dominanz, Chancen, Ballverlust-Muster
- Trend-Linien für KI-Confidence, Spielkontrolle, Angriffsrichtungen
- "Formkurve" basierend auf den tatsächlich vorhandenen Analyse-Daten
- Automatische Erkennung von Mustern ("Ihr werdet in der 2. Halbzeit regelmäßig über links verwundbar")

## Umsetzungsplan

### Schritt 1: Landing Page — Features komplett umschreiben

**FeatureCards.tsx** — Die 12 Feature-Karten ersetzen durch das, was wirklich existiert:
1. Smartphone-Kamera genügt (1 Handy filmt, KI analysiert)
2. KI-Halbzeitanalyse (Analyse schon in der Pause)
3. Spielzug-Replay (animierte Taktik-Grafik aus KI-Schätzungen)
4. Coaching-Insights (KI-generierte taktische Empfehlungen)
5. Trainingsplan-Generator (automatische Übungsvorschläge)
6. Gefährdungszonen & Ballverlust-Muster
7. KI-Berichte (Vor-, Halbzeit-, Nachbericht in 3 Stilen)
8. DSGVO-konform (Einwilligung pro Spieler)
9. KI-Assistent (Chat-basiert)
10. Match-Trend-Dashboard (NEU — Gamechanger)

**Entfernen**: Multi-Kamera, On-Device-Tracking, Echtzeit-Erkennung, Leaderboards mit exakten Messwerten, Player-Level-Tracking-Stats

### Schritt 2: HowItWorks — 3 Schritte anpassen

Aktuell nutzt HowItWorks i18n-Keys, die auf das alte Tracking-Modell verweisen. Neue 3 Schritte:
1. **Aufnehmen** — Smartphone aufstellen, Spiel filmen (kein spezielles Equipment)
2. **KI analysiert** — Gemini Vision erkennt Formationen, Spielzüge, Gefahrenzonen
3. **Coaching-Report** — Fertige Insights, Trainingsplan und Spielzug-Replay im Browser

### Schritt 3: DemoSection — auf echte Features reduzieren

Die DemoSection ist 1546 Zeilen und zeigt Features, die nicht existieren (Player-Tracking-Stats, Radar-Charts mit echten Werten, Heatmaps pro Spieler). Überarbeitung:
- **Behalten**: Coach Summary, KI-Insights, Report-Workflow (Pre/Half/Post), Trainingsplan
- **Ersetzen**: Tracking-Statistiken → KI-Analyse-Ergebnisse (Dominanz, Tempo, Phasen, Gefahrenzonen)
- **Neu hinzufügen**: Spielzug-Replay Demo (Mini-TacticalReplay mit Mock-Frames)
- **Entfernen**: Spieler-Distanz-Balken, Radar-Charts, PlayerDetailModal mit Tracking-Daten, Speed/Pass-Leaderboards mit km/h-Werten
- Ziel: ~800 Zeilen statt 1546

### Schritt 4: AnalyticsShowcase — umbauen

Aktuell zeigt es Heatmap + Tracking-Stats (11.2 km, 32.1 km/h, 47 Sprints). Ersetzen durch:
- Spielstruktur-Visualisierung (Phasen-Timeline)
- Gefahrenzonen-Grafik (links/mitte/rechts)
- Spielzug-Replay-Preview
- "Confidence"-Anzeige statt exakter Messwerte

### Schritt 5: FullGuide — komplett überarbeiten

Die 20 Abschnitte des FullGuide beschreiben ein anderes Produkt. Neuer Guide (~12 Abschnitte):
1. App installieren (Android/iOS) — bleibt
2. Account & Verein einrichten — bleibt
3. Kader anlegen — vereinfachen (keine Tracking-Consent-Details)
4. Spielfeld anlegen — bleibt (ohne Kalibrierung)
5. Spiel anlegen — vereinfachen
6. Aufnehmen starten — NEU (Smartphone filmen, nicht "Tracking starten")
7. Während des Spiels — vereinfachen (Events eintragen, Halbzeit-Analyse)
8. Spiel beenden & Analyse starten — NEU
9. Report verstehen — NEU (KI-Insights statt Tracking-Stats)
10. Spielzug-Replay nutzen — NEU
11. KI-Assistent — bleibt
12. Tipps & Troubleshooting — bleibt

**Entfernen**: Kalibrierung (4-Punkt), Multi-Kamera-Setup (1/2/3 Kameras), Kamera-Codes, On-Device-KI, Spielererkennung ohne Trikotnummern (irrelevant ohne Tracking)

### Schritt 6: Match-Trend-Dashboard bauen (Gamechanger)

**Neue Seite**: `/trends` (oder als Tab im Dashboard)
- Query: alle `analysis_results` + `report_sections` der letzten N Spiele des Clubs
- Visualisierungen:
  - **Formkurve**: Dominanz + Tempo pro Spiel als Linie
  - **Gefahrenzonen-Trend**: Angriffsseiten über mehrere Spiele
  - **Ballverlust-Hotspots**: Wiederkehrende Muster
  - **KI-Confidence-Trend**: Wird die Analyse besser?
  - **Coaching-Insights-Zusammenfassung**: Top-3 wiederkehrende Themen
- Einfache Recharts-Charts (bereits als Dependency vorhanden)
- NavLink in AppLayout hinzufügen

### Schritt 7: i18n-Keys aktualisieren

Die betroffenen Keys in `src/lib/i18n.tsx` (DE + EN) für Features, HowItWorks, Landing-Texte anpassen.

## Betroffene Dateien

| Datei | Änderung |
|---|---|
| `src/components/landing/FeatureCards.tsx` | Features komplett umschreiben |
| `src/components/landing/HowItWorks.tsx` | 3 Schritte anpassen |
| `src/components/landing/DemoSection.tsx` | Auf ~800 Zeilen reduzieren, echte Features |
| `src/components/landing/AnalyticsShowcase.tsx` | Tracking-Stats → KI-Analyse |
| `src/pages/FullGuide.tsx` | Von 20 auf ~12 Abschnitte, echtes Produkt |
| `src/lib/i18n.tsx` | Keys für Landing/Features/Steps aktualisieren |
| `src/pages/Dashboard.tsx` | Trend-Link hinzufügen |
| `src/pages/TrendDashboard.tsx` | NEU — Match-Trend-Dashboard |
| `src/components/AppLayout.tsx` | NavLink für Trends |
| `src/App.tsx` | Route `/trends` hinzufügen |

## Einschränkungen
- Die Demo bleibt mit generierten Testdaten — aber zeigt nur Features, die wirklich existieren
- Der Trend-Dashboard braucht mindestens 2 analysierte Spiele, um sinnvoll zu sein (Empty State für weniger)
- Alle Tracking-bezogenen i18n-Keys bleiben im Code (werden von CameraTrackingPage genutzt), aber Landing-Keys werden aktualisiert


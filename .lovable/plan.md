

## Plan: Heatmap-Verbesserung, mehr Gegner-Spieler & API-Datenabgleich

### Screenshot 1: AnalyticsShowcase Heatmap verbessern

**Problem:** Die Heatmap in `AnalyticsShowcase.tsx` verwendet eine veraltete, pixelige Zellen-basierte Darstellung (`<rect>` pro Zelle mit minimalem Blur von 0.25). Alle anderen Heatmaps im Projekt nutzen bereits die smooth-gradient-Technik mit radialen Verläufen und dualem Gaußschen Weichzeichner.

**Fix in `src/components/landing/AnalyticsShowcase.tsx`:**
- Die `HeatmapPreview` Komponente komplett auf die bewährte smooth-gradient-Technik umstellen (radiale Gradienten + duale Blur-Layer wie in `HeatmapField.tsx` und `DemoSection.tsx`)
- Zellen-basierte `<rect>` Elemente durch `<ellipse>` mit Ambient- und Detail-Layer ersetzen
- Farbskala: Teal → Grün → Gelb → Orange → Rot (wie überall sonst im Projekt)

### Screenshot 2: Mehr Gegner-Spieler im HeroSlider

**Problem:** `HeroSlider.tsx` hat nur 7 Away-Spieler im `mockPlayers` Array statt 11.

**Fix in `src/components/landing/HeroSlider.tsx`:**
- `mockPlayers` Array um 4 weitere Away-Spieler erweitern auf volle 11 (fehlende Positionen: LV, RV, ZM, LA/RA in einer realistischen 4-3-3/4-4-2 Formation)

### Betroffene Dateien

| Datei | Änderung |
|---|---|
| `src/components/landing/AnalyticsShowcase.tsx` | Heatmap auf smooth-gradient-Technik umstellen |
| `src/components/landing/HeroSlider.tsx` | Away-Team auf 11 Spieler erweitern |


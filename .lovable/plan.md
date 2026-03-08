

## Analyse: Dark/Light Toggle auf der Landing Page

### Aktueller Stand

Der `ThemeToggle` ist **bereits in der Nav-Leiste** der Landing Page eingebaut (Zeile 39 in `LandingPage.tsx`). Das Theme-System mit CSS-Variablen funktioniert grundsätzlich für beide Modi.

### Problem: AnalyticsShowcase

Die **einzige problematische Sektion** ist `AnalyticsShowcase.tsx` — sie hat **hardcodierte dunkle Farben**:
- Zeile 84: `style={{ background: "linear-gradient(180deg, hsl(160 20% 5%) ...)" }}` — erzwingt dunklen Hintergrund
- Zeile 18: Canvas-Hintergrund `rgba(16, 30, 22, 1)` — immer dunkelgrün
- Zeilen 95, 98, 113, 117, 138, 141, 145, 149, 162, 163, 169: Alle Text-Farben sind `text-white` oder `text-white/xx` statt Tailwind-Variablen
- Zeilen 106, 137, 161: Borders/Backgrounds als `border-white/10 bg-white/5` hardcodiert

Alle anderen Sektionen (KeyNumbers, HowItWorks, FeatureCards, TrustSection, PricingSection, FAQSection, Footer) verwenden **korrekt die CSS-Variablen** (`text-foreground`, `text-muted-foreground`, `bg-card`, `border-border` etc.) und funktionieren in beiden Modi.

### Plan

**Nur `AnalyticsShowcase.tsx` anpassen** — hardcodierte Farben durch CSS-Variablen-basierte Klassen ersetzen:

1. **Section-Background**: `hsl(160 20% 5%)` → CSS-Klassen mit `bg-muted/50` für Light, dunkler Verlauf nur in `.dark`
2. **Canvas-Heatmap**: Pitch-Hintergrund und Linienfarben dynamisch anhand des aktuellen Themes setzen (Theme aus Context lesen, Farben anpassen)
3. **Text-Farben**: Alle `text-white`, `text-white/xx` → `text-foreground`, `text-muted-foreground`, `text-foreground/80` etc.
4. **Card-Borders**: `border-white/10 bg-white/5` → `border-border/50 bg-card/50 backdrop-blur-sm`

### Dateien

- `src/components/landing/AnalyticsShowcase.tsx` — Hardcodierte Farben durch Theme-aware Variablen ersetzen

Keine weiteren Dateien nötig — der Toggle existiert bereits und alle anderen Sektionen sind bereits kompatibel.


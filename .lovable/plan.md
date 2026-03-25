

# Hyper-Professional Coaching Cockpit -- Complete Upgrade

## What I Found

The analysis pipeline WORKS (4 frames analyzed, insights generated, report sections stored). But the output is mediocre:
- Generic insights like "Zentrum als Kampfzone" without actionable depth
- Flat card-list layout -- no visual hierarchy, no drama, no cockpit feel
- No match rating, no tactical grades, no momentum visualization
- Coaching conclusions are text-only paragraphs
- Missing: comparative gauges, risk scores, drill-down interactions, executive scorecards

## The Upgrade Plan

### 1. Massively Improved AI Prompt (generate-insights)

The current prompt is too generic. New prompt will demand:

- **Match Rating** (1-10 scale with sub-scores for offense, defense, transitions, discipline)
- **Tactical Grade Card** (A-F grades for 6 dimensions: pressing, build-up, final third, defensive shape, transitions, set pieces)
- **Momentum Phases** with minute-by-minute momentum scores (-100 to +100) for visualization
- **Risk Matrix** identifying specific vulnerabilities with severity + urgency scores
- **Player Spotlight** (MVP + concern player with reasoning)
- **Opponent DNA Profile** (play style fingerprint: possession-based? counter? press-heavy?)
- **Concrete Next-Match Actions** (3 "do" + 3 "don't" for the next match)
- **Training Week Plan** (not just exercises, but a 3-session micro-cycle with session goals)

Updated tool schema will capture all these structured fields.

### 2. Cockpit-Grade Match Report UI (MatchReport.tsx)

Complete visual overhaul:

**A. Hero Scorecard Header**
- Full-width gradient header with match rating (large animated number), team logos, date
- Sub-score gauges (offense/defense/transition) as radial progress rings
- Tactical grade badges (A-F) in a horizontal strip

**B. Momentum Timeline**
- Full-width area chart showing momentum flow across the match
- Color-coded: green (home dominance) to red (away pressure)
- Key events overlaid as markers (goals, substitutions, tactical shifts)

**C. Tactical Grade Matrix**
- 6-cell grid with A-F grades, each with color coding (A=emerald, F=red)
- Click to expand with detailed explanation
- Animated entrance with staggered delays

**D. Risk Radar**
- Visual risk indicators with severity bars
- Each risk links to relevant training recommendation
- Urgency badges (immediate / next week / monitor)

**E. Player Spotlight Cards**
- MVP card with glow effect and key stats
- Concern player card with warning styling
- Direct link to player profile

**F. Opponent DNA Fingerprint**
- Radar/spider chart showing opponent play style dimensions
- Next-match "Do / Don't" list with checkmark/x icons

**G. Training Micro-Cycle**
- 3-session timeline with session goals, drills, and linked patterns
- Visual progression (recovery -> intensity -> tactical)

**H. Enhanced Existing Components**
- Pressing chart, transitions, pass map stay but get glass-card styling
- Section transitions with subtle animations
- Collapsible sections for information density control

### 3. New Components to Create

| Component | Purpose |
|---|---|
| `MatchScorecard.tsx` | Hero header with rating, grades, sub-scores |
| `MomentumTimeline.tsx` | Full-width momentum area chart |
| `TacticalGradeMatrix.tsx` | 6-cell A-F grade grid |
| `RiskRadar.tsx` | Vulnerability matrix with severity |
| `PlayerSpotlight.tsx` | MVP + concern player cards |
| `OpponentDNA.tsx` | Spider chart + do/don't list |
| `TrainingMicroCycle.tsx` | 3-session training week plan |

### 4. Files Modified

| File | Change |
|---|---|
| `supabase/functions/generate-insights/index.ts` | Completely rewritten prompt + expanded tool schema for richer output |
| `src/pages/MatchReport.tsx` | Complete layout overhaul with new component composition |
| 7 new components above | New files |
| `src/components/PressingChart.tsx` | Glass-card styling upgrade |
| `src/components/TransitionAnalysis.tsx` | Glass-card styling upgrade |
| `src/components/PassDirectionMap.tsx` | Glass-card styling upgrade |

### 5. No Database Migration Needed

All new data fits into existing `report_sections.content` (JSON strings) and `analysis_results.data` (jsonb). The AI output gets richer but storage stays the same.

### 6. Implementation Order

1. Upgrade `generate-insights` prompt + schema (the brain)
2. Create 7 new cockpit components (the visuals)
3. Rewrite `MatchReport.tsx` layout (the composition)
4. Style upgrades for existing components


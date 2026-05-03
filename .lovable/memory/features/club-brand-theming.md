---
name: Club Brand Theming
description: Logo-derived primary/secondary colors are stored on clubs and applied at runtime as CSS HSL custom properties (--primary, --accent, --ring) via AuthProvider → applyClubTheme. Hex is converted to "H S% L%" to match the design-token format.
type: feature
---

- DB: `clubs.primary_color` and `clubs.secondary_color` (text, hex).
- Onboarding extracts dominant logo colors client-side (`src/lib/extract-logo-colors.ts`, no library) and lets the user assign Primary/Secondary.
- `src/lib/club-theme.ts` exposes `applyClubTheme(primary, secondary)`; converts hex → HSL triplet and overrides `--primary`, `--accent`, `--ring`, `--sidebar-primary`, `--sidebar-ring`.
- `AuthProvider` calls `applyClubTheme` whenever club colors change (load + sign-out resets to defaults).
- All Tailwind tokens that reference `hsl(var(--primary))` / `hsl(var(--accent))` automatically reskin without component changes.

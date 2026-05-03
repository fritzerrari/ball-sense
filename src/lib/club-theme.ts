/**
 * Club brand theming helpers.
 *
 * Converts a hex color to "H S% L%" string (the format used by our
 * Tailwind/HSL design tokens) and applies it as CSS custom properties
 * on <html> so the design system reacts to the club's colors.
 */

function hexToHslTriplet(hex: string): string | null {
  const m = hex.replace("#", "").match(/^([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!m) return null;
  let raw = m[1];
  if (raw.length === 3) raw = raw.split("").map((c) => c + c).join("");
  const r = parseInt(raw.slice(0, 2), 16) / 255;
  const g = parseInt(raw.slice(2, 4), 16) / 255;
  const b = parseInt(raw.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function applyClubTheme(primary: string | null, secondary: string | null) {
  const root = document.documentElement;
  const p = primary ? hexToHslTriplet(primary) : null;
  const a = secondary ? hexToHslTriplet(secondary) : null;

  // Always expose brand vars (or clear them when null)
  if (p) {
    root.style.setProperty("--brand-primary", p);
    // Override the design-system primary for a holistic reskin
    root.style.setProperty("--primary", p);
    root.style.setProperty("--ring", p);
    root.style.setProperty("--sidebar-primary", p);
    root.style.setProperty("--sidebar-ring", p);
  } else {
    root.style.removeProperty("--brand-primary");
    root.style.removeProperty("--primary");
    root.style.removeProperty("--ring");
    root.style.removeProperty("--sidebar-primary");
    root.style.removeProperty("--sidebar-ring");
  }

  if (a) {
    root.style.setProperty("--brand-accent", a);
    root.style.setProperty("--accent", a);
  } else {
    root.style.removeProperty("--brand-accent");
    root.style.removeProperty("--accent");
  }
}

export type ThemeId = "mint" | "classic" | "gold" | "midnight" | "cream";

export type Theme = {
  id: ThemeId;
  name: string;
  dark: boolean;
  bg: string;
  surface: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accentGlow: string;
  ctaBg: string;
  ctaText: string;
  tile: string;
  tileIcon: string;
};

// "gold" (champagne on warm black) is the LineCatch brand look and the default for every barber.
export const DEFAULT_THEME: ThemeId = "gold";

export const THEMES: Record<ThemeId, Theme> = {
  mint: {
    id: "mint", name: "Mint", dark: true,
    bg: "#070908", surface: "rgba(255,255,255,0.045)", border: "rgba(255,255,255,0.09)", text: "#F2F5F3", muted: "#9BA8A2",
    accent: "#00F5A0", accentGlow: "rgba(0,245,160,0.35)", ctaBg: "#00F5A0", ctaText: "#04130D", tile: "#141A17", tileIcon: "#4E5B55",
  },
  classic: {
    id: "classic", name: "Black & White", dark: true,
    bg: "#0B0B0B", surface: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.1)", text: "#FFFFFF", muted: "#A3A3A3",
    accent: "#FFFFFF", accentGlow: "rgba(255,255,255,0.18)", ctaBg: "#FFFFFF", ctaText: "#0B0B0B", tile: "#1C1C1C", tileIcon: "#5C5C5C",
  },
  gold: {
    id: "gold", name: "LineCatch Champagne", dark: true,
    bg: "#121110", surface: "rgba(250,247,242,0.045)", border: "rgba(250,247,242,0.09)", text: "#FAF7F2", muted: "#A89F92",
    accent: "#D4AF7A", accentGlow: "rgba(212,175,122,0.3)", ctaBg: "#D4AF7A", ctaText: "#121110", tile: "#1C1A17", tileIcon: "#5E574D",
  },
  midnight: {
    id: "midnight", name: "Midnight", dark: true,
    bg: "#0B1020", surface: "rgba(160,180,255,0.06)", border: "rgba(160,180,255,0.13)", text: "#F2F5FF", muted: "#9AA4BF",
    accent: "#7C9CFF", accentGlow: "rgba(124,156,255,0.35)", ctaBg: "#7C9CFF", ctaText: "#0B1020", tile: "#18213A", tileIcon: "#4E5A7D",
  },
  cream: {
    id: "cream", name: "Cream & Brass", dark: false,
    bg: "#F6F1E7", surface: "#FFFFFF", border: "#E4DDCF", text: "#1B1916", muted: "#6B655C",
    accent: "#A8762A", accentGlow: "rgba(168,118,42,0)", ctaBg: "#1B1916", ctaText: "#F6F1E7", tile: "#E7DFD2", tileIcon: "#8A8174",
  },
};

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];

// Barber accent picks. All light enough for dark (#121110) text on buttons.
export const ACCENT_COLORS = [
  { name: "Champagne", hex: "#D4AF7A" },
  { name: "Copper", hex: "#E0926A" },
  { name: "Rose", hex: "#E3A4A4" },
  { name: "Sage", hex: "#A8C49A" },
  { name: "Sky", hex: "#8FB8DE" },
  { name: "Pearl", hex: "#E0D9CD" },
];
export const isAccent = (hex: unknown) => ACCENT_COLORS.some((c) => c.hex === hex);

export function getTheme(id: unknown): Theme {
  return THEMES[id as ThemeId] ?? THEMES[DEFAULT_THEME];
}

/** CSS custom properties for a themed page root. */
export function themeVars(t: Theme): Record<string, string> {
  return {
    "--t-bg": t.bg,
    "--t-surface": t.surface,
    "--t-border": t.border,
    "--t-text": t.text,
    "--t-muted": t.muted,
    "--t-accent": t.accent,
    "--t-glow": t.accentGlow,
    "--t-cta-bg": t.ctaBg,
    "--t-cta-text": t.ctaText,
    "--t-tile": t.tile,
    "--t-tile-icon": t.tileIcon,
  };
}

/**
 * The whole app in a barber's colors: dashboard, onboarding, booking, manage and VIP pages.
 * Every screen styles itself from these variables (Tailwind's `white` is the theme's text color),
 * so one pick in Settings or onboarding recolors everything. The five themes keep their own colors.
 */
export function appThemeVars(themeId: unknown, accentHex?: string | null): Record<string, string> {
  const t = getTheme(themeId);
  const mix = (a: string, pct: number, b: string) => `color-mix(in srgb, ${a} ${pct}%, ${b})`;
  // A barber's accent pick wins on dark themes; every pick is light, so it takes dark text.
  const picked = t.dark && isAccent(accentHex) ? (accentHex as string) : null;
  // LineCatch Champagne is the app's own look: exactly the live app's colors (globals.css defaults),
  // so barbers on the default theme see no change. Only the accent follows their pick.
  if (t.id === DEFAULT_THEME) {
    return {
      ...LIVE_APP_COLORS,
      "--accent-color": picked ?? t.accent,
      "--accent-fg": "#121110",
      "color-scheme": "dark",
    };
  }
  const accent = picked ?? (t.dark ? t.accent : mix(t.accent, 78, t.text));
  const accentFg = picked ? "#121110" : t.dark ? t.ctaText : "#FFFFFF";
  return {
    "--app-bg": t.bg,
    "--app-bg-deep": t.bg,
    "--app-fg": t.text,
    "--app-muted": t.muted,
    "--app-border": t.border,
    "--app-card": t.dark ? mix(t.text, 6, t.bg) : "#FFFFFF",
    "--app-card-2": t.dark ? mix(t.text, 11, t.bg) : mix(t.text, 6, t.bg),
    "--app-danger": t.dark ? "#F08A8A" : "#B42318",
    "--app-ok": t.dark ? "#A8C49A" : "#3F6B34",
    "--app-warn": t.dark ? "#E0926A" : "#A4511F",
    "--accent-color": accent,
    "--accent-fg": accentFg,
    // Onboarding's own tokens (their defaults in globals.css stay the Champagne look).
    "--ob-bg": t.bg,
    "--ob-surface": t.dark ? mix(t.text, 6, t.bg) : "#FFFFFF",
    "--ob-surface-hover": t.dark ? mix(t.text, 10, t.bg) : mix(t.text, 5, t.bg),
    "--ob-border": t.border,
    "--ob-text": t.text,
    "--ob-text-secondary": t.muted,
    "--ob-text-muted": mix(t.muted, 85, t.bg),
    "--ob-input-bg": t.dark ? mix(t.text, 5, t.bg) : "#FFFFFF",
    "--ob-danger": t.dark ? "#FF4D4D" : "#B42318",
    "color-scheme": t.dark ? "dark" : "light",
  };
}

/** The live app's colors (same values as the :root defaults in globals.css). */
const LIVE_APP_COLORS: Record<string, string> = {
  "--app-bg": "#121110",
  "--app-bg-deep": "#0C0B0A",
  "--app-fg": "#F2EEE6",
  "--app-muted": "#948C80",
  "--app-border": "rgba(242, 238, 230, 0.1)",
  "--app-card": "#1B1A18",
  "--app-card-2": "#2C2A27",
  "--app-danger": "#F08A8A",
  "--app-ok": "#A8C49A",
  "--app-warn": "#E0926A",
  "--ob-bg": "#0F0E0D",
  "--ob-surface": "#1B1A18",
  "--ob-surface-hover": "#22201E",
  "--ob-border": "rgba(242, 238, 230, 0.08)",
  "--ob-text": "#F2EEE6",
  "--ob-text-secondary": "#A39B8F",
  "--ob-text-muted": "#6F685F",
  "--ob-input-bg": "#1A1A1A",
  "--ob-danger": "#FF4D4D",
};

/** Applies a barber's colors to the page (client side). */
export function applyAppTheme(themeId: unknown, accentHex?: string | null) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const [k, v] of Object.entries(appThemeVars(themeId, accentHex))) {
    if (k === "color-scheme") root.style.colorScheme = v;
    else root.style.setProperty(k, v);
  }
}

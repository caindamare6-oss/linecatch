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

// "mint" is the LineCatch brand look (dark + green) and the default for every barber.
export const DEFAULT_THEME: ThemeId = "mint";

export const THEMES: Record<ThemeId, Theme> = {
  mint: {
    id: "mint", name: "LineCatch", dark: true,
    bg: "#070908", surface: "rgba(255,255,255,0.045)", border: "rgba(255,255,255,0.09)", text: "#F2F5F3", muted: "#9BA8A2",
    accent: "#00F5A0", accentGlow: "rgba(0,245,160,0.35)", ctaBg: "#00F5A0", ctaText: "#04130D", tile: "#141A17", tileIcon: "#4E5B55",
  },
  classic: {
    id: "classic", name: "Black & White", dark: true,
    bg: "#0B0B0B", surface: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.1)", text: "#FFFFFF", muted: "#A3A3A3",
    accent: "#FFFFFF", accentGlow: "rgba(255,255,255,0.18)", ctaBg: "#FFFFFF", ctaText: "#0B0B0B", tile: "#1C1C1C", tileIcon: "#5C5C5C",
  },
  gold: {
    id: "gold", name: "Gold", dark: true,
    bg: "#0E0D0B", surface: "rgba(255,240,200,0.05)", border: "rgba(255,240,200,0.1)", text: "#FAF7F0", muted: "#A8A196",
    accent: "#D4A62A", accentGlow: "rgba(212,166,42,0.35)", ctaBg: "#D4A62A", ctaText: "#0E0D0B", tile: "#221F19", tileIcon: "#6B6456",
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

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Settings, X, Copy, Check, RotateCcw, ChevronDown, ChevronRight } from "lucide-react";

const STORAGE_KEY = "linecatch-dev-theme";

const NAV_LINKS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Schedule", href: "/dashboard/schedule" },
  { label: "Messages", href: "/dashboard/messages" },
  { label: "Services", href: "/dashboard/services" },
  { label: "Settings", href: "/dashboard/settings" },
  { label: "Onboarding", href: "/onboarding" },
  { label: "Login", href: "/login" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "VIP Page", href: "/vip/demo" },
  { label: "Booking Page", href: "/book/demo" },
  { label: "Manage Page", href: "/manage/demo" },
];

const COLOR_FIELDS = [
  { label: "Accent", cssVar: "--accent-color", fallback: "#00F5A0" },
  { label: "Background", cssVar: "--background", fallback: "#111111" },
  { label: "Card BG", cssVar: "--card", fallback: "#1e1e1e" },
  { label: "Card Border", cssVar: "--border", fallback: "#1a1a1a" },
  { label: "Text Primary", cssVar: "--foreground", fallback: "#ffffff" },
  { label: "Text Secondary", cssVar: "--muted-foreground", fallback: "#888888" },
  { label: "Text Muted", cssVar: "--muted", fallback: "#2a2a2a" },
];

const FONT_OPTIONS = [
  { label: "Geist (default)", value: "", googleName: "" },
  { label: "Inter", value: "Inter, sans-serif", googleName: "Inter" },
  { label: "Space Grotesk", value: "'Space Grotesk', sans-serif", googleName: "Space+Grotesk" },
  { label: "Plus Jakarta Sans", value: "'Plus Jakarta Sans', sans-serif", googleName: "Plus+Jakarta+Sans" },
  { label: "DM Sans", value: "'DM Sans', sans-serif", googleName: "DM+Sans" },
  { label: "Poppins", value: "Poppins, sans-serif", googleName: "Poppins" },
];

const SHADOW_OPTIONS = [
  { label: "None", value: "none" },
  { label: "Subtle", value: "0 1px 3px rgba(0,0,0,0.3)" },
  { label: "Medium", value: "0 4px 12px rgba(0,0,0,0.4)" },
  { label: "Strong", value: "0 8px 24px rgba(0,0,0,0.5)" },
];

interface ThemeState {
  colors: Record<string, string>;
  fontFamily: string;
  headingScale: number;
  bodySize: number;
  fontWeight: number;
  borderRadius: number;
  shadow: string;
  borderVisible: boolean;
}

const DEFAULT_THEME: ThemeState = {
  colors: {
    "--accent-color": "#00F5A0",
    "--background": "#111111",
    "--card": "#1e1e1e",
    "--border": "#1a1a1a",
    "--foreground": "#ffffff",
    "--muted-foreground": "#888888",
    "--muted": "#2a2a2a",
  },
  fontFamily: "",
  headingScale: 1.0,
  bodySize: 14,
  fontWeight: 400,
  borderRadius: 12,
  shadow: "none",
  borderVisible: true,
};

function normalizeHex(val: string): string {
  val = val.trim();
  if (val.match(/^rgba?\(/)) {
    const match = val.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return "#1a1a1a";
    const r = parseInt(match[1]).toString(16).padStart(2, "0");
    const g = parseInt(match[2]).toString(16).padStart(2, "0");
    const b = parseInt(match[3]).toString(16).padStart(2, "0");
    return `#${r}${g}${b}`;
  }
  if (!val.startsWith("#")) return "#000000";
  val = val.replace(/^#/, "");
  if (val.length > 6) val = val.slice(0, 6);
  if (val.length === 3) val = val[0] + val[0] + val[1] + val[1] + val[2] + val[2];
  return `#${val.padEnd(6, "0")}`;
}

function loadSaved(): ThemeState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveToDisk(theme: ThemeState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
  } catch {}
}

export default function DevThemeEditor() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeState>(DEFAULT_THEME);
  const [copied, setCopied] = useState(false);
  const [textEditing, setTextEditing] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    nav: false,
    colors: true,
    typography: false,
    effects: false,
    text: false,
    export: false,
  });
  const originalTexts = useRef<Map<Element, string>>(new Map());
  const panelRef = useRef<HTMLDivElement>(null);
  const loadedFonts = useRef<Set<string>>(new Set());

  useEffect(() => {
    const saved = loadSaved();
    if (saved) {
      setTheme(saved);
      applyTheme(saved);
    } else {
      const computed = getComputedStyle(document.documentElement);
      const colors: Record<string, string> = {};
      for (const f of COLOR_FIELDS) {
        const val = computed.getPropertyValue(f.cssVar).trim();
        colors[f.cssVar] = val ? normalizeHex(val) : f.fallback;
      }
      setTheme((t) => ({ ...t, colors }));
    }
  }, []);

  const applyTheme = useCallback((t: ThemeState) => {
    const root = document.documentElement;
    for (const [varName, value] of Object.entries(t.colors)) {
      root.style.setProperty(varName, value);
    }
    if (t.fontFamily) {
      loadFont(t.fontFamily);
      root.style.fontFamily = t.fontFamily;
    } else {
      root.style.removeProperty("font-family");
    }
    document.body.style.fontSize = `${t.bodySize}px`;
    document.body.style.fontWeight = String(t.fontWeight);
    root.style.setProperty("--radius", `${t.borderRadius / 16}rem`);
    root.style.setProperty("--card-shadow", t.shadow);
    applyHeadingScale(t.headingScale);
    applyShadows(t.shadow);
    if (!t.borderVisible) {
      root.style.setProperty("--border", "transparent");
    }
  }, []);

  function loadFont(fontFamily: string) {
    const opt = FONT_OPTIONS.find((f) => f.value === fontFamily);
    if (!opt || !opt.googleName || loadedFonts.current.has(opt.googleName)) return;
    loadedFonts.current.add(opt.googleName);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${opt.googleName}:wght@300;400;500;600;700&display=swap`;
    document.head.appendChild(link);
  }

  function applyHeadingScale(scale: number) {
    document.querySelectorAll("h1, h2, h3, h4").forEach((el) => {
      if (panelRef.current?.contains(el)) return;
      (el as HTMLElement).style.transform = `scale(${scale})`;
      (el as HTMLElement).style.transformOrigin = "left center";
    });
  }

  function applyShadows(shadow: string) {
    document.querySelectorAll("[class*='border-white'], [class*='bg-white/']").forEach((el) => {
      if (panelRef.current?.contains(el)) return;
      if (shadow !== "none") {
        (el as HTMLElement).style.boxShadow = shadow;
      } else {
        (el as HTMLElement).style.removeProperty("box-shadow");
      }
    });
  }

  function updateTheme(partial: Partial<ThemeState>) {
    setTheme((prev) => {
      const next = { ...prev, ...partial };
      applyTheme(next);
      saveToDisk(next);
      return next;
    });
  }

  function updateColor(cssVar: string, value: string) {
    const newColors = { ...theme.colors, [cssVar]: value };
    const next = { ...theme, colors: newColors };
    document.documentElement.style.setProperty(cssVar, value);
    if (!next.borderVisible && cssVar === "--border") {
      document.documentElement.style.setProperty("--border", "transparent");
    }
    setTheme(next);
    saveToDisk(next);
  }

  function toggleTextEditing() {
    if (textEditing) {
      disableTextEditing();
    } else {
      enableTextEditing();
    }
    setTextEditing(!textEditing);
  }

  function enableTextEditing() {
    const selectors = "p, h1, h2, h3, h4, h5, h6, span, button, a, label, li";
    document.querySelectorAll(selectors).forEach((el) => {
      if (panelRef.current?.contains(el)) return;
      if (el.closest("[data-dev-panel]")) return;
      originalTexts.current.set(el, el.innerHTML);
      (el as HTMLElement).contentEditable = "true";
      el.classList.add("dev-text-editable");
    });
  }

  function disableTextEditing() {
    originalTexts.current.forEach((html, el) => {
      (el as HTMLElement).contentEditable = "false";
      el.innerHTML = html;
      el.classList.remove("dev-text-editable");
    });
    originalTexts.current.clear();
  }

  function resetAll() {
    disableTextEditing();
    setTextEditing(false);
    localStorage.removeItem(STORAGE_KEY);
    document.documentElement.removeAttribute("style");
    document.body.removeAttribute("style");
    document.querySelectorAll("h1, h2, h3, h4").forEach((el) => {
      (el as HTMLElement).style.removeProperty("transform");
      (el as HTMLElement).style.removeProperty("transform-origin");
    });
    setTheme(DEFAULT_THEME);
    window.location.reload();
  }

  function exportTheme() {
    const exportObj = {
      colors: {
        accent: theme.colors["--accent-color"],
        background: theme.colors["--background"],
        card: theme.colors["--card"],
        cardBorder: theme.colors["--border"],
        textPrimary: theme.colors["--foreground"],
        textSecondary: theme.colors["--muted-foreground"],
        textMuted: theme.colors["--muted"],
      },
      typography: {
        fontFamily: FONT_OPTIONS.find((f) => f.value === theme.fontFamily)?.label || "Geist (default)",
        headingScale: theme.headingScale,
        bodySize: theme.bodySize,
        fontWeight: theme.fontWeight,
      },
      effects: {
        borderRadius: theme.borderRadius,
        shadow: SHADOW_OPTIONS.find((s) => s.value === theme.shadow)?.label || "None",
        borderVisible: theme.borderVisible,
      },
    };
    navigator.clipboard.writeText(JSON.stringify(exportObj, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function toggleSection(key: string) {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const SectionHeader = ({ id, label }: { id: string; label: string }) => (
    <button
      onClick={() => toggleSection(id)}
      className="w-full flex items-center justify-between py-2 text-[11px] font-bold uppercase tracking-wider text-white/50 hover:text-white/70 transition-colors"
    >
      {label}
      {expandedSections[id] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
    </button>
  );

  return (
    <>
      <style jsx global>{`
        .dev-text-editable {
          outline: 1px dashed rgba(255, 255, 255, 0.2) !important;
          outline-offset: 2px;
          cursor: text !important;
        }
        .dev-text-editable:focus {
          outline-color: var(--accent-color, #00F5A0) !important;
        }
      `}</style>

      {/* Gear trigger */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-16 left-4 z-[60] w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-all shadow-lg"
        title="Theme Editor"
      >
        <Settings className="w-5 h-5" style={open ? { transform: "rotate(90deg)", transition: "transform 0.3s" } : { transition: "transform 0.3s" }} />
      </button>

      {/* Panel */}
      {open && (
        <div
          ref={panelRef}
          data-dev-panel
          className="fixed inset-y-0 right-0 w-80 z-[60] bg-[#0a0a0a] border-l border-white/[0.08] overflow-y-auto animate-slide-in"
          style={{ scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 bg-[#0a0a0a]/95 backdrop-blur-sm border-b border-white/[0.08] px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
              <span className="text-xs font-bold text-white/80 uppercase tracking-wider">Theme Editor</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-4 py-3 space-y-1">
            {/* Navigation */}
            <SectionHeader id="nav" label="Navigation" />
            {expandedSections.nav && (
              <div className="grid grid-cols-2 gap-1 pb-3">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-[11px] px-2 py-1.5 rounded bg-white/[0.04] text-white/50 hover:text-white hover:bg-white/[0.08] transition-colors truncate"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}

            <div className="border-t border-white/[0.06]" />

            {/* Colors */}
            <SectionHeader id="colors" label="Colors" />
            {expandedSections.colors && (
              <div className="space-y-2 pb-3">
                {COLOR_FIELDS.map((field) => (
                  <div key={field.cssVar} className="flex items-center gap-2">
                    <label className="text-[11px] text-white/40 w-20 shrink-0">{field.label}</label>
                    <input
                      type="color"
                      value={theme.colors[field.cssVar] || field.fallback}
                      onChange={(e) => updateColor(field.cssVar, e.target.value)}
                      className="w-7 h-7 rounded border border-white/10 cursor-pointer bg-transparent shrink-0"
                      style={{ padding: 0 }}
                    />
                    <input
                      type="text"
                      value={theme.colors[field.cssVar] || field.fallback}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (/^#?[0-9a-fA-F]{0,8}$/.test(v)) {
                          const colors = { ...theme.colors, [field.cssVar]: v };
                          setTheme((t) => ({ ...t, colors }));
                          if (/^#[0-9a-fA-F]{6}$/.test(v)) {
                            document.documentElement.style.setProperty(field.cssVar, v);
                            saveToDisk({ ...theme, colors });
                          }
                        }
                      }}
                      className="flex-1 text-[11px] bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-white/70 font-mono focus:border-white/20 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-white/[0.06]" />

            {/* Typography */}
            <SectionHeader id="typography" label="Typography" />
            {expandedSections.typography && (
              <div className="space-y-3 pb-3">
                <div>
                  <label className="text-[11px] text-white/40 block mb-1">Font Family</label>
                  <select
                    value={theme.fontFamily}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) loadFont(val);
                      updateTheme({ fontFamily: val });
                    }}
                    className="w-full text-[11px] bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1.5 text-white/70 focus:border-white/20 focus:outline-none appearance-none cursor-pointer"
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option key={f.value} value={f.value} className="bg-[#1a1a1a]">
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-white/40">Heading Scale</label>
                    <span className="text-[10px] text-white/30 font-mono">{theme.headingScale.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.8"
                    max="1.4"
                    step="0.05"
                    value={theme.headingScale}
                    onChange={(e) => updateTheme({ headingScale: parseFloat(e.target.value) })}
                    className="w-full h-1 rounded-full appearance-none cursor-pointer"
                    style={{ accentColor: "var(--accent-color, #00F5A0)" }}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-white/40">Body Text Size</label>
                    <span className="text-[10px] text-white/30 font-mono">{theme.bodySize}px</span>
                  </div>
                  <input
                    type="range"
                    min="12"
                    max="18"
                    step="1"
                    value={theme.bodySize}
                    onChange={(e) => updateTheme({ bodySize: parseInt(e.target.value) })}
                    className="w-full h-1 rounded-full appearance-none cursor-pointer"
                    style={{ accentColor: "var(--accent-color, #00F5A0)" }}
                  />
                </div>

                <div>
                  <label className="text-[11px] text-white/40 block mb-1.5">Font Weight</label>
                  <div className="flex gap-1">
                    {[
                      { label: "Regular", value: 400 },
                      { label: "Medium", value: 500 },
                      { label: "Bold", value: 700 },
                    ].map((w) => (
                      <button
                        key={w.value}
                        onClick={() => updateTheme({ fontWeight: w.value })}
                        className={`flex-1 text-[10px] py-1 rounded transition-colors ${
                          theme.fontWeight === w.value
                            ? "bg-[var(--accent-color)] text-black font-medium"
                            : "bg-white/[0.04] text-white/40 hover:bg-white/[0.08]"
                        }`}
                      >
                        {w.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="border-t border-white/[0.06]" />

            {/* Effects */}
            <SectionHeader id="effects" label="Effects" />
            {expandedSections.effects && (
              <div className="space-y-3 pb-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-white/40">Border Radius</label>
                    <span className="text-[10px] text-white/30 font-mono">{theme.borderRadius}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="24"
                    step="1"
                    value={theme.borderRadius}
                    onChange={(e) => updateTheme({ borderRadius: parseInt(e.target.value) })}
                    className="w-full h-1 rounded-full appearance-none cursor-pointer"
                    style={{ accentColor: "var(--accent-color, #00F5A0)" }}
                  />
                </div>

                <div>
                  <label className="text-[11px] text-white/40 block mb-1.5">Card Shadow</label>
                  <div className="flex gap-1">
                    {SHADOW_OPTIONS.map((s) => (
                      <button
                        key={s.label}
                        onClick={() => updateTheme({ shadow: s.value })}
                        className={`flex-1 text-[10px] py-1 rounded transition-colors ${
                          theme.shadow === s.value
                            ? "bg-[var(--accent-color)] text-black font-medium"
                            : "bg-white/[0.04] text-white/40 hover:bg-white/[0.08]"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-white/40">Card Borders</label>
                  <button
                    onClick={() => {
                      const next = !theme.borderVisible;
                      if (!next) {
                        document.documentElement.style.setProperty("--border", "transparent");
                      } else {
                        document.documentElement.style.setProperty("--border", theme.colors["--border"]);
                      }
                      updateTheme({ borderVisible: next });
                    }}
                    className={`w-9 h-5 rounded-full transition-colors relative ${
                      theme.borderVisible ? "bg-[var(--accent-color)]" : "bg-white/10"
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        theme.borderVisible ? "translate-x-4" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}

            <div className="border-t border-white/[0.06]" />

            {/* Text Editor */}
            <SectionHeader id="text" label="Text Editor" />
            {expandedSections.text && (
              <div className="space-y-2 pb-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-white/40">Edit text on page</label>
                  <button
                    onClick={toggleTextEditing}
                    className={`w-9 h-5 rounded-full transition-colors relative ${
                      textEditing ? "bg-[var(--accent-color)]" : "bg-white/10"
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        textEditing ? "translate-x-4" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
                {textEditing && (
                  <p className="text-[10px] text-white/30">Click any text on the page to edit it. Changes are visual only.</p>
                )}
                <button
                  onClick={() => {
                    disableTextEditing();
                    setTextEditing(false);
                  }}
                  className="w-full text-[10px] py-1.5 rounded bg-white/[0.04] text-white/40 hover:bg-white/[0.08] hover:text-white/60 transition-colors flex items-center justify-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset Text Changes
                </button>
              </div>
            )}

            <div className="border-t border-white/[0.06]" />

            {/* Export */}
            <SectionHeader id="export" label="Export" />
            {expandedSections.export && (
              <div className="space-y-2 pb-3">
                <button
                  onClick={exportTheme}
                  className="w-full text-[11px] py-2 rounded font-medium transition-colors flex items-center justify-center gap-1.5 bg-[var(--accent-color)] text-black hover:brightness-90"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy Theme JSON
                    </>
                  )}
                </button>
                <button
                  onClick={resetAll}
                  className="w-full text-[10px] py-1.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors flex items-center justify-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset All to Defaults
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

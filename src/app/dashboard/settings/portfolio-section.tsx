"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { useT } from "@/lib/i18n";
import { ACCENT_COLORS, DEFAULT_THEME, THEMES, THEME_IDS, applyAppTheme, type ThemeId } from "@/lib/themes";

/** "Your page": the barber's booking link (linecatch.app/their-shop) and their colors. */
export default function PortfolioSection({ bare = false }: { bare?: boolean }) {
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [slug, setSlug] = useState("");
  const [savedSlug, setSavedSlug] = useState("");
  const [theme, setTheme] = useState<ThemeId>(DEFAULT_THEME);
  const [accent, setAccent] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/portfolio")
      .then((r) => r.json())
      .then((d) => {
        setSlug(d.slug || "");
        setSavedSlug(d.slug || "");
        if (d.theme) setTheme(d.theme);
        setAccent(d.accentColor || null);
      })
      .finally(() => setLoading(false));
  }, []);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const pageUrl = `${origin}/${savedSlug}`;
  const shownHost = origin.replace(/^https?:\/\//, "");
  const flash = (text: string, kind: "ok" | "error" = "ok") => setMessage({ kind, text });

  async function patch(body: object) {
    const res = await fetch("/api/portfolio", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    if (!res) throw new Error(t("portfolio.could_not_save"));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || t("portfolio.could_not_save"));
  }

  async function saveSlug() {
    const next = slug.trim().toLowerCase();
    setMessage(null);
    try {
      await patch({ slug: next });
      setSlug(next);
      setSavedSlug(next);
      flash(t("portfolio.link_saved"));
    } catch (e) {
      flash((e as Error).message, "error");
    }
  }

  // Their colors color their page and their whole app, so the change shows here right away.
  async function pickTheme(id: ThemeId) {
    const prev = { theme, accent };
    setTheme(id);
    setAccent(null);
    applyAppTheme(id, null);
    try {
      await patch({ theme: id, accentColor: null });
    } catch (e) {
      setTheme(prev.theme);
      setAccent(prev.accent);
      applyAppTheme(prev.theme, prev.accent);
      flash((e as Error).message, "error");
    }
  }

  async function pickAccent(hex: string | null) {
    const previous = accent;
    setAccent(hex);
    applyAppTheme(theme, hex);
    try {
      await patch({ accentColor: hex });
    } catch (e) {
      setAccent(previous);
      applyAppTheme(theme, previous);
      flash((e as Error).message, "error");
    }
  }

  if (loading) return null;
  const dark = THEMES[theme].dark;

  return (
    <div id="portfolio" className={bare ? "space-y-6" : "bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5 scroll-mt-4 space-y-6"}>
      {/* Link */}
      <div className="space-y-2">
        <label htmlFor="portfolio-slug" className="text-xs text-white/50 block">{t("portfolio.your_link")}</label>
        <div className="flex items-center rounded-xl border border-white/[0.08] bg-white/[0.03] focus-within:border-[var(--accent-color)] transition-colors">
          <span className="pl-3 text-sm text-white/45 whitespace-nowrap">{shownHost}/</span>
          <input
            id="portfolio-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            maxLength={40}
            autoComplete="off"
            className="flex-1 min-w-0 bg-transparent py-2.5 pr-3 text-sm text-white/85 focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {slug !== savedSlug && (
            <button onClick={saveSlug} className="min-h-10 px-3 rounded-lg bg-[var(--accent-color)] text-[var(--accent-fg)] text-xs font-semibold hover:brightness-90 transition">
              {t("portfolio.save_link")}
            </button>
          )}
          <button
            onClick={() => {
              navigator.clipboard.writeText(pageUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
            }}
            className="min-h-10 px-3 rounded-lg border border-white/[0.1] text-xs text-white/75 hover:bg-white/[0.06] transition inline-flex items-center gap-1.5"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? t("common.copied") : t("portfolio.copy_link")}
          </button>
          <a href={pageUrl} target="_blank" rel="noopener noreferrer" className="min-h-10 px-3 rounded-lg border border-white/[0.1] text-xs text-white/75 hover:bg-white/[0.06] transition inline-flex items-center gap-1.5">
            <ExternalLink className="w-3.5 h-3.5" /> {t("portfolio.view_page")}
          </a>
        </div>
      </div>

      {/* Colors: their page, booking pages and their own app */}
      <section aria-labelledby="pf-colors" className="space-y-3">
        <div>
          <h4 id="pf-colors" className="text-[11px] font-semibold uppercase tracking-[0.8px] text-white/45">{t("portfolio.colors_title")}</h4>
          <p className="text-xs text-white/50 mt-1">{t("portfolio.colors_hint")}</p>
        </div>
        <div role="radiogroup" aria-labelledby="pf-colors" className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {THEME_IDS.map((id) => {
            const th = THEMES[id];
            const on = id === theme;
            return (
              <button
                key={id}
                role="radio"
                aria-checked={on}
                onClick={() => pickTheme(id)}
                className={`rounded-xl p-2.5 text-left border-2 transition-all hover:-translate-y-0.5 ${on ? "border-[var(--accent-color)]" : "border-white/[0.08]"}`}
                style={{ background: th.bg }}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: th.accent }} />
                  <span className="h-2 flex-1 rounded-full" style={{ background: th.tile }} />
                </div>
                <div className="text-xs font-semibold" style={{ color: th.text }}>{t(`portfolio.theme_${id}`)}</div>
              </button>
            );
          })}
        </div>
        {dark && (
          <div>
            <div id="pf-accent" className="text-xs text-white/50 mb-2">{t("portfolio.accent")}</div>
            <div role="radiogroup" aria-labelledby="pf-accent" className="flex flex-wrap gap-2.5">
              {[{ name: "theme", hex: null as string | null }, ...ACCENT_COLORS].map((c) => {
                const swatch = c.hex ?? THEMES[theme].accent;
                const on = accent === c.hex;
                return (
                  <button
                    key={c.hex ?? "theme"}
                    role="radio"
                    aria-checked={on}
                    onClick={() => pickAccent(c.hex)}
                    aria-label={c.hex ? t(`portfolio.accent_${c.name.toLowerCase()}`) : t("portfolio.theme_color")}
                    className="w-11 h-11 rounded-xl transition-transform hover:scale-105"
                    style={{ backgroundColor: swatch, boxShadow: on ? `0 0 0 2px var(--app-bg), 0 0 0 4px ${swatch}` : "none" }}
                  />
                );
              })}
            </div>
          </div>
        )}
      </section>

      {message && (
        <p role={message.kind === "error" ? "alert" : "status"} className={`text-xs ${message.kind === "ok" ? "text-[var(--accent-color)]" : "text-[var(--app-danger)]"}`}>{message.text}</p>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Copy, ExternalLink, ImagePlus, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { ACCENT_COLORS, DEFAULT_THEME, THEMES, THEME_IDS, type ThemeId } from "@/lib/themes";

type Photo = { id: string; url: string; thumb_url: string | null; width: number | null; height: number | null };

const MAX_PHOTOS = 8;
const FULL_EDGE = 1600;
const THUMB_EDGE = 600;

/** Shrinks a phone photo to at most `maxEdge` px on its long edge as a JPEG, so the page stays light. */
async function shrink(file: File, maxEdge: number, quality: number): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("unreadable");
  return { blob, width, height };
}

export default function PortfolioSection({ bare = false }: { bare?: boolean }) {
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [slug, setSlug] = useState("");
  const [savedSlug, setSavedSlug] = useState("");
  const [theme, setTheme] = useState<ThemeId>(DEFAULT_THEME);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [accent, setAccent] = useState<string | null>(null);
  const [uploading, setUploading] = useState(0);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const avatarInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/portfolio")
      .then((r) => r.json())
      .then((d) => {
        setSlug(d.slug || "");
        setSavedSlug(d.slug || "");
        if (d.theme) setTheme(d.theme);
        setAvatarUrl(d.avatarUrl || null);
        setAccent(d.accentColor || null);
        setPhotos(d.photos || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const pageUrl = `${origin}/${savedSlug}`;
  const shownHost = origin.replace(/^https?:\/\//, "");

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
      setMessage({ kind: "ok", text: t("portfolio.link_saved") });
    } catch (e) {
      setMessage({ kind: "error", text: (e as Error).message });
    }
  }

  async function pickTheme(id: ThemeId) {
    const previous = theme;
    setTheme(id);
    try {
      await patch({ theme: id });
    } catch (e) {
      setTheme(previous);
      setMessage({ kind: "error", text: (e as Error).message });
    }
  }

  async function pickAccent(hex: string) {
    const previous = accent;
    setAccent(hex);
    document.documentElement.style.setProperty("--accent-color", hex);
    try {
      await patch({ accentColor: hex });
    } catch (e) {
      setAccent(previous);
      if (previous) document.documentElement.style.setProperty("--accent-color", previous);
      setMessage({ kind: "error", text: (e as Error).message });
    }
  }

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setMessage(null);
    const room = MAX_PHOTOS - photos.length;
    const batch = Array.from(files).slice(0, room);
    if (files.length > room) setMessage({ kind: "error", text: room === 1 ? t("portfolio.only_more_one", { max: MAX_PHOTOS }) : t("portfolio.only_more", { n: room, max: MAX_PHOTOS }) });
    for (const file of batch) {
      setUploading((n) => n + 1);
      try {
        const { blob, width, height } = await shrink(file, FULL_EDGE, 0.82);
        const thumb = await shrink(file, THUMB_EDGE, 0.78);
        const form = new FormData();
        form.append("photo", blob, "photo.jpg");
        form.append("thumb", thumb.blob, "thumb.jpg");
        form.append("width", String(width));
        form.append("height", String(height));
        const res = await fetch("/api/portfolio/photos", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t("portfolio.upload_failed"));
        setPhotos((prev) => [...prev, data.photo]);
      } catch (e) {
        setMessage({ kind: "error", text: photoError(e) });
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  async function changeAvatar(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setMessage(null);
    setAvatarBusy(true);
    try {
      const { blob } = await shrink(file, 512, 0.85);
      const form = new FormData();
      form.append("avatar", blob, "avatar.jpg");
      const res = await fetch("/api/onboarding/avatar", { method: "POST", body: form });
      const data = await res.json();
      // The avatar route answers in English; t() maps known sentences to the current language.
      if (!res.ok) throw new Error(data.error ? t(data.error) : t("portfolio.upload_failed"));
      setAvatarUrl(data.avatar_url);
    } catch (e) {
      setMessage({ kind: "error", text: photoError(e) });
    } finally {
      setAvatarBusy(false);
      if (avatarInput.current) avatarInput.current.value = "";
    }
  }

  async function removePhoto(id: string) {
    const before = photos;
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    const res = await fetch(`/api/portfolio/photos/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setPhotos(before);
      setMessage({ kind: "error", text: t("portfolio.could_not_remove") });
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= photos.length) return;
    const before = photos;
    const next = [...photos];
    [next[index], next[target]] = [next[target], next[index]];
    setPhotos(next);
    try {
      await patch({ order: next.map((p) => p.id) });
    } catch (e) {
      setPhotos(before);
      setMessage({ kind: "error", text: (e as Error).message });
    }
  }

  /** Messages from our APIs are already translated; browser decode errors are not. */
  function photoError(e: unknown) {
    if (e instanceof DOMException || (e as Error).message === "unreadable") return t("portfolio.could_not_read");
    if (e instanceof TypeError || e instanceof SyntaxError || !(e as Error).message) return t("portfolio.upload_failed");
    return (e as Error).message;
  }

  if (loading) return null;

  return (
    <div id="portfolio" className={bare ? "space-y-5" : "bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5 scroll-mt-4 space-y-5"}>
      {!bare && (
        <div>
          <h3 className="text-xs text-white/40 uppercase tracking-wider font-medium mb-1">{t("portfolio.section_title")}</h3>
          <p className="text-xs text-white/30">{t("portfolio.section_sub")}</p>
        </div>
      )}

      {/* Barber's photo: leads the page header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => avatarInput.current?.click()}
          aria-label={t("portfolio.change_photo_aria")}
          className="relative shrink-0 w-[72px] h-[72px] rounded-full p-[3px] bg-[var(--accent-color)] shadow-[0_0_18px_color-mix(in_srgb,var(--accent-color)_35%,transparent)] transition-transform hover:scale-105"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={t("portfolio.your_photo")} className="w-full h-full rounded-full object-cover border-[3px] border-[#0d0d0d]" />
          ) : (
            <span className="w-full h-full rounded-full bg-[#0d0d0d] flex items-center justify-center text-[var(--accent-color)]">
              <ImagePlus className="w-6 h-6" />
            </span>
          )}
          {avatarBusy && (
            <span className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
              <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </span>
          )}
        </button>
        <div>
          <div className="text-sm text-white/80 font-medium">{t("portfolio.your_photo")}</div>
          <div className="text-xs text-white/30 mt-0.5">{t("portfolio.photo_hint")}</div>
          <button onClick={() => avatarInput.current?.click()} className="mt-1.5 text-xs font-semibold text-[var(--accent-color)] hover:underline">
            {avatarUrl ? t("portfolio.change_photo") : t("portfolio.add_photo")}
          </button>
        </div>
        <input ref={avatarInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => changeAvatar(e.target.files)} />
      </div>

      {/* Link */}
      <div className="space-y-2">
        <label htmlFor="portfolio-slug" className="text-xs text-white/25 block">{t("portfolio.your_link")}</label>
        <div className="flex items-center rounded-xl border border-white/[0.08] bg-white/[0.03] focus-within:border-[var(--accent-color)] transition-colors">
          <span className="pl-3 text-sm text-white/30 whitespace-nowrap">{shownHost}/</span>
          <input
            id="portfolio-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            maxLength={40}
            autoComplete="off"
            className="flex-1 min-w-0 bg-transparent py-2.5 pr-3 text-sm text-white/80 focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {slug !== savedSlug && (
            <button onClick={saveSlug} className="px-3 py-2 rounded-lg bg-[var(--accent-color)] text-[#0d0d0d] text-xs font-semibold hover:brightness-90 transition">
              {t("portfolio.save_link")}
            </button>
          )}
          <button
            onClick={() => { navigator.clipboard.writeText(pageUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="px-3 py-2 rounded-lg border border-white/[0.1] text-xs text-white/70 hover:bg-white/[0.06] transition inline-flex items-center gap-1.5"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? t("common.copied") : t("portfolio.copy_link")}
          </button>
          <a href={pageUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-2 rounded-lg border border-white/[0.1] text-xs text-white/70 hover:bg-white/[0.06] transition inline-flex items-center gap-1.5">
            <ExternalLink className="w-3.5 h-3.5" /> {t("portfolio.view_page")}
          </a>
        </div>
      </div>

      {/* Accent: also colors the booking, VIP and dashboard pages */}
      <div>
        <div className="text-xs text-white/25 mb-2">{t("portfolio.accent")}</div>
        <div className="flex flex-wrap gap-2.5">
          {ACCENT_COLORS.map((c) => (
            <button
              key={c.hex}
              onClick={() => pickAccent(c.hex)}
              aria-label={t(`portfolio.accent_${c.name.toLowerCase()}`)}
              aria-pressed={accent === c.hex}
              className="w-10 h-10 rounded-xl transition-transform hover:scale-105"
              style={{ backgroundColor: c.hex, boxShadow: accent === c.hex ? `0 0 0 2px #0F0E0D, 0 0 0 4px ${c.hex}` : "none" }}
            />
          ))}
        </div>
      </div>

      {/* Theme */}
      <div>
        <div className="text-xs text-white/25 mb-2">{t("portfolio.background")}</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {THEME_IDS.map((id) => {
            const th = THEMES[id];
            const on = id === theme;
            return (
              <button
                key={id}
                onClick={() => pickTheme(id)}
                aria-pressed={on}
                className={`rounded-xl p-2.5 text-left border-2 transition-all hover:-translate-y-0.5 ${on ? "border-[var(--accent-color)]" : "border-white/[0.06]"}`}
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
      </div>

      {/* Photos */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-xs text-white/25">{t("portfolio.photos")}</span>
          <span className={`text-xs ${photos.length >= 6 ? "text-[var(--accent-color)]" : "text-white/35"}`}>{t("portfolio.count", { n: photos.length, max: MAX_PHOTOS })}</span>
        </div>
        {/* Same layout as the live page: 2 columns, photos 1 and 4 tall. Every empty slot is tap-to-add. */}
        <div className="grid grid-cols-2 auto-rows-[110px] gap-2">
          {Array.from({ length: MAX_PHOTOS }).map((_, i) => {
            const p = photos[i];
            const tall = i === 0 || i === 3 ? "row-span-2" : "";
            if (p) return (
              <div key={p.id} className={`${tall} relative rounded-xl overflow-hidden bg-white/[0.04]`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.thumb_url ?? p.url} alt={t("portfolio.photo_alt", { n: i + 1 })} className="w-full h-full object-cover" loading="lazy" />
                <span className="absolute left-1.5 top-1.5 min-w-5 h-5 px-1 rounded-md bg-black/70 text-[11px] font-semibold text-white/80 flex items-center justify-center">{i + 1}</span>
                <button onClick={() => removePhoto(p.id)} aria-label={t("portfolio.remove_photo", { n: i + 1 })} className="absolute right-1.5 top-1.5 w-7 h-7 rounded-lg bg-black/70 text-white/80 hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
                <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between">
                  <button onClick={() => move(i, -1)} disabled={i === 0} aria-label={t("portfolio.move_earlier", { n: i + 1 })} className="w-7 h-7 rounded-lg bg-black/70 text-white/80 flex items-center justify-center disabled:opacity-0 hover:bg-black/90">
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => move(i, 1)} disabled={i === photos.length - 1} aria-label={t("portfolio.move_later", { n: i + 1 })} className="w-7 h-7 rounded-lg bg-black/70 text-white/80 flex items-center justify-center disabled:opacity-0 hover:bg-black/90">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
            if (i < photos.length + uploading) return <div key={`up-${i}`} className={`${tall} rounded-xl bg-white/[0.06] animate-pulse`} />;
            return (
              <button
                key={`empty-${i}`}
                onClick={() => fileInput.current?.click()}
                aria-label={t("portfolio.add_photo_n", { n: i + 1 })}
                className={`${tall} rounded-xl border-[1.5px] border-dashed border-[var(--accent-color)]/40 bg-[var(--accent-color)]/[0.03] text-[var(--accent-color)] hover:bg-[var(--accent-color)]/[0.08] flex flex-col items-center justify-center gap-1 text-xs font-semibold transition`}
              >
                <ImagePlus className="w-5 h-5" /> {t("portfolio.add")}
              </button>
            );
          })}
        </div>
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => addPhotos(e.target.files)} />
        <p className="text-xs text-white/30 mt-2">{t("portfolio.photos_hint")}</p>
      </div>

      {message && (
        <p className={`text-xs ${message.kind === "ok" ? "text-[var(--accent-color)]" : "text-red-400"}`}>{message.text}</p>
      )}
    </div>
  );
}

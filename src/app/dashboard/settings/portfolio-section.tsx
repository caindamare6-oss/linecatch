"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink, ImagePlus, Plus, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { ACCENT_COLORS, DEFAULT_THEME, THEMES, THEME_IDS, applyAppTheme, type ThemeId } from "@/lib/themes";

type Photo = { id: string; url: string; thumb_url: string | null; width: number | null; height: number | null; service_id: string | null };
type Service = { id: string; name: string; description: string | null; price: number; duration_minutes: number };
type Sheet = { photoId: string; fresh: boolean };

const MAX_PHOTOS = 50;
const FULL_EDGE = 1600;
const THUMB_EDGE = 600;
const LENGTHS = [30, 45, 60];

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

const money = (n: number) => `$${Number.isInteger(Number(n)) ? Number(n) : Number(n).toFixed(2)}`;

export default function PortfolioSection({ bare = false }: { bare?: boolean }) {
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [slug, setSlug] = useState("");
  const [savedSlug, setSavedSlug] = useState("");
  const [theme, setTheme] = useState<ThemeId>(DEFAULT_THEME);
  const [accent, setAccent] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [uploading, setUploading] = useState(0);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverBusy, setCoverBusy] = useState(false);
  // "Which cut is this?": the open photo, plus new uploads still waiting to be tagged.
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/portfolio")
      .then((r) => r.json())
      .then((d) => {
        setSlug(d.slug || "");
        setSavedSlug(d.slug || "");
        if (d.theme) setTheme(d.theme);
        setCoverUrl(d.coverUrl || null);
        setAccent(d.accentColor || null);
        setPhotos(d.photos || []);
        setServices((d.services || []).map((s: Service) => ({ ...s, price: Number(s.price) })));
      })
      .finally(() => setLoading(false));
  }, []);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const pageUrl = `${origin}/${savedSlug}`;
  const shownHost = origin.replace(/^https?:\/\//, "");
  const untagged = photos.filter((p) => !p.service_id).length;
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

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setMessage(null);
    const room = MAX_PHOTOS - photos.length;
    const batch = Array.from(files).slice(0, room);
    if (files.length > room) flash(room === 1 ? t("portfolio.only_more_one", { max: MAX_PHOTOS }) : t("portfolio.only_more", { n: room, max: MAX_PHOTOS }), "error");
    const added: string[] = [];
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
        setPhotos((prev) => [...prev, { ...data.photo, service_id: data.photo.service_id ?? null }]);
        added.push(data.photo.id);
        // Ask "Which cut is this?" right away; more uploads wait their turn.
        if (added.length === 1 && !sheet) setSheet({ photoId: data.photo.id, fresh: true });
        else setQueue((q) => [...q, data.photo.id]);
      } catch (e) {
        flash(photoError(e), "error");
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  async function changeCover(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setMessage(null);
    setCoverBusy(true);
    try {
      const { blob } = await shrink(file, FULL_EDGE, 0.84);
      const form = new FormData();
      form.append("cover", blob, "cover.jpg");
      const res = await fetch("/api/cover", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("portfolio.upload_failed"));
      setCoverUrl(data.coverUrl);
      flash(t("portfolio.toast_cover"));
    } catch (e) {
      flash(photoError(e), "error");
    } finally {
      setCoverBusy(false);
      if (coverInput.current) coverInput.current.value = "";
    }
  }

  async function removePhoto(id: string) {
    const before = photos;
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    const res = await fetch(`/api/portfolio/photos/${id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      setPhotos(before);
      flash(t("portfolio.could_not_remove"), "error");
      return false;
    }
    flash(t("portfolio.toast_deleted"));
    return true;
  }

  async function move(id: string, dir: -1 | 1) {
    const index = photos.findIndex((p) => p.id === id);
    const target = index + dir;
    if (index < 0 || target < 0 || target >= photos.length) return;
    const before = photos;
    const next = [...photos];
    [next[index], next[target]] = [next[target], next[index]];
    setPhotos(next);
    try {
      await patch({ order: next.map((p) => p.id) });
    } catch (e) {
      setPhotos(before);
      flash((e as Error).message, "error");
    }
  }

  /** Saves a photo's cut. Returns an error message, or null when it worked. */
  async function saveTag(photoId: string, body: { serviceId: string | null } | { newService: object }): Promise<string | null> {
    const res = await fetch(`/api/portfolio/photos/${photoId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) return data.error || t("portfolio.err_save_tag");
    if (data.service) setServices((prev) => [...prev, { ...data.service, price: Number(data.service.price) }]);
    setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, service_id: data.serviceId ?? null } : p)));
    return null;
  }

  /** Closes the sheet, then opens the next new upload that still needs a cut. */
  function nextInQueue() {
    const [next, ...rest] = queue;
    setQueue(rest);
    setSheet(next ? { photoId: next, fresh: true } : null);
  }

  /** Messages from our APIs are already translated; browser decode errors are not. */
  function photoError(e: unknown) {
    if (e instanceof DOMException || (e as Error).message === "unreadable") return t("portfolio.could_not_read");
    if (e instanceof TypeError || e instanceof SyntaxError || !(e as Error).message) return t("portfolio.upload_failed");
    return (e as Error).message;
  }

  if (loading) return null;
  const serviceOf = (id: string | null) => services.find((s) => s.id === id) ?? null;
  const dark = THEMES[theme].dark;

  return (
    <div id="portfolio" className={bare ? "space-y-6" : "bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5 scroll-mt-4 space-y-6"}>
      {!bare && (
        <div>
          <h3 className="text-xs text-white/50 uppercase tracking-wider font-medium mb-1">{t("portfolio.section_title")}</h3>
          <p className="text-xs text-white/45">{t("portfolio.section_sub")}</p>
        </div>
      )}

      {/* Cover photo: the big photo at the top of their page */}
      <section aria-labelledby="pf-cover">
        <h4 id="pf-cover" className="text-[11px] font-semibold uppercase tracking-[0.8px] text-white/45 mb-2.5">{t("portfolio.cover_title")}</h4>
        <div className="flex items-center gap-3 rounded-[14px] bg-[var(--app-card)] border border-white/[0.06] p-2.5">
          <button
            type="button"
            onClick={() => coverInput.current?.click()}
            aria-label={coverUrl ? t("portfolio.cover_change") : t("portfolio.cover_add")}
            className="relative shrink-0 w-[112px] h-[132px] rounded-[10px] overflow-hidden bg-white/[0.05] flex items-center justify-center text-white/40"
          >
            {coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <ImagePlus className="w-7 h-7" />
            )}
            {coverBusy && (
              <span className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <span className="w-5 h-5 border-2 border-[#fff]/25 border-t-[#fff] rounded-full animate-spin" />
              </span>
            )}
          </button>
          <div className="min-w-0 flex-1 space-y-2.5">
            <p className="text-[13px] leading-snug text-white/60">{t("portfolio.cover_hint")}</p>
            <button
              type="button"
              onClick={() => coverInput.current?.click()}
              disabled={coverBusy}
              className="min-h-10 px-3.5 rounded-[10px] border border-[var(--accent-color)]/45 text-[var(--accent-color)] text-[13px] font-semibold disabled:opacity-50"
            >
              {coverUrl ? t("portfolio.cover_change") : t("portfolio.cover_add")}
            </button>
          </div>
          <input ref={coverInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => changeCover(e.target.files)} />
        </div>
      </section>

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

      {/* Photos, each tagged with the cut it shows */}
      <section aria-labelledby="pf-photos">
        <div className="flex items-baseline justify-between mb-2.5">
          <h4 id="pf-photos" className="text-[11px] font-semibold uppercase tracking-[0.8px] text-white/45">{t("portfolio.photos_title")}</h4>
          <span className={`text-xs font-semibold ${untagged ? "text-[var(--accent-color)]" : "text-white/45"}`}>
            {t("portfolio.count", { n: photos.length, max: MAX_PHOTOS })}
            {photos.length > 0 && ` · ${untagged ? t("portfolio.need_cut", { n: untagged }) : t("portfolio.all_tagged")}`}
          </span>
        </div>
        {photos.length + uploading > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p, i) => {
              const s = serviceOf(p.service_id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSheet({ photoId: p.id, fresh: false })}
                  aria-label={s ? t("portfolio.photo_tagged_aria", { n: i + 1, cut: s.name }) : t("portfolio.photo_untagged_aria", { n: i + 1 })}
                  className={`relative aspect-[4/5] rounded-xl overflow-hidden bg-white/[0.05] border transition-transform active:scale-[0.97] ${sheet?.photoId === p.id ? "border-[var(--accent-color)]" : "border-white/[0.06]"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.thumb_url ?? p.url} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                  <span className="absolute left-1.5 top-1.5 min-w-5 h-5 px-1 rounded-md bg-black/70 text-[11px] font-semibold text-[#fff] flex items-center justify-center">{i + 1}</span>
                  <span
                    className={`absolute inset-x-1.5 bottom-1.5 min-h-6 px-1.5 py-[3px] rounded-[7px] text-[11px] leading-tight font-semibold flex items-center justify-center text-center ${
                      s ? "bg-black/70 text-[#fff]" : "bg-[var(--accent-color)] text-[var(--accent-fg)]"
                    }`}
                  >
                    {s ? s.name : `+ ${t("portfolio.add_cut")}`}
                  </span>
                </button>
              );
            })}
            {Array.from({ length: uploading }).map((_, i) => (
              <div key={`up-${i}`} className="aspect-[4/5] rounded-xl bg-white/[0.07] animate-pulse" />
            ))}
          </div>
        )}
        {photos.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="mt-2.5 w-full min-h-[50px] rounded-xl border border-dashed border-[var(--accent-color)]/50 bg-[var(--accent-color)]/[0.06] text-[var(--accent-color)] text-sm font-semibold flex items-center justify-center gap-2"
          >
            <ImagePlus className="w-[18px] h-[18px]" /> {t("portfolio.add_photos")}
          </button>
        )}
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => addPhotos(e.target.files)} />
        <p className="text-xs text-white/50 mt-2.5 leading-relaxed">{t("portfolio.tag_hint", { max: MAX_PHOTOS })}</p>
      </section>

      {message && (
        <p role={message.kind === "error" ? "alert" : "status"} className={`text-xs ${message.kind === "ok" ? "text-[var(--accent-color)]" : "text-[var(--app-danger)]"}`}>{message.text}</p>
      )}

      {sheet && (() => {
        const index = photos.findIndex((p) => p.id === sheet.photoId);
        const photo = photos[index];
        if (!photo) return null;
        return (
          <TagSheet
            key={photo.id}
            photo={photo}
            index={index}
            total={photos.length}
            fresh={sheet.fresh}
            services={services}
            onClose={() => (sheet.fresh ? nextInQueue() : setSheet(null))}
            onSave={async (body, done) => {
              const err = await saveTag(photo.id, body);
              if (err) return err;
              flash(done);
              if (sheet.fresh) nextInQueue();
              else setSheet(null);
              return null;
            }}
            onSkip={() => {
              flash(t("portfolio.toast_skipped"));
              nextInQueue();
            }}
            onDelete={async () => {
              if (await removePhoto(photo.id)) setSheet(null);
            }}
            onMove={(dir) => move(photo.id, dir)}
          />
        );
      })()}
    </div>
  );
}

/** "Which cut is this?": pick one of their services, add a new cut, or leave it untagged. */
function TagSheet({
  photo,
  index,
  total,
  fresh,
  services,
  onClose,
  onSave,
  onSkip,
  onDelete,
  onMove,
}: {
  photo: Photo;
  index: number;
  total: number;
  fresh: boolean;
  services: Service[];
  onClose: () => void;
  onSave: (body: { serviceId: string | null } | { newService: object }, done: string) => Promise<string | null>;
  onSkip: () => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const t = useT();
  const [pick, setPick] = useState<string | null>(photo.service_id);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [details, setDetails] = useState("");
  const [price, setPrice] = useState("");
  const [minutes, setMinutes] = useState(45);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const tagged = !!photo.service_id;

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  // Focus moves into the sheet once, when it opens; Escape closes it.
  useEffect(() => {
    panel.current?.querySelector<HTMLElement>("[role=radio], button")?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeRef.current(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function save(body: { serviceId: string | null } | { newService: object }, done: string) {
    setBusy(true);
    setError("");
    const err = await onSave(body, done);
    setBusy(false);
    if (err) setError(err);
  }

  async function addCut(e: React.FormEvent) {
    e.preventDefault();
    const clean = name.trim();
    const amount = Number(price);
    if (!clean) return setError(t("portfolio.err_name_needed"));
    if (services.some((s) => s.name.trim().toLowerCase() === clean.toLowerCase())) return setError(t("portfolio.err_cut_exists", { name: clean }));
    if (!Number.isFinite(amount) || amount < 1 || amount > 999) return setError(t("portfolio.err_price_needed"));
    await save({ newService: { name: clean, description: details.trim() || null, price: amount, duration: minutes } }, t("portfolio.toast_new_cut", { cut: clean }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div aria-hidden className="absolute inset-0 bg-black/55 animate-in fade-in duration-200" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tag-title"
        className="relative w-full max-w-md max-h-[88dvh] overflow-y-auto rounded-t-[22px] bg-[var(--app-card)] border-t border-white/[0.08] px-5 pt-2.5 pb-[calc(24px+env(safe-area-inset-bottom))] space-y-4 animate-in slide-in-from-bottom duration-300"
      >
        <div aria-hidden className="mx-auto w-10 h-1 rounded-full bg-white/20" />
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.thumb_url ?? photo.url} alt="" className="w-[52px] h-16 rounded-[9px] object-cover shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.6px] text-[var(--accent-color)]">
              {fresh ? t("portfolio.sheet_new") : t("portfolio.sheet_photo", { n: index + 1 })}
            </p>
            <h2 id="tag-title" className="font-heading text-[22px] font-semibold leading-tight">{t("portfolio.which_cut")}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={t("common.close")} className="w-11 h-11 shrink-0 rounded-full bg-white/[0.07] flex items-center justify-center">
            <X className="w-[18px] h-[18px]" />
          </button>
        </div>

        {!adding ? (
          <>
            <div role="radiogroup" aria-label={t("portfolio.your_services")} className="flex flex-wrap gap-2">
              {services.map((s) => {
                const on = pick === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setPick(on ? null : s.id)}
                    className={`min-h-11 px-3.5 rounded-full border text-sm font-semibold inline-flex items-center gap-2 transition-colors ${
                      on ? "bg-[var(--accent-color)] border-[var(--accent-color)] text-[var(--accent-fg)]" : "border-white/[0.14] text-white/85"
                    }`}
                  >
                    {s.name} <span className="font-medium opacity-75">{money(s.price)}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => { setAdding(true); setError(""); }}
                className="min-h-11 px-3.5 rounded-full border border-dashed border-[var(--accent-color)]/60 text-[var(--accent-color)] text-sm font-bold inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" strokeWidth={2.6} /> {t("portfolio.new_cut")}
              </button>
            </div>
            <p className="text-xs text-white/50">{t("portfolio.services_note")}</p>
            {error && <p role="alert" className="text-[13px] text-[var(--app-danger)]">{error}</p>}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (fresh) onSkip();
                  else if (tagged) save({ serviceId: null }, t("portfolio.toast_untagged"));
                  else onClose();
                }}
                className="min-h-[50px] rounded-[14px] border border-white/[0.12] text-[15px] font-semibold disabled:opacity-50"
              >
                {fresh ? t("portfolio.skip") : tagged ? t("portfolio.remove_tag") : t("common.cancel")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (!pick) return fresh ? onSkip() : onClose();
                  if (pick === photo.service_id) return onClose();
                  const s = services.find((x) => x.id === pick);
                  save({ serviceId: pick }, t("portfolio.toast_tagged", { cut: s?.name ?? "" }));
                }}
                className="min-h-[50px] rounded-[14px] bg-[var(--accent-color)] text-[var(--accent-fg)] text-[15px] font-bold disabled:opacity-50"
              >
                {busy ? t("portfolio.saving") : t("portfolio.save")}
              </button>
            </div>
            {!fresh && (
              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => onMove(-1)} disabled={index === 0} className="min-h-11 px-3 rounded-xl border border-white/[0.1] text-xs font-semibold text-white/75 disabled:opacity-30">
                    {t("portfolio.move_earlier_btn")}
                  </button>
                  <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} className="min-h-11 px-3 rounded-xl border border-white/[0.1] text-xs font-semibold text-white/75 disabled:opacity-30">
                    {t("portfolio.move_later_btn")}
                  </button>
                </div>
                <button type="button" onClick={onDelete} className="min-h-11 px-2 text-sm font-semibold text-[var(--app-danger)]">
                  {t("portfolio.delete_photo")}
                </button>
              </div>
            )}
          </>
        ) : (
          <form onSubmit={addCut} className="space-y-3">
            <label className="block space-y-1.5">
              <span className="text-[13px] font-semibold text-white/60">{t("portfolio.cut_name")}</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                autoComplete="off"
                placeholder={t("portfolio.cut_name_placeholder")}
                className="w-full h-12 px-3.5 rounded-xl border border-white/[0.1] bg-white/[0.04] text-base text-white placeholder:text-white/30 focus:outline-none focus:border-[var(--accent-color)]"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[13px] font-semibold text-white/60">{t("portfolio.cut_details")}</span>
              <input
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={80}
                autoComplete="off"
                placeholder={t("portfolio.cut_details_placeholder")}
                className="w-full h-12 px-3.5 rounded-xl border border-white/[0.1] bg-white/[0.04] text-base text-white placeholder:text-white/30 focus:outline-none focus:border-[var(--accent-color)]"
              />
            </label>
            <div className="grid grid-cols-[110px_1fr] gap-3">
              <label className="block space-y-1.5">
                <span className="text-[13px] font-semibold text-white/60">{t("portfolio.cut_price")}</span>
                <span className="relative block">
                  <span aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50">$</span>
                  <input
                    value={price}
                    onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))}
                    inputMode="decimal"
                    placeholder="40"
                    className="w-full h-12 pl-6 pr-3 rounded-xl border border-white/[0.1] bg-white/[0.04] text-base text-white placeholder:text-white/30 focus:outline-none focus:border-[var(--accent-color)]"
                  />
                </span>
              </label>
              <div>
                <p id="cut-len" className="text-[13px] font-semibold text-white/60 mb-1.5">{t("portfolio.cut_length")}</p>
                <div role="radiogroup" aria-labelledby="cut-len" className="grid grid-cols-3 gap-1.5">
                  {LENGTHS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={minutes === m}
                      onClick={() => setMinutes(m)}
                      className={`h-12 rounded-xl border text-[13px] font-semibold ${minutes === m ? "bg-[var(--accent-color)] border-[var(--accent-color)] text-[var(--accent-fg)]" : "border-white/[0.1] text-white/80"}`}
                    >
                      {t("portfolio.min_short", { n: m })}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {error && <p role="alert" className="text-[13px] text-[var(--app-danger)]">{error}</p>}
            <p className="text-xs text-white/50">{t("portfolio.new_cut_note")}</p>
            <div className="grid grid-cols-2 gap-2.5">
              <button type="button" onClick={() => { setAdding(false); setError(""); }} className="min-h-[50px] rounded-[14px] border border-white/[0.12] text-[15px] font-semibold">
                {t("common.back")}
              </button>
              <button type="submit" disabled={busy} className="min-h-[50px] rounded-[14px] bg-[var(--accent-color)] text-[var(--accent-fg)] text-[15px] font-bold disabled:opacity-50">
                {busy ? t("portfolio.saving") : t("portfolio.add_cut_btn")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

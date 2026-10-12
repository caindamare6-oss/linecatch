"use client";

import { useState } from "react";
import { Bebas_Neue } from "next/font/google";
import { Check, Copy, Download, Share2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import { Card } from "./ui";

const poster = Bebas_Neue({ subsets: ["latin"], weight: "400", display: "swap" });

const STORY_W = 1080;
const STORY_H = 1920;

/**
 * "Share your page": the barber's link everywhere their clients already are (Instagram bio and
 * stories, TikTok, texts). Copy, the phone's share sheet, and a ready-made story image.
 */
export default function ShareCard({ pageUrl, shopName, coverUrl, compact = false }: { pageUrl: string; shopName: string; coverUrl: string | null; compact?: boolean }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [story, setStory] = useState<{ url: string; file: File } | null>(null);
  const [making, setMaking] = useState(false);
  const [error, setError] = useState("");
  const shown = pageUrl.replace(/^https?:\/\//, "");
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function copy() {
    try {
      await navigator.clipboard.writeText(pageUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setError(t("share.copy_failed"));
    }
  }

  async function share() {
    try {
      await navigator.share({ title: shopName, text: t("share.share_text", { shop: shopName }), url: pageUrl });
    } catch {
      /* closed the share sheet */
    }
  }

  async function makeStory() {
    setError("");
    setMaking(true);
    try {
      const file = await drawStory({ shopName, coverUrl, link: shown, font: poster.style.fontFamily, labels: { book: t("share.story_book"), tap: t("share.story_tap") } });
      setStory((old) => {
        if (old) URL.revokeObjectURL(old.url);
        return { url: URL.createObjectURL(file), file };
      });
    } catch {
      setError(t("share.story_failed"));
    } finally {
      setMaking(false);
    }
  }

  async function shareStory() {
    if (!story) return;
    const data = { files: [story.file], title: shopName };
    if (navigator.canShare?.(data)) {
      try {
        await navigator.share(data);
        return;
      } catch {
        return; // closed the share sheet
      }
    }
    // No file sharing (most computers): save it instead.
    const a = document.createElement("a");
    a.href = story.url;
    a.download = story.file.name;
    a.click();
  }

  return (
    <Card className="p-4 space-y-3.5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.8px] text-white/45">{t("share.title")}</p>
        {!compact && <p className="text-[13px] text-white/60 mt-1 leading-snug">{t("share.body")}</p>}
      </div>

      <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/[0.08] pl-3.5 pr-1.5 py-1.5">
        <span className="flex-1 min-w-0 truncate text-sm font-semibold text-white/85">{shown}</span>
        <button type="button" onClick={copy} className="shrink-0 min-h-10 px-3 rounded-lg text-[13px] font-semibold text-[var(--accent-color)] inline-flex items-center gap-1.5">
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? t("common.copied") : t("common.copy")}
        </button>
      </div>

      <div className={`grid gap-2 ${canShare ? "grid-cols-2" : "grid-cols-1"}`}>
        {canShare && (
          <button type="button" onClick={share} className="min-h-11 rounded-xl bg-[var(--accent-color)] text-[var(--accent-fg)] text-sm font-semibold inline-flex items-center justify-center gap-2">
            <Share2 className="w-4 h-4" /> {t("share.share")}
          </button>
        )}
        <button
          type="button"
          onClick={makeStory}
          disabled={making}
          className={`min-h-11 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 ${canShare ? "border border-white/[0.12] text-white/85" : "bg-[var(--accent-color)] text-[var(--accent-fg)]"}`}
        >
          {making ? t("share.story_making") : t("share.story")}
        </button>
      </div>

      {story && (
        <div className="flex gap-3 items-center rounded-xl bg-white/[0.03] border border-white/[0.06] p-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={story.url} alt={t("share.story_alt", { shop: shopName })} className="w-[72px] aspect-[9/16] rounded-lg object-cover shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-[13px] text-white/70 leading-snug">{t("share.story_ready")}</p>
            <button type="button" onClick={shareStory} className="min-h-10 px-3.5 rounded-lg bg-[var(--accent-color)] text-[var(--accent-fg)] text-[13px] font-semibold inline-flex items-center gap-1.5">
              <Download className="w-4 h-4" /> {t("share.story_save")}
            </button>
          </div>
        </div>
      )}

      {error && <p role="alert" className="text-xs text-[var(--app-danger)]">{error}</p>}

      {!compact && (
        <ul className="space-y-1.5 text-[12px] text-white/55 leading-relaxed">
          <li><span className="font-semibold text-white/75">{t("share.tip_bio_title")}</span> {t("share.tip_bio")}</li>
          <li><span className="font-semibold text-white/75">{t("share.tip_story_title")}</span> {t("share.tip_story")}</li>
          <li><span className="font-semibold text-white/75">{t("share.tip_text_title")}</span> {t("share.tip_text")}</li>
        </ul>
      )}
    </Card>
  );
}

/** A 1080×1920 story: their cover photo, shop name, "Book your next cut" and the link, in their colors. */
async function drawStory(opts: { shopName: string; coverUrl: string | null; link: string; font: string; labels: { book: string; tap: string } }): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = STORY_W;
  canvas.height = STORY_H;
  const ctx = canvas.getContext("2d")!;
  const css = getComputedStyle(document.documentElement);
  const bg = resolveColor(css.getPropertyValue("--app-bg").trim() || "#121110");
  const fg = resolveColor(css.getPropertyValue("--app-fg").trim() || "#F2EEE6");
  const accent = resolveColor(css.getPropertyValue("--accent-color").trim() || "#D4AF7A");
  const accentFg = resolveColor(css.getPropertyValue("--accent-fg").trim() || "#121110");

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, STORY_W, STORY_H);

  const photoH = 1220;
  if (opts.coverUrl) {
    const img = await loadImage(opts.coverUrl);
    const scale = Math.max(STORY_W / img.width, photoH / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    // Keep the photo inside its area so it never shows under the text.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, STORY_W, photoH);
    ctx.clip();
    ctx.drawImage(img, (STORY_W - w) / 2, (photoH - h) / 2, w, h);
    ctx.restore();
  } else {
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.18;
    ctx.fillRect(0, 0, STORY_W, photoH);
    ctx.globalAlpha = 1;
  }
  const fade = ctx.createLinearGradient(0, photoH - 520, 0, photoH);
  fade.addColorStop(0, "rgba(0,0,0,0)");
  fade.addColorStop(1, bg);
  ctx.fillStyle = fade;
  ctx.fillRect(0, photoH - 520, STORY_W, 520);

  await document.fonts.load(`200px ${opts.font}`).catch(() => {});
  const face = `${opts.font}, Impact, "Arial Narrow", sans-serif`;
  ctx.textAlign = "center";

  // Shop name, shrunk to fit.
  let size = 210;
  ctx.font = `${size}px ${face}`;
  while (ctx.measureText(opts.shopName.toUpperCase()).width > STORY_W - 140 && size > 90) {
    size -= 8;
    ctx.font = `${size}px ${face}`;
  }
  ctx.fillStyle = fg;
  ctx.fillText(opts.shopName.toUpperCase(), STORY_W / 2, 1290);

  ctx.font = `92px ${face}`;
  ctx.fillStyle = accent;
  ctx.fillText(opts.labels.book.toUpperCase(), STORY_W / 2, 1420);

  // The link, on a pill in their accent color.
  ctx.font = `600 54px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const pillW = Math.min(STORY_W - 120, ctx.measureText(opts.link).width + 120);
  const pillX = (STORY_W - pillW) / 2;
  ctx.fillStyle = accent;
  roundRect(ctx, pillX, 1500, pillW, 130, 65);
  ctx.fill();
  ctx.fillStyle = accentFg;
  ctx.fillText(opts.link, STORY_W / 2, 1584, STORY_W - 160);

  ctx.font = `44px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.fillStyle = fg;
  ctx.globalAlpha = 0.7;
  ctx.fillText(opts.labels.tap, STORY_W / 2, 1720);
  ctx.globalAlpha = 0.45;
  ctx.font = `36px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.fillText("LineCatch", STORY_W / 2, 1840);
  ctx.globalAlpha = 1;

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("story");
  const slug = opts.shopName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "my-page";
  return new File([blob], `${slug}-story.png`, { type: "image/png" });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Turns a CSS color (including color-mix) into something a canvas understands. */
function resolveColor(value: string): string {
  const el = document.createElement("span");
  el.style.color = value;
  document.body.appendChild(el);
  const out = getComputedStyle(el).color;
  el.remove();
  return out || value;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

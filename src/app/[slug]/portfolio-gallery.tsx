"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PORTFOLIO_COPY, type Lang } from "@/lib/portfolio-copy";

type Photo = { id: string; url: string; thumb_url: string | null; width: number | null; height: number | null };

/** Which column each tile lands in (2 columns, some tiles 2 rows tall), so it flies off its own side. */
function columnsFor(spans: number[]): number[] {
  const taken = new Set<string>();
  const cols: number[] = [];
  let row = 0;
  let col = 0;
  for (const span of spans) {
    for (;;) {
      let free = true;
      for (let r = row; r < row + span; r++) if (taken.has(`${r}:${col}`)) free = false;
      if (free) break;
      col++;
      if (col > 1) { col = 0; row++; }
    }
    for (let r = row; r < row + span; r++) taken.add(`${r}:${col}`);
    cols.push(col);
    col++;
    if (col > 1) { col = 0; row++; }
  }
  return cols;
}

export default function PortfolioGallery({
  photos,
  lang,
  shopName,
  bookHref,
}: {
  photos: Photo[];
  lang: Lang;
  shopName: string;
  bookHref: string;
}) {
  const copy = PORTFOLIO_COPY[lang];
  const [open, setOpen] = useState<number | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const touchX = useRef<number | null>(null);

  const count = photos.length;
  const step = useCallback((dir: number) => setOpen((o) => (o === null ? o : (o + dir + count) % count)), [count]);

  useEffect(() => {
    if (open === null) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, step]);

  if (count === 0) {
    return (
      <div className="rounded-2xl border border-[var(--t-border)] bg-[var(--t-surface)] text-[var(--t-tile-icon)] py-14 flex flex-col items-center gap-2">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
        </svg>
        <span className="text-sm text-[var(--t-muted)]">{copy.noPhotos}</span>
      </div>
    );
  }

  const spans = photos.map((_, i) => (count >= 4 && (i === 0 || i === 3) ? 2 : 1));
  const cols = columnsFor(spans);
  const current = open !== null ? photos[open] : null;

  return (
    <>
      <div className="grid grid-cols-2 auto-rows-[150px] gap-2.5">
        {photos.map((p, i) => (
          <div key={p.id} className={`${spans[i] === 2 ? "row-span-2" : ""} ${cols[i] === 0 ? "pf-fly-left" : "pf-fly-right"}`}>
            <button
              type="button"
              onClick={() => setOpen(i)}
              aria-label={copy.open(i + 1)}
              className={`${i < 2 ? "" : "pf-reveal "}relative block w-full h-full overflow-hidden rounded-2xl bg-[var(--t-tile)] border border-[var(--t-border)] transition-[border-color,box-shadow] duration-300 hover:border-[var(--t-accent)] hover:shadow-[0_0_24px_var(--t-glow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--t-accent)]`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.thumb_url ?? p.url}
                alt={`${shopName}, ${copy.photoOf(i + 1, count).toLowerCase()}`}
                width={p.width ?? undefined}
                height={p.height ?? undefined}
                // The first row sits at the fold on phones; everything after it waits until scrolled near.
                loading={i < 2 ? "eager" : "lazy"}
                decoding={i < 2 ? "sync" : "async"}
                className="absolute inset-0 w-full h-full object-cover"
              />
            </button>
          </div>
        ))}
      </div>

      {current && open !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={copy.photoOf(open + 1, count)}
          className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white px-5 pt-5 pb-8"
          onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            if (touchX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
            touchX.current = null;
          }}
        >
          <div className="mx-auto w-full max-w-[520px] flex items-center justify-between">
            <span className="text-sm text-white/70">{copy.photoOf(open + 1, count)}</span>
            <button
              ref={closeRef}
              type="button"
              onClick={() => setOpen(null)}
              aria-label={copy.close}
              className="w-12 h-12 rounded-2xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center min-h-0 py-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={current.id} src={current.url} alt="" className="max-h-full max-w-full rounded-2xl object-contain" />
          </div>
          <div className="mx-auto w-full max-w-[520px] flex items-center gap-3">
            <button type="button" onClick={() => step(-1)} aria-label={copy.prev} className="w-12 h-12 shrink-0 rounded-2xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <a href={bookHref} className="flex-1 h-12 rounded-2xl bg-[var(--t-cta-bg)] text-[var(--t-cta-text)] shadow-[0_0_24px_var(--t-glow)] text-[15px] font-bold flex items-center justify-center">
              {copy.bookThisLook}
            </a>
            <button type="button" onClick={() => step(1)} aria-label={copy.next} className="w-12 h-12 shrink-0 rounded-2xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useAnimationFrame, useMotionValue, useMotionValueEvent, useReducedMotion, type AnimationPlaybackControls } from "motion/react";
import { useT } from "@/lib/i18n";
import { facePhoto as faceAngle, frontIndex, ringGeometry, stepAngle } from "@/lib/ring";

export type RingPhoto = { id: string; thumb: string; label: string; sub: string | null };

const CARD_W = 112;
const CARD_H = 156;
const GAP = 10;
const SPIN = 0.012; // degrees per ms, about 12° a second
const DRAG = 0.42; // degrees per px
const PERSPECTIVE = 1000;

/**
 * The barber's photos on a slowly spinning 3D ring. Drag to spin (it glides and springs to face a
 * photo), arrow keys or Prev/Next to step, Pause to stop it, tap a photo to open it.
 * Only real photos are placed; the ring grows with the count (up to 50).
 */
export default function CutRing({ photos, onOpen, onFront }: { photos: RingPhoto[]; onOpen: (index: number) => void; onFront?: (index: number) => void }) {
  const t = useT();
  const reduced = useReducedMotion();
  const n = photos.length;
  const { slots, step, radius } = ringGeometry(n, CARD_W, GAP);
  const rot = useMotionValue(0);
  const [front, setFront] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [focused, setFocused] = useState(false);
  const drag = useRef<{ last: number; t: number; v: number; moved: number } | null>(null);
  const coast = useRef<AnimationPlaybackControls | null>(null);
  const holdUntil = useRef(0);
  const lastPan = useRef(0);

  const frontOf = (v: number) => frontIndex(v, n);

  useMotionValueEvent(rot, "change", (v) => {
    const i = frontOf(v);
    setFront((cur) => (cur === i ? cur : i));
  });
  useEffect(() => {
    onFront?.(front);
  }, [front, onFront]);

  useAnimationFrame((_, delta) => {
    if (reduced || !playing || focused || drag.current || coast.current || n < 2) return;
    if (performance.now() < holdUntil.current) return;
    rot.set(rot.get() - Math.min(delta, 64) * SPIN);
  });

  const facePhoto = (angle: number) => faceAngle(angle, n);

  const springTo = (target: number, velocity = 0) => {
    coast.current?.stop();
    if (reduced) {
      rot.set(target);
      coast.current = null;
      holdUntil.current = performance.now() + 2500;
      return;
    }
    const controls = animate(rot, target, { type: "spring", velocity, stiffness: 90, damping: 20 });
    coast.current = controls;
    controls.then(() => {
      if (coast.current === controls) coast.current = null;
      holdUntil.current = performance.now() + 2500;
    });
  };

  /** Next/previous photo; from the last photo "next" wraps to the first across any empty places. */
  const stepBy = (dir: 1 | -1) => {
    holdUntil.current = performance.now() + 3000;
    springTo(stepAngle(rot.get(), dir, n));
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const now = performance.now();
      const dx = e.clientX - d.last;
      d.v = (dx / Math.max(1, now - d.t)) * 1000 * 0.6 + d.v * 0.4;
      d.last = e.clientX;
      d.t = now;
      d.moved += Math.abs(dx);
      rot.set(rot.get() + dx * DRAG);
    };
    const up = () => {
      const d = drag.current;
      if (!d) return;
      drag.current = null;
      holdUntil.current = performance.now() + 2500;
      if (d.moved > 6) {
        lastPan.current = performance.now();
        // Momentum: project the flick (capped), face the nearest photo, spring there.
        const v = performance.now() - d.t > 80 ? 0 : Math.max(-900, Math.min(900, d.v * DRAG));
        springTo(facePhoto(rot.get() + v * 0.32), v);
      } else if (n) {
        springTo(facePhoto(rot.get()));
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      coast.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- listeners read refs and the motion value
  }, [n, slots, step, reduced]);

  // Keep the transform in sync without re-rendering every frame.
  const spinRef = useRef<HTMLDivElement>(null);
  useMotionValueEvent(rot, "change", (v) => {
    if (spinRef.current) spinRef.current.style.transform = `translateZ(${-radius}px) rotateY(${v}deg)`;
  });

  if (!n) return null;

  return (
    <div>
      <div
        role="region"
        aria-roledescription="carousel"
        aria-label={t("shop.ring_label")}
        tabIndex={0}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          coast.current?.stop();
          coast.current = null;
          drag.current = { last: e.clientX, t: performance.now(), v: 0, moved: 0 };
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") { e.preventDefault(); stepBy(1); }
          if (e.key === "ArrowLeft") { e.preventDefault(); stepBy(-1); }
        }}
        onFocus={() => setFocused(true)}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false); }}
        className="relative h-[330px] -mx-5 overflow-hidden select-none cursor-grab active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-[var(--t-accent)]"
        style={{ perspective: `${PERSPECTIVE}px`, touchAction: "pan-y" }}
      >
        <div aria-hidden className="absolute left-1/2 top-[250px] w-[320px] h-14 -ml-40 rounded-full blur-md" style={{ background: "radial-gradient(closest-side, var(--t-glow), transparent)" }} />
        <div className="absolute left-1/2 top-[56px] w-0 h-0" style={{ transformStyle: "preserve-3d", transform: "rotateX(-6deg)" }}>
          <div ref={spinRef} className="absolute will-change-transform" style={{ transformStyle: "preserve-3d", transform: `translateZ(${-radius}px) rotateY(0deg)` }}>
            {photos.map((p, i) => (
              <button
                key={p.id}
                type="button"
                aria-label={t("shop.open_cut", { name: p.label })}
                onClick={() => {
                  if (performance.now() - lastPan.current < 250) return;
                  onOpen(i);
                }}
                className="absolute p-0 rounded-2xl overflow-hidden border border-[var(--t-border)] bg-[var(--t-tile)] text-left [backface-visibility:hidden] focus-visible:outline-2 focus-visible:outline-[var(--t-accent)]"
                style={{
                  width: CARD_W,
                  height: CARD_H,
                  left: -CARD_W / 2,
                  transform: `rotateY(${i * step}deg) translateZ(${radius}px)`,
                  boxShadow: "0 0 26px var(--t-glow)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.thumb} alt="" draggable={false} loading={i < 6 ? "eager" : "lazy"} className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
                <span className="absolute inset-x-0 bottom-0 px-2.5 pb-2 pt-6 text-[11px] font-semibold leading-tight text-[#fff]" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.75), transparent)" }}>
                  {p.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div aria-live="polite" className="flex items-end justify-between gap-3 min-h-[34px]">
        <p className="font-[family-name:var(--font-poster)] text-[30px] leading-none tracking-[0.01em]">
          {photos[front]?.label} {photos[front]?.sub && <span className="text-[var(--t-accent)]">· {photos[front].sub}</span>}
        </p>
        <p className="text-[13px] font-semibold text-[var(--t-muted)] tabular-nums pb-0.5">
          {String(front + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}
        </p>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <RingButton onClick={() => stepBy(-1)} label={t("shop.prev_photo")}>{t("shop.prev")}</RingButton>
        <RingButton onClick={() => setPlaying((p) => !p)} pressed={!playing}>{playing ? t("shop.pause") : t("shop.play")}</RingButton>
        <RingButton onClick={() => stepBy(1)} label={t("shop.next_photo")}>{t("shop.next")}</RingButton>
      </div>
    </div>
  );
}

function RingButton({ children, onClick, label, pressed }: { children: React.ReactNode; onClick: () => void; label?: string; pressed?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      className="min-h-[46px] rounded-[14px] border border-[var(--t-border)] bg-[var(--t-surface)] text-sm font-semibold active:scale-[0.97] transition-transform focus-visible:outline-2 focus-visible:outline-[var(--t-accent)]"
    >
      {children}
    </button>
  );
}

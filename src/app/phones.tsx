"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  AnimatePresence, animate, motion, useInView, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform,
  type HTMLMotionProps,
} from "motion/react";
import { Check, MessageCircle, Phone as PhoneIcon, PhoneMissed, PhoneOff, Scissors, X } from "lucide-react";
import CutRing, { type RingPhoto } from "./[slug]/cut-ring";
import { THEMES, themeVars } from "@/lib/themes";

const EASE = [0.16, 1, 0.3, 1] as const;
const DEPTH = 12; // px of phone body stacked behind the screen

/** A 3D phone: a stack of rounded slabs behind the screen gives it real thickness when it turns. */
export function Phone({ children, ...motionProps }: { children: ReactNode } & Omit<HTMLMotionProps<"div">, "children">) {
  return (
    <div className="relative mx-auto h-[620px] w-[300px]" style={{ perspective: 1600 }}>
      <div aria-hidden className="absolute -bottom-12 left-1/2 h-12 w-[240px] -translate-x-1/2 rounded-full bg-black/70 blur-2xl" />
      <motion.div {...motionProps} className="absolute inset-0" style={{ transformStyle: "preserve-3d", ...motionProps.style }}>
        {Array.from({ length: DEPTH }, (_, i) => (
          <div
            key={i}
            aria-hidden
            className="absolute inset-0 rounded-[52px]"
            style={{
              transform: `translateZ(${-(i + 1)}px)`,
              background: i === DEPTH - 1 ? "#1a1816" : "linear-gradient(135deg, #6b6052, #2a2622 40%, #554c41 70%, #2a2622)",
            }}
          />
        ))}
        <div className="absolute inset-0 rounded-[52px] bg-[#0b0a09] p-[10px] shadow-[inset_0_0_0_1.5px_rgba(212,175,122,0.35)]">
          <div className="relative h-full w-full overflow-hidden rounded-[42px] bg-[var(--app-bg)] text-[var(--app-fg)]">
            {children}
            <div aria-hidden className="pointer-events-none absolute left-1/2 top-2.5 z-30 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-black" />
            <div aria-hidden className="pointer-events-none absolute inset-0 z-30 bg-[linear-gradient(115deg,rgba(255,255,255,0.09),transparent_32%)]" />
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ───────────────────────── Hero: the app story, playing on a loop ───────────────────────── */

const SCENES = [
  { label: "A client calls", ms: 3200, Screen: CallScene },
  { label: "You can't pick up", ms: 3600, Screen: MissedScene },
  { label: "They get a text", ms: 4400, Screen: TextScene },
  { label: "They book", ms: 4800, Screen: BookScene },
  { label: "You get the cut", ms: 4600, Screen: DashScene },
];

export function StoryPhone() {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3 });
  const [scene, setScene] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const id = setTimeout(() => setScene((s) => (s + 1) % SCENES.length), SCENES[scene].ms);
    return () => clearTimeout(id);
  }, [scene, inView]);

  // Tilt: follows the pointer, and turns as the hero scrolls away.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 50, damping: 14 });
  const sy = useSpring(py, { stiffness: 50, damping: 14 });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const rotateY = useTransform(() => (reduced ? -10 : -16 + sx.get() * 18 + scrollYProgress.get() * 40));
  const rotateX = useTransform(() => (reduced ? 4 : 6 - sy.get() * 12 - scrollYProgress.get() * 12));

  useEffect(() => {
    if (reduced) return;
    const move = (e: PointerEvent) => {
      px.set(e.clientX / window.innerWidth - 0.5);
      py.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, [reduced, px, py]);

  const { Screen } = SCENES[scene];
  return (
    <div ref={ref}>
      <motion.div animate={reduced ? undefined : { y: [0, -12, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}>
        <Phone style={{ rotateX, rotateY }} aria-label={`LineCatch demo, step ${scene + 1} of ${SCENES.length}: ${SCENES[scene].label}`} role="img">
          <StatusBar />
          <AnimatePresence initial={false}>
            <motion.div
              key={scene}
              className="absolute inset-0 pt-11"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.03 }}
              transition={{ duration: 0.45, ease: EASE }}
            >
              <Screen />
            </motion.div>
          </AnimatePresence>
        </Phone>
      </motion.div>

      <ol className="mt-16 flex flex-wrap justify-center gap-2">
        {SCENES.map((s, i) => (
          <li key={s.label}>
            <button
              type="button"
              onClick={() => setScene(i)}
              aria-current={i === scene ? "step" : undefined}
              className={`relative min-h-[44px] overflow-hidden rounded-full border px-3.5 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-mint ${
                i === scene ? "border-mint/50 text-white" : "border-white/10 text-[var(--app-muted)] hover:text-white"
              }`}
            >
              {i === scene && (
                <motion.span
                  key={`bar-${scene}`}
                  aria-hidden
                  className="absolute inset-0 origin-left bg-mint/15"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: s.ms / 1000, ease: "linear" }}
                />
              )}
              <span className="relative">{i + 1}. {s.label}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

function StatusBar() {
  return (
    <div aria-hidden className="absolute inset-x-0 top-0 z-20 flex h-11 items-center justify-between px-7 text-[13px] font-semibold">
      <span>2:14</span>
      <span className="flex items-center gap-1">
        <span className="h-2.5 w-4 rounded-[3px] border border-white/70 p-px"><span className="block h-full w-3/4 rounded-[1px] bg-white" /></span>
      </span>
    </div>
  );
}

function Who({ children }: { children: ReactNode }) {
  return <p className="mx-auto w-fit rounded-full bg-white/[0.07] px-2.5 py-1 text-[11px] font-medium text-[var(--app-muted)]">{children}</p>;
}

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: EASE },
});

function CallScene() {
  return (
    <div className="flex h-full flex-col items-center bg-[radial-gradient(circle_at_50%_32%,#2e2821,var(--app-bg)_70%)] px-6 pb-12">
      <Who>Your phone</Who>
      <p className="mt-9 text-[13px] text-[var(--app-muted)]">incoming call…</p>
      <p className="mt-1 font-heading text-3xl">Marcus J.</p>
      <div className="relative mt-12 grid size-28 place-items-center">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="absolute inset-0 rounded-full border border-mint/50"
            initial={{ scale: 1, opacity: 0.7 }}
            animate={{ scale: 1.9, opacity: 0 }}
            transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.6, ease: "easeOut" }}
          />
        ))}
        <span className="grid size-28 place-items-center rounded-full bg-obsidian-card font-heading text-4xl">M</span>
      </div>
      <motion.p {...rise(0.9)} className="mt-12 inline-flex items-center gap-2 rounded-full bg-mint/15 px-3 py-1.5 text-[13px] text-mint">
        <Scissors className="size-4" /> You&apos;re mid-cut
      </motion.p>
      <div className="mt-auto flex w-full justify-between px-4 text-white">
        <span className="grid size-16 place-items-center rounded-full bg-[#e5484d]"><PhoneOff className="size-6" /></span>
        <motion.span
          animate={{ rotate: [0, -14, 14, -14, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 0.7 }}
          className="grid size-16 place-items-center rounded-full bg-[#3fb950]"
        >
          <PhoneIcon className="size-6" />
        </motion.span>
      </div>
    </div>
  );
}

function Notif({ delay, icon, app, title, body, accent }: { delay: number; icon: ReactNode; app: string; title: string; body: string; accent?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -18, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 22, delay }}
      className={`flex gap-3 rounded-2xl p-3 backdrop-blur ${accent ? "bg-mint/15 ring-1 ring-mint/40" : "bg-white/[0.08]"}`}
    >
      <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${accent ? "bg-mint text-[var(--accent-fg)]" : "bg-white/10"}`}>{icon}</span>
      <span className="min-w-0 text-[13px] leading-snug">
        <span className="block text-[11px] uppercase tracking-wide text-[var(--app-muted)]">{app}</span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-[var(--app-muted)]">{body}</span>
      </span>
    </motion.div>
  );
}

function MissedScene() {
  return (
    <div className="flex h-full flex-col bg-[linear-gradient(#1f1b17,var(--app-bg))] px-4">
      <Who>Your phone</Who>
      <p className="mt-6 text-center font-heading text-6xl tabular-nums">2:14</p>
      <p className="text-center text-[13px] text-[var(--app-muted)]">Thursday, October 9</p>
      <div className="mt-9 space-y-2.5">
        <Notif delay={0.2} icon={<PhoneMissed className="size-4 text-[#ff6b6b]" />} app="Phone" title="Missed call" body="Marcus J." />
        <Notif delay={1.4} accent icon={<MessageCircle className="size-4" />} app="LineCatch" title="Texted Marcus a booking link" body="Sent right after the missed call" />
      </div>
      <motion.p {...rise(2.4)} className="mt-auto pb-12 text-center text-[13px] text-[var(--app-muted)]">
        You didn&apos;t lift a finger.
      </motion.p>
    </div>
  );
}

function TextScene() {
  return (
    <div className="flex h-full flex-col bg-[#0d0c0b]">
      <Who>Their phone</Who>
      <div className="mt-3 flex flex-col items-center border-b border-white/10 pb-3">
        <span className="grid size-11 place-items-center rounded-full bg-obsidian-card font-heading text-lg">FF</span>
        <span className="mt-1 text-[12px]">Fresh Fades</span>
      </div>
      <div className="space-y-2 px-3 pt-4">
        <p className="text-center text-[11px] text-[var(--app-muted)]">Today 2:14 PM</p>
        <div className="relative min-h-[110px]">
          <motion.div
            className="absolute left-0 top-0 flex gap-1 rounded-2xl bg-[#2a2724] px-3.5 py-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0] }}
            transition={{ duration: 1.2, times: [0, 0.15, 0.85, 1] }}
          >
            {[0, 1, 2].map((i) => (
              <motion.span key={i} className="size-1.5 rounded-full bg-white/60" animate={{ y: [0, -3, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
            ))}
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 22, delay: 1.2 }}
            className="relative max-w-[88%] origin-bottom-left rounded-2xl rounded-bl-md bg-[#2a2724] px-3 py-2 text-[14px] leading-snug"
          >
            Fresh Fades: Hey, sorry I missed you! I&apos;m with a client right now. Grab a spot here:{" "}
            <span className="relative text-[#6cb6ff] underline">
              www.linecatch.app/c/Fr3sh8Kd
              <motion.span
                aria-hidden
                className="absolute left-1/2 top-1/2 size-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/40"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [0, 1.6], opacity: [0.6, 0] }}
                transition={{ duration: 0.7, delay: 3 }}
              />
            </span>
          </motion.p>
        </div>
        <motion.p {...rise(3.4)} className="pt-2 text-center text-[12px] text-mint">Opening Fresh Fades…</motion.p>
      </div>
    </div>
  );
}

const TIMES = ["2:30", "3:00", "3:30", "4:00", "4:30", "5:00"];

function BookScene() {
  return (
    <div className="relative flex h-full flex-col px-4 pb-6">
      <Who>Their phone</Who>
      <p className="mt-3 font-heading text-2xl">Fresh Fades</p>
      <p className="text-[12px] text-[var(--app-muted)]">Pick your cut</p>
      <div className="mt-3 space-y-2">
        {[["Taper", "$35"], ["Lineup", "$20"], ["Full Service", "$50"]].map(([name, price], i) => (
          <motion.div
            key={name}
            initial={false}
            animate={i === 0 ? { borderColor: ["rgba(242,238,230,0.1)", "rgba(212,175,122,0.9)"] } : undefined}
            transition={{ delay: 0.5, duration: 0.3 }}
            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[14px]"
          >
            <span>{name}</span>
            <span className="text-[var(--app-muted)]">{price}</span>
          </motion.div>
        ))}
      </div>
      <p className="mt-4 text-[12px] text-[var(--app-muted)]">Thursday, Oct 9</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {TIMES.map((t) => (
          <motion.span
            key={t}
            initial={false}
            animate={t === "3:30" ? { backgroundColor: ["rgba(242,238,230,0.04)", "#D4AF7A"], color: ["#F2EEE6", "#121110"] } : undefined}
            transition={{ delay: 1.4, duration: 0.25 }}
            className="rounded-lg bg-white/[0.04] py-2 text-center text-[13px] font-medium"
          >
            {t}
          </motion.span>
        ))}
      </div>
      <motion.span
        animate={{ scale: [1, 0.95, 1] }}
        transition={{ delay: 2.4, duration: 0.3 }}
        className="mt-auto rounded-xl bg-mint py-3 text-center text-[14px] font-semibold text-[var(--accent-fg)]"
      >
        Book Taper · 3:30 PM
      </motion.span>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.8, duration: 0.3 }}
        className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--app-bg)] px-6 text-center"
      >
        <motion.span
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 14, delay: 3 }}
          className="grid size-20 place-items-center rounded-full bg-mint text-[var(--accent-fg)]"
        >
          <Check className="size-10" strokeWidth={3} />
        </motion.span>
        <p className="mt-5 font-heading text-2xl">You&apos;re booked!</p>
        <p className="mt-1 text-[14px] text-[var(--app-muted)]">Taper · Thu 3:30 PM</p>
        <p className="mt-4 text-[12px] text-[var(--app-muted)]">A reminder text comes before your cut.</p>
      </motion.div>
    </div>
  );
}

function CountUp({ from, to, delay }: { from: number; to: number; delay: number }) {
  const v = useMotionValue(from);
  const text = useTransform(v, (n) => `$${Math.round(n)}`);
  useEffect(() => {
    const c = animate(v, to, { duration: 1.2, delay, ease: "easeOut" });
    return () => c.stop();
  }, [v, to, delay]);
  return <motion.span>{text}</motion.span>;
}

function DashScene() {
  const rows = [
    { name: "Marcus J.", cut: "Taper", time: "3:30 PM", fresh: true },
    { name: "Andre P.", cut: "Lineup", time: "1:00 PM" },
    { name: "Chris D.", cut: "Full Service", time: "11:30 AM" },
  ];
  return (
    <div className="flex h-full flex-col px-4">
      <Who>Your phone</Who>
      <Notif delay={0.2} accent icon={<Check className="size-4" />} app="LineCatch" title="New booking from a missed call" body="Marcus J. · Taper · Thu 3:30 PM" />
      <p className="mt-6 text-[12px] text-[var(--app-muted)]">Caught from missed calls this week</p>
      <p className="font-heading text-5xl text-mint tabular-nums"><CountUp from={70} to={105} delay={0.9} /></p>
      <p className="text-[12px] text-[var(--app-muted)]">3 clients who could&apos;ve gone somewhere else</p>
      <div className="mt-5 space-y-2">
        {rows.map((r, i) => (
          <motion.div
            key={r.name}
            {...(r.fresh ? rise(1.3) : rise(0.4 + i * 0.1))}
            className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-[13px] ${r.fresh ? "bg-mint/12 ring-1 ring-mint/40" : "bg-white/[0.04]"}`}
          >
            <span>
              <span className="block font-semibold">{r.name}</span>
              <span className="text-[var(--app-muted)]">{r.cut}</span>
            </span>
            <span className="text-right">
              <span className="block">{r.time}</span>
              {r.fresh && <span className="text-[11px] text-mint">from a missed call</span>}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── Portfolio: the barber's page on a client's phone ───────────────────────── */

// Placeholder art until real cut photos go in. Swap `thumb` for photo URLs (e.g. /landing/taper.jpg).
const HAIR = [
  "M31 60c0-20 11-31 25-31s25 11 25 31c-7-7-15-10-25-10s-18 3-25 10z",
  "M28 63c-3-27 11-41 28-41s31 14 28 41c-6-11-15-15-28-15s-22 4-28 15z",
  "M24 66c-6-33 12-49 32-49s38 16 32 49c-4-14-16-20-32-20s-28 6-32 20z",
];
export function cutArt(i: number) {
  const hue = [28, 18, 36, 12, 24, 40, 8, 32][i % 8];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 112 156"><defs><linearGradient id="g" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hue} 22% 24%)"/><stop offset="1" stop-color="#121110"/></linearGradient><radialGradient id="l" cx=".3" cy=".2" r=".9"><stop offset="0" stop-color="#D4AF7A" stop-opacity=".35"/><stop offset="1" stop-color="#D4AF7A" stop-opacity="0"/></radialGradient></defs><rect width="112" height="156" fill="url(#g)"/><rect width="112" height="156" fill="url(#l)"/><path d="M12 156c3-30 21-45 44-45s41 15 44 45z" fill="#0d0c0b"/><rect x="47" y="90" width="18" height="24" rx="6" fill="hsl(${hue} 30% 30%)"/><ellipse cx="56" cy="70" rx="24" ry="29" fill="hsl(${hue} 32% 38%)"/><path d="${HAIR[i % 3]}" fill="#141210"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const CUTS: RingPhoto[] = [
  ["Taper", "$35"], ["Skin Fade", "$40"], ["Lineup", "$20"], ["Full Service", "$50"],
  ["Beard Trim", "$15"], ["Burst Fade", "$40"], ["Kids Cut", "$25"], ["Waves", "$35"],
].map(([label, sub], i) => ({ id: String(i), thumb: cutArt(i), label, sub }));

export function PortfolioPhone() {
  const reduced = useReducedMotion();
  const [hover, setHover] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const still = reduced || hover;

  return (
    <div
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setHover(false)}
    >
      {/* Floats and turns on its own; faces you while you use it. */}
      <Phone
        animate={still ? { rotateY: 0, rotateX: 0, y: 0 } : { rotateY: [-26, 26], rotateX: [8, 2], y: [0, -16] }}
        transition={still ? { type: "spring", stiffness: 60, damping: 16 } : { duration: 7, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
      >
        <div style={themeVars(THEMES.gold) as CSSProperties} className="absolute inset-0 overflow-y-auto overscroll-contain bg-[var(--t-bg)] text-[var(--t-text)] [scrollbar-width:none]">
          <header
            className="relative h-[165px] overflow-hidden rounded-b-[28px]"
            style={{ background: "radial-gradient(circle at 30% 25%, color-mix(in srgb, var(--t-accent) 30%, var(--t-tile)), var(--t-tile) 70%)" }}
          >
            <div aria-hidden className="pf2-scan absolute inset-x-0 top-0 h-20" style={{ background: "linear-gradient(to bottom, transparent, color-mix(in srgb, var(--t-accent) 16%, transparent), transparent)" }} />
            <span className="absolute left-4 top-12 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/50 px-2.5 py-1 text-[11px] font-semibold">
              <span className="pf2-pulse size-1.5 rounded-full bg-[var(--t-accent)]" style={{ ["--pf2-pulse" as string]: "color-mix(in srgb, var(--t-accent) 70%, transparent)" }} />
              Open now · till 7 PM
            </span>
            <p className="absolute bottom-4 left-5 font-[family-name:var(--font-poster)] text-[42px] leading-[0.88]">
              FRESH<br /><span className="text-[var(--t-accent)]">FADES</span>
            </p>
          </header>
          <div className="px-5 pb-8 pt-4">
            <div className="flex items-center justify-between rounded-2xl border border-[var(--t-border)] bg-[var(--t-surface)] p-3">
              <span>
                <span className="block text-[11px] text-[var(--t-muted)]">Next opening</span>
                <span className="text-sm font-semibold">Thu 3:30 PM</span>
              </span>
              <span className="rounded-full bg-[var(--t-cta-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--t-cta-text)]">Grab it</span>
            </div>
            <p className="mt-3 font-[family-name:var(--font-poster)] text-2xl tracking-wide">THE WORK</p>
            <CutRing photos={CUTS} onOpen={setOpen} />
            <span className="mt-4 block rounded-[14px] bg-[var(--t-cta-bg)] py-3 text-center text-sm font-semibold text-[var(--t-cta-text)]">Book a cut</span>
          </div>
        </div>

        <AnimatePresence>
          {open !== null && (
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="absolute inset-0 z-20 flex flex-col bg-[#121110] p-4 pt-14"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={CUTS[open].thumb} alt="" className="min-h-0 flex-1 rounded-2xl object-cover" />
              <p className="mt-3 font-[family-name:var(--font-poster)] text-3xl">
                {CUTS[open].label} <span className="text-mint">· {CUTS[open].sub}</span>
              </p>
              <div className="mt-3 grid grid-cols-[auto_1fr] gap-2">
                <button type="button" onClick={() => setOpen(null)} aria-label="Close photo" className="grid size-12 place-items-center rounded-[14px] border border-white/15">
                  <X className="size-5" />
                </button>
                <span className="grid place-items-center rounded-[14px] bg-mint text-sm font-semibold text-[var(--accent-fg)]">Book this cut</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Phone>
    </div>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { MotionConfig, motion, useReducedMotion } from "motion/react";
import { CalendarCheck, Check, MessageCircle, PhoneMissed, Plus } from "lucide-react";
import { PortfolioPhone, StoryPhone } from "./phones";
import { SUPPORT_EMAIL } from "@/lib/config";

const TRIAL = "/login";

function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

function Cta({ children = "Start your 30-day free trial", className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <Link
      href={TRIAL}
      className={`relative inline-flex min-h-[52px] items-center justify-center overflow-hidden rounded-full bg-mint px-7 font-semibold text-[var(--accent-fg)] transition-transform hover:scale-[1.03] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mint ${className}`}
    >
      <span aria-hidden className="pf2-shine absolute inset-y-0 left-0 w-1/4 bg-white/35" />
      <span className="relative">{children}</span>
    </Link>
  );
}

const H2 = "font-heading text-[clamp(2rem,5vw,3.25rem)] font-semibold leading-[1.05] tracking-tight";
const EYEBROW = "text-[13px] font-semibold uppercase tracking-[0.18em] text-mint";

export default function Landing({ qr }: { qr: string }) {
  return (
    <MotionConfig reducedMotion="user">
      <div className="overflow-x-clip bg-[var(--app-bg)] text-[var(--app-fg)]">
        <Nav />
        <Hero />
        <HowItWorks />
        <Calculator />
        <Portfolio />
        <Vip qr={qr} />
        <Quotes />
        <Pricing />
        <Faq />
        <Final />
        <Footer />
      </div>
    </MotionConfig>
  );
}

function Logo() {
  return (
    <span className="font-heading text-xl font-semibold tracking-tight">
      Line<span className="text-mint">Catch</span>
    </span>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[var(--app-bg)]/75 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="LineCatch home"><Logo /></Link>
        <div className="hidden items-center gap-7 text-sm text-[var(--app-muted)] md:flex">
          <a href="#how" className="hover:text-white">How it works</a>
          <a href="#portfolio" className="hover:text-white">Portfolio</a>
          <a href="#pricing" className="hover:text-white">Pricing</a>
          <a href="#faq" className="hover:text-white">FAQ</a>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/login" className="inline-flex min-h-[44px] items-center px-3 text-sm font-medium text-[var(--app-muted)] hover:text-white">Log in</Link>
          <Link href={TRIAL} className="inline-flex min-h-[44px] items-center rounded-full bg-mint px-4 text-sm font-semibold text-[var(--accent-fg)]">Try free</Link>
        </div>
      </nav>
    </header>
  );
}

const words = (text: string, from: number, accent = false) =>
  text.split(" ").map((w, i) => (
    <span key={i} className={`pf2-word ${accent ? "text-mint" : ""}`} style={{ animationDelay: `${from + i * 0.09}s` }}>
      {w}&nbsp;
    </span>
  ));

function Hero() {
  return (
    <section className="relative">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-24 h-[520px] w-[820px] max-w-full -translate-x-1/2 rounded-full bg-mint/10 blur-[120px]" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pb-24 pt-14 sm:px-6 md:grid-cols-[1.1fr_1fr] md:pt-24">
        <div>
          <p className={`pf2-rise ${EYEBROW}`}>Missed-call text back for barbers</p>
          <h1 className="mt-5 font-heading text-[clamp(2.75rem,7vw,5rem)] font-semibold leading-[0.98] tracking-tight">
            {words("You're cutting.", 0.1)}
            <br />
            {words("LineCatch is booking.", 0.35, true)}
          </h1>
          <p className="pf2-rise mt-6 max-w-lg text-lg leading-relaxed text-[var(--app-muted)]" style={{ animationDelay: "0.7s" }}>
            When you can&apos;t pick up, LineCatch texts the caller a link to book with you. They pick a time. You keep cutting.
          </p>
          <div className="pf2-rise mt-9 flex flex-wrap items-center gap-4" style={{ animationDelay: "0.85s" }}>
            <Cta />
            <a href="#how" className="inline-flex min-h-[52px] items-center px-2 font-medium text-[var(--app-muted)] hover:text-white">See how it works ↓</a>
          </div>
          <p className="pf2-rise mt-4 text-sm text-[var(--app-muted)]" style={{ animationDelay: "1s" }}>30 days free · No card needed · Keep your number</p>
        </div>
        <StoryPhone />
      </div>
    </section>
  );
}

const STEPS = [
  { icon: PhoneMissed, title: "You miss a call", body: "You're mid-fade, and your phone rings. Forward unanswered calls to your LineCatch number. Clients still call the number they already have." },
  { icon: MessageCircle, title: "They get a text right away", body: "LineCatch texts them back in your words with a link to your booking page, so they don't call the next shop." },
  { icon: CalendarCheck, title: "They book themselves", body: "They pick a cut and a time. You get the booking, and they get a reminder before the appointment." },
];

function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-20 border-t border-white/[0.06] py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <p className={EYEBROW}>How it works</p>
          <h2 className={`mt-3 max-w-2xl ${H2}`}>Every missed call gets a reply. You don&apos;t have to send it.</h2>
        </Reveal>
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.12}>
              <div className="group h-full rounded-3xl border border-white/[0.08] bg-obsidian-light p-7 transition-colors hover:border-mint/40">
                <div className="flex items-center justify-between">
                  <span className="grid size-12 place-items-center rounded-2xl bg-mint/12 text-mint transition-transform group-hover:-rotate-6 group-hover:scale-110">
                    <s.icon className="size-6" />
                  </span>
                  <span className="font-heading text-5xl font-semibold text-white/[0.07]">0{i + 1}</span>
                </div>
                <h3 className="mt-6 text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 leading-relaxed text-[var(--app-muted)]">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Calculator() {
  const [calls, setCalls] = useState(5);
  const [price, setPrice] = useState(35);
  const monthly = Math.round((calls * price * 52) / 12);
  const payback = Math.max(1, Math.ceil(49 / price));
  return (
    <section className="py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="grid gap-10 rounded-[32px] border border-white/[0.08] bg-obsidian-light p-7 sm:p-12 md:grid-cols-2 md:items-center">
          <div>
            <p className={EYEBROW}>What missed calls cost you</p>
            <h2 className={`mt-3 ${H2}`}>Every missed call could be a missed cut.</h2>
            <div className="mt-9 space-y-8">
              <label className="block">
                <span className="flex justify-between text-sm font-medium">
                  Missed calls a week <output className="font-semibold text-mint tabular-nums">{calls}</output>
                </span>
                <input type="range" min={1} max={30} value={calls} onChange={(e) => setCalls(+e.target.value)} className="mt-3 h-11 w-full cursor-pointer accent-[var(--accent-color)]" />
              </label>
              <label className="block">
                <span className="flex justify-between text-sm font-medium">
                  Your average cut <output className="font-semibold text-mint tabular-nums">${price}</output>
                </span>
                <input type="range" min={15} max={100} step={5} value={price} onChange={(e) => setPrice(+e.target.value)} className="mt-3 h-11 w-full cursor-pointer accent-[var(--accent-color)]" />
              </label>
            </div>
          </div>
          <div className="rounded-3xl bg-[var(--app-bg)] p-8 text-center ring-1 ring-mint/25">
            <p className="text-sm text-[var(--app-muted)]">Up to</p>
            <p className="font-heading text-[clamp(3rem,9vw,5.5rem)] font-semibold leading-none text-mint tabular-nums" aria-live="polite">
              ${monthly.toLocaleString()}
            </p>
            <p className="mt-2 text-[var(--app-muted)]">a month could be calling someone else</p>
            <p className="mt-6 border-t border-white/[0.08] pt-6 text-sm leading-relaxed">
              LineCatch is $49 a month. Book <span className="font-semibold text-mint">{payback} {payback === 1 ? "cut" : "cuts"}</span> from missed calls and it has paid for itself.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Portfolio() {
  return (
    <section id="portfolio" className="relative scroll-mt-20 border-t border-white/[0.06] py-24">
      <div aria-hidden className="pointer-events-none absolute right-0 top-1/3 h-[480px] w-[480px] rounded-full bg-mint/10 blur-[120px]" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-16 px-4 sm:px-6 md:grid-cols-2">
        <div className="order-2 md:order-1"><PortfolioPhone /></div>
        <Reveal className="order-1 md:order-2">
          <p className={EYEBROW}>Your portfolio</p>
          <h2 className={`mt-3 ${H2}`}>Your best cuts, right on their phone.</h2>
          <p className="mt-5 text-lg leading-relaxed text-[var(--app-muted)]">
            Every barber gets a page clients can open from a text or a QR scan. It shows your work on a 3D ring they can spin with a thumb. They see a cut they like, tap it, and book it.
          </p>
          <ul className="mt-8 space-y-3">
            {["Your cover photo, shop name, and when you're open", "Up to 50 photos, each one tagged with the cut", "“Book this cut” takes them straight to a time", "Your next opening, one tap away", "In English and Spanish"].map((t) => (
              <li key={t} className="flex gap-3"><Check className="mt-0.5 size-5 shrink-0 text-mint" />{t}</li>
            ))}
          </ul>
          <p className="mt-8 text-sm text-[var(--app-muted)]">Go ahead and try it. Drag the ring, or tap a photo.</p>
        </Reveal>
      </div>
    </section>
  );
}

const STAMPS = [1, 2, 3, 4, 5, 6, 7, 8];
const isReward = (n: number) => n === 2 || (n > 2 && (n - 2) % 3 === 0);

function Vip({ qr }: { qr: string }) {
  const reduced = useReducedMotion();
  return (
    <section className="border-t border-white/[0.06] py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-16 px-4 sm:px-6 md:grid-cols-2">
        <Reveal>
          <p className={EYEBROW}>QR sticker & VIP list</p>
          <h2 className={`mt-3 ${H2}`}>Get clients back in your chair.</h2>
          <p className="mt-5 text-lg leading-relaxed text-[var(--app-muted)]">
            Put the LineCatch sticker on your mirror. Clients scan it from the chair to join your VIP list. LineCatch follows up with them for you.
          </p>
          <ul className="mt-8 space-y-3">
            {["Clients join your VIP list with one scan", "Win-back texts go to clients who haven't been back in a while", "Google review requests after a great cut", "A loyalty card with every plan: the 2nd cut is on you, then every 3rd"].map((t) => (
              <li key={t} className="flex gap-3"><Check className="mt-0.5 size-5 shrink-0 text-mint" />{t}</li>
            ))}
          </ul>
        </Reveal>

        <div className="flex flex-col items-center gap-10" style={{ perspective: 1200 }}>
          <motion.div
            animate={reduced ? undefined : { rotateY: [-18, 18], rotateX: [6, -4] }}
            transition={{ duration: 6, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
            whileHover={{ scale: 1.05 }}
            className="relative w-[240px] overflow-hidden rounded-[32px] bg-mint p-6 text-center text-[var(--accent-fg)] shadow-[0_30px_80px_rgba(212,175,122,0.25)]"
          >
            <span aria-hidden className="pf2-shine absolute inset-y-0 left-0 w-1/3 bg-white/30" />
            <p className="font-[family-name:var(--font-poster)] text-3xl tracking-wide">SCAN FOR VIP</p>
            <div className="mx-auto mt-4 w-40 rounded-2xl bg-[#F2EEE6] p-3 [&_svg]:h-auto [&_svg]:w-full" role="img" aria-label="Sample LineCatch QR sticker" dangerouslySetInnerHTML={{ __html: qr }} />
            <p className="mt-4 text-sm font-semibold">Fresh Fades · LineCatch</p>
          </motion.div>

          <Reveal className="w-full max-w-sm rounded-3xl border border-white/[0.08] bg-obsidian-light p-6">
            <div className="flex items-center justify-between">
              <p className="font-semibold">Loyalty card</p>
              <p className="text-sm text-[var(--app-muted)]">Marcus J.</p>
            </div>
            <ol className="mt-5 grid grid-cols-4 gap-3">
              {STAMPS.map((n) => (
                <motion.li
                  key={n}
                  initial={{ scale: 0.6, opacity: 0.3 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ type: "spring", stiffness: 300, damping: 15, delay: n * 0.12 }}
                  className={`grid aspect-square place-items-center rounded-full text-xs font-semibold ${
                    n <= 4 ? "bg-mint text-[var(--accent-fg)]" : isReward(n) ? "border-2 border-dashed border-mint/60 text-mint" : "border border-white/15 text-[var(--app-muted)]"
                  }`}
                  aria-label={`Cut ${n}${isReward(n) ? ", $5 off" : ""}${n <= 4 ? ", stamped" : ""}`}
                >
                  {isReward(n) ? "$5" : n <= 4 ? <Check className="size-4" strokeWidth={3} /> : n}
                </motion.li>
              ))}
            </ol>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// SAMPLE QUOTES: placeholders. Replace with real barbers' words (and names) before launch.
const QUOTES = [
  { quote: "Saturdays I can't touch my phone. Now my missed calls book themselves while I'm cutting.", who: "Barber name", where: "City, State" },
  { quote: "Clients like getting a text back instead of a voicemail. My slow Tuesdays fill up now.", who: "Barber name", where: "City, State" },
  { quote: "The portfolio page sells my fades better than I do. People show up already knowing what they want.", who: "Barber name", where: "City, State" },
];

function Quotes() {
  return (
    <section className="border-t border-white/[0.06] py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <p className={EYEBROW}>From the chair</p>
          <h2 className={`mt-3 ${H2}`}>Built for barbers who are too busy to answer.</h2>
        </Reveal>
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {QUOTES.map((q, i) => (
            <Reveal key={i} delay={i * 0.12}>
              <figure className="flex h-full flex-col rounded-3xl border border-white/[0.08] bg-obsidian-light p-7">
                <span className="w-fit rounded-full border border-white/15 px-2 py-0.5 text-[11px] uppercase tracking-wide text-[var(--app-muted)]">Sample quote</span>
                <blockquote className="mt-5 flex-1 font-heading text-xl leading-snug">&ldquo;{q.quote}&rdquo;</blockquote>
                <figcaption className="mt-6 text-sm text-[var(--app-muted)]">{q.who} · {q.where}</figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const BARBER = ["Missed-call text back", "Your booking page", "Reminder texts & easy reschedule", "Portfolio page with the 3D ring", "QR sticker & VIP list", "Loyalty card & win-back texts", "Google review requests", "Morning summary & dashboard"];
const SHOP = ["Everything in Barber", "Every barber in the shop gets their own number, booking page & portfolio", "Owner dashboard across every chair", "Priority support & help with setup"];

function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-20 border-t border-white/[0.06] py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <Reveal className="text-center">
          <p className={EYEBROW}>Pricing</p>
          <h2 className={`mt-3 ${H2}`}>Try it free for 30 days.</h2>
          <p className="mt-4 text-lg text-[var(--app-muted)]">No card needed to start.</p>
        </Reveal>
        <div className="mt-14 grid gap-5 md:grid-cols-2">
          {[
            { name: "Barber", price: 49, blurb: "Everything LineCatch does, for your chair.", items: BARBER, best: true },
            { name: "Shop", price: 199, blurb: "LineCatch for every chair in the shop.", items: SHOP },
          ].map((p, i) => (
            <Reveal key={p.name} delay={i * 0.12}>
              <motion.div
                whileHover={{ y: -6 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
                className={`relative flex h-full flex-col rounded-[32px] p-8 ${p.best ? "bg-obsidian-light ring-2 ring-mint shadow-[0_30px_80px_rgba(212,175,122,0.15)]" : "border border-white/[0.08] bg-obsidian-light"}`}
              >
                {p.best && <span className="absolute -top-3 left-8 rounded-full bg-mint px-3 py-1 text-xs font-semibold text-[var(--accent-fg)]">Most popular</span>}
                <p className="text-lg font-semibold">{p.name}</p>
                <p className="mt-3"><span className="font-heading text-6xl font-semibold">${p.price}</span><span className="text-[var(--app-muted)]"> /month</span></p>
                <p className="mt-3 text-[var(--app-muted)]">{p.blurb}</p>
                <ul className="mt-7 flex-1 space-y-3">
                  {p.items.map((t) => <li key={t} className="flex gap-3"><Check className="mt-0.5 size-5 shrink-0 text-mint" />{t}</li>)}
                </ul>
                {p.best ? (
                  <Cta className="mt-8 w-full">Start free</Cta>
                ) : (
                  <Link href={TRIAL} className="mt-8 inline-flex min-h-[52px] w-full items-center justify-center rounded-full border border-white/20 font-semibold hover:border-mint/60">Start free with Shop</Link>
                )}
              </motion.div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const FAQ = [
  ["Do I need a new phone number?", "No. Clients keep calling the number they already have. When you don't answer, your phone forwards the call to your LineCatch number, and LineCatch sends the text. We walk you through setting up forwarding in a couple of minutes."],
  ["What does the text say?", "You choose. Pick Casual (“Hey, sorry I missed you! I'm with a client right now. Grab a spot here: …”), Professional, or write your own. Every text includes your booking link."],
  ["Will it text the same person over and over?", "No. A caller gets one text for a missed call. If they reply STOP, they won't get texts from you again."],
  ["Do I need a card for the free trial?", "No. You get 30 days free, and you don't enter a card to start."],
  ["Does it work for Spanish-speaking clients?", "Yes. The text, your booking page, and your portfolio work in English and Spanish."],
  ["What's the difference between Barber and Shop?", "Barber is everything LineCatch does, for one chair. Shop gives every barber in your shop their own LineCatch, plus an owner dashboard across every chair and priority support."],
];

function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 border-t border-white/[0.06] py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <Reveal>
          <p className={`text-center ${EYEBROW}`}>FAQ</p>
          <h2 className={`mt-3 text-center ${H2}`}>Questions barbers ask</h2>
        </Reveal>
        <div className="mt-12 divide-y divide-white/[0.08] border-y border-white/[0.08]">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group py-2">
              <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-4 text-lg font-medium [&::-webkit-details-marker]:hidden">
                {q}
                <Plus className="size-5 shrink-0 text-mint transition-transform duration-300 group-open:rotate-45" />
              </summary>
              <p className="pb-5 pr-10 leading-relaxed text-[var(--app-muted)]">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Final() {
  return (
    <section className="relative overflow-hidden border-t border-white/[0.06] py-28 text-center">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[720px] max-w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-mint/15 blur-[120px]" />
      <Reveal className="relative mx-auto max-w-3xl px-4 sm:px-6">
        <h2 className="font-heading text-[clamp(2.5rem,6vw,4.5rem)] font-semibold leading-[1.02] tracking-tight">
          Don&apos;t let your next client <span className="text-mint">call the shop down the street.</span>
        </h2>
        <p className="mx-auto mt-6 max-w-lg text-lg text-[var(--app-muted)]">Setup takes about five minutes. You get 30 days free, and you don&apos;t need a card.</p>
        <Cta className="mt-10" />
      </Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/[0.06] py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-[var(--app-muted)] sm:flex-row sm:px-6">
        <Logo />
        <div className="flex flex-wrap justify-center gap-6">
          <Link href="/privacy" className="hover:text-white">Privacy</Link>
          <Link href="/terms" className="hover:text-white">Terms</Link>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-white">{SUPPORT_EMAIL}</a>
        </div>
        <p>© {new Date().getFullYear()} LineCatch</p>
      </div>
    </footer>
  );
}

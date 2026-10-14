"use client";

import { useState } from "react";
import { useT, LanguageToggle } from "@/lib/i18n";

export type PortfolioData = {
  barberId: string;
  shopName: string;
  firstName: string | null;
  status: string;
  openNow: boolean;
  lowestPrice: string | null;
  services: { id: string; name: string; description: string | null; price: number; minutes: number; priceLabel: string | null }[];
  next: { day: string; time: string; then: string[] } | null;
  week: { key: string; label: string; name: string; hours: string | null; today: boolean }[];
  loyalty: { amount: string } | null;
  src: string;
};

const POSTER = "font-[family-name:var(--font-poster)] font-normal tracking-[0.01em] leading-[0.95]";
// Loyalty: the 2nd cut is off, then every 3rd (2, 5, 8…). The first five visits show the pattern.
const STAMPS = [1, 2, 3, 4, 5];
const isReward = (n: number) => n === 10;

export default function PortfolioView({ data }: { data: PortfolioData }) {
  const t = useT();
  const [picked, setPicked] = useState<string | null>(null);
  const serviceById = new Map(data.services.map((s) => [s.id, s]));
  const pickedService = picked ? serviceById.get(picked) ?? null : null;
  const book = (serviceId?: string | null) =>
    `/book/${data.barberId}?${serviceId ? `service=${serviceId}&` : ""}src=${data.src}`;

  const words = (text: string, from: number, accent = false) =>
    text.split(" ").map((w, i) => (
      <span key={`${w}-${i}`} className={`pf2-word ${accent ? "text-[var(--t-accent)]" : ""}`} style={{ animationDelay: `${from + i * 0.08}s` }}>
        {w}&nbsp;
      </span>
    ));

  return (
    <>
      {/* Shop name and open status */}
      <header className="relative overflow-hidden rounded-b-[34px] border-b px-5 pt-[max(16px,env(safe-area-inset-top))] pb-7" style={{ borderColor: "color-mix(in srgb, var(--t-accent) 30%, transparent)", background: "radial-gradient(120% 90% at 20% 0%, color-mix(in srgb, var(--t-accent) 18%, var(--t-bg)), var(--t-bg) 70%)" }}>
        <div className="mx-auto max-w-[520px]">
          <div className="flex items-center justify-between gap-3">
            <span className="pf2-rise inline-flex items-center gap-2 h-9 px-3 rounded-full text-[13px] font-semibold border border-[var(--t-border)] bg-[var(--t-surface)]">
              <span
                className={`w-2 h-2 rounded-full ${data.openNow ? "pf2-pulse" : ""}`}
                style={{ background: data.openNow ? "var(--t-accent)" : "var(--t-muted)", ["--pf2-pulse" as string]: "color-mix(in srgb, var(--t-accent) 70%, transparent)" }}
              />
              {data.status}
            </span>
            <div
              className="pf2-rise shrink-0 rounded-full bg-[var(--t-surface)] [&>div]:border-[var(--t-border)] [&_button[aria-pressed=false]]:text-[var(--t-muted)]"
              style={{ "--accent-color": "var(--t-cta-bg)", "--accent-fg": "var(--t-cta-text)" } as React.CSSProperties}
            >
              <LanguageToggle />
            </div>
          </div>

          {/* The barber's name first, then their shop: "Damare Cain, with Freely Shop". */}
          <h1 className={`${POSTER} mt-8 text-[clamp(52px,15vw,72px)] [text-wrap:balance]`}>{words(data.firstName || data.shopName, 0.2)}</h1>
          <p className="pf2-rise mt-2 text-base font-medium text-[var(--t-muted)]" style={{ animationDelay: "0.35s" }}>
            {[data.firstName && t("shop.with", { name: data.shopName }), data.lowestPrice && t("shop.from", { price: data.lowestPrice })].filter(Boolean).join(" · ")}
          </p>

        </div>
      </header>

      <div className="relative mx-auto max-w-[520px] px-5">
        <p className={`${POSTER} mt-6 text-[clamp(44px,13vw,56px)]`}>
          {words(t("shop.head1"), 0.5)}
          <br />
          {words(t("shop.head2"), 0.66, true)}
        </p>
        <p className="pf2-rise mt-3 text-[16px] leading-relaxed text-[var(--t-muted)] max-w-[340px]" style={{ animationDelay: "0.85s" }}>
          {t("shop.intro_fast")}
        </p>

        {/* Next opening */}
        {data.next && data.services[0] && (
          <div className="pf2-rise mt-6 p-4 rounded-[20px] flex items-center gap-3.5 bg-[var(--t-surface)] border" style={{ animationDelay: "0.95s", borderColor: "color-mix(in srgb, var(--t-accent) 35%, transparent)", boxShadow: "0 14px 40px color-mix(in srgb, var(--t-accent) 12%, transparent)" }}>
            <div className="flex-1 min-w-0">
              <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[1.2px] text-[var(--t-accent)]">
                <span className="pf2-pulse w-[7px] h-[7px] rounded-full bg-[var(--t-accent)]" style={{ ["--pf2-pulse" as string]: "color-mix(in srgb, var(--t-accent) 70%, transparent)" }} />
                {t("shop.next_opening")}
              </p>
              <p className={`${POSTER} mt-1.5 text-[34px]`}>{data.next.day} · {data.next.time}</p>
              {data.next.then.length > 0 && <p className="mt-1 text-[13px] text-[var(--t-muted)]">{t("shop.then_at", { times: data.next.then.join(t("shop.and")) })}</p>}
            </div>
            <a href={book(pickedService?.id)}className="shrink-0 h-12 px-[18px] rounded-[14px] inline-flex items-center font-bold text-[15px] bg-[var(--t-cta-bg)] text-[var(--t-cta-text)] active:scale-[0.97] transition-transform" style={{ boxShadow: "0 8px 26px var(--t-glow)" }}>
              {t("shop.grab_it")}
            </a>
          </div>
        )}
      </div>

      {/* Scrolling banner of their cuts */}
      {data.services.length > 0 && (
        <div aria-hidden className="mt-10 overflow-hidden border-y border-[var(--t-border)] bg-[var(--t-surface)]">
          <div className={`pf2-marquee flex w-max py-3.5 ${POSTER} text-[26px] whitespace-nowrap`}>
            {[0, 1].map((copy) => (
              <span key={copy} className="pr-6">
                {[...data.services.map((s) => s.name), data.shopName].map((name, i) => (
                  <span key={i}>
                    {name.toUpperCase()} <span className="text-[var(--t-accent)]">✦</span>{" "}
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="relative mx-auto max-w-[520px] px-5 pb-44">
        {/* Pick your cut */}
        {data.services.length > 0 && (
          <section id="cuts" className="mt-10">
            <div className="flex items-baseline justify-between">
              <h2 className={`${POSTER} text-[38px]`}>{t("shop.pick_your_cut")}</h2>
              <span className="text-[13px] text-[var(--t-muted)]">{t("shop.tap_one")}</span>
            </div>
            <div role="radiogroup" aria-label={t("shop.pick_your_cut")} className="mt-3.5 flex flex-col gap-2.5">
              {data.services.map((s) => {
                const on = picked === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setPicked(on ? null : s.id)}
                    className="w-full text-left flex items-center gap-3.5 p-4 rounded-[18px] border transition-[border-color,background-color,box-shadow,transform] duration-200 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-[var(--t-accent)]"
                    style={{
                      background: on ? "color-mix(in srgb, var(--t-accent) 12%, transparent)" : "var(--t-surface)",
                      borderColor: on ? "var(--t-accent)" : "var(--t-border)",
                      boxShadow: on ? "0 0 0 1px var(--t-accent), 0 12px 32px color-mix(in srgb, var(--t-accent) 22%, transparent)" : "none",
                    }}
                  >
                    <span className="w-[26px] h-[26px] shrink-0 rounded-full border-2 flex items-center justify-center" style={{ borderColor: on ? "var(--t-cta-bg)" : "var(--t-muted)", background: on ? "var(--t-cta-bg)" : "transparent", color: "var(--t-cta-text)" }}>
                      {on && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12l5 5 9-10" /></svg>}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-base font-bold">{s.name}</span>
                      {s.description && <span className="block text-[13px] text-[var(--t-muted)]">{s.description}</span>}
                      <span className="block text-[13px] text-[var(--t-muted)]">{t("shop.minutes", { n: s.minutes })}</span>
                    </span>
                    {s.priceLabel && <span className={`${POSTER} text-[28px]`}>{s.priceLabel}</span>}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Loyalty card */}
        {data.loyalty && (
          <section className="mt-11 p-5 rounded-[22px] bg-[var(--t-surface)] border" style={{ borderColor: "color-mix(in srgb, var(--t-accent) 35%, transparent)" }}>
            <p className="text-[12px] font-bold uppercase tracking-[1.2px] text-[var(--t-accent)]">{t("shop.loyalty_title")}</p>
            <p className={`${POSTER} mt-2 text-[32px]`}>{t("shop.loyalty_rule", { amount: data.loyalty.amount })}</p>
            <ol className="mt-4 grid grid-cols-5 gap-2" aria-label={t("shop.loyalty_title")}>
              {STAMPS.map((n, i) => {
                const reward = isReward(n);
                return (
                  <li key={n} className="flex flex-col items-center gap-1.5">
                    <span
                      className="pf2-pop w-12 h-12 rounded-full flex items-center justify-center text-[13px] font-bold border-2"
                      style={{
                        animationDelay: `${0.15 + i * 0.1}s`,
                        borderStyle: reward ? "solid" : "dashed",
                        borderColor: reward ? "var(--t-accent)" : "var(--t-border)",
                        background: reward ? "color-mix(in srgb, var(--t-accent) 16%, transparent)" : "transparent",
                        color: reward ? "var(--t-accent)" : "var(--t-muted)",
                        boxShadow: reward ? "0 0 20px var(--t-glow)" : "none",
                      }}
                    >
                      {reward ? "★" : n}
                    </span>
                    <span className="text-[12px] text-[var(--t-muted)]">{t("shop.cut_n", { n })}</span>
                  </li>
                );
              })}
            </ol>
            <p className="mt-3 text-[13px] text-[var(--t-muted)]">{t("shop.loyalty_note")}</p>
          </section>
        )}

        {/* Hours */}
        <section className="mt-11">
          <h2 className={`${POSTER} text-[38px]`}>{t("shop.hours")}</h2>
          <ul className="mt-3.5 grid grid-cols-7 gap-1.5">
            {data.week.map((d) => (
              <li
                key={d.key}
                aria-label={`${d.name}: ${d.hours ?? t("shop.closed")}`}
                className="py-2.5 rounded-[14px] text-center border"
                style={{
                  background: d.today ? "var(--t-cta-bg)" : "var(--t-surface)",
                  borderColor: d.today ? "var(--t-cta-bg)" : "var(--t-border)",
                  color: d.today ? "var(--t-cta-text)" : d.hours ? "var(--t-text)" : "var(--t-muted)",
                  boxShadow: d.today ? "0 8px 22px var(--t-glow)" : "none",
                }}
              >
                <span aria-hidden className="block text-[12px] font-bold">{d.label}</span>
                <span aria-hidden className="block mt-0.5 text-[10.5px] font-medium leading-tight">{d.hours ? d.hours.replace(/\s?(AM|PM|a\.\s?m\.|p\.\s?m\.)/gi, "") : t("shop.off")}</span>
              </li>
            ))}
          </ul>
        </section>

        <p className={`${POSTER} mt-16 text-center text-[48px]`}>
          {t("shop.closing_a")}
          <br />
          <span className="text-[var(--t-accent)]">{t("shop.closing_b")}</span>
        </p>

        {/* Powered by LineCatch */}
        <div className="mt-9 flex justify-center">
          <a href="https://www.linecatch.app" target="_blank" rel="noopener noreferrer" className="min-h-11 px-4 rounded-full inline-flex items-center gap-2 border border-[var(--t-border)] bg-[var(--t-surface)] text-[12px] font-semibold uppercase tracking-[1.2px] text-[var(--t-muted)]">
            {t("shop.powered_by")}
            <span className={`${POSTER} text-[20px] normal-case text-[var(--t-text)]`}>
              Line<span className="text-[var(--t-accent)]">Catch</span>
            </span>
          </a>
        </div>
      </div>

      {/* Pinned Book button: follows the cut they picked */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--t-border)] backdrop-blur-md" style={{ background: "color-mix(in srgb, var(--t-bg) 85%, transparent)" }}>
        <div className="mx-auto max-w-[520px] px-5 pt-3.5 pb-[max(20px,env(safe-area-inset-bottom))]">
          <a
            href={book(pickedService?.id)}
            className="relative overflow-hidden flex items-center justify-center gap-2.5 h-[58px] rounded-2xl text-base font-bold bg-[var(--t-cta-bg)] text-[var(--t-cta-text)] transition-transform active:scale-[0.98]"
            style={{ boxShadow: "0 8px 28px var(--t-glow)" }}
          >
            <span aria-hidden className="pf2-shine absolute inset-y-0 left-0 w-2/5 bg-[#fff]/30" />
            <span className="relative">{pickedService ? t("shop.book_cut", { name: pickedService.name, price: pickedService.priceLabel ?? "" }).replace(/ · $/, "") : t("shop.cta")}</span>
            <svg className="relative" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M12 5l7 7-7 7" /></svg>
          </a>
          <p className="mt-2 text-center text-xs text-[var(--t-muted)]">{t("shop.cta_note")}</p>
        </div>
      </div>

    </>
  );
}

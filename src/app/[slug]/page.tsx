import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Fraunces } from "next/font/google";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTheme, isAccent, themeVars } from "@/lib/themes";
import { getT } from "@/lib/i18n-server";
import { LanguageToggle } from "@/lib/i18n";
import { money, DEFAULT_TZ } from "@/lib/config";
import { weekdayInTz } from "@/lib/availability";
import { checkSlug } from "@/lib/slug";
import PortfolioGallery from "./portfolio-gallery";

// One serif, one weight (regular + italic).
const serif = Fraunces({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-serif", display: "swap" });

const INBOUND_SOURCES = new Set(["qr", "instagram"]);

const loadBarber = cache(async (slug: string) => {
  if (checkSlug(slug)) return null;
  const db = createAdminClient();
  const { data: barber } = await db
    .from("users")
    .select("user_id, business_name, first_name, avatar_url, theme, accent_color, timezone, business_hours, is_active")
    .eq("slug", slug)
    .maybeSingle();
  if (!barber || barber.is_active === false) return null;

  const [{ data: photos }, { data: cheapest }] = await Promise.all([
    db.from("portfolio_photos").select("id, url, thumb_url, width, height").eq("user_id", barber.user_id).order("sort_order").limit(8),
    db.from("services").select("price").eq("user_id", barber.user_id).eq("is_active", true).gt("price", 0).order("price").limit(1).maybeSingle(),
  ]);

  const shopName = barber.business_name?.trim() || barber.first_name?.trim() || "LineCatch";
  return { barber, shopName, photos: photos || [], lowestPrice: cheapest?.price ?? null };
});

/** "09:30" → "9:30 AM" / "9:30 a. m." in the visitor's language (wall-clock time, no timezone math). */
function formatHour(hhmm: string, tag: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(2000, 0, 1, h, m || 0)).toLocaleTimeString(tag, {
    hour: "numeric",
    minute: m ? "2-digit" : undefined,
    timeZone: "UTC",
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadBarber(slug.toLowerCase());
  if (!data) return { title: "LineCatch" };
  const { t } = await getT();
  return {
    title: t("shop.meta_title", { shop: data.shopName }),
    description: t("shop.meta_desc", { shop: data.shopName }),
    openGraph: data.photos[0] ? { images: [data.photos[0].url] } : undefined,
  };
}

const PhotoIcon = ({ size = 26 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
  </svg>
);

const HERO_CARDS = [
  { cls: "pf-float-a", pos: "left-[6%] top-[30px] w-[30%] h-[150px]" },
  { cls: "pf-float-b", pos: "left-[34%] top-[6px] w-[32%] h-[168px] z-10", featured: true },
  { cls: "pf-float-c", pos: "right-[6%] top-[40px] w-[29%] h-[142px]" },
];

export default async function PortfolioPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const data = await loadBarber(slug.toLowerCase());
  if (!data) notFound();

  const { barber, shopName, photos, lowestPrice } = data;
  const { t, locale, tag } = await getT();
  const base = getTheme(barber.theme);
  // The barber's accent wins on dark themes (every accent pick is light, so it reads on dark and takes dark text).
  const theme = base.dark && isAccent(barber.accent_color)
    ? { ...base, accent: barber.accent_color, ctaBg: barber.accent_color, ctaText: "#121110", accentGlow: `color-mix(in srgb, ${barber.accent_color} 30%, transparent)` }
    : base;
  const tz = barber.timezone || DEFAULT_TZ;

  const today = barber.business_hours?.[weekdayInTz(new Date(), tz)] as { open: string; close: string } | null | undefined;
  const hoursChip = today ? `${t("shop.open_today")} · ${formatHour(today.open, tag)}–${formatHour(today.close, tag)}` : t("shop.closed_today");

  const src = typeof sp.src === "string" && INBOUND_SOURCES.has(sp.src) ? sp.src : "portfolio";
  const bookHref = `/book/${barber.user_id}?src=${src}`;
  const initial = shopName.trim().charAt(0).toUpperCase() || "B";
  const glass = "bg-[var(--t-surface)] border border-[var(--t-border)]";

  return (
    <main
      lang={locale}
      className={`${serif.variable} relative min-h-screen overflow-x-clip bg-[var(--t-bg)] text-[var(--t-text)] font-[family-name:var(--font-dm-sans)]`}
      style={themeVars(theme) as React.CSSProperties}
    >
      {/* Accent glow behind the hero (a plain radial fill: no blur filter to paint). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 -top-40 h-[420px] w-[560px] -translate-x-1/2"
        style={{ background: "radial-gradient(closest-side, var(--t-glow), transparent)" }}
      />

      <div className="relative mx-auto max-w-[520px] px-5 pt-6 pb-44">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            {/* The barber's own photo leads the page, ringed in the theme accent. */}
            <div className="shrink-0 rounded-full p-[3px] bg-[var(--t-accent)] shadow-[0_0_24px_var(--t-glow)]">
              {barber.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={barber.avatar_url}
                  alt={barber.first_name || shopName}
                  width={68}
                  height={68}
                  fetchPriority="high"
                  className="block w-[68px] h-[68px] rounded-full object-cover border-[3px] border-[var(--t-bg)]"
                />
              ) : (
                <div className="w-[68px] h-[68px] rounded-full flex items-center justify-center text-[30px] font-[family-name:var(--font-serif)] bg-[var(--t-bg)] text-[var(--t-accent)] border-[3px] border-[var(--t-bg)]">
                  {initial}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-base font-semibold truncate">{shopName}</div>
              {barber.first_name && barber.business_name && (
                <div className="text-xs text-[var(--t-muted)] truncate">
                  {t("shop.with", { name: barber.first_name })}
                </div>
              )}
            </div>
          </div>
          {/* Shared EN/ES pill, recolored to the barber's theme (works on the light Cream theme too). */}
          <div
            className="shrink-0 rounded-full bg-[var(--t-surface)] [&>div]:border-[var(--t-border)] [&_button[aria-pressed=false]]:text-[var(--t-muted)] [&_button[aria-pressed=false]:hover]:text-[var(--t-text)]"
            style={{ "--accent-color": "var(--t-cta-bg)", "--accent-fg": "var(--t-cta-text)" } as React.CSSProperties}
          >
            <LanguageToggle />
          </div>
        </div>

        {/* Hero */}
        <h1 className="mt-8 text-[52px] leading-[0.98] tracking-[-1px] font-[family-name:var(--font-serif)]">
          {t("shop.head1")}
          <br />
          <span className="italic text-[var(--t-accent)]">{t("shop.head2")}</span>
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-[var(--t-muted)] max-w-[340px]">{t("shop.intro")}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium ${glass}`}>
            <span
              className="w-[7px] h-[7px] rounded-full"
              style={today ? { background: "var(--t-accent)", boxShadow: "0 0 8px var(--t-accent)" } : { background: "var(--t-muted)" }}
            />
            {hoursChip}
          </span>
          {lowestPrice !== null && (
            <span className={`inline-flex items-center px-3 py-2 rounded-full text-xs font-medium ${glass}`}>
              {t("shop.from", { price: money(Math.round(Number(lowestPrice) * 100), locale) })}
            </span>
          )}
        </div>

        {/* Floating photo cards: the hero is the only place with ambient motion and backdrop blur. */}
        <div className="relative mt-6 h-[210px]" aria-hidden="true">
          {HERO_CARDS.map((card, i) => {
            const photo = photos[i];
            return (
              <div
                key={i}
                className={`${card.cls} ${card.pos} absolute overflow-hidden rounded-[18px] border backdrop-blur-md flex items-center justify-center text-[var(--t-tile-icon)] ${
                  card.featured ? "border-[var(--t-accent)]/40 shadow-[0_0_30px_var(--t-glow),0_16px_34px_rgba(0,0,0,0.45)]" : "border-[var(--t-border)] shadow-[0_14px_30px_rgba(0,0,0,0.4)]"
                }`}
                style={{ background: "var(--t-surface)" }}
              >
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.thumb_url ?? photo.url}
                    alt=""
                    width={photo.width ?? undefined}
                    height={photo.height ?? undefined}
                    loading="eager"
                    fetchPriority={card.featured ? "high" : "auto"}
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <PhotoIcon />
                )}
              </div>
            );
          })}
        </div>

        {/* The work */}
        <section className="mt-10">
          <div className="flex items-end justify-between mb-4">
            <h2 className="text-[36px] leading-none font-[family-name:var(--font-serif)]">{t("shop.the_work")}</h2>
            {photos.length > 0 && <span className="text-[13px] text-[var(--t-muted)]">{t("shop.tap_to_open")}</span>}
          </div>
          <PortfolioGallery photos={photos} shopName={shopName} bookHref={bookHref} />
        </section>

        {/* How booking works */}
        <section className="mt-14">
          <h2 className="text-[36px] leading-none font-[family-name:var(--font-serif)] mb-4">{t("shop.how_title")}</h2>
          <ol className="flex flex-col gap-2.5">
            {[1, 2, 3].map((n) => ({ title: t(`shop.step${n}_title`), body: t(`shop.step${n}_body`) })).map((step, i) => (
              <li key={i} className={`flex gap-3.5 items-start p-4 rounded-2xl ${glass}`}>
                <span
                  className="w-[38px] h-[38px] shrink-0 rounded-full flex items-center justify-center text-[20px] font-[family-name:var(--font-serif)] border"
                  style={{
                    background: "color-mix(in srgb, var(--t-accent) 12%, transparent)",
                    borderColor: "color-mix(in srgb, var(--t-accent) 35%, transparent)",
                    color: "var(--t-accent)",
                  }}
                >
                  {i + 1}
                </span>
                <div>
                  <div className="text-[15px] font-semibold">{step.title}</div>
                  <div className="text-[13px] leading-snug text-[var(--t-muted)] mt-0.5">{step.body}</div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <p
          className="mt-16 text-center text-[44px] leading-none italic font-[family-name:var(--font-serif)] text-[var(--t-accent)]"
          style={{ textShadow: "0 0 28px var(--t-glow)" }}
        >
          {t("shop.closing")}
        </p>
      </div>

      {/* Pinned CTA */}
      <div
        className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--t-border)]"
        style={{ background: "var(--t-bg)" }}
      >
        <div className="mx-auto max-w-[520px] px-5 pt-3.5 pb-7">
          <a
            href={bookHref}
            className="flex items-center justify-center gap-2.5 h-[58px] rounded-2xl text-base font-bold bg-[var(--t-cta-bg)] text-[var(--t-cta-text)] shadow-[0_0_28px_var(--t-glow)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_40px_var(--t-glow)] active:translate-y-0"
          >
            {t("shop.cta")}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>
          <div className="mt-2 text-center text-xs text-[var(--t-muted)]">{t("shop.cta_note")}</div>
        </div>
      </div>
    </main>
  );
}

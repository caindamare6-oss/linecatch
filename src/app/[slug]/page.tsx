import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Bebas_Neue } from "next/font/google";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTheme, isAccent, themeVars } from "@/lib/themes";
import { getT } from "@/lib/i18n-server";
import { money, DEFAULT_TZ } from "@/lib/config";
import { toLoyalty } from "@/lib/loyalty-rules";
import { weekdayInTz } from "@/lib/availability";
import { checkSlug } from "@/lib/slug";
import { nextOpenings } from "@/lib/slots";
import { barberLocalToUTC } from "@/lib/format";
import { MAX_PORTFOLIO_PHOTOS } from "@/lib/portfolio";
import PortfolioView, { type PortfolioData } from "./portfolio-view";

// Tall, bold display face for the page's headings (barbershop-poster feel).
const display = Bebas_Neue({ subsets: ["latin"], weight: "400", variable: "--font-poster", display: "swap" });

const INBOUND_SOURCES = new Set(["qr", "instagram"]);
const WEEK = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

const loadBarber = cache(async (slug: string) => {
  if (checkSlug(slug)) return null;
  const db = createAdminClient();
  const { data: barber } = await db
    .from("users")
    .select("user_id, business_name, first_name, cover_url, theme, accent_color, timezone, business_hours, is_active, loyalty_enabled, loyalty_reward_cents")
    .eq("slug", slug)
    .maybeSingle();
  if (!barber || barber.is_active === false) return null;

  const [{ data: photos }, { data: services }] = await Promise.all([
    db.from("portfolio_photos").select("id, url, thumb_url, width, height, service_id").eq("user_id", barber.user_id).order("sort_order").limit(MAX_PORTFOLIO_PHOTOS),
    db.from("services").select("id, name, description, price, duration_minutes").eq("user_id", barber.user_id).eq("is_active", true).order("sort_order"),
  ]);

  const shopName = barber.business_name?.trim() || barber.first_name?.trim() || "LineCatch";
  return { db, barber, shopName, photos: photos || [], services: (services || []).map((s) => ({ ...s, price: Number(s.price) })) };
});

/** "09:30" → "9:30 AM" / "9:30 a. m." in the visitor's language (wall-clock time, no timezone math). */
function formatHour(hhmm: string, tag: string, short = false) {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(2000, 0, 1, h, m || 0)).toLocaleTimeString(tag, {
    hour: "numeric",
    minute: m || !short ? (m ? "2-digit" : undefined) : undefined,
    timeZone: "UTC",
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadBarber(slug.toLowerCase());
  if (!data) return { title: "LineCatch" };
  const { t } = await getT();
  const image = data.barber.cover_url || data.photos[0]?.url;
  return {
    title: t("shop.meta_title", { shop: data.shopName }),
    description: t("shop.meta_desc", { shop: data.shopName }),
    openGraph: image ? { images: [image] } : undefined,
  };
}

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

  const { db, barber, shopName, photos, services } = data;
  const { t, locale, tag } = await getT();
  const loyalty = toLoyalty(barber);
  const tz = barber.timezone || DEFAULT_TZ;
  const hours = barber.business_hours as Record<string, { open: string; close: string } | null> | null;

  // The page's colors: the barber's theme; their accent wins on dark themes (every pick is light).
  const base = getTheme(barber.theme);
  const theme = base.dark && isAccent(barber.accent_color)
    ? { ...base, accent: barber.accent_color, ctaBg: barber.accent_color, ctaText: "#121110", accentGlow: `color-mix(in srgb, ${barber.accent_color} 30%, transparent)` }
    : base;

  const now = new Date();
  const nowMs = now.getTime();
  const todayKey = weekdayInTz(now, tz);
  const today = hours?.[todayKey] ?? null;
  const localToday = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const openNow = !!today && nowMs >= barberLocalToUTC(localToday, today.open, tz).getTime() && nowMs < barberLocalToUTC(localToday, today.close, tz).getTime();
  const status = openNow
    ? t("shop.open_now_until", { time: formatHour(today!.close, tag) })
    : today && nowMs < barberLocalToUTC(localToday, today.open, tz).getTime()
      ? t("shop.opens_at", { time: formatHour(today.open, tag) })
      : t("shop.closed_now");

  // "Next opening" for their first service (the one "Grab it" books).
  const first = services[0];
  const openings = first ? await nextOpenings(db, { userId: barber.user_id, totalMinutes: first.duration_minutes, hours, tz }) : [];
  const next = openings[0]
    ? {
        day:
          openings[0].dayOffset === 0
            ? t("shop.today")
            : openings[0].dayOffset === 1
              ? t("shop.tomorrow")
              : new Date(openings[0].date + "T12:00:00Z").toLocaleDateString(tag, { weekday: "long", timeZone: "UTC" }),
        time: formatHour(openings[0].time, tag),
        then: openings.slice(1).map((o) => formatHour(o.time, tag)),
      }
    : null;

  const week = WEEK.map((key) => {
    const h = hours?.[key] ?? null;
    return {
      key,
      label: new Date(Date.UTC(2024, 0, 1 + WEEK.indexOf(key))).toLocaleDateString(tag, { weekday: "narrow", timeZone: "UTC" }),
      name: new Date(Date.UTC(2024, 0, 1 + WEEK.indexOf(key))).toLocaleDateString(tag, { weekday: "long", timeZone: "UTC" }),
      hours: h ? `${formatHour(h.open, tag, true)}–${formatHour(h.close, tag, true)}` : null,
      today: key === todayKey,
    };
  });

  const src = typeof sp.src === "string" && INBOUND_SOURCES.has(sp.src) ? sp.src : "portfolio";
  const view: PortfolioData = {
    barberId: barber.user_id,
    shopName,
    firstName: barber.business_name && barber.first_name ? barber.first_name.trim() : null,
    coverUrl: barber.cover_url,
    status,
    openNow,
    lowestPrice: services.some((s) => s.price > 0) ? money(Math.round(Math.min(...services.filter((s) => s.price > 0).map((s) => s.price)) * 100), locale) : null,
    services: services.map((s) => ({ id: s.id, name: s.name, description: s.description, price: s.price, minutes: s.duration_minutes, priceLabel: s.price > 0 ? money(Math.round(s.price * 100), locale) : null })),
    photos: photos.map((p) => ({ id: p.id, url: p.url, thumb: p.thumb_url ?? p.url, width: p.width, height: p.height, serviceId: p.service_id })),
    next,
    week,
    loyalty: loyalty.enabled ? { amount: money(loyalty.cents, locale) } : null,
    src,
  };

  return (
    <main
      lang={locale}
      className={`${display.variable} relative min-h-screen overflow-x-clip bg-[var(--t-bg)] text-[var(--t-text)] font-sans`}
      style={themeVars(theme) as React.CSSProperties}
    >
      <PortfolioView data={view} />
    </main>
  );
}

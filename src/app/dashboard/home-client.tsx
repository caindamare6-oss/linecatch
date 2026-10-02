"use client";

import Link from "next/link";
import { lazy, Suspense, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, SectionLabel, SERIF } from "./ui";
import { formatPhone } from "@/lib/clients";

const QRScanner = lazy(() => import("./qr-scanner").then((m) => ({ default: m.QRScanner })));

type FeedEvent = { id: string; event_type: string; client_name: string | null; description: string; metadata?: Record<string, unknown> | null; created_at: string };
type Suppressed = { id: string; from_number: string; received_at: string; suppressed_reason: string | null };
type Revenue = { total: number; cuts: number; lastMonthToDate: number; points: (number | null)[]; currentWeek: number; monthName: string };

const I = {
  check: <><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" /></>,
  bolt: <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />,
  phone: <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z" />,
  cal: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  gift: <><path d="M20 12v10H4V12" /><path d="M22 7H2v5h20V7z" /><path d="M12 22V7" /></>,
  star: <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />,
  qr: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 17h4v4" /></>,
  x: <path d="M18 6L6 18M6 6l12 12" />,
};
const Icon = ({ d, size = 16, className = "" }: { d: React.ReactNode; size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>{d}</svg>
);

const EVENTS: Record<string, { icon: React.ReactNode; tone: string; tag?: string }> = {
  booking_created: { icon: I.cal, tone: "var(--accent-color)" },
  booking_completed: { icon: I.check, tone: "var(--accent-color)" },
  booking_cancelled: { icon: I.x, tone: "#F08A8A", tag: "Cancelled" },
  missed_call_caught: { icon: I.phone, tone: "var(--accent-color)" },
  cron_reengagement: { icon: I.bolt, tone: "#E0926A", tag: "Re-engage" },
  loyalty_claimed: { icon: I.gift, tone: "#E0926A", tag: "Reward" },
  review_sent: { icon: I.star, tone: "#E0926A", tag: "Review" },
  qr_scan: { icon: I.qr, tone: "#A8C49A", tag: "VIP" },
};

function timeAgo(iso: string, tz: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d} days ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: tz });
}

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export function HomeClient(props: {
  greeting: string;
  dateLine: string;
  paused: boolean;
  hasActiveSticker: boolean;
  bookingLink: string;
  revenue: Revenue;
  vips: number;
  callsCaught: number;
  autotextOn: boolean;
  marketing: "off" | "awaiting_sticker" | "on";
  wednesdayOn: boolean;
  wednesdayTargeted: number;
  reviewsOn: boolean;
  feed: FeedEvent[];
  suppressed: Suppressed[];
  timezone: string;
}) {
  const router = useRouter();
  const [showScanner, setShowScanner] = useState(false);
  const [stickerDone, setStickerDone] = useState(false);
  const [bannerHidden, setBannerHidden] = useState(false);
  const [feed, setFeed] = useState(props.feed);
  const [cursor, setCursor] = useState(props.feed.length >= 20 ? props.feed[props.feed.length - 1].created_at : null);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await fetch(`/api/activity?cursor=${encodeURIComponent(cursor)}`).then((r) => r.json());
      if (data.items?.length) {
        setFeed((f) => [...f, ...data.items]);
        setCursor(data.nextCursor ?? null);
      } else setCursor(null);
    } catch {}
    setLoadingMore(false);
  }, [cursor, loadingMore]);

  const { revenue } = props;
  const delta = revenue.total - revenue.lastMonthToDate;

  return (
    <div className="space-y-4">
      {showScanner && (
        <Suspense fallback={null}>
          <QRScanner
            onClose={() => setShowScanner(false)}
            onActivated={() => {
              setStickerDone(true);
              router.refresh();
            }}
          />
        </Suspense>
      )}

      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon d={I.phone} size={22} className="text-[var(--accent-color)]" />
          <span className={`${SERIF} text-[19px] font-semibold tracking-[-0.3px]`}>
            Line<span className="text-[var(--accent-color)]">Catch</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full border text-[12px] font-medium ${
              props.paused ? "border-[#E0926A]/30 text-[#E0926A]" : "border-white/[0.1] text-white/60"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${props.paused ? "bg-[#E0926A]" : "bg-[var(--accent-color)]"}`} />
            {props.paused ? "Paused" : "Active"}
          </span>
          <Link
            href="/dashboard/settings"
            aria-label="Settings"
            className="w-9 h-9 rounded-[10px] bg-white/[0.06] text-white/60 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </Link>
        </div>
      </header>

      <div className="pt-1">
        <h1 className={`${SERIF} text-[26px] leading-tight font-semibold tracking-[-0.5px]`}>{props.greeting}</h1>
        <p className="text-[13px] text-white/40 mt-0.5">{props.dateLine}</p>
      </div>

      {props.paused && (
        <Card className="p-4 border-[#E0926A]/25">
          <p className="text-sm font-semibold text-[#E0926A]">Texting is paused</p>
          <p className="text-xs text-white/45 mt-1 leading-relaxed">Missed calls are still logged, but no texts go out right now. Contact support to turn it back on.</p>
        </Card>
      )}

      {props.marketing === "awaiting_sticker" && !stickerDone && !bannerHidden && (
        <Card className="relative p-4">
          <button onClick={() => setBannerHidden(true)} aria-label="Dismiss" className="absolute top-2.5 right-2.5 w-8 h-8 flex items-center justify-center text-white/30 hover:text-white/60">
            <Icon d={I.x} size={15} />
          </button>
          <div className="flex gap-3.5 pr-6">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-[var(--accent-color)]/[0.12] text-[var(--accent-color)] flex items-center justify-center">
              <Icon d={I.qr} size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Your QR sticker is on its way</p>
              <p className="text-xs text-white/45 mt-1 leading-relaxed">When it arrives, scan it to start SMS marketing: Wednesday check-ins, win-backs, broadcasts and review requests. Missed-call texts and reminders already work.</p>
              <button
                onClick={() => setShowScanner(true)}
                className="mt-3 h-9 px-3.5 rounded-[10px] bg-[var(--accent-color)] text-[var(--accent-fg)] text-xs font-semibold"
              >
                Scan your sticker
              </button>
              <p className="text-[11px] text-white/35 mt-2.5 leading-relaxed">
                Meanwhile, clients can book at <span className="text-white/55 break-all">{props.bookingLink.replace(/^https?:\/\//, "")}</span>
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Revenue */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.8px] text-white/40">Revenue</p>
            <p className={`${SERIF} text-[32px] leading-none font-semibold mt-2`}>{money(revenue.total)}</p>
            <p className="text-xs text-white/35 mt-1.5">
              {revenue.cuts} cut{revenue.cuts === 1 ? "" : "s"} completed
            </p>
          </div>
          <div className="text-right">
            <p className="text-[13px] text-white/40">{revenue.monthName}</p>
            {(revenue.total > 0 || revenue.lastMonthToDate > 0) && (
              <p className={`text-[13px] font-semibold mt-1 ${delta >= 0 ? "text-[var(--accent-color)]" : "text-white/50"}`}>
                {delta >= 0 ? "▲" : "▼"} {money(Math.abs(delta))} <span className="font-normal text-white/30">vs last mo</span>
              </p>
            )}
          </div>
        </div>
        {revenue.total > 0 ? (
          <RevenueChart points={revenue.points} current={revenue.currentWeek} />
        ) : (
          <p className="mt-4 rounded-xl bg-white/[0.03] px-4 py-3 text-[12px] text-white/40">
            Mark cuts as done on your Schedule and your month fills in here.
          </p>
        )}
      </Card>

      {/* Tiles */}
      <div className="grid grid-cols-2 gap-2.5">
        <Tile href="/dashboard/clients?filter=vip" label="VIPs" value={props.vips} sub="opted in" accent />
        <Tile
          href="/dashboard/messages"
          label="Missed calls caught"
          icon={I.phone}
          value={props.callsCaught}
          sub={props.autotextOn ? "texted back this week" : "auto-text is off"}
        />
        <Tile
          href="/dashboard/settings#marketing"
          label="Wed engine"
          icon={I.bolt}
          value={props.marketing === "on" && props.wednesdayOn ? props.wednesdayTargeted : "Off"}
          sub={
            props.marketing === "off"
              ? "SMS marketing is off"
              : props.marketing === "awaiting_sticker"
                ? "starts when your sticker is scanned"
                : props.wednesdayOn
                  ? "due for a nudge this week"
                  : "turn on in settings"
          }
          warm
        />
        <Tile href="/dashboard/schedule" label="Bookings" value={revenue.cuts} sub="completed this month" />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Link
          href="/dashboard/portfolio"
          className="h-12 rounded-xl bg-[var(--accent-color)] text-[var(--accent-fg)] text-sm font-semibold flex items-center justify-center gap-2 hover:-translate-y-px transition-transform"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
          Portfolio
        </Link>
        <Link
          href="/dashboard/messages?compose=broadcast"
          className="h-12 rounded-xl border border-white/[0.12] text-white/80 text-sm font-medium flex items-center justify-center gap-2 hover:border-[var(--accent-color)]/40 hover:text-white transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
          Broadcast
        </Link>
      </div>

      {!props.reviewsOn && (
        <Link href="/dashboard/settings#reviews" className="block">
          <Card className="px-4 py-3.5 flex items-center gap-3 hover:border-[var(--accent-color)]/25 transition-colors">
            <Icon d={I.star} className="text-[#E0926A]" />
            <span className="text-[13px] text-white/60 flex-1">Add your Google review link to ask happy clients for reviews.</span>
            <span className="text-[var(--accent-color)] text-sm">›</span>
          </Card>
        </Link>
      )}

      {props.suppressed.length > 0 && (
        <section>
          <SectionLabel>Calls not texted back</SectionLabel>
          <Card className="divide-y divide-white/[0.05]">
            {props.suppressed.slice(0, 5).map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                <Icon d={I.phone} size={14} className="text-[#E0926A]/70" />
                <span className="text-sm text-white/70 flex-1">{formatPhone(c.from_number)}</span>
                <span className="text-[11px] text-white/35">{reasonLabel(c.suppressed_reason)}</span>
              </div>
            ))}
            <p className="px-4 py-3 text-[11px] text-white/35 leading-relaxed">
              LineCatch only texts people who opted in. Ask these callers to scan your QR sticker next time they&apos;re in.
            </p>
          </Card>
        </section>
      )}

      <section>
        <SectionLabel>Recent activity</SectionLabel>
        {feed.length === 0 ? (
          <Card className="px-5 py-8 text-center text-[13px] text-white/40">Nothing yet. Bookings and caught calls show up here.</Card>
        ) : (
          <ul className="space-y-0.5">
            {feed.map((e) => {
              const cfg = EVENTS[e.event_type] ?? { icon: I.check, tone: "var(--accent-color)" };
              const price = typeof e.metadata?.price === "number" ? (e.metadata.price as number) : null;
              return (
                <li key={e.id} className="flex items-center gap-3 px-2.5 py-2.5 rounded-xl hover:bg-white/[0.03] transition-colors">
                  <span
                    className="w-9 h-9 shrink-0 rounded-[10px] flex items-center justify-center"
                    style={{ color: cfg.tone, background: `color-mix(in srgb, ${cfg.tone} 12%, transparent)` }}
                  >
                    <Icon d={cfg.icon} size={15} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-white/85 truncate">{e.description}</p>
                    <p className="text-[11px] text-white/30">{timeAgo(e.created_at, props.timezone)}</p>
                  </div>
                  {price !== null ? (
                    <span className={`${SERIF} text-[13px] font-semibold text-[var(--accent-color)]`}>${price}</span>
                  ) : cfg.tag ? (
                    <span className="text-[10px] font-bold uppercase tracking-[0.4px] px-1.5 py-[2px] rounded-[5px]" style={{ color: cfg.tone, background: `color-mix(in srgb, ${cfg.tone} 12%, transparent)` }}>
                      {cfg.tag}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {cursor && (
          <button onClick={loadMore} disabled={loadingMore} className="w-full mt-2 h-10 text-xs text-white/40 hover:text-white/70 disabled:opacity-40">
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        )}
      </section>
    </div>
  );
}

function reasonLabel(r: string | null) {
  if (r === "no_consent") return "not on VIP list";
  if (r === "opted_out") return "opted out";
  if (r === "trial_locked") return "texting not on yet";
  if (r === "autotext_disabled") return "auto-text off";
  return "not sent";
}

function Tile({ href, label, value, sub, icon, accent, warm }: { href: string; label: string; value: number | string; sub: string; icon?: React.ReactNode; accent?: boolean; warm?: boolean }) {
  return (
    <Link href={href} className="block group">
      <Card className="p-4 h-full transition-[transform,border-color] duration-150 group-hover:-translate-y-px group-hover:border-[var(--accent-color)]/20">
        <p className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.6px] ${warm ? "text-[#E0926A]" : "text-white/40"}`}>
          {icon && <Icon d={icon} size={12} />}
          {label}
        </p>
        <p className={`font-heading text-[24px] font-semibold mt-1.5 ${accent ? "text-[var(--accent-color)]" : ""}`}>{value}</p>
        <p className="text-[11px] text-white/35 mt-0.5 leading-snug">{sub}</p>
      </Card>
    </Link>
  );
}

/** Running revenue by week of the month: smooth line with a soft fill, future weeks left blank. */
function RevenueChart({ points, current }: { points: (number | null)[]; current: number }) {
  const W = 310, H = 92, pad = 6;
  const known = points.filter((p): p is number => p !== null);
  const max = Math.max(...known, 1);
  // Each point is the running total at the end of its week; the line starts at $0 on day 1.
  const step = (W - pad * 2) / points.length;
  const pts = [[pad, H - pad] as const, ...known.map((v, i) => [pad + (i + 1) * step, H - pad - (v / max) * (H - pad * 2)] as const)];
  const d = pts.reduce((acc, [x, y], i) => {
    if (i === 0) return `M${x},${y}`;
    const [px, py] = pts[i - 1];
    const cx = (px + x) / 2;
    return `${acc} C${cx},${py} ${cx},${y} ${x},${y}`;
  }, "");
  const last = pts[pts.length - 1];
  return (
    <div className="mt-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[92px]" role="img" aria-label="Revenue by week this month">
        <defs>
          <linearGradient id="rev-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-color)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--accent-color)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.33, 0.66].map((f) => (
          <line key={f} x1={pad} x2={W - pad} y1={H * f} y2={H * f} stroke="currentColor" className="text-white/[0.05]" />
        ))}
        <path d={`${d} L${last[0]},${H} L${pad},${H} Z`} fill="url(#rev-fill)" />
        <path d={d} fill="none" stroke="var(--accent-color)" strokeWidth="2" strokeLinecap="round" />
        <circle cx={last[0]} cy={last[1]} r="3.5" fill="var(--accent-color)" />
      </svg>
      <div className="grid mt-1.5 text-[10px] text-white/30 text-right" style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
        {points.map((_, i) => (
          <span key={i} className={i === current ? "text-[var(--accent-color)] font-semibold" : ""}>
            Week {i + 1}
          </span>
        ))}
      </div>
    </div>
  );
}

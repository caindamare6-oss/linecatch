"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader, Badge, SERIF } from "../ui";
import { PageSkeleton } from "@/components/ui/skeleton";
import { minutesInTz } from "@/lib/format";
import { formatPhone, clientPathId } from "@/lib/clients";

type Booking = {
  id: string;
  time: string;
  date: string;
  status: "confirmed" | "completed" | "no_show";
  phone: string;
  name: string | null;
  isVip: boolean;
  service: string;
  price: number;
  minutes: number;
  groupId: string | null;
};
type Hours = Record<string, { open: string; close: string } | null> | null;
type Data = { timezone: string; today: string; dates: string[]; hours: Hours; bookings: Booking[]; barberId: string };

const PX_PER_MIN = 1.2;
const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const dayOfWeek = (ymd: string) => new Date(`${ymd}T12:00:00Z`).getUTCDay();
const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const fmtDay = (ymd: string, o: Intl.DateTimeFormatOptions) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-US", { ...o, timeZone: "UTC" });
function clock(min: number, compact = false) {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  const hr = h % 12 === 0 ? 12 : h % 12;
  const ap = h < 12 ? "am" : "pm";
  return compact && m === 0 ? `${hr}${ap}` : `${hr}:${String(m).padStart(2, "0")}${ap}`;
}
const firstName = (b: Booking) => (b.name ? b.name.split(" ")[0] + (b.name.split(" ")[1] ? ` ${b.name.split(" ")[1][0]}.` : "") : formatPhone(b.phone));

export default function SchedulePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Schedule />
    </Suspense>
  );
}

function Schedule() {
  const params = useSearchParams();
  const highlight = params.get("booking");
  const [from, setFrom] = useState<string | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState<Booking | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async (start: string | null) => {
    const res = await fetch(`/api/schedule?days=7${start ? `&from=${start}` : ""}`);
    if (!res.ok) return setError("Couldn't load your schedule.");
    const d: Data = await res.json();
    setData(d);
    setSelected((s) => (s && d.dates.includes(s) ? s : d.dates.includes(d.today) ? d.today : d.dates[0]));
    if (highlight) {
      const b = d.bookings.find((x) => x.id === highlight);
      if (b) setSelected(b.date);
    }
  }, [highlight]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-change; state updates after the request resolves
    load(from);
  }, [from, load]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const day = useMemo(() => {
    if (!data || !selected) return null;
    const tz = data.timezone;
    const hours = data.hours?.[DAYS[dayOfWeek(selected)]] ?? null;
    const list = data.bookings.filter((b) => b.date === selected).map((b) => ({ ...b, start: minutesInTz(new Date(b.time), tz) }));
    // Show the open hours, stretched to fit anything booked outside them (a late add-on, hours changed after booking).
    let lo = hours ? toMin(hours.open) : 9 * 60;
    let hi = hours ? toMin(hours.close) : 18 * 60;
    for (const b of list) {
      lo = Math.min(lo, b.start);
      hi = Math.max(hi, b.start + b.minutes);
    }
    lo = Math.floor(lo / 60) * 60;
    hi = Math.ceil(hi / 60) * 60;
    const isToday = selected === data.today;
    const nowMin = minutesInTz(new Date(now), tz);
    const upNext = isToday ? list.find((b) => b.status === "confirmed" && b.start + b.minutes > nowMin) : undefined;
    return { hours, list, lo, hi, isToday, nowMin, upNext };
  }, [data, selected, now]);

  if (error) return <p className="text-sm text-white/50 py-10 text-center">{error}</p>;
  if (!data || !day || !selected) return <PageSkeleton />;

  const confirmed = day.list.filter((b) => b.status !== "no_show");
  const first = day.list.find((b) => b.status === "confirmed");
  const rangeLabel = `${fmtDay(data.dates[0], { month: "short", day: "numeric" })} – ${fmtDay(data.dates[data.dates.length - 1], { month: "short", day: "numeric" })}`;
  const isThisWeek = data.dates[0] === data.today;

  return (
    <>
      <PageHeader
        title="Schedule"
        right={
          <Link
            href={`/book/${data.barberId}?src=barber`}
            className="h-10 px-3.5 rounded-xl bg-[var(--accent-color)] text-[var(--accent-fg)] text-[13px] font-semibold flex items-center gap-1.5 hover:-translate-y-px transition-transform shadow-[0_6px_20px_color-mix(in_srgb,var(--accent-color)_22%,transparent)]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
            Book a client
          </Link>
        }
      />

      <div className="flex items-center justify-between mb-3">
        <NavBtn label="Previous week" onClick={() => setFrom(addDays(data.dates[0], -7))} d="M15 18l-6-6 6-6" />
        <button className="text-center" onClick={() => setFrom(null)} disabled={isThisWeek} title={isThisWeek ? undefined : "Back to today"}>
          <span className="block text-[15px] font-semibold">{isThisWeek ? "Next 7 days" : fmtDay(data.dates[0], { month: "long" })}</span>
          <span className="block text-[12px] text-white/45">{rangeLabel}{!isThisWeek && " · tap for today"}</span>
        </button>
        <NavBtn label="Next week" onClick={() => setFrom(addDays(data.dates[0], 7))} d="M9 18l6-6-6-6" />
      </div>

      <div className="grid grid-cols-7 gap-1.5 mb-5" role="tablist" aria-label="Day">
        {data.dates.map((d) => {
          const isSel = d === selected;
          const closed = !data.hours?.[DAYS[dayOfWeek(d)]];
          const count = data.bookings.filter((b) => b.date === d && b.status === "confirmed").length;
          return (
            <button
              key={d}
              role="tab"
              aria-selected={isSel}
              aria-label={`${fmtDay(d, { weekday: "long", month: "short", day: "numeric" })}, ${count} booked${closed ? ", closed" : ""}`}
              onClick={() => setSelected(d)}
              className={`h-[62px] rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors ${
                isSel ? "bg-[var(--accent-color)] text-[var(--accent-fg)]" : closed ? "bg-white/[0.03] text-white/25" : "bg-white/[0.05] text-white/80 hover:bg-white/[0.08]"
              }`}
            >
              <span className={`text-[11px] font-semibold ${isSel ? "" : "text-white/45"}`}>{fmtDay(d, { weekday: "short" })}</span>
              <span className={`${SERIF} text-[18px] font-semibold leading-none`}>{Number(d.slice(8))}</span>
              <span className={`w-1 h-1 rounded-full ${count ? (isSel ? "bg-[var(--accent-fg)]" : "bg-[var(--accent-color)]") : "bg-transparent"}`} />
            </button>
          );
        })}
      </div>

      <div className="flex items-baseline justify-between mb-3">
        <h2 className="font-sans text-[11px] font-bold uppercase tracking-[0.8px] text-white/45">
          {day.isToday ? "Today" : fmtDay(selected, { weekday: "long" })} · {confirmed.length} cut{confirmed.length === 1 ? "" : "s"}
        </h2>
        <span className="text-[12px] text-white/45">
          {day.hours ? `Opens ${clock(toMin(day.hours.open), true)}` : "Closed"}
          {first && ` · first: ${firstName(first).split(" ")[0]}`}
        </span>
      </div>

      {day.list.length === 0 && (
        <p className="text-[13px] text-white/35 mb-3">{day.hours ? "Nothing booked yet." : "You're closed this day."}</p>
      )}

      <div className="relative" style={{ height: (day.hi - day.lo) * PX_PER_MIN + 8 }}>
        {Array.from({ length: (day.hi - day.lo) / 60 + 1 }, (_, i) => day.lo + i * 60).map((m) => (
          <div key={m} className="absolute left-0 right-0 flex items-start gap-2" style={{ top: (m - day.lo) * PX_PER_MIN }}>
            <span className="w-10 -mt-[7px] text-[11px] text-white/30 text-right shrink-0">{clock(m, true)}</span>
            <span className="flex-1 border-t border-white/[0.05]" />
          </div>
        ))}
        {day.hours && (
          <>
            <Closed lo={day.lo} from={day.lo} to={toMin(day.hours.open)} />
            <Closed lo={day.lo} from={toMin(day.hours.close)} to={day.hi} />
          </>
        )}
        {day.isToday && day.nowMin >= day.lo && day.nowMin <= day.hi && (
          <div className="pointer-events-none absolute left-11 right-0 z-10 flex items-center" style={{ top: (day.nowMin - day.lo) * PX_PER_MIN }} aria-hidden>
            <span className="w-2 h-2 -ml-1 rounded-full bg-[#E0926A]" />
            <span className="flex-1 border-t border-[#E0926A]/70" />
          </div>
        )}
        {day.list.map((b) => {
          const isNext = day.upNext?.id === b.id;
          const done = b.status === "completed";
          const ns = b.status === "no_show";
          const h = Math.max(b.minutes * PX_PER_MIN - 4, 34);
          return (
            <button
              key={b.id}
              id={`booking-${b.id}`}
              onClick={() => setOpen(b)}
              className={`absolute left-12 right-0 rounded-xl border text-left px-3 py-2 flex gap-2.5 overflow-hidden transition-[transform,border-color] hover:-translate-y-px ${
                isNext
                  ? "bg-[var(--accent-color)]/[0.1] border-[var(--accent-color)]/45"
                  : done || ns
                    ? "bg-white/[0.025] border-white/[0.05] opacity-60"
                    : "bg-[#1B1A18] border-white/[0.08] hover:border-[var(--accent-color)]/30"
              } ${highlight === b.id ? "ring-2 ring-[var(--accent-color)]" : ""}`}
              style={{ top: (b.start - day.lo) * PX_PER_MIN + 2, height: h }}
            >
              <span className={`w-[3px] rounded-full shrink-0 ${isNext ? "bg-[var(--accent-color)]" : done ? "bg-[#A8C49A]" : "bg-white/20"}`} />
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className={`text-[14px] font-semibold truncate ${ns ? "line-through" : ""}`}>{firstName(b)}</span>
                  {isNext && <Badge tone="gold">Up next</Badge>}
                  {done && <Badge tone="vip">Done</Badge>}
                  {ns && <Badge tone="danger">No-show</Badge>}
                </span>
                {h > 44 && (
                  <span className="block text-[12px] text-white/45 truncate">
                    {clock(b.start)}–{clock(b.start + b.minutes)} · {b.service}
                  </span>
                )}
              </span>
              <span className={`${SERIF} text-[13px] font-semibold shrink-0 ${isNext ? "text-[var(--accent-color)]" : "text-white/55"}`}>${Math.round(b.price)}</span>
            </button>
          );
        })}
      </div>

      {open && (
        <BookingSheet
          booking={open}
          tz={data.timezone}
          started={new Date(open.time).getTime() <= now}
          onClose={() => setOpen(null)}
          onChanged={() => {
            setOpen(null);
            load(from);
          }}
        />
      )}
    </>
  );
}

function NavBtn({ label, onClick, d }: { label: string; onClick: () => void; d: string }) {
  return (
    <button onClick={onClick} aria-label={label} className="w-10 h-10 rounded-xl border border-white/[0.1] text-white/55 hover:text-white hover:border-white/25 flex items-center justify-center transition-colors">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d={d} /></svg>
    </button>
  );
}

function Closed({ lo, from, to }: { lo: number; from: number; to: number }) {
  if (to <= from) return null;
  return (
    <div
      aria-hidden
      className="absolute left-12 right-0 rounded-lg bg-[repeating-linear-gradient(135deg,rgba(242,238,230,0.025)_0_6px,transparent_6px_12px)]"
      style={{ top: (from - lo) * PX_PER_MIN, height: (to - from) * PX_PER_MIN }}
    />
  );
}

function BookingSheet({ booking: b, tz, started, onClose, onChanged }: { booking: Booking; tz: string; started: boolean; onClose: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState("");
  const start = new Date(b.time);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function act(action: "complete" | "no_show" | "cancel") {
    setBusy(action);
    setError("");
    const res = await fetch(`/api/bookings/${b.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const d = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setError(d.error || "That didn't work. Try again.");
    onChanged();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="bk-title">
      <button aria-label="Close" className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[#1B1A18] border border-white/[0.08] rounded-t-2xl sm:rounded-2xl p-5 pb-[calc(20px+env(safe-area-inset-bottom))]" style={{ animation: "ob-fade-up 220ms ease-out both" }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="bk-title" className={`${SERIF} text-xl font-semibold`}>{b.name || formatPhone(b.phone)}</h2>
            <p className="text-[13px] text-white/50 mt-0.5">
              {start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: tz })} ·{" "}
              {start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz })} · {b.minutes} min
            </p>
          </div>
          <span className={`${SERIF} text-lg font-semibold text-[var(--accent-color)]`}>${Math.round(b.price)}</span>
        </div>
        <p className="text-sm text-white/75 mt-3">{b.service}</p>

        <div className="grid grid-cols-2 gap-2 mt-4">
          <Link href={`/dashboard/messages/${clientPathId(b.phone)}`} className="h-11 rounded-xl border border-white/[0.1] text-[13px] font-medium text-white/75 flex items-center justify-center">Message</Link>
          <Link href={`/dashboard/clients/${clientPathId(b.phone)}`} className="h-11 rounded-xl border border-white/[0.1] text-[13px] font-medium text-white/75 flex items-center justify-center">Client profile</Link>
        </div>

        {b.status === "confirmed" ? (
          <div className="mt-2 space-y-2">
            <button
              onClick={() => act("complete")}
              disabled={!!busy}
              className="w-full h-12 rounded-xl bg-[var(--accent-color)] text-[var(--accent-fg)] font-semibold disabled:opacity-50"
            >
              {busy === "complete" ? "Saving…" : "Mark as done"}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => act("no_show")}
                disabled={!!busy || !started}
                title={started ? undefined : "Available once the appointment time passes"}
                className="h-11 rounded-xl border border-white/[0.1] text-[13px] text-white/70 disabled:opacity-35"
              >
                {busy === "no_show" ? "Saving…" : "No-show"}
              </button>
              <button
                onClick={() => (confirmCancel ? act("cancel") : setConfirmCancel(true))}
                disabled={!!busy}
                className={`h-11 rounded-xl border text-[13px] ${confirmCancel ? "border-[#F08A8A] bg-[#F08A8A]/10 text-[#F08A8A] font-semibold" : "border-[#F08A8A]/30 text-[#F08A8A]"}`}
              >
                {busy === "cancel" ? "Cancelling…" : confirmCancel ? "Tap to confirm" : "Cancel"}
              </button>
            </div>
            {confirmCancel && <p className="text-[11px] text-white/40 text-center">They&apos;ll get a text that the booking was cancelled.</p>}
          </div>
        ) : (
          <p className="mt-4 text-[13px] text-white/45 text-center">{b.status === "completed" ? "Marked done." : "Marked as a no-show."}</p>
        )}
        {error && <p className="mt-3 text-[13px] text-[#F08A8A]">{error}</p>}
      </div>
    </div>
  );
}

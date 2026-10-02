"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { barberLocalToUTC } from "@/lib/format";
import { money } from "@/lib/config";
import { REWARD_CENTS } from "@/lib/loyalty-rules";
import { useT, useFormat, useLocale, LanguageToggle } from "@/lib/i18n";
import { PageSkeleton } from "@/components/ui/skeleton";

const CUTOFF_HOURS = 3;

type BookingData = {
  id: string;
  status: string;
  bookingTime: string;
  userId: string;
  serviceId: string;
  service: { name: string; price: number; duration_minutes: number } | null;
  businessName: string | null;
  timezone: string;
  partySize: number;
  rewardDue: boolean;
};

export default function ManageBookingPage() {
  const params = useParams();
  const bookingId = params.id as string;
  const t = useT();
  const f = useFormat();
  const locale = useLocale();

  const [booking, setBooking] = useState<BookingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<"details" | "reschedule" | "confirm-cancel" | "done">("details");
  const [actionResult, setActionResult] = useState("");

  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsFor, setSlotsFor] = useState("");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/bookings/${bookingId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setBooking(data);
          if (data.accentColor) document.documentElement.style.setProperty("--accent-color", data.accentColor);
        }
        setLoading(false);
      })
      .catch(() => {
        setError(t("manage.load_error"));
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per booking, not per language
  }, [bookingId]);

  // Slots shown are for `slotsFor`; a different picked date is still loading.
  const slotsLoading = !!selectedDate && slotsFor !== selectedDate;

  useEffect(() => {
    if (!selectedDate || !booking?.serviceId) return;
    let cancelled = false;
    fetch(`/api/bookings/slots?userId=${booking.userId}&date=${selectedDate}&serviceId=${booking.serviceId}&partySize=${booking.partySize || 1}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setSlots(data.slots || []);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      })
      .finally(() => {
        if (!cancelled) setSlotsFor(selectedDate);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDate, booking?.serviceId, booking?.userId, booking?.partySize]);

  function isWithinWindow(): boolean {
    if (!booking) return false;
    const bt = new Date(booking.bookingTime);
    const now = new Date();
    const hoursUntil = (bt.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntil > CUTOFF_HOURS;
  }

  async function handleCancel() {
    setSubmitting(true);
    const res = await fetch(`/api/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel", source: "client" }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (data.success) {
      setActionResult("cancelled");
      setView("done");
    } else {
      setError(data.error || t("manage.failed_cancel"));
    }
  }

  async function handleReschedule() {
    if (!selectedDate || !selectedTime || !booking) return;
    setSubmitting(true);
    const newTime = barberLocalToUTC(selectedDate, selectedTime, booking.timezone);
    const res = await fetch(`/api/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reschedule", newTime: newTime.toISOString(), source: "client" }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (data.success) {
      setActionResult("rescheduled");
      setView("done");
    } else {
      setError(data.error || t("manage.failed_reschedule"));
    }
  }

  // "16:30" on the shop's clock → "4:30 PM" / "4:30 p. m."
  function formatTime(slot: string) {
    const [h, m] = slot.split(":").map(Number);
    return f.time(new Date(2000, 0, 1, h, m));
  }

  function renderCalendar() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Jan 7 2024 was a Sunday.
    const dayHeaders = Array.from({ length: 7 }, (_, i) => f.date(new Date(2024, 0, 7 + i), { weekday: "narrow" }));
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    const canGoPrev = year > today.getFullYear() || (year === today.getFullYear() && month > today.getMonth());

    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => canGoPrev && setCurrentMonth(new Date(year, month - 1, 1))}
            aria-label={t("manage.prev_month")}
            className={`p-1 rounded ${canGoPrev ? "text-white/50 hover:text-white" : "text-white/10 cursor-default"}`}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-medium text-white/70">
            {f.date(currentMonth, { month: "long", year: "numeric" })}
          </span>
          <button
            onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}
            aria-label={t("manage.next_month")}
            className="p-1 rounded text-white/50 hover:text-white"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {dayHeaders.map((d, i) => (
            <div key={i} className="text-center text-[11px] text-white/30 py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (day === null) return <div key={`empty-${i}`} />;
            const dateStr = `${year}-${(month + 1).toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
            const cellDate = new Date(year, month, day);
            const isPast = cellDate < today;
            const isSelected = dateStr === selectedDate;
            return (
              <button
                key={dateStr}
                disabled={isPast}
                onClick={() => { setSelectedDate(dateStr); setSelectedTime(""); }}
                className={`py-2 text-sm rounded-lg transition-all ${
                  isPast ? "text-white/10 cursor-default"
                    : isSelected ? "bg-[var(--accent-color)] text-[var(--accent-fg)] font-semibold"
                    : "text-white/60 hover:bg-white/[0.06]"
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#121110] flex items-center justify-center">
        <PageSkeleton />
      </div>
    );
  }

  if (error && !booking) {
    return (
      <div className="min-h-screen bg-[#121110] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-400 mb-2">{error}</p>
          <p className="text-white/30 text-sm">{t("manage.maybe_expired")}</p>
        </div>
      </div>
    );
  }

  if (!booking) return null;

  const bt = new Date(booking.bookingTime);
  const displayName = booking.businessName || t("manage.your_barber");
  const dateLabel = f.date(bt, { weekday: "long", month: "long", day: "numeric", timeZone: booking.timezone });
  const timeLabel = f.time(bt, { hour: "numeric", minute: "2-digit", timeZone: booking.timezone });
  const canModify = booking.status === "confirmed" && isWithinWindow();
  const tooLate = booking.status === "confirmed" && !isWithinWindow();

  if (view === "done") {
    return (
      <div className="min-h-screen bg-[#121110] flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-[#1B1A18] rounded-2xl p-8 border border-[#2C2A27] text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--accent-color) 10%, transparent)' }}>
            <svg className="w-8 h-8 text-[var(--accent-color)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">
            {actionResult === "cancelled" ? t("manage.cancelled_title") : t("manage.rescheduled_title")}
          </h2>
          <p className="text-stone-400 text-sm">
            {actionResult === "cancelled"
              ? t("manage.cancelled_body", { name: displayName })
              : t("manage.rescheduled_body")}
          </p>
        </div>
      </div>
    );
  }

  if (view === "confirm-cancel") {
    return (
      <div className="min-h-screen bg-[#121110] flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-[#1B1A18] rounded-2xl p-6 border border-[#2C2A27]">
          <h2 className="text-lg font-bold text-white mb-2">{t("manage.cancel_q")}</h2>
          <p className="text-stone-400 text-sm mb-6">
            {t("manage.cancel_summary", { service: booking.service?.name || "", name: displayName, date: dateLabel, time: timeLabel })}
          </p>
          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
          <div className="flex gap-3">
            <button
              onClick={() => { setView("details"); setError(""); }}
              className="flex-1 py-3 rounded-xl border border-white/[0.08] text-white/50 text-sm hover:bg-white/[0.04]"
            >
              {t("manage.go_back")}
            </button>
            <button
              onClick={handleCancel}
              disabled={submitting}
              className="flex-1 py-3 rounded-xl bg-red-500 text-white font-semibold text-sm hover:bg-red-600 disabled:opacity-50"
            >
              {submitting ? t("manage.cancelling") : t("manage.yes_cancel")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === "reschedule") {
    return (
      <div className="min-h-screen bg-[#121110] px-4 py-8">
        <div className="max-w-md mx-auto">
          <button
            onClick={() => { setView("details"); setSelectedDate(""); setSelectedTime(""); setError(""); }}
            className="text-sm text-white/30 hover:text-white/50 mb-4 flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" /> {t("common.back")}
          </button>

          <h2 className="text-lg font-bold text-white mb-4">{t("manage.pick_new_time")}</h2>

          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 mb-4">
            {renderCalendar()}
          </div>

          {selectedDate && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
              <p className="text-xs text-white/30 mb-3">{t("manage.available_times")}</p>
              {slotsLoading ? (
                <div className="flex justify-center py-4">
                  <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'color-mix(in srgb, var(--accent-color) 30%, transparent)', borderTopColor: 'var(--accent-color)' }} />
                </div>
              ) : slots.length === 0 ? (
                <p className="text-white/20 text-sm text-center py-4">{t("manage.no_slots")}</p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {slots.map((slot) => (
                      <button
                        key={slot}
                        onClick={() => setSelectedTime(slot)}
                        className={`py-2 px-1 rounded-lg text-sm transition-all ${
                          selectedTime === slot
                            ? "bg-[var(--accent-color)] text-[var(--accent-fg)] font-semibold"
                            : "bg-white/[0.04] text-white/50 hover:bg-white/[0.08]"
                        }`}
                      >
                        {formatTime(slot)}
                      </button>
                    ))}
                  </div>
                  {selectedTime && (
                    <button
                      onClick={handleReschedule}
                      disabled={submitting}
                      className="w-full mt-4 bg-[var(--accent-color)] text-[var(--accent-fg)] font-semibold py-3 rounded-xl hover:brightness-90 disabled:opacity-50 transition"
                    >
                      {submitting ? t("manage.rescheduling") : t("manage.confirm_new_time")}
                    </button>
                  )}
                </>
              )}
              {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
            </div>
          )}
        </div>
      </div>
    );
  }

  const statusTone = booking.status === "confirmed" ? "var(--accent-color)" : booking.status === "completed" ? "#A8C49A" : "#F08A8A";
  const priceCents = booking.service ? Math.max(Math.round(booking.service.price * 100) * (booking.partySize || 1) - (booking.rewardDue ? REWARD_CENTS : 0), 0) : 0;
  const statusLabel = ["confirmed", "completed", "cancelled", "no_show"].includes(booking.status) ? t(`manage.status_${booking.status}`) : booking.status;

  return (
    <div className="min-h-screen bg-[#121110] text-white flex flex-col">
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col px-6">
        <header className="pt-6" style={{ animation: "ob-fade-up 450ms ease-out both" }}>
          <div className="flex items-center gap-2.5 mb-5">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color)" strokeWidth="2" aria-hidden><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z" /></svg>
            <span className="font-heading text-lg font-bold text-[var(--accent-color)]">LineCatch</span>
            <LanguageToggle className="ml-auto" />
          </div>
          <h1 className="font-heading text-[26px] font-semibold tracking-[-0.5px]">{t("manage.title")}</h1>
          <p className="text-[13px] text-white/40 mt-1">{displayName}</p>
        </header>

        <main className="flex-1 pb-6" style={{ animation: "ob-fade-up 450ms ease-out 120ms both" }}>
          <span
            className="mt-5 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-[12px] font-semibold uppercase tracking-[0.5px]"
            style={{ color: statusTone, borderColor: `color-mix(in srgb, ${statusTone} 25%, transparent)`, background: `color-mix(in srgb, ${statusTone} 8%, transparent)` }}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: statusTone }} />
            {statusLabel}
          </span>

          <div className="mt-4 rounded-[18px] bg-white/[0.025] border border-white/[0.07] px-5 py-1">
            {booking.service && (
              <Detail tone="var(--accent-color)" label={t("manage.service")} title={`${booking.service.name}${booking.partySize > 1 ? t("manage.party_suffix", { n: booking.partySize }) : ""}`} sub={`${t("manage.minutes", { n: booking.service.duration_minutes * (booking.partySize || 1) })}${priceCents > 0 ? ` · ${money(priceCents, locale)}` : ""}${booking.rewardDue ? t("manage.reward_applied", { amount: money(REWARD_CENTS, locale) }) : ""}`} icon={<><path d="M6 3a3 3 0 100 6 3 3 0 000-6zM6 15a3 3 0 100 6 3 3 0 000-6z" /><path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12" /></>} />
            )}
            <Detail tone="#8FB8DE" label={t("manage.date")} title={dateLabel} icon={<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>} />
            <Detail tone="#E0926A" label={t("manage.time")} title={timeLabel} icon={<><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>} last />
          </div>

          {canModify && (
            <div className="mt-6 flex flex-col gap-2.5">
              <button
                onClick={() => setView("reschedule")}
                className="h-[52px] rounded-[14px] bg-[var(--accent-color)] text-[var(--accent-fg)] font-bold flex items-center justify-center gap-2 hover:shadow-[0_6px_24px_color-mix(in_srgb,var(--accent-color)_30%,transparent)] transition-shadow"
              >
                {t("manage.reschedule")}
              </button>
              <button
                onClick={() => setView("confirm-cancel")}
                className="h-[52px] rounded-[14px] border-2 border-[#EF4444]/30 text-[#F08A8A] font-bold hover:border-[#EF4444]/50 transition-colors"
              >
                {t("manage.cancel_booking")}
              </button>
            </div>
          )}

          {booking.status === "confirmed" && (
            <p className={`mt-4 rounded-[10px] px-3.5 py-3 text-[12px] leading-relaxed border ${tooLate ? "bg-[#E0926A]/10 border-[#E0926A]/25 text-[#E0926A]" : "bg-[#E0926A]/[0.04] border-[#E0926A]/10 text-white/40"}`}>
              {tooLate
                ? t("manage.too_late", { hours: CUTOFF_HOURS })
                : t("manage.window_note", { hours: CUTOFF_HOURS })}
            </p>
          )}

          {booking.status !== "confirmed" && (
            <p className="mt-6 text-center text-[13px] text-white/45">
              {booking.status === "cancelled" ? t("manage.was_cancelled") : booking.status === "completed" ? t("manage.thanks") : t("manage.was_missed")}
            </p>
          )}
        </main>

        <footer className="py-6 text-center">
          <a href={`/book/${booking.userId}`} className="text-[13px] text-[var(--accent-color)]/60 hover:text-[var(--accent-color)] transition-colors">
            {t("manage.book_another")}
          </a>
        </footer>
      </div>
    </div>
  );
}

function Detail({ icon, tone, label, title, sub, last }: { icon: React.ReactNode; tone: string; label: string; title: string; sub?: string; last?: boolean }) {
  return (
    <div className={`flex items-center gap-3.5 py-3.5 ${last ? "" : "border-b border-white/[0.05]"}`}>
      <span className="w-[42px] h-[42px] rounded-xl flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${tone} 8%, transparent)`, color: tone }} aria-hidden>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">{icon}</svg>
      </span>
      <div className="min-w-0">
        <p className="text-[12px] text-white/35">{label}</p>
        <p className="text-[16px] font-semibold">{title}</p>
        {sub && <p className="text-[13px] text-white/40">{sub}</p>}
      </div>
    </div>
  );
}

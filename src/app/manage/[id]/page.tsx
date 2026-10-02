"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatBarberDate, formatBarberTime, barberLocalToUTC } from "@/lib/format";
import { PageSkeleton } from "@/components/ui/skeleton";

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

  const [booking, setBooking] = useState<BookingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<"details" | "reschedule" | "confirm-cancel" | "done">("details");
  const [actionResult, setActionResult] = useState("");

  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
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
        setError("Could not load booking");
        setLoading(false);
      });
  }, [bookingId]);

  useEffect(() => {
    if (!selectedDate || !booking?.serviceId) return;
    setSlotsLoading(true);
    fetch(`/api/bookings/slots?userId=${booking.userId}&date=${selectedDate}&serviceId=${booking.serviceId}&partySize=${booking.partySize || 1}`)
      .then((r) => r.json())
      .then((data) => {
        setSlots(data.slots || []);
        setSlotsLoading(false);
      })
      .catch(() => setSlotsLoading(false));
  }, [selectedDate, booking?.serviceId, booking?.userId]);

  function isWithinWindow(): boolean {
    if (!booking) return false;
    const bt = new Date(booking.bookingTime);
    const now = new Date();
    const hoursUntil = (bt.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntil > 3;
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
      setError(data.error || "Failed to cancel");
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
      setError(data.error || "Failed to reschedule");
    }
  }

  function formatTime(t: string) {
    const [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
  }

  function renderCalendar() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dayHeaders = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    const canGoPrev = year > today.getFullYear() || (year === today.getFullYear() && month > today.getMonth());

    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => canGoPrev && setCurrentMonth(new Date(year, month - 1, 1))}
            className={`p-1 rounded ${canGoPrev ? "text-white/50 hover:text-white" : "text-white/10 cursor-default"}`}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-medium text-white/70">
            {currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </span>
          <button
            onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}
            className="p-1 rounded text-white/50 hover:text-white"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {dayHeaders.map((d) => (
            <div key={d} className="text-center text-[11px] text-white/30 py-1">{d}</div>
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
          <p className="text-white/30 text-sm">This booking may not exist or the link may have expired.</p>
        </div>
      </div>
    );
  }

  if (!booking) return null;

  const bt = new Date(booking.bookingTime);
  const displayName = booking.businessName || "your barber";
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
            {actionResult === "cancelled" ? "Booking Cancelled" : "Booking Rescheduled"}
          </h2>
          <p className="text-stone-400 text-sm">
            {actionResult === "cancelled"
              ? `Your appointment with ${displayName} has been cancelled. Your barber has been notified.`
              : `Your appointment has been moved. Your barber has been notified.`}
          </p>
        </div>
      </div>
    );
  }

  if (view === "confirm-cancel") {
    return (
      <div className="min-h-screen bg-[#121110] flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-[#1B1A18] rounded-2xl p-6 border border-[#2C2A27]">
          <h2 className="text-lg font-bold text-white mb-2">Cancel this appointment?</h2>
          <p className="text-stone-400 text-sm mb-6">
            {booking.service?.name} with {displayName} on{" "}
            {formatBarberDate(bt, booking.timezone)} at{" "}
            {formatBarberTime(bt, booking.timezone)}
          </p>
          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
          <div className="flex gap-3">
            <button
              onClick={() => { setView("details"); setError(""); }}
              className="flex-1 py-3 rounded-xl border border-white/[0.08] text-white/50 text-sm hover:bg-white/[0.04]"
            >
              Go back
            </button>
            <button
              onClick={handleCancel}
              disabled={submitting}
              className="flex-1 py-3 rounded-xl bg-red-500 text-white font-semibold text-sm hover:bg-red-600 disabled:opacity-50"
            >
              {submitting ? "Cancelling..." : "Yes, cancel"}
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
            <ChevronLeft className="w-4 h-4" /> Back
          </button>

          <h2 className="text-lg font-bold text-white mb-4">Pick a new time</h2>

          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 mb-4">
            {renderCalendar()}
          </div>

          {selectedDate && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
              <p className="text-xs text-white/30 mb-3">Available times</p>
              {slotsLoading ? (
                <div className="flex justify-center py-4">
                  <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'color-mix(in srgb, var(--accent-color) 30%, transparent)', borderTopColor: 'var(--accent-color)' }} />
                </div>
              ) : slots.length === 0 ? (
                <p className="text-white/20 text-sm text-center py-4">No available slots this day</p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {slots.map((t) => (
                      <button
                        key={t}
                        onClick={() => setSelectedTime(t)}
                        className={`py-2 px-1 rounded-lg text-sm transition-all ${
                          selectedTime === t
                            ? "bg-[var(--accent-color)] text-[var(--accent-fg)] font-semibold"
                            : "bg-white/[0.04] text-white/50 hover:bg-white/[0.08]"
                        }`}
                      >
                        {formatTime(t)}
                      </button>
                    ))}
                  </div>
                  {selectedTime && (
                    <button
                      onClick={handleReschedule}
                      disabled={submitting}
                      className="w-full mt-4 bg-[var(--accent-color)] text-[var(--accent-fg)] font-semibold py-3 rounded-xl hover:brightness-90 disabled:opacity-50 transition"
                    >
                      {submitting ? "Rescheduling..." : "Confirm new time"}
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
  const price = booking.service ? Math.max(booking.service.price * (booking.partySize || 1) - (booking.rewardDue ? 5 : 0), 0) : 0;

  return (
    <div className="min-h-screen bg-[#121110] text-white flex flex-col">
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col px-6">
        <header className="pt-6" style={{ animation: "ob-fade-up 450ms ease-out both" }}>
          <div className="flex items-center gap-2.5 mb-5">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color)" strokeWidth="2" aria-hidden><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z" /></svg>
            <span className="font-heading text-lg font-bold text-[var(--accent-color)]">LineCatch</span>
          </div>
          <h1 className="font-heading text-[26px] font-semibold tracking-[-0.5px]">Manage booking</h1>
          <p className="text-[13px] text-white/40 mt-1">{displayName}</p>
        </header>

        <main className="flex-1 pb-6" style={{ animation: "ob-fade-up 450ms ease-out 120ms both" }}>
          <span
            className="mt-5 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-[12px] font-semibold uppercase tracking-[0.5px]"
            style={{ color: statusTone, borderColor: `color-mix(in srgb, ${statusTone} 25%, transparent)`, background: `color-mix(in srgb, ${statusTone} 8%, transparent)` }}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: statusTone }} />
            {booking.status === "no_show" ? "Missed" : booking.status}
          </span>

          <div className="mt-4 rounded-[18px] bg-white/[0.025] border border-white/[0.07] px-5 py-1">
            {booking.service && (
              <Detail tone="var(--accent-color)" label="Service" title={`${booking.service.name}${booking.partySize > 1 ? ` · party of ${booking.partySize}` : ""}`} sub={`${booking.service.duration_minutes * (booking.partySize || 1)} min${price > 0 ? ` · $${price}` : ""}${booking.rewardDue ? " ($5 loyalty reward applied)" : ""}`} icon={<><path d="M6 3a3 3 0 100 6 3 3 0 000-6zM6 15a3 3 0 100 6 3 3 0 000-6z" /><path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12" /></>} />
            )}
            <Detail tone="#8FB8DE" label="Date" title={formatBarberDate(bt, booking.timezone)} icon={<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>} />
            <Detail tone="#E0926A" label="Time" title={formatBarberTime(bt, booking.timezone)} icon={<><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>} last />
          </div>

          {canModify && (
            <div className="mt-6 flex flex-col gap-2.5">
              <button
                onClick={() => setView("reschedule")}
                className="h-[52px] rounded-[14px] bg-[var(--accent-color)] text-[var(--accent-fg)] font-bold flex items-center justify-center gap-2 hover:shadow-[0_6px_24px_color-mix(in_srgb,var(--accent-color)_30%,transparent)] transition-shadow"
              >
                Reschedule
              </button>
              <button
                onClick={() => setView("confirm-cancel")}
                className="h-[52px] rounded-[14px] border-2 border-[#EF4444]/30 text-[#F08A8A] font-bold hover:border-[#EF4444]/50 transition-colors"
              >
                Cancel booking
              </button>
            </div>
          )}

          {booking.status === "confirmed" && (
            <p className={`mt-4 rounded-[10px] px-3.5 py-3 text-[12px] leading-relaxed border ${tooLate ? "bg-[#E0926A]/10 border-[#E0926A]/25 text-[#E0926A]" : "bg-[#E0926A]/[0.04] border-[#E0926A]/10 text-white/40"}`}>
              {tooLate
                ? "Your appointment is less than 3 hours away, so it can't be changed here. Call or text the shop."
                : "Changes can be made up to 3 hours before your appointment. After that, contact the shop directly."}
            </p>
          )}

          {booking.status !== "confirmed" && (
            <p className="mt-6 text-center text-[13px] text-white/45">
              {booking.status === "cancelled" ? "This booking was cancelled." : booking.status === "completed" ? "Thanks for coming in." : "This appointment was missed."}
            </p>
          )}
        </main>

        <footer className="py-6 text-center">
          <a href={`/book/${booking.userId}`} className="text-[13px] text-[var(--accent-color)]/60 hover:text-[var(--accent-color)] transition-colors">
            Book another appointment →
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

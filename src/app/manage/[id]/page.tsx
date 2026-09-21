"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

type BookingData = {
  id: string;
  status: string;
  bookingTime: string;
  userId: string;
  serviceId: string;
  service: { name: string; price: number; duration_minutes: number } | null;
  businessName: string | null;
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
    fetch(`/api/bookings/slots?userId=${booking.userId}&date=${selectedDate}&serviceId=${booking.serviceId}`)
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
    if (!selectedDate || !selectedTime) return;
    setSubmitting(true);
    const newTime = new Date(`${selectedDate}T${selectedTime}:00`);
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
                    : isSelected ? "bg-[#00F5A0] text-[#0d0d0d] font-semibold"
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
      <div className="min-h-screen bg-[#111111] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[#00F5A0]/30 border-t-[#00F5A0] rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !booking) {
    return (
      <div className="min-h-screen bg-[#111111] flex items-center justify-center px-4">
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
      <div className="min-h-screen bg-[#111111] flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-[#1a1a1a] rounded-2xl p-8 border border-[#2a2a2a] text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#00F5A0]/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-[#00F5A0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">
            {actionResult === "cancelled" ? "Booking Cancelled" : "Booking Rescheduled"}
          </h2>
          <p className="text-gray-400 text-sm">
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
      <div className="min-h-screen bg-[#111111] flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-[#1a1a1a] rounded-2xl p-6 border border-[#2a2a2a]">
          <h2 className="text-lg font-bold text-white mb-2">Cancel this appointment?</h2>
          <p className="text-gray-400 text-sm mb-6">
            {booking.service?.name} with {displayName} on{" "}
            {bt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} at{" "}
            {bt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
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
      <div className="min-h-screen bg-[#111111] px-4 py-8">
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
                  <div className="w-4 h-4 border-2 border-[#00F5A0]/30 border-t-[#00F5A0] rounded-full animate-spin" />
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
                            ? "bg-[#00F5A0] text-[#0d0d0d] font-semibold"
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
                      className="w-full mt-4 bg-[#00F5A0] text-[#0d0d0d] font-semibold py-3 rounded-xl hover:bg-[#00D98A] disabled:opacity-50 transition"
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

  return (
    <div className="min-h-screen bg-[#111111] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-2xl font-bold text-white mb-1">
            Line<span className="text-[#00F5A0]">Catch</span>
          </div>
          <p className="text-gray-400 text-sm">Manage your appointment</p>
        </div>

        <div className="bg-[#1a1a1a] rounded-2xl p-6 border border-[#2a2a2a]">
          <div className="space-y-3 mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Barber</span>
              <span className="text-white/80">{displayName}</span>
            </div>
            {booking.service && (
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Service</span>
                <span className="text-white/80">{booking.service.name}</span>
              </div>
            )}
            {booking.service && booking.service.price > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Price</span>
                <span className="text-[#00F5A0]">${booking.service.price}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Date</span>
              <span className="text-white/80">
                {bt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Time</span>
              <span className="text-white/80">
                {bt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Status</span>
              <span className={`font-medium ${
                booking.status === "confirmed" ? "text-[#00F5A0]"
                  : booking.status === "completed" ? "text-blue-400"
                  : "text-red-400"
              }`}>
                {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
              </span>
            </div>
          </div>

          {tooLate && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-center">
              <p className="text-yellow-400 text-sm font-medium mb-1">Too late to change</p>
              <p className="text-yellow-400/60 text-xs">Your appointment is less than 3 hours away. Contact your barber directly.</p>
            </div>
          )}

          {booking.status !== "confirmed" && (
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 text-center">
              <p className="text-white/40 text-sm">
                This booking has been {booking.status}.
              </p>
            </div>
          )}

          {canModify && (
            <div className="flex gap-3">
              <button
                onClick={() => setView("reschedule")}
                className="flex-1 py-3 rounded-xl bg-[#00F5A0] text-[#0d0d0d] font-semibold text-sm hover:bg-[#00D98A] transition"
              >
                Reschedule
              </button>
              <button
                onClick={() => setView("confirm-cancel")}
                className="flex-1 py-3 rounded-xl border border-red-500/30 text-red-400 font-semibold text-sm hover:bg-red-500/10 transition"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

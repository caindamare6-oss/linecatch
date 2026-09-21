"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";

const CONSENT_TEXT = "By checking this box, I consent to receive SMS messages from this business, including appointment reminders, confirmations, and offers. Message and data rates may apply. I can reply STOP to opt out or HELP for assistance at any time.";

type Service = {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
};

export default function BookingPage() {
  const params = useParams();
  const bookingSearchParams = useSearchParams();
  const barberId = params.id as string;
  const bookingSource = bookingSearchParams.get("src") || "direct";

  const [step, setStep] = useState<"service" | "date" | "time" | "phone" | "done">("service");
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [slotsLoading, setSlotsLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const [servicesRes, barberRes] = await Promise.all([
        fetch(`/api/services/${barberId}`),
        fetch(`/api/vip-optin?barberId=${barberId}`),
      ]);
      if (servicesRes.ok) {
        const data = await servicesRes.json();
        setServices(data.services);
      }
      if (barberRes.ok) {
        const data = await barberRes.json();
        if (data.businessName) setBusinessName(data.businessName);
      }
      setLoading(false);
    }
    load();
  }, [barberId]);

  useEffect(() => {
    if (!selectedDate || !selectedService) return;
    setSlotsLoading(true);
    fetch(
      `/api/bookings/slots?userId=${barberId}&date=${selectedDate}&serviceId=${selectedService.id}`
    )
      .then((r) => r.json())
      .then((data) => {
        setSlots(data.slots || []);
        setSlotsLoading(false);
      })
      .catch(() => setSlotsLoading(false));
  }, [selectedDate, selectedService, barberId]);

  async function handleBook() {
    if (!selectedService || !selectedDate || !selectedTime || !phone) return;
    if (!consentChecked) {
      setError("You must agree to receive SMS messages to book.");
      return;
    }
    setError("");
    setSubmitting(true);

    const bookingTime = new Date(`${selectedDate}T${selectedTime}:00`);

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: barberId,
          serviceId: selectedService.id,
          customerPhone: phone,
          bookingTime: bookingTime.toISOString(),
          firstName: firstName.trim() || undefined,
          consentText: CONSENT_TEXT,
          source: bookingSource,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Booking failed");
        setSubmitting(false);
        return;
      }
      setStep("done");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
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

    const canGoPrev =
      year > today.getFullYear() ||
      (year === today.getFullYear() && month > today.getMonth());

    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() =>
              canGoPrev && setCurrentMonth(new Date(year, month - 1, 1))
            }
            className={`p-1 rounded ${canGoPrev ? "text-white/50 hover:text-white" : "text-white/10 cursor-default"}`}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-medium text-white/70">
            {currentMonth.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
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
            <div
              key={d}
              className="text-center text-[11px] text-white/30 py-1"
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (day === null)
              return <div key={`empty-${i}`} />;
            const dateStr = `${year}-${(month + 1).toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
            const cellDate = new Date(year, month, day);
            const isPast = cellDate < today;
            const isSelected = dateStr === selectedDate;

            return (
              <button
                key={dateStr}
                disabled={isPast}
                onClick={() => {
                  setSelectedDate(dateStr);
                  setSelectedTime("");
                }}
                className={`py-2 text-sm rounded-lg transition-all ${
                  isPast
                    ? "text-white/10 cursor-default"
                    : isSelected
                      ? "bg-[#00F5A0] text-[#0d0d0d] font-semibold"
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

  const displayName = businessName || "Book an Appointment";

  if (loading) {
    return (
      <div className="min-h-screen bg-[#111111] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[#00F5A0]/30 border-t-[#00F5A0] rounded-full animate-spin" />
      </div>
    );
  }

  if (step === "done") {
    const bookingDate = new Date(`${selectedDate}T${selectedTime}:00`);
    return (
      <div className="min-h-screen bg-[#111111] flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-[#1a1a1a] rounded-2xl p-8 border border-[#2a2a2a] text-center">
          <CheckCircle2 className="w-16 h-16 text-[#00F5A0] mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Booked!</h2>
          <p className="text-gray-400 mb-2">
            {selectedService?.name} with {displayName}
          </p>
          <p className="text-white/70 font-medium mb-1">
            {bookingDate.toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
          <p className="text-[#00F5A0] font-semibold text-lg mb-6">
            {formatTime(selectedTime)}
          </p>
          <p className="text-sm text-gray-500">
            A confirmation text has been sent to your phone. You&apos;ll get
            reminders at 24 hours and 2 hours before.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111111] px-4 py-8">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-2xl font-bold text-white mb-1">
            Line<span className="text-[#00F5A0]">Catch</span>
          </div>
          <p className="text-gray-400 text-sm">{displayName}</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-6">
          {["Service", "Date & Time", "Confirm"].map((label, i) => {
            const stepIndex =
              step === "service" ? 0 : step === "date" || step === "time" ? 1 : 2;
            return (
              <div key={label} className="flex-1">
                <div
                  className={`h-1 rounded-full transition-colors ${
                    i <= stepIndex ? "bg-[#00F5A0]" : "bg-white/[0.06]"
                  }`}
                />
                <p
                  className={`text-[10px] mt-1 ${
                    i <= stepIndex ? "text-[#00F5A0]" : "text-white/20"
                  }`}
                >
                  {label}
                </p>
              </div>
            );
          })}
        </div>

        {/* Step 1: Pick Service */}
        {step === "service" && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-white/50 mb-3">
              Choose a service
            </h3>
            {services.length === 0 ? (
              <p className="text-white/30 text-sm text-center py-8">
                No services available right now.
              </p>
            ) : (
              services.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSelectedService(s);
                    setStep("date");
                  }}
                  className="w-full text-left p-4 rounded-xl border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.1] transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white/80 font-medium">{s.name}</p>
                      <p className="text-white/30 text-xs">
                        {s.duration_minutes} min
                      </p>
                    </div>
                    {s.price > 0 && (
                      <span className="text-[#00F5A0] font-semibold">
                        ${s.price}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {/* Step 2: Pick Date & Time */}
        {(step === "date" || step === "time") && (
          <div>
            <button
              onClick={() => {
                setStep("service");
                setSelectedDate("");
                setSelectedTime("");
              }}
              className="text-sm text-white/30 hover:text-white/50 mb-4 flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>

            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 mb-4">
              <p className="text-xs text-white/30 mb-1">Selected service</p>
              <div className="flex justify-between items-center">
                <span className="text-white/70 text-sm">
                  {selectedService?.name}
                </span>
                {selectedService && selectedService.price > 0 && (
                  <span className="text-[#00F5A0] text-sm font-medium">
                    ${selectedService.price}
                  </span>
                )}
              </div>
            </div>

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
                  <p className="text-white/20 text-sm text-center py-4">
                    No available slots this day
                  </p>
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
                        onClick={() => setStep("phone")}
                        className="w-full mt-4 bg-[#00F5A0] text-[#0d0d0d] font-semibold py-3 rounded-xl hover:bg-[#00D98A] transition"
                      >
                        Continue
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Phone, Name, Consent & Confirm */}
        {step === "phone" && (
          <div>
            <button
              onClick={() => setStep("date")}
              className="text-sm text-white/30 hover:text-white/50 mb-4 flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>

            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 mb-4">
              <p className="text-xs text-white/30 mb-2">Booking summary</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/50">Service</span>
                  <span className="text-white/80">{selectedService?.name}</span>
                </div>
                {selectedService && selectedService.price > 0 && (
                  <div className="flex justify-between">
                    <span className="text-white/50">Price</span>
                    <span className="text-[#00F5A0]">
                      ${selectedService.price}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-white/50">Date</span>
                  <span className="text-white/80">
                    {new Date(selectedDate + "T12:00:00").toLocaleDateString(
                      "en-US",
                      { weekday: "short", month: "short", day: "numeric" }
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Time</span>
                  <span className="text-white/80">
                    {formatTime(selectedTime)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
              <label className="text-xs text-white/30 block mb-2">
                First name
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Your first name"
                className="w-full px-4 py-3 border border-[#333] rounded-lg bg-[#222] text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#00F5A0] mb-4"
              />

              <label className="text-xs text-white/30 block mb-2">
                Phone number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
                className="w-full px-4 py-3 border border-[#333] rounded-lg bg-[#222] text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#00F5A0] mb-4"
              />

              {/* Consent checkbox */}
              <div className="flex items-start gap-3 p-3 bg-[#1e1e1e] rounded-lg border border-[#2a2a2a] mb-4">
                <input
                  id="booking-consent"
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="mt-1 w-4 h-4 accent-[#00F5A0] cursor-pointer flex-shrink-0"
                />
                <label
                  htmlFor="booking-consent"
                  className="text-xs text-gray-400 cursor-pointer"
                >
                  By checking this box, I consent to receive SMS messages from
                  this business, including appointment reminders, confirmations,
                  and offers. Message and data rates may apply. I can reply{" "}
                  <strong className="text-gray-200">STOP</strong> to opt out or{" "}
                  <strong className="text-gray-200">HELP</strong> for assistance
                  at any time.
                  {" "}
                  <a href="/privacy" className="text-[#00F5A0] hover:underline">Privacy Policy</a>
                  {" & "}
                  <a href="/terms" className="text-[#00F5A0] hover:underline">Terms</a>
                </label>
              </div>

              {error && (
                <div className="p-3 bg-red-950 border border-red-800 rounded-lg mb-4">
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}

              <button
                onClick={handleBook}
                disabled={!phone.trim() || !consentChecked || submitting}
                className="w-full bg-[#00F5A0] text-[#0d0d0d] font-semibold py-3 rounded-xl hover:bg-[#00D98A] disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {submitting ? "Booking..." : "Confirm Booking"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

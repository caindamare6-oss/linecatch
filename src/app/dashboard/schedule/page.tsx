"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Clock, User, Scissors, X, Check, Gift, ChevronLeft, ChevronRight } from "lucide-react";

type Booking = {
  id: string;
  booking_time: string;
  status: string;
  customer_phone: string;
  service: { name: string; price: number; duration_minutes: number } | null;
  contact_name: string | null;
  first_name: string | null;
  is_new_vip: boolean;
  loyalty_badge: string | null;
};

type BusinessHours = Record<string, { open: string; close: string } | null>;

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getWeekDates(referenceDate: Date): Date[] {
  const d = new Date(referenceDate);
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    dates.push(date);
  }
  return dates;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
}

function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function formatSlotTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH}:${m.toString().padStart(2, "0")} ${period}`;
}

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return `***-${digits.slice(-4)}`;
}

export default function SchedulePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-16"><div className="w-5 h-5 border-2 border-[#00F5A0]/30 border-t-[#00F5A0] rounded-full animate-spin" /></div>}>
      <ScheduleContent />
    </Suspense>
  );
}

function ScheduleContent() {
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight");

  const [businessHours, setBusinessHours] = useState<BusinessHours | null>(null);
  const [slotDuration, setSlotDuration] = useState(30);
  const [weekDates, setWeekDates] = useState<Date[]>(() => getWeekDates(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const { data: barber } = await supabase
        .from("users")
        .select("business_hours")
        .eq("user_id", user.id)
        .single();

      if (cancelled) return;

      setBusinessHours(barber?.business_hours || null);

      const { data: services } = await supabase
        .from("services")
        .select("duration_minutes")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .limit(1);

      if (cancelled) return;

      if (services && services.length > 0) {
        setSlotDuration(services[0].duration_minutes);
      }

      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!businessHours) return;
    let cancelled = false;

    async function loadDayBookings() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const dateStr = toDateStr(selectedDate);
      const startOfDay = new Date(dateStr + "T00:00:00");
      const endOfDay = new Date(dateStr + "T23:59:59");

      const { data: rawBookings } = await supabase
        .from("bookings")
        .select("id, booking_time, status, customer_phone, service_id")
        .eq("user_id", user.id)
        .eq("status", "confirmed")
        .gte("booking_time", startOfDay.toISOString())
        .lte("booking_time", endOfDay.toISOString())
        .order("booking_time", { ascending: true })
        .limit(50);

      if (cancelled) return;

      if (!rawBookings || rawBookings.length === 0) {
        setBookings([]);
        return;
      }

      const serviceIds = [...new Set(rawBookings.map((b) => b.service_id))];
      const { data: services } = await supabase
        .from("services")
        .select("id, name, price, duration_minutes")
        .in("id", serviceIds);

      const serviceMap = new Map(
        (services || []).map((s) => [s.id, { name: s.name, price: s.price, duration_minutes: s.duration_minutes }])
      );

      const phones = [...new Set(rawBookings.map((b) => b.customer_phone))];
      const { data: contacts } = await supabase
        .from("contacts")
        .select("caller_phone, name")
        .eq("user_id", user.id)
        .in("caller_phone", phones);

      const contactMap = new Map(
        (contacts || []).map((c) => [c.caller_phone, c.name])
      );

      const { data: vipClients } = await supabase
        .from("vip_clients")
        .select("phone_number, first_name, cut_count, has_claimed_onboarding_discount, opted_in_at")
        .eq("user_id", user.id)
        .in("phone_number", phones);

      const vipMap = new Map(
        (vipClients || []).map((v) => [v.phone_number, v])
      );

      if (cancelled) return;

      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const enriched: Booking[] = rawBookings.map((b) => {
        const vip = vipMap.get(b.customer_phone);
        let loyaltyBadge: string | null = null;

        if (vip) {
          const nextCut = vip.cut_count + 1;
          const claimed = vip.has_claimed_onboarding_discount;
          if ((nextCut === 1 && !claimed) || (nextCut >= 4 && (nextCut - 1) % 3 === 0)) {
            loyaltyBadge = "$5 off this cut!";
          } else {
            let cutsLeft: number;
            if (!claimed && nextCut < 1) cutsLeft = 1 - nextCut;
            else if (nextCut < 4) cutsLeft = 4 - nextCut;
            else cutsLeft = (3 - ((nextCut - 1) % 3)) % 3;
            if (cutsLeft > 0 && cutsLeft <= 3) loyaltyBadge = `${cutsLeft} until reward`;
          }
        }

        return {
          id: b.id,
          booking_time: b.booking_time,
          status: b.status,
          customer_phone: b.customer_phone,
          service: serviceMap.get(b.service_id) || null,
          contact_name: contactMap.get(b.customer_phone) || null,
          first_name: vip?.first_name || null,
          is_new_vip: vip ? new Date(vip.opted_in_at) > new Date(weekAgo) : false,
          loyalty_badge: loyaltyBadge,
        };
      });

      setBookings(enriched);

      if (highlightId) {
        setTimeout(() => {
          document.getElementById(`booking-${highlightId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 300);
      }
    }

    loadDayBookings();
    return () => { cancelled = true; };
  }, [selectedDate, businessHours, highlightId]);

  async function cancelBooking(bookingId: string) {
    setActionId(bookingId);
    try {
      await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      setBookings((prev) => prev.filter((b) => b.id !== bookingId));
    } catch {}
    setActionId(null);
  }

  async function completeBooking(bookingId: string) {
    setActionId(bookingId);
    try {
      await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete" }),
      });
      setBookings((prev) => prev.filter((b) => b.id !== bookingId));
    } catch {}
    setActionId(null);
  }

  function prevWeek() {
    const d = new Date(weekDates[0]);
    d.setDate(d.getDate() - 7);
    setWeekDates(getWeekDates(d));
  }

  function nextWeek() {
    const d = new Date(weekDates[0]);
    d.setDate(d.getDate() + 7);
    setWeekDates(getWeekDates(d));
  }

  function goToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setWeekDates(getWeekDates(today));
    setSelectedDate(today);
  }

  const todayStr = toDateStr(new Date());
  const selectedStr = toDateStr(selectedDate);
  const dayName = DAY_NAMES[selectedDate.getDay()];
  const dayHours = businessHours ? businessHours[dayName] : null;

  // Build time slots for the selected day
  const timeSlots: number[] = [];
  if (dayHours) {
    const open = parseTime(dayHours.open);
    const close = parseTime(dayHours.close);
    for (let m = open; m < close; m += slotDuration) {
      timeSlots.push(m);
    }
  }

  // Map bookings to their slot minute
  const bookingsBySlot = new Map<number, Booking>();
  const occupiedSlots = new Set<number>();
  for (const b of bookings) {
    const d = new Date(b.booking_time);
    const m = d.getHours() * 60 + d.getMinutes();
    bookingsBySlot.set(m, b);
    const dur = b.service?.duration_minutes || slotDuration;
    for (let t = m; t < m + dur; t += slotDuration) {
      occupiedSlots.add(t);
    }
  }

  // Month/year header
  const weekMonth = weekDates[3].toLocaleDateString("en-US", { month: "long", year: "numeric" });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-5 h-5 border-2 border-[#00F5A0]/30 border-t-[#00F5A0] rounded-full animate-spin" />
      </div>
    );
  }

  if (!businessHours) {
    return (
      <div className="text-center py-16">
        <Clock className="w-10 h-10 text-white/10 mx-auto mb-3" />
        <p className="text-white/30 text-sm">Set your business hours first</p>
        <p className="text-white/15 text-xs mt-1">Go to Settings to configure your working days and hours</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <button onClick={prevWeek} className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-white/60">{weekMonth}</span>
          {!weekDates.some((d) => toDateStr(d) === todayStr) && (
            <button onClick={goToday} className="text-xs px-2 py-0.5 rounded-full bg-[#00F5A0]/10 text-[#00F5A0] hover:bg-[#00F5A0]/20 transition-colors">
              Today
            </button>
          )}
        </div>
        <button onClick={nextWeek} className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Day picker */}
      <div className="grid grid-cols-7 gap-1">
        {weekDates.map((date) => {
          const ds = toDateStr(date);
          const dn = DAY_NAMES[date.getDay()];
          const isWorking = businessHours[dn] !== null && businessHours[dn] !== undefined;
          const isSelected = ds === selectedStr;
          const isToday = ds === todayStr;

          return (
            <button
              key={ds}
              onClick={() => { setSelectedDate(new Date(date)); }}
              disabled={!isWorking}
              className={`flex flex-col items-center py-2 rounded-xl transition-all ${
                isSelected
                  ? "bg-[#00F5A0]/15 border border-[#00F5A0]/30"
                  : isWorking
                    ? "bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.06]"
                    : "opacity-25 border border-transparent cursor-not-allowed"
              }`}
            >
              <span className={`text-[10px] uppercase tracking-wider ${isSelected ? "text-[#00F5A0]" : "text-white/30"}`}>
                {DAY_LABELS[date.getDay()]}
              </span>
              <span className={`text-sm font-semibold mt-0.5 ${
                isSelected ? "text-[#00F5A0]" : isToday ? "text-white" : "text-white/50"
              }`}>
                {date.getDate()}
              </span>
              {isToday && (
                <div className={`w-1 h-1 rounded-full mt-0.5 ${isSelected ? "bg-[#00F5A0]" : "bg-[#00F5A0]/50"}`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Day header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs text-white/40 uppercase tracking-wider font-medium">
          {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
          {dayHours && (
            <span className="ml-2 text-white/20">
              {formatSlotTime(parseTime(dayHours.open))} – {formatSlotTime(parseTime(dayHours.close))}
            </span>
          )}
        </h3>
        <span className="text-xs text-white/20">
          {bookings.length} booked
        </span>
      </div>

      {/* Closed day */}
      {!dayHours && (
        <div className="text-center py-12">
          <p className="text-white/20 text-sm">Closed</p>
        </div>
      )}

      {/* Time slot grid */}
      {dayHours && (
        <div className="space-y-0">
          {timeSlots.map((slotMin) => {
            const booking = bookingsBySlot.get(slotMin);
            const isOccupiedByOverlap = !booking && occupiedSlots.has(slotMin);

            if (isOccupiedByOverlap) return null;

            const slotCount = booking ? Math.ceil((booking.service?.duration_minutes || slotDuration) / slotDuration) : 1;
            const heightClass = slotCount > 1 ? "" : "";

            return (
              <div key={slotMin} className="flex gap-3 group">
                {/* Time label */}
                <div className="w-16 flex-shrink-0 pt-3 text-right">
                  <span className={`text-xs tabular-nums ${booking ? "text-white/50" : "text-white/15"}`}>
                    {formatSlotTime(slotMin)}
                  </span>
                </div>

                {/* Slot content */}
                {booking ? (
                  <div
                    id={`booking-${booking.id}`}
                    className={`flex-1 bg-[#00F5A0]/[0.06] border border-[#00F5A0]/20 rounded-xl p-3 my-0.5 transition-all ${
                      highlightId === booking.id ? "ring-1 ring-[#00F5A0]/40 bg-[#00F5A0]/[0.1]" : ""
                    }`}
                    style={slotCount > 1 ? { minHeight: `${slotCount * 52}px` } : undefined}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-[#00F5A0]/60 flex-shrink-0" />
                          <span className="text-sm font-medium text-white/80 truncate">
                            {booking.first_name || booking.contact_name || formatPhone(booking.customer_phone)}
                          </span>
                          {booking.is_new_vip && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#00F5A0]/10 text-[#00F5A0] flex-shrink-0">
                              NEW
                            </span>
                          )}
                        </div>
                        {booking.service && (
                          <div className="flex items-center gap-2 mt-1">
                            <Scissors className="w-3 h-3 text-white/15 flex-shrink-0" />
                            <span className="text-xs text-white/35">
                              {booking.service.name}
                              {booking.service.duration_minutes !== slotDuration && ` · ${booking.service.duration_minutes}min`}
                            </span>
                            {booking.service.price > 0 && (
                              <span className="text-xs text-[#00F5A0]/50">${booking.service.price}</span>
                            )}
                          </div>
                        )}
                        {booking.loyalty_badge && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <Gift className="w-3 h-3 text-yellow-400/50 flex-shrink-0" />
                            <span className="text-[10px] font-medium text-yellow-400/70">{booking.loyalty_badge}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 flex-shrink-0 ml-2">
                        <button
                          onClick={() => completeBooking(booking.id)}
                          disabled={actionId === booking.id}
                          className="p-1 rounded-lg text-white/10 hover:text-[#00F5A0] hover:bg-[#00F5A0]/10 transition-colors disabled:opacity-50"
                          title="Complete"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => cancelBooking(booking.id)}
                          disabled={actionId === booking.id}
                          className="p-1 rounded-lg text-white/10 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 border border-dashed border-white/[0.04] rounded-xl my-0.5 h-[44px] group-hover:border-white/[0.08] transition-colors" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

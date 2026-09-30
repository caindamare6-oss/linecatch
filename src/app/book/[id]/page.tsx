"use client";

import { useState, useEffect, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Calendar, Check, ChevronLeft, ChevronRight, MessageSquare, Scissors, User, Users, Wallet } from "lucide-react";
import { normalizePhone } from "@/lib/phone";
import { formatBarberDate, barberLocalToUTC } from "@/lib/format";
import { CONSENT_TEXT } from "@/lib/consent";

type Service = {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
};

type Step = "service" | "time" | "confirm" | "done";

const PARTY_SIZES = [1, 2, 3, 4];
const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const HEADING = "font-[family-name:var(--font-space-grotesk)]";
const BODY = "font-[family-name:var(--font-dm-sans)]";
const fadeUp = (delayMs = 0) => ({ animation: `ob-fade-up 400ms ease-out ${delayMs}ms both` });

function todayInTz(tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function formatSlot(t: string) {
  const [h, m] = t.split(":").map(Number);
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

export default function BookingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
        </div>
      }
    >
      <BookingContent />
    </Suspense>
  );
}

function BookingContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const barberId = params.id as string;
  const bookingSource = searchParams.get("src") || "direct";

  const [step, setStep] = useState<Step>("service");
  const [services, setServices] = useState<Service[]>([]);
  const [service, setService] = useState<Service | null>(null);
  const [partySize, setPartySize] = useState(1);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);
  const [shopName, setShopName] = useState("");
  const [openDays, setOpenDays] = useState<string[]>(DAY_NAMES);
  const [timezone, setTimezone] = useState("America/New_York");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  useEffect(() => {
    async function load() {
      const [servicesRes, barberRes] = await Promise.all([
        fetch(`/api/services/${barberId}`),
        fetch(`/api/vip-optin?barberId=${barberId}`),
      ]);
      if (servicesRes.ok) {
        const data = await servicesRes.json();
        setServices(data.services || []);
      }
      if (barberRes.ok) {
        const data = await barberRes.json();
        if (data.businessName) setShopName(data.businessName);
        if (data.timezone) setTimezone(data.timezone);
        if (Array.isArray(data.openDays) && data.openDays.length) setOpenDays(data.openDays);
        document.documentElement.style.setProperty("--accent-color", data.accentColor || "#00F5A0");
      }
      setLoading(false);
    }
    load();
  }, [barberId]);

  useEffect(() => {
    if (!selectedDate || !service) return;
    let cancelled = false;
    setSlotsLoading(true);
    fetch(`/api/bookings/slots?userId=${barberId}&date=${selectedDate}&serviceId=${service.id}&partySize=${partySize}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setSlots(data.slots || []);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDate, service, partySize, barberId]);

  const total = service ? service.price * partySize : 0;
  const totalMinutes = service ? service.duration_minutes * partySize : 0;
  const bookingDate = selectedDate && selectedTime ? barberLocalToUTC(selectedDate, selectedTime, timezone) : null;
  const dateLabel = bookingDate ? formatBarberDate(bookingDate, timezone, "short") : "";
  const partyLabel = partySize > 1 ? `Party of ${partySize}` : "Just me";

  async function handleBook() {
    if (!service || !bookingDate) return;
    setError("");
    const phoneResult = normalizePhone(phone);
    if (!phoneResult.valid) {
      setError(phoneResult.error);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: barberId,
          serviceId: service.id,
          partySize,
          customerPhone: phoneResult.e164,
          bookingTime: bookingDate.toISOString(),
          firstName: firstName.trim() || undefined,
          consentText: consentChecked ? CONSENT_TEXT : undefined,
          source: bookingSource,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Booking failed");
        if (res.status === 409) {
          setSelectedTime("");
          setStep("time");
        }
        return;
      }
      setBookingId(data.bookingId);
      setStep("done");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div
          className="w-5 h-5 border-2 rounded-full animate-spin"
          style={{ borderColor: "color-mix(in srgb, var(--accent-color) 30%, transparent)", borderTopColor: "var(--accent-color)" }}
        />
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className={`${BODY} min-h-screen bg-[#0A0A0A] text-white flex flex-col items-center justify-center text-center px-6 py-10`}>
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
          style={{ background: "color-mix(in srgb, var(--accent-color) 10%, transparent)", animation: "ob-scale-in 600ms cubic-bezier(0.34,1.56,0.64,1) both" }}
        >
          <Check className="w-10 h-10 text-[var(--accent-color)]" strokeWidth={2.5} />
        </div>
        <div style={fadeUp(300)}>
          <h1 className={`${HEADING} text-[28px] font-bold tracking-tight`}>You&apos;re Booked!</h1>
          <p className="text-sm text-white/35 mt-2 leading-relaxed">
            Your appointment is confirmed.
            {consentChecked && <><br />A confirmation text is on its way.</>}
          </p>
        </div>

        <div className="mt-7 w-full max-w-[300px] rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5 text-left" style={fadeUp(500)}>
          <SummaryRow label="Service" value={service?.name || ""} />
          <SummaryRow label="Party" value={partyLabel} />
          <SummaryRow label="Date" value={dateLabel} />
          <SummaryRow label="Time" value={formatSlot(selectedTime)} />
          {total > 0 && <SummaryRow label="Total" value={`$${total}`} accent last />}
        </div>

        <p className="mt-4 text-xs text-white/35 flex items-center gap-1.5" style={fadeUp(500)}>
          <Wallet className="w-3.5 h-3.5" /> Pay in person at your appointment
        </p>

        {bookingId && (
          <a
            href={`/manage/${bookingId}`}
            className="mt-5 text-[13px] text-[var(--accent-color)]/60 hover:text-[var(--accent-color)] transition-colors"
            style={fadeUp(500)}
          >
            Need to reschedule or cancel? Manage booking →
          </a>
        )}

        {!consentChecked && (
          <div className="mt-8 w-full max-w-[340px] rounded-xl bg-white/[0.02] border border-white/[0.04] px-4 py-3 text-xs text-white/30 flex items-center gap-2" style={fadeUp(500)}>
            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
            Save your manage link. You won&apos;t get text reminders for this booking.
          </div>
        )}
      </div>
    );
  }

  const progress = step === "service" ? 1 : step === "time" ? 2 : 3;

  return (
    <div className={`${BODY} min-h-screen bg-[#0A0A0A] text-white flex flex-col`}>
      <div className="w-full max-w-[440px] mx-auto flex-1 flex flex-col">
        {/* Header */}
        <div className="px-6 pt-5" style={fadeUp()}>
          {step === "service" ? (
            <>
              <div className="flex items-center gap-2.5 mb-4">
                <Scissors className="w-5 h-5 text-[var(--accent-color)]" />
                <span className={`${HEADING} text-lg font-bold text-[var(--accent-color)]`}>LineCatch</span>
              </div>
              <h1 className={`${HEADING} text-[22px] font-bold tracking-tight`}>Book an Appointment</h1>
              {shopName && <p className="text-[13px] text-white/30 mt-1">{shopName}</p>}
            </>
          ) : (
            <div className="flex items-center gap-2 mb-1">
              <button
                onClick={() => {
                  setError("");
                  setStep(step === "confirm" ? "time" : "service");
                }}
                className="p-1 -ml-1 text-white/40 hover:text-white/70 transition-colors"
                aria-label="Back"
              >
                <ArrowLeft className="w-5 h-5" strokeWidth={2.5} />
              </button>
              <div>
                <h1 className={`${HEADING} text-lg font-bold tracking-tight`}>
                  {step === "time" ? "Pick a Date & Time" : "Confirm Booking"}
                </h1>
                {step === "time" && service && (
                  <p className="text-xs text-white/25 mt-0.5">
                    {service.name} · {partyLabel.toLowerCase()} · {totalMinutes} min{total > 0 && ` · $${total}`}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-1.5 mt-3.5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex-1 h-1 rounded-full transition-colors duration-300"
                style={{ background: i <= progress ? "var(--accent-color)" : "rgba(255,255,255,0.08)" }}
              />
            ))}
          </div>
          {step === "service" && (
            <div className="flex justify-between mt-1.5 text-[10px] uppercase tracking-wide font-medium">
              <span className="text-[var(--accent-color)] font-semibold">Service</span>
              <span className="text-white/15">Date &amp; Time</span>
              <span className="text-white/15">Confirm</span>
            </div>
          )}
        </div>

        {/* Step 1: party size + service */}
        {step === "service" && (
          <>
            <div className="flex-1 px-6 py-5 overflow-y-auto" style={fadeUp(100)}>
              <SectionLabel>How many people?</SectionLabel>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {PARTY_SIZES.map((n) => (
                  <button
                    key={n}
                    onClick={() => {
                      setPartySize(n);
                      setSelectedTime("");
                    }}
                    className={`${HEADING} py-3 rounded-xl text-[15px] font-semibold border-[1.5px] transition-all duration-200 hover:-translate-y-px flex items-center justify-center gap-1.5 ${
                      partySize === n
                        ? "border-[var(--accent-color)]/50 bg-[var(--accent-color)]/[0.06] text-[var(--accent-color)]"
                        : "border-white/[0.06] bg-white/[0.02] text-white/60 hover:border-[var(--accent-color)]/25 hover:text-white"
                    }`}
                  >
                    {n === 1 ? <User className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-xs text-white/25 mb-6">
                {partySize > 1 ? `Everyone gets the same service, back to back.` : "Booking for yourself."}
              </p>

              <SectionLabel>Choose a service</SectionLabel>
              {services.length === 0 ? (
                <p className="text-white/30 text-sm text-center py-8">No services available right now.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {services.map((s) => {
                    const picked = service?.id === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => {
                          setService(s);
                          setSelectedTime("");
                        }}
                        className={`p-4 rounded-[14px] border-2 flex items-center gap-3.5 text-left transition-all duration-200 hover:-translate-y-px ${
                          picked
                            ? "border-[var(--accent-color)]/50 bg-[var(--accent-color)]/[0.04]"
                            : "border-white/[0.06] bg-white/[0.02] hover:border-[var(--accent-color)]/20"
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                            picked ? "border-[var(--accent-color)] bg-[var(--accent-color)]" : "border-white/15"
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full bg-[#0A0A0A] transition-opacity ${picked ? "opacity-100" : "opacity-0"}`} />
                        </span>
                        <span className="flex-1">
                          <span className="block text-[15px] font-semibold">{s.name}</span>
                          <span className="block text-xs text-white/25 mt-0.5">{s.duration_minutes} min</span>
                        </span>
                        {s.price > 0 && (
                          <span className={`${HEADING} text-base font-bold text-[var(--accent-color)]`}>
                            ${s.price}
                            {partySize > 1 && <span className="text-xs text-white/30 font-medium"> ea</span>}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <BottomCta disabled={!service} onClick={() => setStep("time")}>
              Continue <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
            </BottomCta>
          </>
        )}

        {/* Step 2: date + time */}
        {step === "time" && (
          <>
            <div className="flex-1 px-6 py-4 overflow-y-auto" style={fadeUp(100)}>
              <CalendarGrid
                viewMonth={viewMonth}
                setViewMonth={setViewMonth}
                today={todayInTz(timezone)}
                openDays={openDays}
                selectedDate={selectedDate}
                onPick={(d) => {
                  setSelectedDate(d);
                  setSelectedTime("");
                  setError("");
                }}
              />

              {selectedDate && (
                <div className="mt-5">
                  <SectionLabel>Available times</SectionLabel>
                  {error && <ErrorBox>{error}</ErrorBox>}
                  {slotsLoading ? (
                    <div className="flex justify-center py-6">
                      <div className="w-4 h-4 border-2 border-white/10 border-t-[var(--accent-color)] rounded-full animate-spin" />
                    </div>
                  ) : slots.length === 0 ? (
                    <p className="text-white/25 text-sm text-center py-6">
                      {partySize > 1 ? `No back-to-back openings for ${partySize} this day` : "No openings this day"}
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {slots.map((t) => (
                        <button
                          key={t}
                          onClick={() => setSelectedTime(t)}
                          className={`${HEADING} py-3 rounded-[10px] border-[1.5px] text-[13px] font-semibold transition-all duration-200 hover:-translate-y-px ${
                            selectedTime === t
                              ? "border-[var(--accent-color)]/50 bg-[var(--accent-color)]/[0.06] text-[var(--accent-color)]"
                              : "border-white/[0.06] bg-white/[0.02] text-white/60 hover:border-[var(--accent-color)]/25 hover:text-white"
                          }`}
                        >
                          {formatSlot(t)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <BottomCta disabled={!selectedTime} onClick={() => { setError(""); setStep("confirm"); }}>
              Continue <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
            </BottomCta>
          </>
        )}

        {/* Step 3: details + confirm */}
        {step === "confirm" && service && (
          <>
            <div className="flex-1 px-6 py-5 overflow-y-auto">
              <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-[18px]" style={fadeUp(100)}>
                <SectionLabel>Your appointment</SectionLabel>
                <DetailRow icon={<Scissors className="w-4 h-4" />} title={service.name} sub={`${service.duration_minutes} min${service.price > 0 ? ` · $${service.price}` : ""}${partySize > 1 ? " each" : ""}`} />
                <Divider />
                <DetailRow icon={<Users className="w-4 h-4" />} title={partyLabel} sub={partySize > 1 ? `${totalMinutes} min back to back` : undefined} />
                <Divider />
                <DetailRow icon={<Calendar className="w-4 h-4" />} title={dateLabel} sub={formatSlot(selectedTime)} />
                <Divider />
                <DetailRow icon={<User className="w-4 h-4" />} title={shopName || "Your barber"} />
                {total > 0 && (
                  <>
                    <Divider />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/40">Total</span>
                      <span className={`${HEADING} text-lg font-bold text-[var(--accent-color)]`}>${total}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-3 rounded-xl px-3.5 py-3 flex items-center gap-2 text-xs text-white/40 bg-white/[0.02] border border-white/[0.05]" style={fadeUp(150)}>
                <Wallet className="w-3.5 h-3.5 shrink-0" /> Pay in person at your appointment. No card needed.
              </div>

              <div className="mt-6" style={fadeUp(200)}>
                <SectionLabel>Your info</SectionLabel>
                <div className="flex flex-col gap-2.5">
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                    autoComplete="given-name"
                    className="w-full px-4 py-3.5 rounded-xl border-[1.5px] border-white/[0.08] bg-white/[0.04] text-[15px] text-white placeholder-white/20 outline-none focus:border-[var(--accent-color)]/40 transition-colors"
                  />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Phone number"
                    autoComplete="tel"
                    className="w-full px-4 py-3.5 rounded-xl border-[1.5px] border-white/[0.08] bg-white/[0.04] text-[15px] text-white placeholder-white/20 outline-none focus:border-[var(--accent-color)]/40 transition-colors"
                  />
                </div>

                <label className="mt-4 flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(e) => setConsentChecked(e.target.checked)}
                    className="sr-only peer"
                  />
                  <span
                    className={`mt-0.5 w-5 h-5 rounded-[5px] border-2 shrink-0 flex items-center justify-center transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--accent-color)]/40 ${
                      consentChecked ? "bg-[var(--accent-color)] border-[var(--accent-color)]" : "border-white/15"
                    }`}
                  >
                    {consentChecked && <Check className="w-3 h-3 text-[#0A0A0A]" strokeWidth={3} />}
                  </span>
                  <span className="text-xs text-white/30 leading-relaxed">
                    {CONSENT_TEXT}{" "}
                    <a href="/privacy" className="text-[var(--accent-color)]/70 hover:underline">Privacy</a>
                    {" & "}
                    <a href="/terms" className="text-[var(--accent-color)]/70 hover:underline">Terms</a>
                  </span>
                </label>

                {consentChecked && (
                  <div className="mt-4 rounded-xl px-3.5 py-3 flex items-start gap-2 text-xs text-white/35 bg-[var(--accent-color)]/[0.03] border border-[var(--accent-color)]/[0.08]">
                    <Check className="w-3.5 h-3.5 text-[var(--accent-color)] shrink-0 mt-px" />
                    You&apos;ll get a text reminder 24 hours and 2 hours before your appointment.
                  </div>
                )}

                {error && <div className="mt-4"><ErrorBox>{error}</ErrorBox></div>}
              </div>
            </div>
            <BottomCta disabled={!phone.trim() || submitting} onClick={handleBook}>
              {submitting ? "Booking..." : <><Check className="w-4 h-4" strokeWidth={2.5} /> Confirm Booking</>}
            </BottomCta>
          </>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-white/25 font-medium uppercase tracking-wide mb-3">{children}</div>;
}

function Divider() {
  return <div className="h-px bg-white/[0.04] my-3" />;
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 p-3 rounded-xl bg-red-950/60 border border-red-800/60 text-sm text-red-300">{children}</div>;
}

function SummaryRow({ label, value, accent, last }: { label: string; value: string; accent?: boolean; last?: boolean }) {
  return (
    <div className={`flex justify-between items-center py-2.5 ${last ? "" : "border-b border-white/[0.04]"}`}>
      <span className="text-[13px] text-white/30">{label}</span>
      <span className={`text-sm font-semibold ${accent ? "text-[var(--accent-color)] font-bold" : ""}`}>{value}</span>
    </div>
  );
}

function DetailRow({ icon, title, sub }: { icon: React.ReactNode; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-[10px] bg-[var(--accent-color)]/[0.08] text-[var(--accent-color)] flex items-center justify-center shrink-0">{icon}</div>
      <div>
        <div className="text-[15px] font-semibold">{title}</div>
        {sub && <div className="text-xs text-white/25">{sub}</div>}
      </div>
    </div>
  );
}

function BottomCta({ disabled, onClick, children }: { disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <div className="px-6 pt-3 pb-9 sticky bottom-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A] to-transparent">
      <button
        onClick={onClick}
        disabled={disabled}
        className="w-full py-4 rounded-[14px] bg-[var(--accent-color)] text-[#0A0A0A] text-base font-bold flex items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_6px_24px_color-mix(in_srgb,var(--accent-color)_30%,transparent)] active:scale-[0.99] disabled:opacity-40 disabled:hover:scale-100 disabled:hover:shadow-none disabled:cursor-not-allowed"
      >
        {children}
      </button>
    </div>
  );
}

function CalendarGrid({
  viewMonth,
  setViewMonth,
  today,
  openDays,
  selectedDate,
  onPick,
}: {
  viewMonth: Date;
  setViewMonth: (d: Date) => void;
  today: string;
  openDays: string[];
  selectedDate: string;
  onPick: (date: string) => void;
}) {
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const [todayY, todayM] = today.split("-").map(Number);
  const canGoPrev = year > todayY || (year === todayY && month + 1 > todayM);

  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const navBtn = "w-8 h-8 rounded-lg border border-white/[0.08] flex items-center justify-center transition-colors";

  return (
    <div>
      <div className="flex items-center justify-between mb-3.5">
        <button
          onClick={() => canGoPrev && setViewMonth(new Date(year, month - 1, 1))}
          disabled={!canGoPrev}
          className={`${navBtn} ${canGoPrev ? "text-white/50 hover:border-[var(--accent-color)]/30 hover:text-[var(--accent-color)]" : "text-white/10 cursor-default"}`}
          aria-label="Previous month"
        >
          <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2.5} />
        </button>
        <span className={`${HEADING} text-base font-bold`}>
          {viewMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </span>
        <button
          onClick={() => setViewMonth(new Date(year, month + 1, 1))}
          className={`${navBtn} text-white/50 hover:border-[var(--accent-color)]/30 hover:text-[var(--accent-color)]`}
          aria-label="Next month"
        >
          <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1.5">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} className="text-[11px] text-white/20 font-medium text-center">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e${i}`} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isPast = dateStr < today;
          const isClosed = !openDays.includes(DAY_NAMES[new Date(year, month, day).getDay()]);
          const isToday = dateStr === today;
          const isPicked = dateStr === selectedDate;
          const disabled = isPast || isClosed;
          return (
            <button
              key={dateStr}
              disabled={disabled}
              onClick={() => onPick(dateStr)}
              className={`${HEADING} aspect-square rounded-[10px] text-sm font-semibold flex items-center justify-center transition-all duration-200 ${
                isPicked
                  ? "bg-[var(--accent-color)] text-[#0A0A0A] shadow-[0_4px_16px_color-mix(in_srgb,var(--accent-color)_30%,transparent)]"
                  : disabled
                    ? isClosed && !isPast ? "text-white/[0.12] line-through cursor-not-allowed" : "text-white/10 cursor-not-allowed"
                    : isToday
                      ? "bg-[var(--accent-color)]/[0.06] text-[var(--accent-color)] border border-[var(--accent-color)]/15 hover:scale-[1.08]"
                      : "bg-white/[0.03] text-white/70 hover:bg-[var(--accent-color)]/[0.08] hover:text-white hover:scale-[1.08]"
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

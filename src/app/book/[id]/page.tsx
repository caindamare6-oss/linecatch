"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Calendar, Check, ChevronLeft, ChevronRight, MessageSquare, Scissors, User, Users, Wallet } from "lucide-react";
import { normalizePhone } from "@/lib/phone";
import { barberLocalToUTC } from "@/lib/format";
import { consentText } from "@/lib/consent";
import { DEFAULT_TZ, money } from "@/lib/config";
import { rewardLabel, type Loyalty } from "@/lib/loyalty-rules";
import { useT, useFormat, useLocale, LanguageToggle } from "@/lib/i18n";
import { PageSkeleton } from "@/components/ui/skeleton";
import { saveToken, useClientSession } from "./use-client-session";
import { applyAppTheme } from "@/lib/themes";
import { CardOnFile, type CardSaver } from "./card-on-file";

type Service = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  duration_minutes: number;
};

type Step = "service" | "time" | "confirm" | "done";

const PARTY_SIZES = [1, 2, 3, 4];
const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const HEADING = "font-heading";
const BODY = "font-sans";
const fadeUp = (delayMs = 0) => ({ animation: `ob-fade-up 400ms ease-out ${delayMs}ms both` });

function todayInTz(tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

const FEW_SPOTS = 3;

function groupSlots(slots: string[]) {
  const groups = [
    { name: "morning", times: [] as string[] },
    { name: "afternoon", times: [] as string[] },
    { name: "evening", times: [] as string[] },
  ];
  for (const t of slots) {
    const h = Number(t.split(":")[0]);
    groups[h < 12 ? 0 : h < 17 ? 1 : 2].times.push(t);
  }
  return groups.filter((g) => g.times.length > 0);
}

/** "16:30" (shop wall clock) → "4:30 PM" / "4:30 p. m." */
function useSlotLabel() {
  const f = useFormat();
  return (t: string) => {
    if (!t) return "";
    const [h, m] = t.split(":").map(Number);
    return f.time(new Date(2000, 0, 1, h, m));
  };
}

/** Prices are whole dollars on services. */
const usd = (dollars: number, locale: "en" | "es") => money(Math.round(dollars * 100), locale);

export default function BookingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--app-bg-deep,#0C0B0A)] flex items-center justify-center px-4">
          <PageSkeleton />
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
  const router = useRouter();
  const t = useT();
  const f = useFormat();
  const locale = useLocale();
  const formatSlot = useSlotLabel();
  const barberId = params.id as string;
  const bookingSource = searchParams.get("src") || "direct";
  // The barber booking someone in from their dashboard: no device recognition, no consent box (only the client can consent).
  const forBarber = bookingSource === "barber";
  const { session, forget } = useClientSession(barberId, searchParams.get("t"), forBarber);
  const known = session.status === "recognized" ? session : null;

  const [step, setStep] = useState<Step>("service");
  const [services, setServices] = useState<Service[]>([]);
  const [pickedService, setService] = useState<Service | null>(null);
  const [partySize, setPartySize] = useState(1);
  // Everyone after the person booking picks their own cut; `person` is whose cut is being picked.
  const [others, setOthers] = useState<(Service | null)[]>([]);
  const [person, setPerson] = useState(0);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  // Which date/service/party the current `slots` are for; anything else is still loading.
  const [slotsFor, setSlotsFor] = useState("");
  const [firstName, setFirstName] = useState(() => (forBarber ? (searchParams.get("name") || "").slice(0, 40) : ""));
  const [phone, setPhone] = useState(() => (forBarber ? (searchParams.get("phone") || "").replace(/[^\d]/g, "").slice(0, 11) : ""));
  const [shopName, setShopName] = useState("");
  const [openDays, setOpenDays] = useState<string[]>(DAY_NAMES);
  const [timezone, setTimezone] = useState(DEFAULT_TZ);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [rewardDue, setRewardDue] = useState(false);
  const [rewardCents, setRewardCents] = useState(0);
  const [loyalty, setLoyalty] = useState<Loyalty | null>(null);
  // No-show protection: a card is saved (not charged) before the booking goes through.
  const [protection, setProtection] = useState<{ account: string; feePercent: number } | null>(null);
  const saver = useRef<CardSaver | null>(null);
  // With protection on, the client picks: hold the spot with a card, or pay in store.
  const [payWith, setPayWith] = useState<"card" | "store">("card");
  const [heldWithCard, setHeldWithCard] = useState(false);
  const onSaver = useCallback((fn: CardSaver | null) => {
    saver.current = fn;
  }, []);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  // 1-tap rebook: a returning client's last service is preselected until they pick another.
  const service = pickedService ?? services.find((s) => s.id === known?.client.lastServiceId) ?? null;
  const party = Array.from({ length: partySize }, (_, i) => (i === 0 ? service : others[i - 1] ?? null));
  const partyReady = party.every(Boolean);
  const partyServices = party.filter((s): s is Service => !!s);
  const partyIds = partyServices.map((s) => s.id).join(",");
  const serviceSummary = partyServices.map((s) => s.name).join(" + ");

  function pickCut(s: Service) {
    const next = [...party];
    next[person] = s;
    if (person === 0) setService(s);
    else setOthers((o) => Object.assign([...o], { [person - 1]: s }));
    setSelectedTime("");
    // Move on to the next person who hasn't picked yet.
    const open = next.findIndex((x, i) => i > person && !x);
    if (open > 0) setPerson(open);
  }

  useEffect(() => {
    async function load() {
      const [servicesRes, barberRes] = await Promise.all([
        fetch(`/api/services/${barberId}`),
        fetch(`/api/shop?barberId=${barberId}`),
      ]);
      if (servicesRes.ok) {
        const data = await servicesRes.json();
        const list: Service[] = data.services || [];
        setServices(list);
        // A cut picked on the portfolio ("Book this cut", "Pick your cut"): skip straight to the time.
        const chosen = list.find((s) => s.id === searchParams.get("service"));
        if (chosen) {
          setService(chosen);
          setStep("time");
        }
      }
      if (barberRes.ok) {
        const data = await barberRes.json();
        if (data.businessName) setShopName(data.businessName);
        if (data.timezone) setTimezone(data.timezone);
        if (data.loyalty) setLoyalty(data.loyalty);
        if (data.protection?.account) setProtection(data.protection);
        if (Array.isArray(data.openDays) && data.openDays.length) setOpenDays(data.openDays);
        applyAppTheme(data.theme, data.accentColor);
      }
      setLoading(false);
    }
    load();
  }, [barberId]);

  const slotKey = selectedDate && partyReady ? `${selectedDate}|${partyIds}` : "";
  const slotsLoading = !!slotKey && slotsFor !== slotKey;

  useEffect(() => {
    if (!selectedDate || !partyReady) return;
    let cancelled = false;
    const key = `${selectedDate}|${partyIds}`;
    fetch(`/api/bookings/slots?userId=${barberId}&date=${selectedDate}&serviceIds=${partyIds}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setSlots(data.slots || []);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      })
      .finally(() => {
        if (!cancelled) setSlotsFor(key);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDate, partyReady, partyIds, barberId]);

  const total = partyServices.reduce((sum, s) => sum + s.price, 0);
  const totalMinutes = partyServices.reduce((m, s) => m + s.duration_minutes, 0);
  const bookingDate = selectedDate && selectedTime ? barberLocalToUTC(selectedDate, selectedTime, timezone) : null;
  const dateLabel = bookingDate ? f.date(bookingDate, { weekday: "short", month: "short", day: "numeric", timeZone: timezone }) : "";
  const partyLabel = partySize > 1 ? t("book.party_of", { n: partySize }) : t("book.just_me");
  const shownConsent = consentText(locale);

  function notMe() {
    forget();
    setFirstName("");
    setPhone("");
    setService(null);
  }

  async function handleBook() {
    if (!service || !bookingDate) return;
    setError("");
    let customerPhone: string | undefined;
    if (!known) {
      const phoneResult = normalizePhone(phone);
      if (!phoneResult.valid) {
        setError(t("book.err_phone"));
        return;
      }
      customerPhone = phoneResult.e164;
    }
    setSubmitting(true);
    try {
      let setupIntentId: string | undefined;
      const useCard = !!protection && !forBarber && payWith === "card";
      if (useCard) {
        const setup = await fetch("/api/bookings/card-setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: barberId, customerPhone, sessionToken: known?.token }),
        });
        const sd = await setup.json().catch(() => ({}));
        if (!setup.ok) {
          setError(sd.error || t("pay.card_unavailable"));
          return;
        }
        if (sd.required) {
          if (!saver.current) {
            setError(t("pay.card_unavailable"));
            return;
          }
          const saved = await saver.current(sd.clientSecret);
          if ("error" in saved) {
            setError(saved.error);
            return;
          }
          setupIntentId = saved.setupIntentId;
        }
      }
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: barberId,
          serviceId: service.id,
          serviceIds: partyServices.map((s) => s.id),
          partySize,
          customerPhone,
          sessionToken: known?.token,
          bookingTime: bookingDate.toISOString(),
          firstName: known ? undefined : firstName.trim() || undefined,
          // The client's language for later texts. Not when the barber books for them.
          language: forBarber ? undefined : locale,
          source: bookingSource,
          setupIntentId,
          payment: protection && !forBarber ? payWith : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.sessionExpired) forget();
        setError(data.error || t("book.booking_failed"));
        if (res.status === 409) {
          setSelectedTime("");
          setStep("time");
        }
        return;
      }
      if (data.sessionToken && !forBarber) saveToken(barberId, data.sessionToken);
      setBookingId(data.bookingId);
      setHeldWithCard(useCard);
      setRewardDue(!!data.rewardDue);
      if (typeof data.rewardCents === "number") setRewardCents(data.rewardCents);
      setStep("done");
    } catch {
      setError(t("book.something_wrong"));
    } finally {
      setSubmitting(false);
    }
  }

  const getsTexts = !forBarber;

  if (loading || session.status === "checking") {
    return (
      <div className="min-h-screen bg-[var(--app-bg-deep,#0C0B0A)] flex items-center justify-center px-4">
        <PageSkeleton />
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className={`${BODY} min-h-screen bg-[var(--app-bg-deep,#0C0B0A)] text-white flex flex-col items-center justify-center text-center px-6 py-10`}>
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
          style={{ background: "color-mix(in srgb, var(--accent-color) 10%, transparent)", animation: "ob-scale-in 600ms cubic-bezier(0.34,1.56,0.64,1) both" }}
        >
          <Check className="w-10 h-10 text-[var(--accent-color)]" strokeWidth={2.5} />
        </div>
        <div style={fadeUp(300)}>
          <h1 className={`${HEADING} text-[34px] font-semibold tracking-[-0.8px]`}>
            {forBarber ? t("book.done_barber_a") : t("book.done_a")}
            <em className="text-[var(--accent-color)]">{forBarber ? t("book.done_barber_b") : t("book.done_b")}</em>
          </h1>
          <p className="text-sm text-white/45 mt-2 leading-relaxed">
            {serviceSummary}{partySize > 1 ? t("book.party_suffix", { n: partySize }) : ""} · {dateLabel}, {formatSlot(selectedTime)}
            {getsTexts && !forBarber && <><br />{t("book.confirmation_coming")}</>}
          </p>
        </div>

        <div className="mt-7 w-full max-w-[300px] rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5 text-left" style={fadeUp(500)}>
          <SummaryRow label={t("book.service")} value={serviceSummary} />
          <SummaryRow label={t("book.party")} value={partyLabel} />
          <SummaryRow label={t("book.date")} value={dateLabel} />
          <SummaryRow label={t("book.time")} value={formatSlot(selectedTime)} />
          {total > 0 && <SummaryRow label={t("book.total")} value={rewardDue ? money(Math.max(Math.round(total * 100) - rewardCents, 0), locale) : usd(total, locale)} accent last={!(rewardDue && rewardCents > 0)} />}
          {rewardDue && rewardCents > 0 && <SummaryRow label={t("book.loyalty_reward")} value={t("book.reward_off", { amount: money(rewardCents, locale) })} accent last />}
        </div>

        <div className="mt-4 w-full max-w-[300px]" style={fadeUp(500)}>
          {heldWithCard ? <CardHeld /> : <PayInPerson />}
        </div>

        {bookingId && (
          <a
            href={`/manage/${bookingId}`}
            className="mt-5 text-[13px] text-[var(--accent-color)]/60 hover:text-[var(--accent-color)] transition-colors"
            style={fadeUp(500)}
          >
            {t("book.manage_link")}
          </a>
        )}

        {forBarber && (
          <Link href="/dashboard/schedule" className="mt-6 h-12 px-6 rounded-xl bg-[var(--accent-color)] text-[var(--accent-fg)] font-semibold flex items-center" style={fadeUp(500)}>
            {t("book.back_to_schedule")}
          </Link>
        )}

        {!getsTexts && !forBarber && (
          <div className="mt-8 w-full max-w-[340px] rounded-xl bg-white/[0.02] border border-white/[0.04] px-4 py-3 text-xs text-white/30 flex items-center gap-2" style={fadeUp(500)}>
            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
            {t("book.no_texts_note")}
          </div>
        )}
      </div>
    );
  }

  const progress = step === "service" ? 1 : step === "time" ? 2 : 3;

  return (
    <div className={`${BODY} min-h-screen bg-[var(--app-bg-deep,#0C0B0A)] text-white flex flex-col`}>
      <div className="w-full max-w-[440px] mx-auto flex-1 flex flex-col">
        {/* Header */}
        <div className="px-6 pt-5" style={fadeUp()}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setError("");
                if (step === "service") {
                  if (forBarber) router.push("/dashboard/schedule");
                  else window.history.back();
                } else setStep(step === "confirm" ? "time" : "service");
              }}
              className="w-11 h-11 shrink-0 rounded-xl border border-white/[0.1] bg-white/[0.03] text-white/70 hover:text-white flex items-center justify-center transition-colors"
              aria-label={t("common.back")}
            >
              <ArrowLeft className="w-[18px] h-[18px]" strokeWidth={2.4} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-white/45">{forBarber ? t("book.booking_client_for") : t("book.booking_with")}</p>
              <p className="text-[15px] font-bold truncate">{shopName || t("book.your_barber")}</p>
            </div>
            <LanguageToggle className="shrink-0" />
          </div>

          <div className="flex gap-1.5 mt-4" aria-label={t("book.step_of", { n: progress })}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex-1 h-[3px] rounded-full transition-colors duration-300"
                style={{ background: i <= progress ? "var(--accent-color)" : "color-mix(in srgb, var(--app-fg) 10%, transparent)" }}
              />
            ))}
          </div>

          {step === "service" && known && (
            <p className="mt-5 text-[13px] text-white/55 flex items-center gap-2 flex-wrap">
              {known.client.firstName ? t("book.greet_name", { name: known.client.firstName }) : t("book.greet")}
              <NotMe name={known.client.firstName} onClick={notMe} />
            </p>
          )}
          <h1 className={`${HEADING} ${step === "service" && known ? "mt-1" : "mt-5"} text-[34px] leading-[1.05] font-semibold tracking-[-0.8px]`}>
            {step === "service" ? <>{t("book.title_service_a")}<em className="text-[var(--accent-color)]">{t("book.title_service_b")}</em></> : step === "time" ? <>{t("book.title_time_a")}<em className="text-[var(--accent-color)]">{t("book.title_time_b")}</em></> : <>{t("book.title_confirm_a")}<em className="text-[var(--accent-color)]">{t("book.title_confirm_b")}</em></>}
          </h1>
          {/* The loyalty offer, for anyone the page doesn't already know (returning clients see their own badge). */}
          {step === "service" && !known && loyalty?.enabled && (
            <p className="mt-2 inline-flex text-[12px] font-semibold px-2.5 py-1 rounded-full bg-[var(--accent-color)]/15 text-[var(--accent-color)]">
              {t("book.loyalty_note", { amount: rewardLabel(loyalty, locale) })}
            </p>
          )}
          {step === "time" && service && (
            <p className="text-[13px] text-white/50 mt-1.5">
              {serviceSummary} · {partyLabel.toLowerCase()} · {t("book.minutes", { n: totalMinutes })}{total > 0 && ` · ${usd(total, locale)}`}
              {" · "}
              <button type="button" onClick={() => { setError(""); setStep("service"); }} className="font-semibold text-[var(--accent-color)] hover:underline underline-offset-2 min-h-[44px] -my-3 px-1">
                {t("book.change")}
              </button>
            </p>
          )}
        </div>

        {/* Step 1: party size + service */}
        {step === "service" && (
          <>
            <div className="flex-1 px-6 py-5 overflow-y-auto" style={fadeUp(100)}>
              <SectionLabel>{t("book.how_many")}</SectionLabel>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {PARTY_SIZES.map((n) => (
                  <button
                    key={n}
                    aria-pressed={partySize === n}
                    onClick={() => {
                      setPartySize(n);
                      setPerson((p) => Math.min(p, n - 1));
                      setSelectedTime("");
                    }}
                    className={`tap-spring ${HEADING} h-12 rounded-xl text-[15px] font-semibold border-[1.5px] flex items-center justify-center gap-1.5 ${
                      partySize === n
                        ? "border-[var(--accent-color)] bg-[var(--accent-color)] text-[var(--accent-fg)]"
                        : "border-white/[0.06] bg-white/[0.02] text-white/60 hover:border-[var(--accent-color)]/25 hover:text-white"
                    }`}
                  >
                    {n === 1 ? <User className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-xs text-white/25 mb-6">
                {partySize > 1 ? t("book.own_cut") : t("book.for_yourself")}
              </p>

              <SectionLabel>{t("book.choose_service")}</SectionLabel>
              {partySize > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1 mb-3 -mx-1 px-1" role="tablist" aria-label={t("book.who")}>
                  {party.map((p, i) => (
                    <button
                      key={i}
                      role="tab"
                      aria-selected={person === i}
                      onClick={() => setPerson(i)}
                      className={`tap-spring shrink-0 min-h-12 px-3.5 py-2 rounded-xl border-[1.5px] text-left ${
                        person === i ? "border-[var(--accent-color)] bg-[var(--accent-color)]/[0.08]" : "border-white/[0.06] bg-white/[0.02]"
                      }`}
                    >
                      <span className="block text-[13px] font-semibold">{i === 0 ? t("book.person_you") : t("book.person_n", { n: i + 1 })}</span>
                      <span className={`block text-[11px] mt-0.5 ${p ? "text-[var(--accent-color)]" : "text-white/35"}`}>{p ? p.name : t("book.pick_cut")}</span>
                    </button>
                  ))}
                </div>
              )}
              {services.length === 0 ? (
                <p className="text-white/30 text-sm text-center py-8">{t("book.no_services")}</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {services.map((s) => {
                    const picked = party[person]?.id === s.id;
                    return (
                      <button
                        key={s.id}
                        aria-pressed={picked}
                        onClick={() => pickCut(s)}
                        className={`tap-spring p-4 rounded-[14px] border-2 flex items-center gap-3.5 text-left ${
                          picked
                            ? "border-[var(--accent-color)]/60 bg-[var(--accent-color)]/[0.07] shadow-[0_0_22px_color-mix(in_srgb,var(--accent-color)_18%,transparent)]"
                            : "border-white/[0.06] bg-white/[0.02] hover:border-[var(--accent-color)]/20"
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                            picked ? "border-[var(--accent-color)] bg-[var(--accent-color)]" : "border-white/15"
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full bg-[var(--app-bg-deep,#0C0B0A)] transition-opacity ${picked ? "opacity-100" : "opacity-0"}`} />
                        </span>
                        <span className="flex-1">
                          <span className="block text-[15px] font-semibold">{s.name}</span>
                          {s.description && <span className="block text-[13px] text-white/55 mt-0.5">{s.description}</span>}
                          <span className="block text-xs text-white/40 mt-0.5">{t("book.minutes", { n: s.duration_minutes })}</span>
                        </span>
                        {s.price > 0 && (
                          <span className={`${HEADING} text-base font-bold text-[var(--accent-color)]`}>
                            {usd(s.price, locale)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <BottomCta
              disabled={!partyReady}
              onClick={() => {
                const open = party.findIndex((x) => !x);
                if (open >= 0) setPerson(open);
                else setStep("time");
              }}
              note={t(protection && !forBarber ? "pay.note_choice" : "book.pay_note")}
            >
              {partyReady ? t("book.pick_time") : t("book.choose_service")} <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
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
                  <div className="flex items-baseline justify-between">
                    <SectionLabel>{t("book.available_times")}</SectionLabel>
                    {!slotsLoading && slots.length > 0 && slots.length <= FEW_SPOTS && (
                      <span className="text-xs font-semibold text-[var(--accent-color)]">
                        {slots.length === 1 ? t("book.one_spot_left") : t("book.n_spots_left", { n: slots.length })}
                      </span>
                    )}
                  </div>
                  {error && <ErrorBox>{error}</ErrorBox>}
                  {slotsLoading ? (
                    <div className="flex justify-center py-6">
                      <div className="w-4 h-4 border-2 border-white/10 border-t-[var(--accent-color)] rounded-full animate-spin" />
                    </div>
                  ) : slots.length === 0 ? (
                    <p className="text-white/25 text-sm text-center py-6">
                      {partySize > 1 ? t("book.no_openings_party", { n: partySize }) : t("book.no_openings")}
                    </p>
                  ) : (
                    // Keyed by day so the pills slide in again whenever a new day is picked.
                    <div key={`${selectedDate}-${partySize}`} className="flex flex-col gap-4">
                      {groupSlots(slots).map((group) => (
                        <div key={group.name}>
                          <div className="text-[11px] text-white/35 font-medium mb-2">{t(`book.${group.name}`)}</div>
                          <div className="flex gap-2 overflow-x-auto -mx-6 px-6 pb-1 [scrollbar-width:none]">
                            {group.times.map((t, i) => (
                              <button
                                key={t}
                                aria-pressed={selectedTime === t}
                                onClick={() => setSelectedTime(t)}
                                className={`pill-slide tap-spring ${HEADING} shrink-0 h-11 px-4 rounded-xl border-[1.5px] text-[13px] font-semibold ${
                                  selectedTime === t
                                    ? "border-[var(--accent-color)] bg-[var(--accent-color)] text-[var(--accent-fg)]"
                                    : "border-white/[0.08] bg-white/[0.04] text-white/70 hover:border-[var(--accent-color)]/30 hover:text-white"
                                }`}
                                style={{ animationDelay: `${i * 35}ms` }}
                              >
                                {formatSlot(t)}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <BottomCta
              disabled={!selectedTime}
              onClick={() => { setError(""); setStep("confirm"); }}
              note={partySize > 1 ? t("book.note_party", { n: partySize }) : t("book.note_tz")}
            >
              {selectedTime ? t("book.review") : selectedDate ? t("book.pick_time") : t("book.pick_day")} <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
            </BottomCta>
          </>
        )}

        {/* Step 3: details + confirm */}
        {step === "confirm" && service && (
          <>
            <div className="flex-1 px-6 py-5 overflow-y-auto">
              <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-[18px]" style={fadeUp(100)}>
                <SectionLabel>{t("book.your_appointment")}</SectionLabel>
                {partyServices.map((s, i) => (
                  <DetailRow key={i} icon={<Scissors className="w-4 h-4" />} title={partySize > 1 ? `${i === 0 ? t("book.person_you") : t("book.person_n", { n: i + 1 })}: ${s.name}` : s.name} sub={`${t("book.minutes", { n: s.duration_minutes })}${s.price > 0 ? ` · ${usd(s.price, locale)}` : ""}`} />
                ))}
                <Divider />
                <DetailRow icon={<Users className="w-4 h-4" />} title={partyLabel} sub={partySize > 1 ? t("book.back_to_back", { n: totalMinutes }) : undefined} />
                <Divider />
                <DetailRow icon={<Calendar className="w-4 h-4" />} title={dateLabel} sub={formatSlot(selectedTime)} />
                <Divider />
                <DetailRow icon={<User className="w-4 h-4" />} title={shopName || t("book.your_barber_cap")} />
                {total > 0 && (
                  <>
                    <Divider />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/40">{t("book.total")}</span>
                      <span className={`${HEADING} text-lg font-bold text-[var(--accent-color)]`}>{usd(total, locale)}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-3" style={fadeUp(150)}>
                {protection && !forBarber ? (
                  <>
                    <div role="radiogroup" aria-label={t("pay.choose")} className="grid grid-cols-2 gap-2 mb-3">
                      {(["card", "store"] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          role="radio"
                          aria-checked={payWith === m}
                          onClick={() => setPayWith(m)}
                          className={`min-h-12 rounded-xl px-3 text-[13px] font-semibold border-[1.5px] transition-colors ${payWith === m ? "border-[var(--accent-color)] bg-[var(--accent-color)]/10 text-white" : "border-white/[0.08] bg-white/[0.03] text-white/55"}`}
                        >
                          {t(m === "card" ? "pay.choice_card" : "pay.choice_store")}
                        </button>
                      ))}
                    </div>
                    {payWith === "card" ? <CardOnFile account={protection.account} feePercent={protection.feePercent} onSaver={onSaver} /> : <PayInPerson />}
                  </>
                ) : (
                  <PayInPerson />
                )}
              </div>

              <div className="mt-6" style={fadeUp(200)}>
                <SectionLabel>{t("book.your_info")}</SectionLabel>
                {known ? (
                  <div className="rounded-xl px-4 py-3.5 border-[1.5px] border-white/[0.08] bg-white/[0.04] flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[15px] font-semibold">{known.client.firstName || t("book.welcome_back")}</div>
                      <div className="text-xs text-white/25">{t("book.phone_ending", { last4: known.client.phoneLast4 })}</div>
                    </div>
                    <NotMe name={known.client.firstName} onClick={notMe} />
                  </div>
                ) : (
                <div className="flex flex-col gap-2.5">
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder={t("common.first_name")}
                    autoComplete="given-name"
                    className="w-full px-4 py-3.5 rounded-xl border-[1.5px] border-white/[0.08] bg-white/[0.04] text-[15px] text-white placeholder-white/20 outline-none focus:border-[var(--accent-color)]/40 transition-colors"
                  />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t("book.phone_placeholder")}
                    autoComplete="tel"
                    className="w-full px-4 py-3.5 rounded-xl border-[1.5px] border-white/[0.08] bg-white/[0.04] text-[15px] text-white placeholder-white/20 outline-none focus:border-[var(--accent-color)]/40 transition-colors"
                  />
                </div>
                )}

                {!forBarber && (
                  <p className="mt-4 text-[11px] text-white/30 leading-relaxed">
                    {shownConsent}{" "}
                    <Link href="/privacy" className="text-[var(--accent-color)]/70 hover:underline">{t("common.privacy")}</Link>
                    {" & "}
                    <Link href="/terms" className="text-[var(--accent-color)]/70 hover:underline">{t("common.terms")}</Link>
                  </p>
                )}

                {error && <div className="mt-4"><ErrorBox>{error}</ErrorBox></div>}
              </div>
            </div>
            <BottomCta
              disabled={(!known && !phone.trim()) || submitting}
              onClick={handleBook}
              note={forBarber ? t("book.note_barber") : t("book.note_gets_texts")}
            >
              {submitting ? t("book.booking") : <><Check className="w-4 h-4" strokeWidth={2.5} /> {t("book.confirm")}</>}
            </BottomCta>
          </>
        )}
      </div>
    </div>
  );
}

function NotMe({ name, onClick }: { name: string | null; onClick: () => void }) {
  const t = useT();
  return (
    <button onClick={onClick} className="mt-1 text-xs text-white/30 hover:text-white/60 underline underline-offset-2 transition-colors shrink-0">
      {name ? t("book.not_name", { name }) : t("book.not_you")}
    </button>
  );
}

/** Done screen after booking with a card: nothing charged yet. */
function CardHeld() {
  const t = useT();
  return (
    <div className="rounded-xl px-4 py-3 text-left bg-[var(--accent-color)]/10 border-[1.5px] border-[var(--accent-color)]/40">
      <div className="text-sm font-bold text-white">{t("pay.held_title")}</div>
      <div className="text-xs text-white/60">{t("pay.held_sub")}</div>
    </div>
  );
}

function PayInPerson() {
  const t = useT();
  return (
    <div className="rounded-xl px-4 py-3 flex items-center gap-3 text-left bg-emerald-500/15 border-[1.5px] border-emerald-400/60 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
      <div className="w-9 h-9 rounded-lg bg-emerald-400 text-[var(--app-bg-deep,#0C0B0A)] flex items-center justify-center shrink-0">
        <Wallet className="w-5 h-5" strokeWidth={2.25} />
      </div>
      <div>
        <div className="text-sm font-bold text-emerald-300">{t("book.pay_in_person")}</div>
        <div className="text-xs text-emerald-100/70">{t("book.pay_in_person_sub")}</div>
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

function BottomCta({ disabled, onClick, children, note }: { disabled?: boolean; onClick: () => void; children: React.ReactNode; note?: string }) {
  return (
    <div className="px-6 pt-3 pb-[calc(16px+env(safe-area-inset-bottom))] sticky bottom-0 border-t border-white/[0.08] bg-[var(--app-bg)]">
      <button
        onClick={onClick}
        disabled={disabled}
        className="w-full h-[58px] rounded-2xl bg-[var(--accent-color)] text-[var(--accent-fg)] text-base font-bold flex items-center justify-center gap-2 transition-[transform,box-shadow,opacity] duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40 disabled:shadow-none disabled:hover:translate-y-0 disabled:cursor-not-allowed"
      >
        {children}
      </button>
      {note && <p className="text-center text-[12px] text-white/40 mt-2">{note}</p>}
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
  const t = useT();
  const f = useFormat();
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
          aria-label={t("book.prev_month")}
        >
          <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2.5} />
        </button>
        <span className={`${HEADING} text-base font-bold`}>
          {f.date(viewMonth, { month: "long", year: "numeric" })}
        </span>
        <button
          onClick={() => setViewMonth(new Date(year, month + 1, 1))}
          className={`${navBtn} text-white/50 hover:border-[var(--accent-color)]/30 hover:text-[var(--accent-color)]`}
          aria-label={t("book.next_month")}
        >
          <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1.5">
        {/* Jan 7 2024 was a Sunday. */}
        {Array.from({ length: 7 }, (_, i) => f.date(new Date(2024, 0, 7 + i), { weekday: "narrow" })).map((d, i) => (
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
                  ? "bg-[var(--accent-color)] text-[var(--app-bg-deep,#0C0B0A)] shadow-[0_4px_16px_color-mix(in_srgb,var(--accent-color)_30%,transparent)]"
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

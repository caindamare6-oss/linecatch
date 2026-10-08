"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { consentText } from "@/lib/consent";
import { money } from "@/lib/config";
import { REWARD_CENTS } from "@/lib/loyalty-rules";
import { useT, useLocale, LanguageToggle } from "@/lib/i18n";
import { normalizePhone } from "@/lib/phone";
import { PageSkeleton } from "@/components/ui/skeleton";

export default function VIPOptIn() {
  const params = useParams();
  const barberId = params.id as string;
  const t = useT();
  const locale = useLocale();
  const [rewardCents, setRewardCents] = useState(REWARD_CENTS);
  const reward = money(rewardCents, locale);

  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [consented, setConsented] = useState(false);
  const [modal, setModal] = useState<0 | 1 | 2>(0);
  const [businessName, setBusinessName] = useState("");
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    async function loadBarber() {
      try {
        const res = await fetch(`/api/vip-optin?barberId=${barberId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.businessName) setBusinessName(data.businessName);
          if (data.loyalty?.cents) setRewardCents(data.loyalty.cents);
          if (data.isLockedOut) setIsLockedOut(true);
          if (data.accentColor) document.documentElement.style.setProperty("--accent-color", data.accentColor);
        }
      } catch {}
      setPageLoading(false);
    }
    loadBarber();
  }, [barberId]);

  async function submitForm(didConsent: boolean) {
    setLoading(true);
    try {
      const response = await fetch("/api/vip-optin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.trim(),
          barberId,
          firstName: firstName.trim() || undefined,
          consentText: didConsent ? consentText(locale) : null,
          language: locale,
          consented: didConsent,
          optInSource: new URLSearchParams(window.location.search).get("src") === "qr" ? "qr" : "vip_form",
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t("vip.err_save"));
      }

      setSubmitted(true);
      setPhone("");
      setFirstName("");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t("common.try_again");
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const result = normalizePhone(phone);
    if (!result.valid) {
      setError(t("vip.err_phone"));
      return;
    }

    if (!consented) {
      setModal(1);
      return;
    }

    submitForm(true);
  };

  const displayName = businessName || t("vip.your_barber");

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-[#121110] flex items-center justify-center">
        <PageSkeleton />
      </div>
    );
  }

  if (isLockedOut) {
    return (
      <div className="min-h-screen bg-[#121110] flex items-center justify-center px-4">
        <LanguageToggle className="fixed top-4 right-4 z-40" />
        <div className="w-full max-w-md bg-[#1B1A18] rounded-2xl p-8 border border-[#2C2A27] text-center">
          <div className="text-3xl font-bold mb-4 text-white">
            Line<span className="text-[var(--accent-color)]">Catch</span>
          </div>
          <p className="text-stone-400 mb-2">
            {t("vip.offline_title", { name: displayName })}
          </p>
          <p className="text-stone-500 text-sm">
            {t("vip.offline_body")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121110] text-white flex items-center justify-center px-6 pt-16 pb-8">
      <LanguageToggle className="fixed top-4 right-4 z-40 bg-[#121110]" />
      <div className="w-full max-w-md">
        {!submitted ? (
          <div style={{ animation: "ob-fade-up 450ms ease-out both" }}>
            <div className="text-center mb-7">
              <div className="inline-flex items-center gap-2 mb-4">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color)" strokeWidth="1.8" aria-hidden><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z" /></svg>
                <span className="font-heading text-lg font-semibold text-[var(--accent-color)]">LineCatch</span>
              </div>
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[var(--accent-color)]/30 bg-[var(--accent-color)]/[0.08] text-[11px] font-bold uppercase tracking-[1px] text-[var(--accent-color)]">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                  {t("vip.badge")}
                </span>
              </div>
              <h1 className="font-heading text-[28px] leading-tight font-semibold tracking-[-0.5px] mt-4">
                {t("vip.title_1", { name: displayName })}<br />{t("vip.title_2", { name: displayName })}
              </h1>
              <p className="text-[14px] text-white/45 mt-2 leading-relaxed">{t("vip.subtitle")}</p>
            </div>

            <ul className="space-y-2 mb-6">
              {[
                { tone: "var(--accent-color)", title: t("vip.perk_reminders"), sub: t("vip.perk_reminders_sub"), d: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></> },
                { tone: "#E0926A", title: t("vip.perk_loyalty"), sub: t("vip.perk_loyalty_sub", { amount: reward }), d: <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /> },
                { tone: "#8FB8DE", title: t("vip.perk_booking"), sub: t("vip.perk_booking_sub"), d: <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /> },
              ].map((b) => (
                <li key={b.title} className="flex items-center gap-3.5 px-4 py-3 rounded-[14px] bg-white/[0.025] border border-white/[0.06]">
                  <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ color: b.tone, background: `color-mix(in srgb, ${b.tone} 10%, transparent)` }} aria-hidden>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">{b.d}</svg>
                  </span>
                  <span>
                    <span className="block text-[14px] font-semibold">{b.title}</span>
                    <span className="block text-[12px] text-white/40">{b.sub}</span>
                  </span>
                </li>
              ))}
            </ul>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="firstName"
                  className="block text-[12px] font-medium text-white/45 mb-1.5"
                >
                  {t("common.first_name")}
                </label>
                <input
                  id="firstName"
                  type="text"
                  placeholder={t("vip.first_name_placeholder")}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={loading}
                  className="w-full h-12 px-4 rounded-xl border border-white/[0.1] bg-white/[0.04] text-white text-[15px] placeholder-white/25 outline-none focus:border-[var(--accent-color)]/50 disabled:opacity-50"
                />
              </div>

              <div>
                <label
                  htmlFor="phone"
                  className="block text-[12px] font-medium text-white/45 mb-1.5"
                >
                  {t("vip.phone_label")}
                </label>
                <input
                  id="phone"
                  type="tel"
                  placeholder="(555) 234-5678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={loading}
                  className="w-full h-12 px-4 rounded-xl border border-white/[0.1] bg-white/[0.04] text-white text-[15px] placeholder-white/25 outline-none focus:border-[var(--accent-color)]/50 disabled:opacity-50"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-950 border border-red-800 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}

              <div className="flex items-start gap-3 px-1">
                <input
                  id="consent"
                  type="checkbox"
                  checked={consented}
                  onChange={(e) => setConsented(e.target.checked)}
                  className="mt-1 w-4 h-4 accent-[var(--accent-color)] cursor-pointer flex-shrink-0"
                />
                <label
                  htmlFor="consent"
                  className="text-[12px] leading-relaxed text-white/40 cursor-pointer"
                >
                  {consentText(locale)}{" "}
                  <Link href="/privacy" className="text-[var(--accent-color)] hover:underline">{t("vip.privacy_policy")}</Link>
                  {` ${t("vip.and_short")} `}
                  <Link href="/terms" className="text-[var(--accent-color)] hover:underline">{t("vip.terms_short")}</Link>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-[52px] bg-[var(--accent-color)] text-[var(--accent-fg)] font-bold rounded-[14px] transition hover:shadow-[0_6px_24px_color-mix(in_srgb,var(--accent-color)_30%,transparent)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? t("vip.joining") : t("vip.join")}
              </button>
            </form>

            <p className="text-xs text-white/30 text-center mt-6">
              {t("vip.agree_pre")}{" "}
              <Link href="/privacy" className="text-[var(--accent-color)] hover:underline">
                {t("vip.privacy_policy")}
              </Link>{" "}
              {t("vip.and")}{" "}
              <Link href="/terms" className="text-[var(--accent-color)] hover:underline">
                {t("vip.terms_of_service")}
              </Link>
            </p>
          </div>
        ) : (
          <div className="bg-[#1B1A18] rounded-2xl p-8 border border-[#2C2A27] text-center">
            <CheckCircle2 className="w-16 h-16 text-[var(--accent-color)] mx-auto mb-4" />
            {consented ? (
              <>
                <h2 className="text-2xl font-bold text-white mb-2">
                  {t("vip.done_title")}
                </h2>
                <p className="text-stone-400 mb-6">
                  {t("vip.done_body", { name: displayName })}
                </p>
                <p className="text-sm text-stone-500">
                  {t("vip.stop_pre")} <strong className="text-stone-300">STOP</strong> {t("vip.stop_post")}
                </p>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-white mb-2">
                  {t("vip.nocon_title")}
                </h2>
                <p className="text-stone-400 mb-6">
                  {t("vip.nocon_body", { amount: reward })}
                </p>
              </>
            )}
          </div>
        )}

        {/* Modal 1: Nudge to check the box */}
        {modal === 1 && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-4">
            <div className="bg-[#1B1A18] rounded-2xl border border-[#2C2A27] p-6 max-w-sm w-full space-y-4 text-center">
              <p className="text-white text-base font-medium leading-relaxed">
                {t("vip.modal1", { amount: reward })}
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => setModal(0)}
                  className="w-full bg-[var(--accent-color)] text-[var(--accent-fg)] font-semibold py-3 rounded-lg hover:brightness-90 transition"
                >
                  {t("vip.go_back")}
                </button>
                <button
                  onClick={() => setModal(2)}
                  className="w-full bg-white/[0.06] text-white/50 font-medium py-3 rounded-lg hover:bg-white/[0.1] transition text-sm"
                >
                  {t("vip.skip")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal 2: Final confirmation */}
        {modal === 2 && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-4">
            <div className="bg-[#1B1A18] rounded-2xl border border-[#2C2A27] p-6 max-w-sm w-full space-y-4 text-center">
              <p className="text-white text-base font-medium leading-relaxed">
                {t("vip.modal2", { amount: reward })}
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => setModal(0)}
                  className="w-full bg-[var(--accent-color)] text-[var(--accent-fg)] font-semibold py-3 rounded-lg hover:brightness-90 transition"
                >
                  {t("vip.go_back")}
                </button>
                <button
                  onClick={() => { setModal(0); submitForm(false); }}
                  disabled={loading}
                  className="w-full bg-white/[0.06] text-white/50 font-medium py-3 rounded-lg hover:bg-white/[0.1] transition text-sm disabled:opacity-50"
                >
                  {loading ? t("vip.joining") : t("vip.confirm_skip")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

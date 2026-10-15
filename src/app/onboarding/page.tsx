"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useT, useLocale, useSetLocale, type Locale } from "@/lib/i18n";
import { REFERRAL_PERCENT_OFF, DEFAULT_TZ } from "@/lib/config";
import { PageSkeleton } from "@/components/ui/skeleton";
import ForwardCallsStep from "./forward-calls-step";
import ServicesStep from "./services-step";
import HoursStep from "./hours-step";
import LoyaltyStep from "./loyalty-step";
import { SetupProgress } from "./step-shell";

const LANGUAGES = [
  { code: "en" as const, label: "English" },
  { code: "es" as const, label: "Español" },
];

type Initial = {
  profile: Record<string, unknown>;
  googleName?: string;
  pendingCode?: string | null;
  referral?: { code: string; name: string | null } | null;
};

/**
 * Sign-up in five short steps: (1) name, shop and cell, which assigns their texting number and fills
 * in starter services and hours; (2) services; (3) hours; (4) loyalty rewards; (5) the one-tap call
 * forwarding for missed calls.
 */
export default function OnboardingPage() {
  const language = useLocale();
  const setLanguage = useSetLocale();
  const [initial, setInitial] = useState<Initial | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/onboarding")
      .then((r) => r.json())
      .then((data: Initial) => {
        if (cancelled) return;
        const saved = data.profile?.barber_language;
        if ((saved === "en" || saved === "es") && saved !== document.cookie.match(/lc_lang=(\w+)/)?.[1]) setLanguage(saved);
        setInitial(data);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once
  }, []);

  if (!loaded) {
    return (
      <div className="h-[100dvh] flex items-center justify-center px-4" style={{ backgroundColor: "var(--ob-bg)" }}>
        <PageSkeleton />
      </div>
    );
  }
  return <QuickSetup language={language} setLanguage={setLanguage} initial={initial} />;
}

function QuickSetup({ language, setLanguage, initial }: { language: Locale; setLanguage: (l: Locale) => void; initial: Initial | null }) {
  const t = useT();
  const router = useRouter();
  const p = initial?.profile || {};
  const applied = initial?.referral ?? null;
  // A Google sign-up already gave us a name: just the first word ("Damare", not "Damare Cain").
  const [firstName, setFirstName] = useState((p.first_name as string) || initial?.googleName?.trim().split(/\s+/)[0] || "");
  const [shopName, setShopName] = useState((p.business_name as string) || "");
  const [phone, setPhone] = useState((p.forwarding_number as string) || "");
  const [code, setCode] = useState(initial?.pendingCode || "");
  const [showCode, setShowCode] = useState(!!initial?.pendingCode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ field?: string; text: string } | null>(null);
  const [step, setStep] = useState<"start" | "services" | "hours" | "loyalty" | "forward">("start");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!firstName.trim()) return setError({ field: "firstName", text: t("quick.err_name") });
    if (!shopName.trim()) return setError({ field: "businessName", text: t("quick.err_shop") });
    if (!phone.trim()) return setError({ field: "phone", text: t("quick.err_phone") });
    setSaving(true);
    let timezone = DEFAULT_TZ;
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TZ;
    } catch {}
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        step: "quick",
        data: { firstName, businessName: shopName, phone, language, timezone, ...(!applied && code.trim() ? { referralCode: code.trim() } : {}) },
      }),
    }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : {};
    setSaving(false);
    if (!res?.ok) {
      const text = body.field === "referralCode" ? t(`step1.err_${body.error}`) : t(body.error || "quick.err_generic");
      return setError({ field: body.field, text });
    }
    setStep("services");
  }

  // Their LineCatch number is being assigned in the background while they do services and hours.
  if (step === "services") return <ServicesStep onBack={() => setStep("start")} onNext={() => setStep("hours")} />;
  if (step === "hours") return <HoursStep onBack={() => setStep("services")} onNext={() => setStep("loyalty")} />;
  if (step === "loyalty") return <LoyaltyStep onBack={() => setStep("hours")} onNext={() => setStep("forward")} />;
  if (step === "forward") return <ForwardCallsStep onDone={() => router.push("/dashboard")} />;

  const field = (name: string) => (error?.field === name ? "var(--ob-danger)" : "var(--ob-border)");

  return (
    <div className="min-h-[100dvh] flex flex-col" style={{ backgroundColor: "var(--ob-bg)", fontFamily: "var(--ob-font-body)" }}>
      <header className="px-5 pt-[max(16px,env(safe-area-inset-top))] pb-2">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <span className="text-base font-bold" style={{ fontFamily: "var(--ob-font-heading)" }}>
            <span style={{ color: "var(--ob-text)" }}>Line</span>
            <span style={{ color: "var(--ob-accent)" }}>Catch</span>
          </span>
          <div role="group" aria-label={t("welcome.language_label")} className="flex p-1 rounded-full" style={{ backgroundColor: "var(--ob-surface)", border: "1px solid var(--ob-border)" }}>
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                aria-pressed={language === l.code}
                onClick={() => setLanguage(l.code)}
                className="min-h-9 px-3 rounded-full text-xs font-semibold"
                style={language === l.code ? { backgroundColor: "var(--ob-accent)", color: "var(--accent-fg)" } : { color: "var(--ob-text-secondary)" }}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 px-5">
        <form onSubmit={submit} className="max-w-md mx-auto pt-8 pb-10 space-y-6" style={{ animation: "ob-fade-up 400ms ease-out" }} noValidate>
          <div>
            <SetupProgress step={1} />
            <h1 className="mt-4text-[34px] leading-[1.05] font-bold tracking-tight" style={{ fontFamily: "var(--ob-font-heading)", color: "var(--ob-text)" }}>{t("quick.title")}</h1>
            <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "var(--ob-text-secondary)" }}>{t("quick.subtitle")}</p>
          </div>

          {applied && (
            <p className="text-[13px] rounded-xl px-3.5 py-3" style={{ backgroundColor: "var(--ob-accent-glow)", color: "var(--ob-accent)" }}>
              ✓ {t("step1.ref_applied", { code: applied.code, percent: REFERRAL_PERCENT_OFF })}
            </p>
          )}

          <label className="block">
            <span className="text-xs uppercase tracking-wider font-medium block mb-2" style={{ color: "var(--ob-text-muted)" }}>{t("quick.name_label")}</span>
            <input
              id="quick-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder={t("quick.name_placeholder")}
              autoComplete="given-name"
              maxLength={40}
              aria-invalid={error?.field === "firstName"}
              className="w-full h-12 rounded-xl px-3.5 text-base focus:outline-none"
              style={{ backgroundColor: "var(--ob-input-bg)", border: `1px solid ${field("firstName")}`, color: "var(--ob-text)" }}
            />
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-wider font-medium block mb-2" style={{ color: "var(--ob-text-muted)" }}>{t("quick.shop_label")}</span>
            <input
              id="quick-shop"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              placeholder={t("quick.shop_placeholder")}
              autoComplete="organization"
              maxLength={60}
              aria-invalid={error?.field === "businessName"}
              className="w-full h-12 rounded-xl px-3.5 text-base focus:outline-none"
              style={{ backgroundColor: "var(--ob-input-bg)", border: `1px solid ${field("businessName")}`, color: "var(--ob-text)" }}
            />
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-wider font-medium block mb-2" style={{ color: "var(--ob-text-muted)" }}>{t("quick.phone_label")}</span>
            <input
              id="quick-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 234-5678"
              autoComplete="tel"
              aria-invalid={error?.field === "phone"}
              aria-describedby="quick-phone-hint"
              className="w-full h-12 rounded-xl px-3.5 text-base focus:outline-none"
              style={{ backgroundColor: "var(--ob-input-bg)", border: `1px solid ${field("phone")}`, color: "var(--ob-text)" }}
            />
            <span id="quick-phone-hint" className="block mt-2 text-xs leading-relaxed" style={{ color: "var(--ob-text-muted)" }}>{t("quick.phone_hint")}</span>
          </label>

          {!applied && (
            showCode ? (
              <label className="block">
                <span className="text-xs uppercase tracking-wider font-medium block mb-2" style={{ color: "var(--ob-text-muted)" }}>{t("quick.code_label")}</span>
                <input
                  id="quick-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  autoComplete="off"
                  aria-invalid={error?.field === "referralCode"}
                  className="w-full h-12 rounded-xl px-3.5 text-base uppercase focus:outline-none"
                  style={{ backgroundColor: "var(--ob-input-bg)", border: `1px solid ${field("referralCode")}`, color: "var(--ob-text)" }}
                />
              </label>
            ) : (
              <button type="button" onClick={() => setShowCode(true)} className="min-h-11 text-sm font-semibold" style={{ color: "var(--ob-accent)" }}>
                {t("quick.have_code")}
              </button>
            )
          )}

          {error && (
            <p role="alert" className="text-sm rounded-xl px-3.5 py-3" style={{ backgroundColor: "color-mix(in srgb, var(--ob-danger) 10%, transparent)", color: "var(--ob-danger)" }}>
              {error.text}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full h-14 rounded-2xl text-base font-bold disabled:opacity-50 transition-transform active:scale-[0.99]"
            style={{ backgroundColor: "var(--ob-accent)", color: "var(--accent-fg)", fontFamily: "var(--ob-font-heading)" }}
          >
            {saving ? t("quick.saving") : t("quick.cta")}
          </button>
          <p className="text-xs text-center leading-relaxed" style={{ color: "var(--ob-text-muted)" }}>{t("quick.fine_print")}</p>
        </form>
      </main>
    </div>
  );
}

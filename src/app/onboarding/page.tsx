"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useT, useLocale, useSetLocale, type Locale } from "@/lib/i18n";
import { ACCENT_COLORS } from "@/lib/themes";
import { money, STICKER_PRICE_CENTS, REFERRED_PERCENT_OFF, DEFAULT_TZ } from "@/lib/config";
import PortfolioSection from "@/app/dashboard/settings/portfolio-section";
import { PageSkeleton } from "@/components/ui/skeleton";


const LANGUAGES = [
  { code: "en" as const, label: "English" },
  { code: "es" as const, label: "Español" },
];

const HEARD_FROM = ["barber", "instagram", "tiktok", "google", "youtube", "event", "other"] as const;


const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

type BusinessHours = Record<string, { open: string; close: string } | null>;

type Service = {
  name: string;
  price: number;
  duration: number;
  enabled: boolean;
  id?: string;
  sortOrder: number;
  priceInput?: string;
  durationInput?: string;
};

const SERVICE_NAMES: Record<string, Record<string, string>> = {
  en: { lineup: "Lineup", lineup_taper: "Lineup + Taper", lineup_taper_beard: "Lineup + Taper + Beard" },
  es: { lineup: "Lineup", lineup_taper: "Lineup + Taper", lineup_taper_beard: "Lineup + Taper + Barba" },
};

function getDefaultServices(lang: string): Service[] {
  const n = SERVICE_NAMES[lang] || SERVICE_NAMES.en;
  return [
    { name: n.lineup, price: 30, duration: 30, enabled: true, sortOrder: 0 },
    { name: n.lineup_taper, price: 35, duration: 45, enabled: true, sortOrder: 1 },
    { name: n.lineup_taper_beard, price: 45, duration: 60, enabled: true, sortOrder: 2 },
  ];
}

const TOTAL_STEPS = 8;
const DONE = TOTAL_STEPS - 1;

export default function OnboardingPage() {
  // The language picked here is the app's language from now on (cookie + saved on the account).
  const language = useLocale();
  const setLanguage = useSetLocale();
  const [loaded, setLoaded] = useState(false);
  const [initialData, setInitialData] = useState<{
    profile: Record<string, unknown>;
    services: { id: string; name: string; price: number; duration_minutes: number; is_active: boolean; sort_order: number }[];
    googleName: string;
    googleEmail: string;
    pendingCode?: string | null;
    referral?: { code: string; name: string | null } | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/onboarding");
        if (cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        const savedLang = data.profile?.barber_language;
        if ((savedLang === "en" || savedLang === "es") && savedLang !== document.cookie.match(/lc_lang=(\w+)/)?.[1]) {
          setLanguage(savedLang);
        }
        setInitialData(data);
      } catch {}
      if (!cancelled) setLoaded(true);
    }
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once
  }, []);

  if (!loaded) {
    return (
      <div className="h-[100dvh] flex items-center justify-center px-4" style={{ backgroundColor: "var(--ob-bg)" }}>
        <PageSkeleton />
      </div>
    );
  }

  return (
    <OnboardingFlow language={language} setLanguage={setLanguage} initialData={initialData} />
  );
}

function OnboardingFlow({
  language,
  setLanguage,
  initialData,
}: {
  language: Locale;
  setLanguage: (l: Locale) => void;
  initialData: {
    profile: Record<string, unknown>;
    services: { id: string; name: string; price: number; duration_minutes: number; is_active: boolean; sort_order: number }[];
    googleName: string;
    googleEmail: string;
    pendingCode?: string | null;
    referral?: { code: string; name: string | null } | null;
  } | null;
}) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const stickerPrice = money(STICKER_PRICE_CENTS, locale);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [animKey, setAnimKey] = useState(0);

  const [firstName, setFirstName] = useState("");
  const [accentColor, setAccentColor] = useState("#D4AF7A");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [heardFrom, setHeardFrom] = useState("");
  const appliedRef = initialData?.referral ?? null;
  const [referralCode, setReferralCode] = useState(appliedRef?.code || initialData?.pendingCode || "");
  const [refResult, setRefResult] = useState<{ code: string; valid: boolean; name: string | null } | null>(null);
  const cleanRef = referralCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const refCheck: { state: "idle" | "checking" | "ok" | "bad"; name?: string | null } =
    cleanRef.length < 4 ? { state: "idle" } : refResult?.code !== cleanRef ? { state: "checking" } : refResult.valid ? { state: "ok", name: refResult.name } : { state: "bad" };
  const [refError, setRefError] = useState("");

  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [services, setServices] = useState<Service[]>([]);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("25");
  const [customDuration, setCustomDuration] = useState("30");

  // This flow only renders in the browser (after /api/onboarding loads), so the device timezone is safe here.
  const [timezone, setTimezone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TZ;
    } catch {
      return DEFAULT_TZ;
    }
  });
  const [businessHours, setBusinessHours] = useState<BusinessHours>({
    monday: { open: "09:00", close: "18:00" },
    tuesday: { open: "09:00", close: "18:00" },
    wednesday: { open: "09:00", close: "18:00" },
    thursday: { open: "09:00", close: "18:00" },
    friday: { open: "09:00", close: "18:00" },
    saturday: { open: "09:00", close: "18:00" },
    sunday: null,
  });

  const [featureAutotext, setFeatureAutotext] = useState(true);
  const [featureWednesday, setFeatureWednesday] = useState(true);
  const [featureReviews, setFeatureReviews] = useState(false);
  // SMS marketing is off by default; turning it on means shipping a QR sticker to the shop.
  const [featureMarketing, setFeatureMarketing] = useState(false);
  const [wantsSticker, setWantsSticker] = useState(false);
  const [shipping, setShipping] = useState({ name: "", line1: "", line2: "", city: "", state: "", zip: "" });
  const [googleReviewUrl, setGoogleReviewUrl] = useState("");

  const [confettiDone, setConfettiDone] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Saved account data fills the form once it's loaded; switching language re-seeds the default services.
  useEffect(() => {
    if (!initialData) return;
    /* eslint-disable react-hooks/set-state-in-effect -- one-time seed from server data */
    const p = initialData.profile || {};
    if (p.first_name) setFirstName(p.first_name as string);
    if (p.accent_color) {
      setAccentColor(p.accent_color as string);
      document.documentElement.style.setProperty("--accent-color", p.accent_color as string);
    }
    if (p.avatar_url) setAvatarUrl(p.avatar_url as string);
    if (p.business_name) setBusinessName(p.business_name as string);
    if (p.forwarding_number) setPhone(p.forwarding_number as string);
    if (p.email) setEmail(p.email as string);
    if (p.business_hours) setBusinessHours(p.business_hours as BusinessHours);
    if (p.timezone) setTimezone(p.timezone as string);
    if (typeof p.feature_autotext === "boolean") setFeatureAutotext(p.feature_autotext);
    if (typeof p.feature_wednesday === "boolean") setFeatureWednesday(p.feature_wednesday);
    if (typeof p.feature_reviews === "boolean") setFeatureReviews(p.feature_reviews);
    if (typeof p.feature_marketing === "boolean") setFeatureMarketing(p.feature_marketing);
    if (p.shipping_address && typeof p.shipping_address === "object") {
      const a = p.shipping_address as Record<string, string | null>;
      setShipping({ name: a.name || "", line1: a.line1 || "", line2: a.line2 || "", city: a.city || "", state: a.state || "", zip: a.zip || "" });
    }
    if (p.google_review_url) setGoogleReviewUrl(p.google_review_url as string);
    if (typeof p.referral_source === "string") setHeardFrom(p.referral_source);
    if (initialData.googleName && !p.first_name) setFirstName(initialData.googleName);
    if (initialData.googleEmail && !p.email) setEmail(initialData.googleEmail);
    if (initialData.services && initialData.services.length > 0) {
      setServices(initialData.services.map((s) => ({
        id: s.id, name: s.name, price: s.price, duration: s.duration_minutes,
        enabled: s.is_active, sortOrder: s.sort_order,
      })));
    } else {
      setServices(getDefaultServices(language));
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [initialData, language]);

  // Live check of the referral code as they type (debounced).
  useEffect(() => {
    if (appliedRef || cleanRef.length < 4) return;
    const timer = setTimeout(() => {
      fetch(`/api/referrals/check?code=${encodeURIComponent(cleanRef)}`)
        .then((r) => r.json())
        .then((d) => setRefResult({ code: cleanRef, valid: !!d.valid, name: d.name ?? null }))
        .catch(() => {});
    }, 350);
    return () => clearTimeout(timer);
  }, [cleanRef, appliedRef]);

  const saveStep = useCallback(async (stepName: string, data: Record<string, unknown>): Promise<{ ok: boolean; error?: string; body?: Record<string, unknown> }> => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: stepName, data }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Unknown error" }));
        setSaving(false);
        return { ok: false, error: body.error || `Save failed (${res.status})`, body };
      }
      setSaving(false);
      return { ok: true, body: await res.json().catch(() => ({})) };
    } catch {
      setSaving(false);
      return { ok: false, error: "Network error" };
    }
  }, []);

  function resizeImage(file: File, maxDim: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas not supported")); return; }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => blob ? resolve(blob) : reject(new Error("Conversion failed")),
          "image/jpeg",
          0.85,
        );
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image")); };
      img.src = url;
    });
  }

  async function uploadAvatar(file: File) {
    setAvatarUploading(true);
    try {
      const blob = await resizeImage(file, 512);
      const resized = new File([blob], "avatar.jpg", { type: "image/jpeg" });
      const formData = new FormData();
      formData.append("avatar", resized);
      const res = await fetch("/api/onboarding/avatar", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Upload failed" }));
        setError(body.error || "Upload failed");
        return;
      }
      const { avatar_url } = await res.json();
      setAvatarUrl(avatar_url);
    } catch {
      setError("Upload failed");
    } finally {
      setAvatarUploading(false);
    }
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("Image must be under 5MB"); return; }
    if (!file.type.startsWith("image/")) { setError("Invalid image"); return; }
    uploadAvatar(file);
  }

  function handleAccentChange(hex: string) {
    setAccentColor(hex);
    document.documentElement.style.setProperty("--accent-color", hex);
  }

  async function goNext() {
    let result: { ok: boolean; error?: string; body?: Record<string, unknown> } | null = null;

    const langToSave = language;
    if (step === 0) result = await saveStep("who", { language: langToSave });
    else if (step === 1) {
      setRefError("");
      result = await saveStep("who", {
        firstName,
        language: langToSave,
        accentColor,
        ...(heardFrom ? { heardFrom } : {}),
        ...(!appliedRef && referralCode.trim() ? { referralCode: referralCode.trim() } : {}),
      });
      if (!result.ok && result.body?.field === "referralCode") {
        setRefError(t(`step1.err_${result.error}`));
        return;
      }
    }
    else if (step === 2) result = await saveStep("business", { businessName, phone, email });
    else if (step === 3) {
      result = await saveStep("services", { services });
      const ids = result.body?.ids;
      if (result.ok && Array.isArray(ids)) {
        setServices((prev) => prev.map((s, i) => (typeof ids[i] === "string" ? { ...s, id: ids[i] as string } : s)));
      }
    }
    else if (step === 4) result = await saveStep("hours", { businessHours, timezone });
    else if (step === 5)
      result = await saveStep("preferences", {
        featureAutotext,
        featureMarketing,
        // Check-ins and review requests are marketing: off unless marketing is on.
        featureWednesday: featureMarketing && featureWednesday,
        featureReviews: featureMarketing && featureReviews,
        googleReviewUrl,
        // Optional paid add-on: only sent when they chose it.
        wantsSticker,
        ...(wantsSticker ? { shippingAddress: { ...shipping, name: shipping.name || businessName || firstName } } : {}),
      });

    if (result && !result.ok) {
      setError(result.error || "Failed to save");
      return;
    }
    setError(null);
    setAnimKey((k) => k + 1);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }

  function goBack() {
    setError(null);
    setAnimKey((k) => k + 1);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleFinish() {
    const result = await saveStep("complete", {});
    if (!result.ok) {
      setError(result.error || "Failed to complete setup");
      return;
    }
    router.push("/dashboard");
  }

  function toggleDay(day: string) {
    setBusinessHours((prev) => ({
      ...prev,
      [day]: prev[day] ? null : { open: "09:00", close: "18:00" },
    }));
  }

  function updateHours(day: string, field: "open" | "close", value: string) {
    setBusinessHours((prev) => ({
      ...prev,
      [day]: { ...(prev[day] || { open: "09:00", close: "18:00" }), [field]: value },
    }));
  }

  function toggleService(index: number) {
    setServices((prev) => {
      const updated = prev.map((s, i) => i === index ? { ...s, enabled: !s.enabled } : s);
      const enabled = updated.filter((s) => s.enabled);
      const disabled = updated.filter((s) => !s.enabled);
      return [...enabled, ...disabled];
    });
  }

  function updateServiceField(index: number, field: "price" | "duration", value: string) {
    const inputField = field === "price" ? "priceInput" : "durationInput";
    setServices((prev) => prev.map((s, i) => i === index ? { ...s, [inputField]: value } : s));
  }

  function commitServiceField(index: number, field: "price" | "duration") {
    const inputField = field === "price" ? "priceInput" : "durationInput";
    setServices((prev) => prev.map((s, i) => {
      if (i !== index) return s;
      const raw = s[inputField];
      if (raw === undefined) return s;
      const parsed = field === "price" ? parseFloat(raw) : parseInt(raw);
      return { ...s, [field]: isNaN(parsed) || parsed < 0 ? 0 : parsed, [inputField]: undefined };
    }));
  }

  function addCustomService() {
    if (!customName.trim()) return;
    setServices((prev) => {
      const newList = [...prev, {
        name: customName.trim(), price: parseFloat(customPrice) || 0,
        duration: parseInt(customDuration) || 30, enabled: true, sortOrder: prev.length,
      }];
      const enabled = newList.filter((s) => s.enabled);
      const disabled = newList.filter((s) => !s.enabled);
      return [...enabled, ...disabled];
    });
    setCustomName("");
    setCustomPrice("25");
    setCustomDuration("30");
    setShowAddCustom(false);
  }

  // Confetti
  useEffect(() => {
    if (step !== DONE || confettiDone || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function sizeCanvas() {
      canvas.width = document.documentElement.clientWidth;
      canvas.height = document.documentElement.clientHeight;
    }
    sizeCanvas();
    window.addEventListener("resize", sizeCanvas);

    const particles: { x: number; y: number; vx: number; vy: number; color: string; size: number; rotation: number; rotationSpeed: number }[] = [];
    const colors = [accentColor, "#D4AF7A", "#FAF7F2", "#C29A62"];
    for (let i = 0; i < 120; i++) {
      particles.push({
        x: Math.random() * canvas.width, y: -10 - Math.random() * canvas.height * 0.5,
        vx: (Math.random() - 0.5) * 4, vy: Math.random() * 3 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4, rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
      });
    }
    let frame = 0;
    let running = true;
    function animate() {
      if (!ctx || !canvas || !running) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.rotation += p.rotationSpeed;
        if (p.y < canvas.height + 20) alive = true;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      frame++;
      if (alive && frame < 300) requestAnimationFrame(animate);
      else setConfettiDone(true);
    }
    animate();
    return () => { running = false; window.removeEventListener("resize", sizeCanvas); };
  }, [step, confettiDone]);

  const STEP_PROGRESS = [0, 17, 33, 50, 67, 83, 100, 100];
  const progress = STEP_PROGRESS[step] ?? 0;

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden" style={{ backgroundColor: "var(--ob-bg)", fontFamily: "var(--ob-font-body)" }}>
      {step === DONE && (
        <canvas ref={canvasRef} className="fixed inset-0 z-50 pointer-events-none" />
      )}

      {/* Header */}
      <header className="flex-none px-4 pt-3 pb-2" style={{ height: "var(--ob-header-height)" }}>
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold" style={{ fontFamily: "var(--ob-font-heading)" }}>
              <span style={{ color: "var(--ob-text)" }}>Line</span>
              <span style={{ color: "var(--ob-accent)" }}>Catch</span>
            </span>
            {step > 0 && step < DONE && (
              <span className="text-[11px]" style={{ color: "var(--ob-text-muted)" }}>
                {t("nav.progress_pct", { pct: progress })}
              </span>
            )}
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--ob-border)" }}>
            <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: "var(--ob-accent)", transition: "width 500ms cubic-bezier(0.4, 0, 0.2, 1)" }} />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4" style={{ paddingBottom: "calc(var(--ob-footer-height) + env(safe-area-inset-bottom, 0px) + 8px)" }}>
        <div className="max-w-md mx-auto py-4" key={animKey}>

          {/* Welcome */}
          {step === 0 && (
            <div className="flex flex-col items-center text-center pt-8 space-y-6">
              <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--ob-accent-glow)", animation: "ob-scale-in 600ms ease-out" }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" style={{ color: "var(--ob-accent)" }}>
                  <path d="M3 5.5C3 4.12 4.12 3 5.5 3h3.09c.39 0 .74.24.88.6l1.42 3.55c.15.37.05.8-.25 1.06l-1.72 1.47a12.06 12.06 0 005.69 5.69l1.47-1.72c.26-.3.69-.4 1.06-.25l3.55 1.42c.36.14.6.49.6.88v3.09c0 1.38-1.12 2.5-2.5 2.5C9.83 21.29 2.71 14.17 2.71 5.5H3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div style={{ animation: "ob-fade-up 500ms ease-out 200ms both" }}>
                <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "var(--ob-font-heading)", color: "var(--ob-text)" }}>
                  {t("welcome.title_pre")}<span style={{ color: "var(--ob-accent)" }}>{t("welcome.title_brand")}</span>
                </h1>
                <p className="mt-3 text-base leading-relaxed whitespace-pre-line" style={{ color: "var(--ob-text-muted)" }}>
                  {t("welcome.subtitle")}
                </p>
              </div>

              {/* Language picker */}
              <div className="w-full max-w-xs" style={{ animation: "ob-fade-up 500ms ease-out 350ms both" }}>
                <label className="text-xs uppercase tracking-wider font-medium block mb-2 text-center" style={{ color: "var(--ob-text-muted)", fontFamily: "var(--ob-font-heading)" }}>
                  {t("welcome.language_label")}
                </label>
                <div className="flex gap-2">
                  {LANGUAGES.map((l) => (
                    <button
                      key={l.code}
                      onClick={() => setLanguage(l.code as Locale)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 flex items-center justify-center gap-1.5"
                      style={{
                        backgroundColor: language === l.code ? "var(--ob-accent)" : "var(--ob-surface)",
                        color: language === l.code ? "#000" : "var(--ob-text-secondary)",
                        border: language === l.code ? "none" : "1px solid var(--ob-border)",
                      }}
                    >
                      <span>{l.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div
                className="rounded-2xl p-5 w-full max-w-xs"
                style={{ backgroundColor: "var(--ob-surface)", border: "1px solid var(--ob-border)", animation: "ob-fade-up 500ms ease-out 500ms both" }}
              >
                <div className="space-y-3 text-left">
                  {[t("welcome.bullet_1"), t("welcome.bullet_2"), t("welcome.bullet_3")].map((item, i) => (
                    <div key={i} className="flex items-center gap-3" style={{ animation: `ob-fade-up 400ms ease-out ${700 + i * 100}ms both` }}>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--ob-accent-glow)" }}>
                        <svg className="w-3 h-3" style={{ color: "var(--ob-accent)" }} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="text-sm" style={{ color: "var(--ob-text-secondary)" }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Who you are */}
          {step === 1 && (
            <StepContainer title={t("step1.title")} subtitle={t("step1.subtitle")} stepNum={1}>
              <div className="flex flex-col items-center mb-6">
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  className="w-20 h-20 rounded-full flex items-center justify-center overflow-hidden transition-transform hover:scale-105"
                  style={{ backgroundColor: "var(--ob-surface)", border: "2px dashed var(--ob-border)" }}
                >
                  {avatarUploading ? (
                    <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: "var(--ob-accent-glow)", borderTopColor: "var(--ob-accent)" }} />
                  ) : avatarUrl ? (
                    <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-8 h-8" style={{ color: "var(--ob-text-muted)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                    </svg>
                  )}
                </button>
                <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                <span className="text-xs mt-2" style={{ color: "var(--ob-text-muted)" }}>
                  {avatarUrl ? t("step1.avatar_change") : t("step1.avatar_add")}
                </span>
              </div>
              <InputField label={t("step1.name_label")} value={firstName} onChange={setFirstName} placeholder={t("step1.name_placeholder")} />

              <div className="mt-5">
                <label className="text-xs uppercase tracking-wider font-medium block mb-3" style={{ color: "var(--ob-text-muted)", fontFamily: "var(--ob-font-heading)" }}>
                  {t("step1.color_label")}
                </label>
                <div className="flex flex-wrap gap-2.5">
                  {ACCENT_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      onClick={() => handleAccentChange(c.hex)}
                      className="w-10 h-10 rounded-xl transition-all duration-200 relative"
                      style={{
                        backgroundColor: c.hex,
                        boxShadow: accentColor === c.hex ? `0 0 0 2px var(--ob-bg), 0 0 0 4px ${c.hex}` : "none",
                        transform: accentColor === c.hex ? "scale(1.1)" : "scale(1)",
                      }}
                      title={c.name}
                    >
                      {accentColor === c.hex && (
                        <svg className="w-4 h-4 absolute inset-0 m-auto text-[var(--accent-fg)]" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6">
                <p className="text-xs uppercase tracking-wider font-medium mb-3" style={{ color: "var(--ob-text-muted)", fontFamily: "var(--ob-font-heading)" }}>
                  {t("step1.heard_label")}
                </p>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("step1.heard_label")}>
                  {HEARD_FROM.map((h) => (
                    <button
                      key={h}
                      type="button"
                      role="radio"
                      aria-checked={heardFrom === h}
                      onClick={() => setHeardFrom(heardFrom === h ? "" : h)}
                      className="h-9 px-3.5 rounded-xl text-[13px] transition-colors"
                      style={{
                        backgroundColor: heardFrom === h ? "var(--ob-accent)" : "var(--ob-surface)",
                        color: heardFrom === h ? "#000" : "var(--ob-text-secondary)",
                        border: heardFrom === h ? "none" : "1px solid var(--ob-border)",
                        fontWeight: heardFrom === h ? 600 : 400,
                      }}
                    >
                      {t(`step1.heard.${h}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5">
                {appliedRef ? (
                  <p className="text-[13px] rounded-xl px-3.5 py-3" style={{ backgroundColor: "var(--ob-accent-glow)", color: "var(--ob-accent)" }}>
                    ✓ {t("step1.ref_applied", { code: appliedRef.code, percent: REFERRED_PERCENT_OFF })}
                  </p>
                ) : (
                  <>
                    <InputField
                      label={`${t("step1.ref_label")} (${t("step1.ref_optional")})`}
                      value={referralCode}
                      onChange={(v) => { setReferralCode(v.toUpperCase().slice(0, 12)); setRefError(""); }}
                      placeholder={t("step1.ref_placeholder")}
                    />
                    <p className="text-[12px] mt-1.5 min-h-[18px]" aria-live="polite" style={{ color: refError || refCheck.state === "bad" ? "#F08A8A" : refCheck.state === "ok" ? "#A8C49A" : "var(--ob-text-muted)" }}>
                      {refError ||
                        (refCheck.state === "checking"
                          ? t("step1.ref_checking")
                          : refCheck.state === "ok"
                            ? `✓ ${refCheck.name ? t("step1.ref_ok_from", { name: refCheck.name, percent: REFERRED_PERCENT_OFF }) : t("step1.ref_ok", { percent: REFERRED_PERCENT_OFF })}`
                            : refCheck.state === "bad"
                              ? t("step1.ref_bad")
                              : "")}
                    </p>
                  </>
                )}
              </div>
            </StepContainer>
          )}

          {/* Step 2: Your business */}
          {step === 2 && (
            <StepContainer title={t("step2.title")} subtitle={t("step2.subtitle")} stepNum={2}>
              <InputField label={t("step2.shop_label")} value={businessName} onChange={setBusinessName} placeholder={t("step2.shop_placeholder")} />
              <InputField label={t("step2.phone_label")} value={phone} onChange={setPhone} placeholder={t("step2.phone_placeholder")} type="tel" className="mt-4" />
              <p className="text-[11px] mt-1" style={{ color: "var(--ob-text-muted)" }}>{t("step2.phone_hint")}</p>
              <InputField label={t("step2.email_label")} value={email} onChange={setEmail} placeholder={t("step2.email_placeholder")} type="email" className="mt-4" />
            </StepContainer>
          )}

          {/* Step 3: Services */}
          {step === 3 && (
            <StepContainer title={t("step3.title")} subtitle={t("step3.subtitle")} stepNum={3}>
              <div className="space-y-2">
                {services.map((svc, i) => (
                  <div
                    key={svc.name + i}
                    className="rounded-xl p-3 transition-all duration-200"
                    style={{
                      backgroundColor: svc.enabled ? "var(--ob-surface)" : "transparent",
                      border: "1px solid var(--ob-border)",
                      opacity: svc.enabled ? 1 : 0.4,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <button onClick={() => toggleService(i)} className="flex items-center gap-3">
                        <div
                          className="w-5 h-5 rounded-md flex items-center justify-center transition-colors"
                          style={{
                            backgroundColor: svc.enabled ? "var(--ob-accent)" : "transparent",
                            border: svc.enabled ? "none" : "1.5px solid var(--ob-text-muted)",
                          }}
                        >
                          {svc.enabled && (
                            <svg className="w-3 h-3 text-[var(--accent-fg)]" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <span className="text-sm font-medium" style={{ color: svc.enabled ? "var(--ob-text)" : "var(--ob-text-muted)" }}>{svc.name}</span>
                      </button>
                    </div>
                    {svc.enabled && (
                      <div className="flex gap-3 ml-8 mt-2">
                        <div className="flex-1">
                          <label className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: "var(--ob-text-muted)" }}>{t("step3.price_label")}</label>
                          <div className="flex items-center gap-1">
                            <span className="text-xs" style={{ color: "var(--ob-text-muted)" }}>$</span>
                            <input
                              type="number"
                              value={svc.priceInput !== undefined ? svc.priceInput : svc.price}
                              onChange={(e) => updateServiceField(i, "price", e.target.value)}
                              onBlur={() => commitServiceField(i, "price")}
                              className="w-full rounded-lg px-2 py-1.5 text-sm focus:outline-none"
                              style={{ backgroundColor: "var(--ob-input-bg)", border: "1px solid var(--ob-border)", color: "var(--ob-text)" }}
                            />
                          </div>
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: "var(--ob-text-muted)" }}>{t("step3.minutes_label")}</label>
                          <input
                            type="number"
                            value={svc.durationInput !== undefined ? svc.durationInput : svc.duration}
                            onChange={(e) => updateServiceField(i, "duration", e.target.value)}
                            onBlur={() => commitServiceField(i, "duration")}
                            className="w-full rounded-lg px-2 py-1.5 text-sm focus:outline-none"
                            style={{ backgroundColor: "var(--ob-input-bg)", border: "1px solid var(--ob-border)", color: "var(--ob-text)" }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {!showAddCustom ? (
                <button
                  onClick={() => setShowAddCustom(true)}
                  className="w-full py-3 rounded-xl text-sm transition-colors mt-3"
                  style={{ border: "1px dashed var(--ob-border)", color: "var(--ob-text-muted)" }}
                >
                  {t("step3.add_custom")}
                </button>
              ) : (
                <div className="rounded-xl p-4 space-y-3 mt-3" style={{ backgroundColor: "var(--ob-surface)", border: "1px solid var(--ob-border)" }}>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder={t("step3.custom_name_placeholder")}
                    className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={{ backgroundColor: "var(--ob-input-bg)", border: "1px solid var(--ob-border)", color: "var(--ob-text)" }}
                    autoFocus
                  />
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-[10px] block mb-1" style={{ color: "var(--ob-text-muted)" }}>{t("step3.custom_price_label")}</label>
                      <input type="number" value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} className="w-full rounded-lg px-2 py-1.5 text-sm focus:outline-none" style={{ backgroundColor: "var(--ob-input-bg)", border: "1px solid var(--ob-border)", color: "var(--ob-text)" }} />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] block mb-1" style={{ color: "var(--ob-text-muted)" }}>{t("step3.custom_minutes_label")}</label>
                      <input type="number" value={customDuration} onChange={(e) => setCustomDuration(e.target.value)} className="w-full rounded-lg px-2 py-1.5 text-sm focus:outline-none" style={{ backgroundColor: "var(--ob-input-bg)", border: "1px solid var(--ob-border)", color: "var(--ob-text)" }} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowAddCustom(false)} className="flex-1 py-2 rounded-lg text-xs" style={{ color: "var(--ob-text-muted)", backgroundColor: "var(--ob-surface-hover)" }}>{t("step3.cancel")}</button>
                    <button onClick={addCustomService} disabled={!customName.trim()} className="flex-1 py-2 rounded-lg text-xs font-semibold text-[var(--accent-fg)] disabled:opacity-30" style={{ backgroundColor: "var(--ob-accent)" }}>{t("step3.add")}</button>
                  </div>
                </div>
              )}

              {!services.some((s) => s.enabled) && (
                <p className="text-xs text-center mt-3" style={{ color: "var(--ob-danger)" }}>{t("step3.at_least_one")}</p>
              )}
            </StepContainer>
          )}

          {/* Step 4: Calendar & hours */}
          {step === 4 && (
            <StepContainer title={t("step4.title")} subtitle={t("step4.subtitle")} stepNum={4}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.8px] mb-2" style={{ color: "var(--ob-text-muted)" }}>{t("step4.hours")}</p>
              <div className="rounded-xl p-4 space-y-2" style={{ backgroundColor: "var(--ob-surface)", border: "1px solid var(--ob-border)" }}>
                {DAYS.map((day) => {
                  const isOpen = !!businessHours[day];
                  return (
                    <div key={day} className="flex items-center gap-2">
                      <button
                        onClick={() => toggleDay(day)}
                        className="w-10 h-5 rounded-full relative transition-colors duration-200 shrink-0"
                        style={{ backgroundColor: isOpen ? "var(--ob-accent)" : "var(--ob-input-bg)" }}
                      >
                        <div className="w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all duration-200 shadow-sm" style={{ left: isOpen ? "22px" : "2px" }} />
                      </button>
                      <span className="text-sm w-10 shrink-0" style={{ color: isOpen ? "var(--ob-text)" : "var(--ob-text-muted)" }}>{t(`days.${day}`)}</span>
                      {isOpen ? (
                        <div className="flex items-center gap-1.5 flex-1">
                          <input type="time" value={businessHours[day]!.open} onChange={(e) => updateHours(day, "open", e.target.value)} className="text-xs rounded-lg px-1.5 py-1 w-[5.5rem] focus:outline-none" style={{ backgroundColor: "var(--ob-input-bg)", border: "1px solid var(--ob-border)", color: "var(--ob-text-secondary)" }} />
                          <span className="text-xs" style={{ color: "var(--ob-text-muted)" }}>–</span>
                          <input type="time" value={businessHours[day]!.close} onChange={(e) => updateHours(day, "close", e.target.value)} className="text-xs rounded-lg px-1.5 py-1 w-[5.5rem] focus:outline-none" style={{ backgroundColor: "var(--ob-input-bg)", border: "1px solid var(--ob-border)", color: "var(--ob-text-secondary)" }} />
                        </div>
                      ) : (
                        <span className="text-xs" style={{ color: "var(--ob-text-muted)" }}>{t("step4.closed")}</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-4">
                <label className="text-xs uppercase tracking-wider font-medium block mb-2" style={{ color: "var(--ob-text-muted)", fontFamily: "var(--ob-font-heading)" }}>{t("step4.timezone_label")}</label>
                <div className="rounded-lg px-3 py-2.5 text-sm" style={{ backgroundColor: "var(--ob-input-bg)", border: "1px solid var(--ob-border)", color: "var(--ob-text-secondary)" }}>
                  {timezone || t("step4.timezone_detecting")}
                </div>
                <p className="text-[11px] mt-1" style={{ color: "var(--ob-text-muted)" }}>{t("step4.timezone_hint")}</p>
              </div>
            </StepContainer>
          )}

          {/* Step 5: Preferences */}
          {step === 5 && (
            <StepContainer title={t("step5.title")} subtitle={t("step5.subtitle")} stepNum={5}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.8px] mb-2" style={{ color: "var(--ob-text-muted)" }}>{t("step5.included")}</p>
              <div className="space-y-3">
                <ToggleCard label={t("step5.autotext_label")} description={t("step5.autotext_desc")} checked={featureAutotext} onChange={setFeatureAutotext} />
                <div className="rounded-xl px-4 py-3 text-xs leading-relaxed" style={{ backgroundColor: "var(--ob-surface)", border: "1px solid var(--ob-border)", color: "var(--ob-text-secondary)" }}>
                  {t("step5.service_note")}
                </div>
              </div>

              <p className="text-[11px] font-semibold uppercase tracking-[0.8px] mt-6 mb-2" style={{ color: "var(--ob-text-muted)" }}>{t("step5.marketing_section")}</p>
              <ToggleCard label={t("step5.marketing_label")} description={t("step5.marketing_desc")} checked={featureMarketing} onChange={setFeatureMarketing} />

              {featureMarketing && (
                <div className="mt-3 space-y-3" style={{ animation: "ob-fade-up 300ms ease-out" }}>
                  <p className="text-xs leading-relaxed px-1" style={{ color: "var(--ob-text-secondary)" }}>{t("step5.marketing_consent_note")}</p>
                  <ToggleCard label={t("step5.wednesday_label")} description={t("step5.wednesday_desc")} checked={featureWednesday} onChange={setFeatureWednesday} />
                  <ToggleCard label={t("step5.reviews_label")} description={t("step5.reviews_desc")} checked={featureReviews} onChange={setFeatureReviews} />
                  {featureReviews && (
                    <div style={{ animation: "ob-fade-up 300ms ease-out" }}>
                      <InputField label={t("step5.review_url_label")} value={googleReviewUrl} onChange={setGoogleReviewUrl} placeholder={t("step5.review_url_placeholder")} />
                      <p className="text-[11px] mt-1" style={{ color: "var(--ob-text-muted)" }}>{t("step5.review_url_hint")}</p>
                    </div>
                  )}
                </div>
              )}

              <p className="text-[11px] font-semibold uppercase tracking-[0.8px] mt-6 mb-2" style={{ color: "var(--ob-text-muted)" }}>{t("step5.sticker_section")}</p>
              <div className="rounded-xl px-4 py-3 flex gap-3 mb-3" style={{ backgroundColor: "var(--ob-accent-glow)", border: "1px solid var(--ob-border-focus)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ob-accent)" strokeWidth="2" className="shrink-0 mt-0.5" aria-hidden><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 17h4v4" /></svg>
                <p className="text-xs leading-relaxed" style={{ color: "var(--ob-text)" }}>{t("step5.sticker_note")}</p>
              </div>
              <ToggleCard label={t("step5.sticker_label", { price: stickerPrice })} description={t("step5.sticker_desc")} checked={wantsSticker} onChange={setWantsSticker} />
              {wantsSticker && (
                <div className="mt-3 space-y-3" style={{ animation: "ob-fade-up 300ms ease-out" }}>
                  <InputField label={t("step5.ship_name")} value={shipping.name} onChange={(v) => setShipping((a) => ({ ...a, name: v }))} placeholder={businessName || t("step5.ship_name_placeholder")} />
                  <InputField label={t("step5.ship_street")} value={shipping.line1} onChange={(v) => setShipping((a) => ({ ...a, line1: v }))} placeholder={t("step5.ship_street_placeholder")} />
                  <InputField label={t("step5.ship_unit")} value={shipping.line2} onChange={(v) => setShipping((a) => ({ ...a, line2: v }))} placeholder={t("step5.ship_unit_placeholder")} />
                  <div className="grid grid-cols-[1fr_72px_96px] gap-2">
                    <InputField label={t("step5.ship_city")} value={shipping.city} onChange={(v) => setShipping((a) => ({ ...a, city: v }))} placeholder="" />
                    <InputField label={t("step5.ship_state")} value={shipping.state} onChange={(v) => setShipping((a) => ({ ...a, state: v.toUpperCase().slice(0, 2) }))} placeholder="" />
                    <InputField label={t("step5.ship_zip")} value={shipping.zip} onChange={(v) => setShipping((a) => ({ ...a, zip: v.replace(/[^\d-]/g, "").slice(0, 10) }))} placeholder="" />
                  </div>
                </div>
              )}
            </StepContainer>
          )}

          {/* Step 6: Portfolio (saves as they go; skippable, editable later from the dashboard Portfolio button) */}
          {step === 6 && (
            <StepContainer title={t("step6.title")} subtitle={t("step6.subtitle")} stepNum={6}>
              <PortfolioSection bare />
            </StepContainer>
          )}

          {/* Done */}
          {step === DONE && (
            <div className="flex flex-col items-center text-center pt-8 space-y-6">
              <div className="w-20 h-20 rounded-full flex items-center justify-center overflow-hidden" style={{ backgroundColor: "var(--ob-accent-glow)", animation: "ob-scale-in 500ms ease-out" }}>
                {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : <svg className="w-9 h-9" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="var(--ob-accent)"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>}
              </div>
              <div style={{ animation: "ob-fade-up 500ms ease-out 200ms both" }}>
                <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "var(--ob-font-heading)", color: "var(--ob-text)" }}>{t("done.title")}</h1>
                <p className="mt-2 text-sm" style={{ color: "var(--ob-text-secondary)" }}>{t("done.subtitle")}</p>
              </div>
              <div className="w-full max-w-xs rounded-xl p-5 text-left" style={{ backgroundColor: "var(--ob-surface)", border: "1px solid var(--ob-border)", animation: "ob-fade-up 500ms ease-out 400ms both" }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold overflow-hidden" style={{ backgroundColor: "var(--ob-accent-glow)", color: "var(--ob-accent)" }}>
                    {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : (businessName ? businessName[0].toUpperCase() : "L")}
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--ob-text)" }}>{businessName || "Your Shop"}</p>
                    <p className="text-[11px]" style={{ color: "var(--ob-text-muted)" }}>{firstName || "You"}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {services.filter((s) => s.enabled).slice(0, 3).map((svc, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: "var(--ob-text-secondary)" }}>{svc.name}</span>
                      <span className="text-xs font-medium" style={{ color: "var(--ob-accent)" }}>${svc.price}</span>
                    </div>
                  ))}
                  {services.filter((s) => s.enabled).length > 3 && (
                    <p className="text-[11px]" style={{ color: "var(--ob-text-muted)" }}>{t("done.more_services", { count: services.filter((s) => s.enabled).length - 3 })}</p>
                  )}
                </div>
                <div className="h-px my-3" style={{ backgroundColor: "var(--ob-border)" }} />
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: "var(--ob-text-muted)" }}>{t("done.working_days")}</span>
                  <span className="text-[11px]" style={{ color: "var(--ob-text-secondary)" }}>{t("done.days_per_week", { count: DAYS.filter((d) => businessHours[d]).length })}</span>
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[11px]" style={{ color: "var(--ob-text-muted)" }}>{t("done.marketing")}</span>
                  <span className="text-[11px]" style={{ color: featureMarketing ? "var(--ob-accent)" : "var(--ob-text-secondary)" }}>{featureMarketing ? t("done.marketing_on") : t("done.marketing_off")}</span>
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[11px]" style={{ color: "var(--ob-text-muted)" }}>{t("done.sticker")}</span>
                  <span className="text-[11px]" style={{ color: "var(--ob-text-secondary)" }}>{wantsSticker ? t("done.sticker_on") : t("done.sticker_off")}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="flex-none border-t" style={{ backgroundColor: "var(--ob-bg)", borderColor: "var(--ob-border)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="max-w-md mx-auto px-4 py-3">
          {error && (
            <div className="mb-2 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: "rgba(255,77,77,0.1)", border: "1px solid rgba(255,77,77,0.2)", color: "var(--ob-danger)" }}>
              {t(error)}
            </div>
          )}
          <div className="flex gap-3">
            {step > 0 && step < DONE && (
              <button onClick={goBack} disabled={saving} className="flex-none px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-30" style={{ color: "var(--ob-text-secondary)", backgroundColor: "var(--ob-surface)", border: "1px solid var(--ob-border)" }}>
                {t("nav.back")}
              </button>
            )}
            {step === 0 && (
              <button onClick={goNext} disabled={saving} className="flex-1 py-3.5 rounded-xl text-sm font-bold text-[var(--accent-fg)] transition-all duration-200 hover:brightness-110 disabled:opacity-30" style={{ backgroundColor: "var(--ob-accent)", fontFamily: "var(--ob-font-heading)" }}>
                {saving ? t("nav.saving") : t("welcome.cta")}
              </button>
            )}
            {step > 0 && step < DONE && (
              <button onClick={goNext} disabled={saving || (step === 3 && !services.some((s) => s.enabled))} className="flex-1 py-3 rounded-xl text-sm font-semibold text-[var(--accent-fg)] disabled:opacity-30 transition-all duration-200 hover:brightness-110" style={{ backgroundColor: "var(--ob-accent)" }}>
                {saving ? t("nav.saving") : t("nav.continue")}
              </button>
            )}
            {step === DONE && (
              <button onClick={handleFinish} disabled={saving} className="flex-1 py-3.5 rounded-xl text-sm font-bold text-[var(--accent-fg)] disabled:opacity-30 transition-all duration-200 hover:brightness-110" style={{ backgroundColor: "var(--ob-accent)", fontFamily: "var(--ob-font-heading)" }}>
                {saving ? t("nav.setting_up") : t("done.cta")}
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}

function StepContainer({ title, subtitle, stepNum, children }: { title: string; subtitle: string; stepNum: number; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ animation: "ob-fade-up 400ms ease-out" }}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-md" style={{ backgroundColor: "var(--ob-accent-glow)", color: "var(--ob-accent)" }}>{stepNum}</span>
        </div>
        <h2 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--ob-font-heading)", color: "var(--ob-text)" }}>{title}</h2>
        <p className="text-sm mt-1 mb-5" style={{ color: "var(--ob-text-muted)" }}>{subtitle}</p>
      </div>
      <div style={{ animation: "ob-fade-up 400ms ease-out 150ms both" }}>{children}</div>
    </div>
  );
}

function InputField({ label, value, onChange, placeholder, type = "text", className = "" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string; className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs uppercase tracking-wider font-medium block mb-2" style={{ color: "var(--ob-text-muted)", fontFamily: "var(--ob-font-heading)" }}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none transition-colors"
        style={{ backgroundColor: "var(--ob-input-bg)", border: `1px solid ${value ? "var(--ob-border-focus)" : "var(--ob-border)"}`, color: "var(--ob-text)" }}
      />
    </label>
  );
}

function ToggleCard({ label, description, checked, onChange }: {
  label: string; description: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="rounded-xl p-4 transition-all duration-200" style={{ backgroundColor: "var(--ob-surface)", border: `1px solid ${checked ? "var(--ob-border-focus)" : "var(--ob-border)"}` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium" style={{ color: "var(--ob-text)" }}>{label}</p>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--ob-text-muted)" }}>{description}</p>
        </div>
        <button
          role="switch"
          aria-checked={checked}
          aria-label={label}
          onClick={() => onChange(!checked)}
          className="relative shrink-0 -m-3 p-3"
        >
          <span className="block w-10 h-5 rounded-full relative transition-colors duration-200" style={{ backgroundColor: checked ? "var(--ob-accent)" : "rgba(242,238,230,0.16)" }}>
            <span className="block w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all duration-200 shadow-sm" style={{ left: checked ? "22px" : "2px" }} />
          </span>
        </button>
      </div>
    </div>
  );
}

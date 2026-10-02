"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizePhone } from "@/lib/phone";
import { useT, LanguageToggle } from "@/lib/i18n";

type Invite = { code: string; name: string | null; percentOff: number };

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}

function Login() {
  const router = useRouter();
  const t = useT();
  const params = useSearchParams();
  const refParam = params.get("ref");
  const stickerParam = params.get("sticker");
  const [mode, setMode] = useState<"in" | "up">(params.get("mode") === "in" ? "in" : params.get("mode") === "up" || refParam || stickerParam ? "up" : "in");
  const [sticker, setSticker] = useState<{ code: string; shop: string | null } | null>(null);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"input" | "verify">("input");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  // A referral link (/join/CODE) lands here with ?ref=CODE; the code also lives in a cookie for onboarding.
  useEffect(() => {
    const cookieRef = document.cookie.match(/(?:^|; )lc_ref=([^;]+)/)?.[1];
    const code = refParam || (cookieRef ? decodeURIComponent(cookieRef) : null);
    if (!code) return;
    fetch(`/api/referrals/check?code=${encodeURIComponent(code)}`)
      .then((r) => r.json())
      .then((d) => d.valid && setInvite({ code: d.code, name: d.name, percentOff: d.percentOff }))
      .catch(() => {});
  }, [refParam]);

  // A sticker handed out in person (/s/CODE → "Set up my shop"): it connects at the end of setup.
  useEffect(() => {
    const cookieCode = document.cookie.match(/(?:^|; )lc_sticker=([^;]+)/)?.[1];
    const code = stickerParam || (cookieCode ? decodeURIComponent(cookieCode) : null);
    if (!code) return;
    fetch(`/api/stickers/check?code=${encodeURIComponent(code)}`)
      .then((r) => r.json())
      .then((d) => d.valid && setSticker({ code: d.code, shop: d.shop }))
      .catch(() => {});
  }, [stickerParam]);

  // The referral code and handed-out sticker ride along in the link, so they survive the email
  // being opened in another browser (mail apps often use their own).
  function callbackUrl() {
    const u = new URL("/auth/callback", window.location.origin);
    if (invite?.code) u.searchParams.set("ref", invite.code);
    if (sticker?.code) u.searchParams.set("sticker", sticker.code);
    return u.toString();
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl(),
      },
    });

    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
  }

  async function handleSendEmailLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: callbackUrl(),
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setMessage(mode === "up" ? t("login.sent_up") : t("login.sent_in"));
    setLoading(false);
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const parsed = normalizePhone(phone);
    if (!parsed.valid) {
      setError(t("login.bad_phone"));
      setLoading(false);
      return;
    }
    const formatted = parsed.e164;

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({ phone: formatted });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setPhone(formatted);
    setStep("verify");
    setLoading(false);
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token: otp,
      type: "sms",
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      await fetch("/api/auth/setup-profile", { method: "POST" });
    }

    router.push("/dashboard");
  }

  function resetToInput() {
    setStep("input");
    setOtp("");
    setError("");
    setMessage("");
  }

  const up = mode === "up";
  return (
    <div className="relative min-h-screen bg-[#121110] text-white flex items-center justify-center px-6 py-10 overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--accent-color)_8%,transparent)_0%,transparent_70%)]" />
      <LanguageToggle className="absolute top-4 right-4 z-10" />
      <div className="relative w-full max-w-sm">
        <div className="text-center mb-7" style={{ animation: "ob-fade-up 500ms ease-out both" }}>
          <svg className="mx-auto" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 5.5C3 4.12 4.12 3 5.5 3h3.09c.39 0 .74.24.88.6l1.42 3.55c.15.37.05.8-.25 1.06l-1.72 1.47a12.06 12.06 0 005.69 5.69l1.47-1.72c.26-.3.69-.4 1.06-.25l3.55 1.42c.36.14.6.49.6.88v3.09c0 1.38-1.12 2.5-2.5 2.5C9.83 21.29 2.71 14.17 2.71 5.5H3z" />
            <path d="M14 3s2 .5 3.5 2S20 9 20 9" />
            <path d="M14.5 6.5s1 .3 1.8 1.2c.8.8 1.2 1.8 1.2 1.8" />
          </svg>
          <h1 className="font-heading text-[32px] font-bold tracking-[-1px] mt-3">
            Line<span className="text-[var(--accent-color)]">Catch</span>
          </h1>
          <p className="text-[14px] text-white/40 mt-1.5">{t("login.tagline")}</p>
        </div>

        {sticker && (
          <div className="mb-4 rounded-2xl border border-[#A8C49A]/30 bg-[#A8C49A]/[0.07] px-4 py-3 text-center" style={{ animation: "ob-fade-up 500ms ease-out 60ms both" }}>
            <p className="text-[14px] font-semibold text-[#A8C49A]">
              {sticker.shop ? t("login.sticker_banner_shop", { code: sticker.code, shop: sticker.shop }) : t("login.sticker_banner", { code: sticker.code })}
            </p>
            <p className="text-[12px] text-white/45 mt-0.5">{t(up ? "login.sticker_sub" : "login.sticker_sub_in")}</p>
          </div>
        )}

        {invite && (
          <div className="mb-4 rounded-2xl border border-[var(--accent-color)]/30 bg-[var(--accent-color)]/[0.07] px-4 py-3 text-center" style={{ animation: "ob-fade-up 500ms ease-out 60ms both" }}>
            <p className="text-[14px] font-semibold text-[var(--accent-color)]">
              {invite.name ? `${t("login.invited", { name: invite.name })} · ` : ""}
              {t("login.invite_deal", { percent: invite.percentOff })}
            </p>
            <p className="text-[12px] text-white/45 mt-0.5">{t("login.invite_code", { code: invite.code })}</p>
          </div>
        )}

        <div className="bg-white/[0.03] border border-white/[0.07] rounded-[20px] p-6" style={{ animation: "ob-fade-up 500ms ease-out 120ms both" }}>
          <div role="tablist" aria-label={t("login.account")} className="relative grid grid-cols-2 p-1 rounded-[14px] bg-white/[0.04] border border-white/[0.06] mb-5">
            <span
              aria-hidden
              className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-[10px] bg-[var(--accent-color)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.3,1.3,0.5,1)]"
              style={{ transform: up ? "translateX(100%)" : "translateX(0)" }}
            />
            {(["in", "up"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => { setMode(m); setError(""); setMessage(""); }}
                className={`relative z-10 h-10 text-sm font-semibold transition-colors ${mode === m ? "text-[var(--accent-fg)]" : "text-white/55"}`}
              >
                {m === "in" ? t("login.sign_in") : t("login.sign_up")}
              </button>
            ))}
          </div>

          <div className="text-center mb-5">
            <h2 className="font-heading text-[22px] font-semibold">{up ? t("login.create") : t("login.welcome")}</h2>
            <p className="text-[13px] text-white/45 mt-1">{up ? t("login.trial") : t("login.sign_in_shop")}</p>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full h-12 flex items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-[15px] font-semibold text-white/85 hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" aria-hidden>
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            {googleLoading ? t("login.redirecting") : up ? t("login.google_up") : t("login.google_in")}
          </button>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-white/[0.07]" />
            <span className="text-[11px] text-white/25 uppercase tracking-[1px]">{t("common.or")}</span>
            <div className="flex-1 h-px bg-white/[0.07]" />
          </div>

          {step === "input" ? (
            <>
              <div className="flex gap-5 mb-4 border-b border-white/[0.07]">
                {(["email", "phone"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setMethod(m); setError(""); setMessage(""); }}
                    className={`pb-2.5 -mb-px border-b-2 text-sm font-medium capitalize transition-colors ${
                      method === m ? "border-[var(--accent-color)] text-[var(--accent-color)]" : "border-transparent text-white/40 hover:text-white/75"
                    }`}
                  >
                    {t(`login.${m}`)}
                  </button>
                ))}
              </div>

              {method === "email" ? (
                <form onSubmit={handleSendEmailLink} className="space-y-4">
                  <div>
                    <Label htmlFor="email" className="text-[12px] text-white/45">
                      {t("login.email_label")}
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t("login.email_placeholder")}
                      required
                      className="mt-1.5 h-12 rounded-xl bg-white/[0.04] border-white/[0.08] text-white text-[15px] placeholder:text-white/25 focus-visible:border-[var(--accent-color)]/50"
                    />
                    <p className="text-xs text-stone-500 mt-1.5">
                      {up ? t("login.email_hint_up") : t("login.email_hint_in")}
                    </p>
                  </div>

                  {message && <p className="text-[var(--accent-color)] text-sm">{message}</p>}
                  {error && <p className="text-red-400 text-sm">{t(error)}</p>}

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 rounded-xl bg-[var(--accent-color)] text-[var(--accent-fg)] text-[15px] font-semibold hover:brightness-95 disabled:opacity-50"
                  >
                    {loading ? t("login.sending") : up ? t("login.send_up") : t("login.send_in")}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleSendCode} className="space-y-4">
                  <div>
                    <Label htmlFor="phone" className="text-[12px] text-white/45">
                      {t("login.phone_label")}
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(555) 234-5678"
                      required
                      className="mt-1.5 h-12 rounded-xl bg-white/[0.04] border-white/[0.08] text-white text-[15px] placeholder:text-white/25 focus-visible:border-[var(--accent-color)]/50"
                    />
                    <p className="text-xs text-stone-500 mt-1.5">
                      {t("login.phone_hint")}
                    </p>
                  </div>

                  {error && <p className="text-red-400 text-sm">{t(error)}</p>}

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 rounded-xl bg-[var(--accent-color)] text-[var(--accent-fg)] text-[15px] font-semibold hover:brightness-95 disabled:opacity-50"
                  >
                    {loading ? t("login.sending") : t("login.send_code")}
                  </Button>
                </form>
              )}
            </>
          ) : (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="text-center mb-2">
                <p className="text-sm text-stone-300">
                  {t("login.enter_code")}
                </p>
                <p className="text-white font-medium">{phone}</p>
              </div>

              <div>
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  required
                  className="text-center text-2xl tracking-[0.5em] bg-[#121110] border-white/10 text-white placeholder:text-stone-500"
                />
              </div>

              {error && <p className="text-red-400 text-sm">{t(error)}</p>}

              <Button
                type="submit"
                disabled={loading || otp.length < 6}
                className="w-full h-12 rounded-xl bg-[var(--accent-color)] text-[var(--accent-fg)] text-[15px] font-semibold hover:brightness-95 disabled:opacity-50"
              >
                {loading ? t("login.verifying") : t("login.verify")}
              </Button>

              <button
                type="button"
                onClick={resetToInput}
                className="w-full text-sm text-stone-500 hover:text-stone-300 transition-colors"
              >
                {t("login.different")}
              </button>
            </form>
          )}
        </div>

        <div className="text-center mt-6" style={{ animation: "ob-fade-up 500ms ease-out 240ms both" }}>
          <p className="text-[13px] text-white/40">
            {up ? t("login.have_account") : t("login.new_here")}{" "}
            <button onClick={() => { setMode(up ? "in" : "up"); setError(""); setMessage(""); }} className="text-[var(--accent-color)] font-semibold">
              {up ? t("login.sign_in") : t("login.create_link")}
            </button>
          </p>
          <p className="text-[11px] text-white/25 mt-3.5">
            <Link href="/privacy" className="hover:text-white/50">{t("common.privacy")}</Link>
            <span className="mx-2">·</span>
            <Link href="/terms" className="hover:text-white/50">{t("common.terms")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

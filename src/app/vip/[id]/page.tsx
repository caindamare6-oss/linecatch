"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { CONSENT_TEXT } from "@/lib/consent";
import { normalizePhone } from "@/lib/phone";
import { PageSkeleton } from "@/components/ui/skeleton";

export default function VIPOptIn() {
  const params = useParams();
  const barberId = params.id as string;

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
          consentText: didConsent ? CONSENT_TEXT : null,
          consented: didConsent,
          optInSource: new URLSearchParams(window.location.search).get("src") === "qr" ? "qr" : "vip_form",
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to opt in");
      }

      setSubmitted(true);
      setPhone("");
      setFirstName("");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Something went wrong. Please try again.";
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
      setError(result.error);
      return;
    }

    if (!consented) {
      setModal(1);
      return;
    }

    submitForm(true);
  };

  const displayName = businessName || "your barber";

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
        <div className="w-full max-w-md bg-[#1B1A18] rounded-2xl p-8 border border-[#2C2A27] text-center">
          <div className="text-3xl font-bold mb-4 text-white">
            Line<span className="text-[var(--accent-color)]">Catch</span>
          </div>
          <p className="text-stone-400 mb-2">
            {displayName} is currently offline.
          </p>
          <p className="text-stone-500 text-sm">
            Please check back later or contact the business directly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121110] text-white flex items-center justify-center px-6 py-8">
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
                  VIP text list
                </span>
              </div>
              <h1 className="font-heading text-[28px] leading-tight font-semibold tracking-[-0.5px] mt-4">
                Join {displayName}&apos;s<br />VIP list
              </h1>
              <p className="text-[14px] text-white/45 mt-2 leading-relaxed">Get perks and never miss an open appointment.</p>
            </div>

            <ul className="space-y-2 mb-6">
              {[
                { tone: "var(--accent-color)", title: "Appointment reminders", sub: "Never forget your next cut", d: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></> },
                { tone: "#E0926A", title: "Loyalty rewards", sub: "$5 off as you keep coming back", d: <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /> },
                { tone: "#8FB8DE", title: "Quick booking", sub: "Book or move your cut by text", d: <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /> },
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
                  First Name
                </label>
                <input
                  id="firstName"
                  type="text"
                  placeholder="Your first name"
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
                  Phone Number
                </label>
                <input
                  id="phone"
                  type="tel"
                  placeholder="(555) 123-4567"
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
                  {CONSENT_TEXT}{" "}
                  <Link href="/privacy" className="text-[var(--accent-color)] hover:underline">Privacy Policy</Link>
                  {" & "}
                  <Link href="/terms" className="text-[var(--accent-color)] hover:underline">Terms</Link>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-[52px] bg-[var(--accent-color)] text-[var(--accent-fg)] font-bold rounded-[14px] transition hover:shadow-[0_6px_24px_color-mix(in_srgb,var(--accent-color)_30%,transparent)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Joining…" : "Join VIP list"}
              </button>
            </form>

            <p className="text-xs text-white/30 text-center mt-6">
              By joining, you agree to our{" "}
              <Link href="/privacy" className="text-[var(--accent-color)] hover:underline">
                Privacy Policy
              </Link>{" "}
              and{" "}
              <Link href="/terms" className="text-[var(--accent-color)] hover:underline">
                Terms of Service
              </Link>
            </p>
          </div>
        ) : (
          <div className="bg-[#1B1A18] rounded-2xl p-8 border border-[#2C2A27] text-center">
            <CheckCircle2 className="w-16 h-16 text-[var(--accent-color)] mx-auto mb-4" />
            {consented ? (
              <>
                <h2 className="text-2xl font-bold text-white mb-2">
                  You&apos;re In!
                </h2>
                <p className="text-stone-400 mb-6">
                  You&apos;ve been added to {displayName}&apos;s VIP text list.
                  You&apos;ll receive appointment reminders and exclusive offers.
                </p>
                <p className="text-sm text-stone-500">
                  Reply <strong className="text-stone-300">STOP</strong> to any
                  message to unsubscribe.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-white mb-2">
                  Thanks, you&apos;re on the list!
                </h2>
                <p className="text-stone-400 mb-6">
                  You won&apos;t receive text messages. Check the consent box
                  next time to unlock your $5 off and booking reminders.
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
                Check the box to get your $5 off and more VIP perks like booking reminders and rewards!
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => setModal(0)}
                  className="w-full bg-[var(--accent-color)] text-[var(--accent-fg)] font-semibold py-3 rounded-lg hover:brightness-90 transition"
                >
                  Go Back &amp; Check the Box
                </button>
                <button
                  onClick={() => setModal(2)}
                  className="w-full bg-white/[0.06] text-white/50 font-medium py-3 rounded-lg hover:bg-white/[0.1] transition text-sm"
                >
                  Continue Without Perks
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
                Are you sure? You&apos;ll miss out on your $5 off, booking reminders, and rewards.
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => setModal(0)}
                  className="w-full bg-[var(--accent-color)] text-[var(--accent-fg)] font-semibold py-3 rounded-lg hover:brightness-90 transition"
                >
                  Go Back &amp; Check the Box
                </button>
                <button
                  onClick={() => { setModal(0); submitForm(false); }}
                  disabled={loading}
                  className="w-full bg-white/[0.06] text-white/50 font-medium py-3 rounded-lg hover:bg-white/[0.1] transition text-sm disabled:opacity-50"
                >
                  {loading ? "Joining..." : "Yes, Continue Without Perks"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

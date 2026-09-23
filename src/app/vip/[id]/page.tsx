"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { CONSENT_TEXT } from "@/lib/consent";

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
          optInSource: "vip_form",
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

    const phoneRegex = /^[\d\s\-\+\(\)]{10,}$/;
    if (!phone.trim() || !phoneRegex.test(phone)) {
      setError("Please enter a valid phone number");
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
      <div className="min-h-screen bg-[#111111] flex items-center justify-center">
        <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'color-mix(in srgb, var(--accent-color) 30%, transparent)', borderTopColor: 'var(--accent-color)' }} />
      </div>
    );
  }

  if (isLockedOut) {
    return (
      <div className="min-h-screen bg-[#111111] flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-[#1a1a1a] rounded-2xl shadow-lg p-8 border border-[#2a2a2a] text-center">
          <div className="text-3xl font-bold mb-4 text-white">
            Line<span className="text-[var(--accent-color)]">Catch</span>
          </div>
          <p className="text-gray-400 mb-2">
            {displayName} is currently offline.
          </p>
          <p className="text-gray-500 text-sm">
            Please check back later or contact the business directly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111111] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {!submitted ? (
          <div className="bg-[#1a1a1a] rounded-2xl shadow-lg p-8 border border-[#2a2a2a]">
            <div className="text-center mb-8">
              <div className="text-3xl font-bold mb-2 text-white">
                Line<span className="text-[var(--accent-color)]">Catch</span> VIP
              </div>
              <p className="text-gray-400">
                Join {displayName}&apos;s text list for exclusive perks
              </p>
            </div>

            <div className="rounded-lg p-4 mb-6" style={{ backgroundColor: 'color-mix(in srgb, var(--accent-color) 10%, transparent)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'color-mix(in srgb, var(--accent-color) 20%, transparent)' }}>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-[var(--accent-color)] mt-0.5">&#10003;</span>
                  <span className="text-gray-300">
                    Appointment reminders &amp; confirmations
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[var(--accent-color)] mt-0.5">&#10003;</span>
                  <span className="text-gray-300">
                    Exclusive member-only offers
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[var(--accent-color)] mt-0.5">&#10003;</span>
                  <span className="text-gray-300">
                    Quick booking &amp; rescheduling
                  </span>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="firstName"
                  className="block text-sm font-medium text-gray-300 mb-2"
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
                  className="w-full px-4 py-3 border border-[#333] rounded-lg bg-[#222] text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] disabled:opacity-50"
                />
              </div>

              <div>
                <label
                  htmlFor="phone"
                  className="block text-sm font-medium text-gray-300 mb-2"
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
                  className="w-full px-4 py-3 border border-[#333] rounded-lg bg-[#222] text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] disabled:opacity-50"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-950 border border-red-800 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}

              <div className="flex items-start gap-3 p-4 bg-[#1e1e1e] rounded-lg border border-[#2a2a2a]">
                <input
                  id="consent"
                  type="checkbox"
                  checked={consented}
                  onChange={(e) => setConsented(e.target.checked)}
                  className="mt-1 w-4 h-4 accent-[var(--accent-color)] cursor-pointer flex-shrink-0"
                />
                <label
                  htmlFor="consent"
                  className="text-sm text-gray-400 cursor-pointer"
                >
                  By checking this box, I consent to receive SMS messages from
                  this business, including appointment reminders, confirmations,
                  and offers. Message and data rates may apply. I can reply{" "}
                  <strong className="text-gray-200">STOP</strong> to opt out or{" "}
                  <strong className="text-gray-200">HELP</strong> for assistance
                  at any time.
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[var(--accent-color)] hover:brightness-90 text-black font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Joining..." : "Join VIP List"}
              </button>
            </form>

            <p className="text-xs text-gray-500 text-center mt-6">
              By joining, you agree to our{" "}
              <a href="/privacy" className="text-[var(--accent-color)] hover:underline">
                Privacy Policy
              </a>{" "}
              and{" "}
              <a href="/terms" className="text-[var(--accent-color)] hover:underline">
                Terms of Service
              </a>
            </p>
          </div>
        ) : (
          <div className="bg-[#1a1a1a] rounded-2xl shadow-lg p-8 border border-[#2a2a2a] text-center">
            <CheckCircle2 className="w-16 h-16 text-[var(--accent-color)] mx-auto mb-4" />
            {consented ? (
              <>
                <h2 className="text-2xl font-bold text-white mb-2">
                  You&apos;re In!
                </h2>
                <p className="text-gray-400 mb-6">
                  You&apos;ve been added to {displayName}&apos;s VIP text list.
                  You&apos;ll receive appointment reminders and exclusive offers.
                </p>
                <p className="text-sm text-gray-500">
                  Reply <strong className="text-gray-300">STOP</strong> to any
                  message to unsubscribe.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-white mb-2">
                  Thanks, you&apos;re on the list!
                </h2>
                <p className="text-gray-400 mb-6">
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
            <div className="bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] p-6 max-w-sm w-full space-y-4 text-center">
              <p className="text-white text-base font-medium leading-relaxed">
                Check the box to get your $5 off and more VIP perks like booking reminders and rewards!
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => setModal(0)}
                  className="w-full bg-[var(--accent-color)] text-black font-semibold py-3 rounded-lg hover:brightness-90 transition"
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
            <div className="bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] p-6 max-w-sm w-full space-y-4 text-center">
              <p className="text-white text-base font-medium leading-relaxed">
                Are you sure? You&apos;ll miss out on your $5 off, booking reminders, and rewards.
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => setModal(0)}
                  className="w-full bg-[var(--accent-color)] text-black font-semibold py-3 rounded-lg hover:brightness-90 transition"
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

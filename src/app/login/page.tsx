"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"input" | "verify">("input");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
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
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setMessage("Check your inbox — we sent you a sign-in link.");
    setLoading(false);
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formatted = phone.startsWith("+") ? phone : `+1${phone.replace(/\D/g, "")}`;

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

  return (
    <div className="min-h-screen bg-[#111111] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">
            <span className="text-white">Line</span>
            <span className="text-[var(--accent-color)]">Catch</span>
          </h1>
          <p className="text-gray-400 mt-2">
            Never lose a customer to a missed call
          </p>
        </div>

        <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 rounded-lg border border-white/10 bg-[#111111] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#222222] transition-colors disabled:opacity-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            {googleLoading ? "Redirecting..." : "Continue with Google"}
          </button>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-gray-500 uppercase">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {step === "input" ? (
            <>
              <div className="flex rounded-lg border border-white/10 overflow-hidden mb-5">
                <button
                  type="button"
                  onClick={() => { setMethod("email"); setError(""); setMessage(""); }}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    method === "email"
                      ? "bg-[var(--accent-color)] text-black"
                      : "bg-[#111111] text-gray-400 hover:text-white"
                  }`}
                >
                  Email
                </button>
                <button
                  type="button"
                  onClick={() => { setMethod("phone"); setError(""); setMessage(""); }}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    method === "phone"
                      ? "bg-[var(--accent-color)] text-black"
                      : "bg-[#111111] text-gray-400 hover:text-white"
                  }`}
                >
                  Phone
                </button>
              </div>

              {method === "email" ? (
                <form onSubmit={handleSendEmailLink} className="space-y-4">
                  <div>
                    <Label htmlFor="email" className="text-gray-300">
                      Email address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="mt-1.5 bg-[#111111] border-white/10 text-white placeholder:text-gray-500"
                    />
                    <p className="text-xs text-gray-500 mt-1.5">
                      We&apos;ll send you a sign-in link
                    </p>
                  </div>

                  {message && <p className="text-[var(--accent-color)] text-sm">{message}</p>}
                  {error && <p className="text-red-400 text-sm">{error}</p>}

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[var(--accent-color)] text-black font-semibold hover:brightness-90 disabled:opacity-50"
                  >
                    {loading ? "Sending..." : "Send sign-in link"}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleSendCode} className="space-y-4">
                  <div>
                    <Label htmlFor="phone" className="text-gray-300">
                      Phone number
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(857) 505-2551"
                      required
                      className="mt-1.5 bg-[#111111] border-white/10 text-white placeholder:text-gray-500"
                    />
                    <p className="text-xs text-gray-500 mt-1.5">
                      We&apos;ll text you a verification code
                    </p>
                  </div>

                  {error && <p className="text-red-400 text-sm">{error}</p>}

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[var(--accent-color)] text-black font-semibold hover:brightness-90 disabled:opacity-50"
                  >
                    {loading ? "Sending..." : "Send verification code"}
                  </Button>
                </form>
              )}
            </>
          ) : (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="text-center mb-2">
                <p className="text-sm text-gray-300">
                  Enter the 6-digit code sent to
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
                  className="text-center text-2xl tracking-[0.5em] bg-[#111111] border-white/10 text-white placeholder:text-gray-500"
                />
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <Button
                type="submit"
                disabled={loading || otp.length < 6}
                className="w-full bg-[var(--accent-color)] text-black font-semibold hover:brightness-90 disabled:opacity-50"
              >
                {loading ? "Verifying..." : "Verify & sign in"}
              </Button>

              <button
                type="button"
                onClick={resetToInput}
                className="w-full text-sm text-gray-500 hover:text-gray-300 transition-colors"
              >
                Use a different number
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

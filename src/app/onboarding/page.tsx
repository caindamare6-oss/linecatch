"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type BusinessHours = Record<string, { open: string; close: string } | null>;

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_LABELS: Record<string, string> = {
  monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu",
  friday: "Fri", saturday: "Sat", sunday: "Sun",
};

const BOOKING_PLACEHOLDERS = [
  "https://calendly.com/your-name",
  "https://booksy.com/en-us/your-name",
  "https://vagaro.com/your-shop",
  "https://square.site/book/your-shop",
  "https://fresha.com/your-shop",
  "https://setmore.com/your-name",
  "https://acuityscheduling.com/your-name",
];

const SMS_TEMPLATES = [
  {
    id: "casual",
    label: "Casual",
    description: "Friendly and laid-back",
    message: "Hey! Sorry I missed your call. You can book your next appointment here: {link}",
  },
  {
    id: "professional",
    label: "Professional",
    description: "Clean and business-like",
    message: "Thank you for calling. I'm currently with a client and unable to answer. You can schedule your next appointment here: {link}",
  },
  {
    id: "short",
    label: "Short & Sweet",
    description: "Quick and to the point",
    message: "Missed your call! Book here: {link}",
  },
  {
    id: "custom",
    label: "Custom",
    description: "Write your own message",
    message: "",
  },
];

const TOTAL_STEPS = 6;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step data
  const [businessName, setBusinessName] = useState("");
  const [forwardingNumber, setForwardingNumber] = useState("");
  const [bookingLink, setBookingLink] = useState("");
  const [avgBookingValue, setAvgBookingValue] = useState("35");
  const [businessHours, setBusinessHours] = useState<BusinessHours>({
    monday: { open: "09:00", close: "17:00" },
    tuesday: { open: "09:00", close: "17:00" },
    wednesday: { open: "09:00", close: "17:00" },
    thursday: { open: "09:00", close: "17:00" },
    friday: { open: "09:00", close: "17:00" },
    saturday: { open: "10:00", close: "15:00" },
    sunday: null,
  });
  const [selectedTemplate, setSelectedTemplate] = useState("casual");
  const [customMessage, setCustomMessage] = useState("");

  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [linkStatus, setLinkStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [linkError, setLinkError] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % BOOKING_PLACEHOLDERS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  function toggleDay(day: string) {
    setBusinessHours((prev) => {
      const copy = { ...prev };
      if (copy[day]) {
        copy[day] = null;
      } else {
        copy[day] = { open: "09:00", close: "17:00" };
      }
      return copy;
    });
  }

  function updateHours(day: string, field: "open" | "close", value: string) {
    setBusinessHours((prev) => ({
      ...prev,
      [day]: { ...(prev[day] || { open: "09:00", close: "17:00" }), [field]: value },
    }));
  }

  async function verifyLink() {
    if (!bookingLink.trim()) return;
    setLinkStatus("checking");
    setLinkError("");
    try {
      const res = await fetch("/api/verify-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: bookingLink }),
      });
      const data = await res.json();
      if (data.valid) {
        setLinkStatus("valid");
      } else {
        setLinkStatus("invalid");
        setLinkError(data.reason || "Link could not be reached");
      }
    } catch {
      setLinkStatus("invalid");
      setLinkError("Could not verify link");
    }
  }

  function getFinalMessage() {
    if (selectedTemplate === "custom") {
      return customMessage || SMS_TEMPLATES[0].message;
    }
    return SMS_TEMPLATES.find((t) => t.id === selectedTemplate)?.message || SMS_TEMPLATES[0].message;
  }

  function getPreviewMessage() {
    let msg = getFinalMessage();
    const displayLink = bookingLink
      ? bookingLink.length > 25 ? bookingLink.slice(0, 25) + "..." : bookingLink
      : "your-booking-link.com";
    msg = msg.replace("{link}", displayLink);
    if (!msg.toLowerCase().includes("stop")) {
      msg += "\n\nReply STOP to opt out.";
    }
    return msg;
  }

  async function handleFinish() {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const message = getFinalMessage();
    const finalMsg = message.toLowerCase().includes("stop")
      ? message
      : message + "\n\nReply STOP to opt out.";

    await supabase
      .from("users")
      .update({
        business_name: businessName || null,
        forwarding_number: forwardingNumber || null,
        booking_link: bookingLink || null,
        avg_booking_value: parseFloat(avgBookingValue) || 35,
        business_hours: Object.keys(businessHours).length ? businessHours : null,
        custom_message: finalMsg,
        onboarding_completed: true,
      })
      .eq("user_id", user.id);

    router.push("/dashboard");
  }

  function canProceed() {
    switch (step) {
      case 1: return true;
      case 2: return forwardingNumber.trim().length >= 10;
      case 3: return true;
      case 4: return parseFloat(avgBookingValue) > 0;
      case 5: return true;
      case 6: return selectedTemplate !== "custom" || customMessage.trim().length > 0;
      default: return true;
    }
  }

  const progress = (step / TOTAL_STEPS) * 100;

  return (
    <div className="min-h-screen bg-[#0d0d0d] relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[#00F5A0]/[0.03] blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-md mx-auto px-4 py-8">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-[#00F5A0]">
                <path d="M3 5.5C3 4.12 4.12 3 5.5 3h3.09c.39 0 .74.24.88.6l1.42 3.55c.15.37.05.8-.25 1.06l-1.72 1.47a12.06 12.06 0 005.69 5.69l1.47-1.72c.26-.3.69-.4 1.06-.25l3.55 1.42c.36.14.6.49.6.88v3.09c0 1.38-1.12 2.5-2.5 2.5C9.83 21.29 2.71 14.17 2.71 5.5H3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="text-sm font-bold">
                <span className="text-white">Line</span>
                <span className="text-[#00F5A0]">Catch</span>
              </span>
            </div>
            <span className="text-[11px] text-white/30">{step} of {TOTAL_STEPS}</span>
          </div>
          <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#00F5A0] rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Step 1: Welcome + Business Name */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                Welcome to LineCatch
              </h2>
              <p className="text-sm text-white/40 mt-2">
                Let&apos;s get you set up in a few minutes. After this, every missed call gets an automatic text — no extra work needed.
              </p>
            </div>

            <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5">
              <label className="text-xs text-white/40 uppercase tracking-wider font-medium block mb-3">
                Your business name
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Fresh Cuts by Mike"
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder:text-white/15 focus:outline-none focus:border-[#00F5A0]/30 transition-colors"
              />
              <p className="text-[11px] text-white/20 mt-2">Optional — helps personalize your setup</p>
            </div>

            <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-[#00F5A0]/10 flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-[#00F5A0]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-white/70 font-medium">Takes about 3 minutes</p>
                  <p className="text-xs text-white/30 mt-0.5">
                    We&apos;ll ask for your phone number, booking link, prices, hours, and pick a text template. That&apos;s it.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Forwarding Number */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                Your phone number
              </h2>
              <p className="text-sm text-white/40 mt-2">
                When someone calls your LineCatch number, we forward the call to your cell. If you miss it, we text them automatically.
              </p>
            </div>

            <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5">
              <label className="text-xs text-white/40 uppercase tracking-wider font-medium block mb-3">
                Your cell number
              </label>
              <input
                type="tel"
                value={forwardingNumber}
                onChange={(e) => setForwardingNumber(e.target.value)}
                placeholder="+1 (212) 555-9876"
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder:text-white/15 focus:outline-none focus:border-[#00F5A0]/30 transition-colors"
              />
              <p className="text-[11px] text-white/20 mt-2">Calls forward here — customers never see this number</p>
            </div>
          </div>
        )}

        {/* Step 3: Booking Link */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                Booking link
              </h2>
              <p className="text-sm text-white/40 mt-2">
                This gets included in your auto-texts so missed callers can book instantly.
              </p>
            </div>

            <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5">
              <label className="text-xs text-white/40 uppercase tracking-wider font-medium block mb-3">
                Your booking URL
              </label>
              <div className="relative">
                <input
                  type="url"
                  value={bookingLink}
                  onChange={(e) => {
                    setBookingLink(e.target.value);
                    setLinkStatus("idle");
                    setLinkError("");
                  }}
                  placeholder={BOOKING_PLACEHOLDERS[placeholderIndex]}
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder:text-white/15 focus:outline-none focus:border-[#00F5A0]/30 transition-colors pr-16"
                />
                {bookingLink && (
                  <button
                    onClick={verifyLink}
                    disabled={linkStatus === "checking"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-medium px-2 py-1 rounded-lg transition-colors bg-white/[0.06] text-white/40 hover:text-white/60 hover:bg-white/[0.1] disabled:opacity-50"
                  >
                    {linkStatus === "checking" ? "..." : "Verify"}
                  </button>
                )}
              </div>
              {linkStatus === "valid" && (
                <p className="text-[11px] text-[#00F5A0] mt-2 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  Link is working
                </p>
              )}
              {linkStatus === "invalid" && (
                <p className="text-[11px] text-red-400 mt-2">{linkError}</p>
              )}
              {linkStatus === "idle" && (
                <p className="text-[11px] text-white/20 mt-2">
                  Calendly, Booksy, Vagaro, Square, Fresha, or any booking page
                </p>
              )}
            </div>

            <p className="text-[11px] text-white/20 text-center">
              Don&apos;t have one yet? You can skip this and add it later in settings.
            </p>
          </div>
        )}

        {/* Step 4: Price per cut */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                Average price per booking
              </h2>
              <p className="text-sm text-white/40 mt-2">
                We use this to calculate how much revenue LineCatch saves you each week.
              </p>
            </div>

            <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5">
              <label className="text-xs text-white/40 uppercase tracking-wider font-medium block mb-3">
                Price per cut / booking
              </label>
              <div className="flex items-center gap-2">
                <span className="text-2xl text-white/30">$</span>
                <input
                  type="number"
                  value={avgBookingValue}
                  onChange={(e) => setAvgBookingValue(e.target.value)}
                  className="w-28 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-3 text-2xl font-bold text-white/80 focus:outline-none focus:border-[#00F5A0]/30 transition-colors"
                />
              </div>
              <p className="text-[11px] text-white/20 mt-3">
                If a missed caller books through your link, that&apos;s ${avgBookingValue || "0"} saved
              </p>
            </div>
          </div>
        )}

        {/* Step 5: Business Hours */}
        {step === 5 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                Business hours
              </h2>
              <p className="text-sm text-white/40 mt-2">
                Set when you&apos;re typically working. We can use this to customize messages based on time of day.
              </p>
            </div>

            <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5">
              <div className="space-y-3">
                {DAYS.map((day) => (
                  <div key={day} className="flex items-center gap-2.5">
                    <button
                      onClick={() => toggleDay(day)}
                      className={`w-5 h-5 rounded shrink-0 flex items-center justify-center text-xs transition-colors ${
                        businessHours[day]
                          ? "bg-[#00F5A0] text-[#0d0d0d]"
                          : "border border-white/10 text-transparent"
                      }`}
                    >
                      {businessHours[day] ? "✓" : ""}
                    </button>
                    <span className="text-sm text-white/50 w-10 shrink-0">
                      {DAY_LABELS[day]}
                    </span>
                    {businessHours[day] ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="time"
                          value={businessHours[day]!.open}
                          onChange={(e) => updateHours(day, "open", e.target.value)}
                          className="text-xs bg-white/[0.03] border border-white/[0.08] rounded-lg px-2.5 py-2 text-white/60 min-w-[6.5rem] focus:outline-none focus:border-[#00F5A0]/30"
                        />
                        <span className="text-white/15 text-xs shrink-0">to</span>
                        <input
                          type="time"
                          value={businessHours[day]!.close}
                          onChange={(e) => updateHours(day, "close", e.target.value)}
                          className="text-xs bg-white/[0.03] border border-white/[0.08] rounded-lg px-2.5 py-2 text-white/60 min-w-[6.5rem] focus:outline-none focus:border-[#00F5A0]/30"
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-white/15">Closed</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 6: SMS Template */}
        {step === 6 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                Pick your text style
              </h2>
              <p className="text-sm text-white/40 mt-2">
                This is the auto-text your missed callers receive. Pick a template or write your own.
              </p>
            </div>

            <div className="space-y-2">
              {SMS_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplate(template.id)}
                  className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
                    selectedTemplate === template.id
                      ? "bg-[#00F5A0]/[0.08] border-[#00F5A0]/30"
                      : "bg-white/[0.04] border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.1]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-white/80">{template.label}</span>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                      selectedTemplate === template.id
                        ? "border-[#00F5A0] bg-[#00F5A0]"
                        : "border-white/20"
                    }`}>
                      {selectedTemplate === template.id && (
                        <svg className="w-2.5 h-2.5 text-[#0d0d0d]" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-white/25">{template.description}</p>
                  {template.id !== "custom" && selectedTemplate === template.id && (
                    <p className="text-xs text-white/40 mt-2 leading-relaxed">{template.message}</p>
                  )}
                </button>
              ))}
            </div>

            {selectedTemplate === "custom" && (
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5">
                <label className="text-xs text-white/40 uppercase tracking-wider font-medium block mb-3">
                  Your message
                </label>
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={3}
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder:text-white/15 resize-none focus:outline-none focus:border-[#00F5A0]/30 transition-colors"
                  placeholder="Hey! Sorry I missed your call. Book here: {link}"
                />
                <p className="text-[11px] text-white/20 mt-2">
                  Use <code className="bg-white/[0.06] px-1 rounded text-[#00F5A0]/60">{"{link}"}</code> where you want the booking link
                </p>
              </div>
            )}

            {/* SMS Preview */}
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5">
              <p className="text-[11px] text-white/25 mb-3">Preview</p>
              <div className="bg-[#00F5A0]/10 border border-[#00F5A0]/20 rounded-lg rounded-tl-none px-3 py-2 inline-block max-w-[280px]">
                <p className="text-sm text-white/70 whitespace-pre-line">{getPreviewMessage()}</p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="mt-8 flex gap-3">
          {step > 1 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="flex-none px-4 py-3 rounded-xl text-sm font-medium text-white/40 hover:text-white/60 bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.06] transition-all duration-200"
            >
              Back
            </button>
          )}

          {step < TOTAL_STEPS ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canProceed()}
              className="flex-1 py-3 rounded-xl text-sm font-semibold bg-[#00F5A0] text-[#0d0d0d] hover:bg-[#00D68A] disabled:opacity-30 transition-all duration-200"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={saving || !canProceed()}
              className="flex-1 py-3 rounded-xl text-sm font-semibold bg-[#00F5A0] text-[#0d0d0d] hover:bg-[#00D68A] disabled:opacity-30 transition-all duration-200"
            >
              {saving ? "Setting up..." : "Finish setup"}
            </button>
          )}
        </div>

        {step === 3 && (
          <button
            onClick={() => setStep(4)}
            className="w-full mt-2 py-2 text-[11px] text-white/20 hover:text-white/40 transition-colors"
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type BusinessHours = Record<
  string,
  { open: string; close: string } | null
>;

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const DAY_LABELS: Record<string, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

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

const BOOKING_PLACEHOLDERS = [
  "https://calendly.com/your-name",
  "https://square.site/book/your-shop",
  "https://booksy.com/en-us/your-name",
  "https://vagaro.com/your-shop",
  "https://squareup.com/appointments/your-name",
  "https://fresha.com/your-shop",
  "https://setmore.com/your-name",
  "https://acuityscheduling.com/your-name",
];

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [bookingLink, setBookingLink] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [forwardingNumber, setForwardingNumber] = useState("");
  const [businessHours, setBusinessHours] = useState<BusinessHours>({});
  const [avgBookingValue, setAvgBookingValue] = useState("35");
  const [afterHoursMessage, setAfterHoursMessage] = useState("");
  const [returningMessage, setReturningMessage] = useState("");
  const [followupMessage, setFollowupMessage] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("custom");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [linkStatus, setLinkStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [linkError, setLinkError] = useState("");
  const [googleReviewUrl, setGoogleReviewUrl] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [linkCopied, setLinkCopied] = useState<"vip" | "book" | false>(false);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash) {
      const el = document.querySelector(window.location.hash);
      if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth" }), 300);
    }
  }, [loading]);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % BOOKING_PLACEHOLDERS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  async function loadSettings() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (data) {
      setBookingLink(data.booking_link || "");
      const msg = data.custom_message || "";
      setCustomMessage(msg);
      setForwardingNumber(data.forwarding_number || "");
      setBusinessHours(data.business_hours || {});
      setAvgBookingValue(String(data.avg_booking_value || 35));

      setAfterHoursMessage(data.after_hours_message || "");
      setReturningMessage(data.returning_message || "");
      setFollowupMessage(data.followup_message || "");
      setGoogleReviewUrl(data.google_review_url || "");

      const cleanMsg = msg.replace(/\n\nReply STOP to opt out\.?/i, "").trim();
      const matched = SMS_TEMPLATES.find((t) => t.id !== "custom" && t.message === cleanMsg);
      setSelectedTemplate(matched ? matched.id : "custom");
    }
    setLoading(false);
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

  async function handleSave() {
    setSaving(true);
    setSaved(false);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const msg = getActiveMessage();
    const finalMsg = msg.toLowerCase().includes("stop")
      ? msg
      : msg + "\n\nReply STOP to opt out.";

    // Only include enabled days (filter out null/closed entries)
    const cleanedHours: BusinessHours = {};
    for (const [day, val] of Object.entries(businessHours)) {
      if (val) cleanedHours[day] = val;
    }

    const { error } = await supabase
      .from("users")
      .update({
        booking_link: bookingLink || null,
        custom_message: finalMsg,
        forwarding_number: forwardingNumber || null,
        business_hours: Object.keys(cleanedHours).length
          ? cleanedHours
          : null,
        avg_booking_value: parseFloat(avgBookingValue) || 35,
        after_hours_message: afterHoursMessage || null,
        returning_message: returningMessage || null,
        followup_message: followupMessage || null,
        google_review_url: googleReviewUrl || null,
      })
      .eq("user_id", user.id);

    setSaving(false);

    if (error) {
      console.error("Settings save failed:", error);
      alert("Failed to save settings. Please try again.");
      return;
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function getActiveMessage() {
    if (selectedTemplate === "custom") return customMessage;
    return SMS_TEMPLATES.find((t) => t.id === selectedTemplate)?.message || customMessage;
  }

  function getPreviewMessage() {
    let msg = getActiveMessage() || "Hey! Sorry I missed your call.";
    if (bookingLink) {
      const displayLink = bookingLink.length > 30
        ? bookingLink.slice(0, 30) + "..."
        : bookingLink;
      msg = msg.replace("{link}", displayLink);
    } else {
      msg = msg.replace("{link}", "your-booking-link.com");
    }
    if (!msg.toLowerCase().includes("stop")) {
      msg += "\n\nReply STOP to opt out.";
    }
    return msg;
  }

  function toggleDay(day: string) {
    setBusinessHours((prev) => {
      const copy = { ...prev };
      if (copy[day]) {
        delete copy[day];
      } else {
        copy[day] = { open: "09:00", close: "17:00" };
      }
      return copy;
    });
  }

  function updateHours(
    day: string,
    field: "open" | "close",
    value: string
  ) {
    setBusinessHours((prev) => ({
      ...prev,
      [day]: { ...(prev[day] || { open: "09:00", close: "17:00" }), [field]: value },
    }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'color-mix(in srgb, var(--accent-color) 30%, transparent)', borderTopColor: 'var(--accent-color)' }} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Forwarding Number */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5">
        <h3 className="text-xs text-white/40 uppercase tracking-wider font-medium mb-3">
          Call forwarding
        </h3>
        <label className="text-xs text-white/25 block mb-1.5">Your cell (calls forward here)</label>
        <input
          type="tel"
          value={forwardingNumber}
          onChange={(e) => setForwardingNumber(e.target.value)}
          placeholder="+12125559876"
          className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder:text-white/15 focus:outline-none focus:border-[var(--accent-color)] transition-colors"
        />
      </div>

      {/* Booking Link */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5">
        <h3 className="text-xs text-white/40 uppercase tracking-wider font-medium mb-3">
          Booking link
        </h3>
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
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder:text-white/15 focus:outline-none focus:border-[var(--accent-color)] transition-colors pr-16"
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
          <p className="text-[11px] text-[var(--accent-color)] mt-2 flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
            Link is working
          </p>
        )}
        {linkStatus === "invalid" && (
          <p className="text-[11px] text-red-400 mt-2">{linkError}</p>
        )}
        {linkStatus === "idle" && (
          <p className="text-[11px] text-white/20 mt-2">
            Included in auto-texts when you miss a call
          </p>
        )}
      </div>

      {/* VIP Opt-In Link */}
      {userId && (
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5 space-y-4">
          <div>
            <h3 className="text-xs text-white/40 uppercase tracking-wider font-medium mb-2">
              VIP sign-up link
            </h3>
            <p className="text-[11px] text-white/20 mb-2">
              Clients opt in to your text list here
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/50 truncate">
                {typeof window !== "undefined"
                  ? `${window.location.origin}/vip/${userId}`
                  : `/vip/${userId}`}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${window.location.origin}/vip/${userId}`
                  );
                  setLinkCopied("vip");
                  setTimeout(() => setLinkCopied(false), 2000);
                }}
                className="shrink-0 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-[var(--accent-color)]"
                style={{ backgroundColor: 'color-mix(in srgb, var(--accent-color) 10%, transparent)' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--accent-color) 20%, transparent)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--accent-color) 10%, transparent)'}
              >
                {linkCopied === "vip" ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          <div className="border-t border-white/[0.05] pt-4">
            <h3 className="text-xs text-white/40 uppercase tracking-wider font-medium mb-2">
              Booking link
            </h3>
            <p className="text-[11px] text-white/20 mb-2">
              Clients book appointments here (requires VIP opt-in first)
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/50 truncate">
                {typeof window !== "undefined"
                  ? `${window.location.origin}/book/${userId}`
                  : `/book/${userId}`}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${window.location.origin}/book/${userId}`
                  );
                  setLinkCopied("book");
                  setTimeout(() => setLinkCopied(false), 2000);
                }}
                className="shrink-0 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-[var(--accent-color)]"
                style={{ backgroundColor: 'color-mix(in srgb, var(--accent-color) 10%, transparent)' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--accent-color) 20%, transparent)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--accent-color) 10%, transparent)'}
              >
                {linkCopied === "book" ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-reply Template */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5">
        <h3 className="text-xs text-white/40 uppercase tracking-wider font-medium mb-3">
          Auto-reply message
        </h3>

        <div className="space-y-2 mb-4">
          {SMS_TEMPLATES.map((template) => {
            const isSelected = selectedTemplate === template.id;
            return (
              <button
                key={template.id}
                onClick={() => {
                  setSelectedTemplate(template.id);
                  if (template.id !== "custom") {
                    setCustomMessage(template.message);
                  }
                }}
                className={`w-full text-left p-3 rounded-xl border transition-all duration-200 ${
                  isSelected
                    ? "border-[var(--accent-color)]"
                    : "bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.08]"
                }`}
                style={isSelected ? { backgroundColor: 'color-mix(in srgb, var(--accent-color) 8%, transparent)' } : undefined}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-white/70">{template.label}</span>
                    <span className="text-[11px] text-white/20 ml-2">{template.description}</span>
                  </div>
                  <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                    isSelected ? "border-[var(--accent-color)] bg-[var(--accent-color)]" : "border-white/15"
                  }`}>
                    {isSelected && (
                      <svg className="w-2 h-2 text-[#0d0d0d]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {selectedTemplate === "custom" && (
          <>
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              rows={3}
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder:text-white/15 resize-none focus:outline-none focus:border-[var(--accent-color)] transition-colors mb-2"
              placeholder="Hey! Sorry I missed your call. Book here: {link}"
            />
            <p className="text-[11px] text-white/20 mb-4">
              Use <code className="bg-white/[0.06] px-1 rounded" style={{ color: 'color-mix(in srgb, var(--accent-color) 60%, transparent)' }}>{"{link}"}</code> where
              you want the booking link inserted
            </p>
          </>
        )}

        <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
          <p className="text-[11px] text-white/25 mb-2">Preview</p>
          <div className="border rounded-lg rounded-tl-none px-3 py-2 inline-block max-w-[280px]" style={{ backgroundColor: 'color-mix(in srgb, var(--accent-color) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--accent-color) 20%, transparent)' }}>
            <p className="text-sm text-white/70 whitespace-pre-line">
              {getPreviewMessage()}
            </p>
          </div>
        </div>

        {/* Advanced Messages Dropdown */}
        <button
          onClick={() => setAdvancedOpen(!advancedOpen)}
          className="w-full flex items-center justify-between p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors mt-4"
        >
          <span className="text-sm text-white/50">Advanced Messages</span>
          <svg
            className={`w-4 h-4 text-white/30 transition-transform duration-200 ${advancedOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {advancedOpen && (
          <div className="space-y-4 mt-3 pt-3 border-t border-white/[0.05]">
            <div>
              <label className="text-xs text-white/40 font-medium block mb-1">After-hours message</label>
              <p className="text-[11px] text-white/20 mb-2">
                Sent when someone calls outside business hours
              </p>
              <textarea
                value={afterHoursMessage}
                onChange={(e) => setAfterHoursMessage(e.target.value)}
                rows={2}
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder:text-white/15 resize-none focus:outline-none focus:border-[var(--accent-color)] transition-colors"
                placeholder="Hey! We're closed right now but I'd love to get you booked. Schedule here: {link}"
              />
            </div>

            <div>
              <label className="text-xs text-white/40 font-medium block mb-1">Returning caller message</label>
              <p className="text-[11px] text-white/20 mb-2">
                Sent to callers who&apos;ve called before
              </p>
              <textarea
                value={returningMessage}
                onChange={(e) => setReturningMessage(e.target.value)}
                rows={2}
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder:text-white/15 resize-none focus:outline-none focus:border-[var(--accent-color)] transition-colors"
                placeholder="Hey again! Sorry I missed you. Book your next appointment here: {link}"
              />
            </div>

            <div>
              <label className="text-xs text-white/40 font-medium block mb-1">Follow-up nudge</label>
              <p className="text-[11px] text-white/20 mb-2">
                Sent 2 hours after the first text if no reply
              </p>
              <textarea
                value={followupMessage}
                onChange={(e) => setFollowupMessage(e.target.value)}
                rows={2}
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder:text-white/15 resize-none focus:outline-none focus:border-[var(--accent-color)] transition-colors"
                placeholder="Just following up — did you still want to book an appointment? {link}"
              />
            </div>

            <p className="text-[11px] text-white/15">
              Leave any field blank to use your main auto-reply instead
            </p>
          </div>
        )}
      </div>

      {/* Average Booking Value */}
      <div id="booking-value" className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5 scroll-mt-4">
        <h3 className="text-xs text-white/40 uppercase tracking-wider font-medium mb-3">
          Average booking value
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-white/30">$</span>
          <input
            type="number"
            value={avgBookingValue}
            onChange={(e) => setAvgBookingValue(e.target.value)}
            className="w-24 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/80 focus:outline-none focus:border-[var(--accent-color)] transition-colors"
          />
        </div>
        <p className="text-[11px] text-white/20 mt-2">
          Used to estimate your weekly ROI on the dashboard
        </p>
      </div>

      {/* Google Reviews */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5">
        <h3 className="text-xs text-white/40 uppercase tracking-wider font-medium mb-3">
          Google Reviews
        </h3>
        <input
          type="url"
          value={googleReviewUrl}
          onChange={(e) => setGoogleReviewUrl(e.target.value)}
          placeholder="https://g.page/r/your-business/review"
          className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder:text-white/15 focus:outline-none focus:border-[var(--accent-color)] transition-colors"
        />
        <p className="text-[11px] text-white/20 mt-2">
          After a client&apos;s 2nd visit, we&apos;ll text them asking for a Google review. Leave blank to skip.
        </p>
      </div>

      {/* Business Hours */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5">
        <h3 className="text-xs text-white/40 uppercase tracking-wider font-medium mb-3">
          Business hours
        </h3>
        <p className="text-[11px] text-white/20 mb-4">
          Set when you&apos;re available. Different messages can be sent after hours.
        </p>
        <div className="space-y-3">
          {DAYS.map((day) => (
            <div key={day} className="flex items-center gap-2.5">
              <button
                onClick={() => toggleDay(day)}
                className={`w-5 h-5 rounded shrink-0 flex items-center justify-center text-xs transition-colors ${
                  businessHours[day]
                    ? "bg-[var(--accent-color)] text-[#0d0d0d]"
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
                    className="text-xs bg-white/[0.03] border border-white/[0.08] rounded-lg px-2.5 py-2 text-white/60 min-w-[6.5rem] focus:outline-none focus:border-[var(--accent-color)]"
                  />
                  <span className="text-white/15 text-xs shrink-0">to</span>
                  <input
                    type="time"
                    value={businessHours[day]!.close}
                    onChange={(e) => updateHours(day, "close", e.target.value)}
                    className="text-xs bg-white/[0.03] border border-white/[0.08] rounded-lg px-2.5 py-2 text-white/60 min-w-[6.5rem] focus:outline-none focus:border-[var(--accent-color)]"
                  />
                </div>
              ) : (
                <span className="text-xs text-white/15">Closed</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-[var(--accent-color)] text-[#0d0d0d] font-semibold py-3 rounded-xl hover:brightness-90 disabled:opacity-30 transition-all duration-200 text-sm"
      >
        {saving ? "Saving..." : saved ? "Saved!" : "Save settings"}
      </button>

      {/* Support */}
      <a
        href="mailto:caindamare6@gmail.com"
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors text-sm text-white/40 hover:text-white/60 mb-4"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" />
        </svg>
        Customer Support
      </a>
    </div>
  );
}

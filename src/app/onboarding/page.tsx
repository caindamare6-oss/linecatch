"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const ACCENT_COLORS = [
  { name: "Mint", hex: "#00F5A0" },
  { name: "Gold", hex: "#FFD700" },
  { name: "Sky", hex: "#38BDF8" },
  { name: "Coral", hex: "#FF6B6B" },
  { name: "Violet", hex: "#A78BFA" },
  { name: "Orange", hex: "#FB923C" },
  { name: "Rose", hex: "#F472B6" },
  { name: "Teal", hex: "#2DD4BF" },
  { name: "Lime", hex: "#A3E635" },
  { name: "Ice", hex: "#67E8F9" },
];

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_LABELS: Record<string, string> = {
  monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday",
  friday: "Friday", saturday: "Saturday", sunday: "Sunday",
};

type BusinessHours = Record<string, { open: string; close: string } | null>;

type PresetService = {
  name: string;
  price: number;
  duration: number;
  enabled: boolean;
  id?: string;
  sortOrder: number;
};

const DEFAULT_SERVICES: PresetService[] = [
  { name: "Lineup", price: 20, duration: 20, enabled: true, sortOrder: 0 },
  { name: "Taper", price: 30, duration: 30, enabled: true, sortOrder: 1 },
  { name: "Lineup + Taper", price: 40, duration: 45, enabled: true, sortOrder: 2 },
  { name: "Beard Trim", price: 15, duration: 15, enabled: false, sortOrder: 3 },
  { name: "Kids Cut", price: 20, duration: 25, enabled: false, sortOrder: 4 },
];

const TOTAL_STEPS = 6;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [loaded, setLoaded] = useState(false);

  // Step 2
  const [accentColor, setAccentColor] = useState("#00F5A0");
  const [businessName, setBusinessName] = useState("");

  // Step 3
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Step 4
  const [businessHours, setBusinessHours] = useState<BusinessHours>({
    monday: { open: "09:00", close: "18:00" },
    tuesday: { open: "09:00", close: "18:00" },
    wednesday: { open: "09:00", close: "18:00" },
    thursday: { open: "09:00", close: "18:00" },
    friday: { open: "09:00", close: "18:00" },
    saturday: { open: "09:00", close: "18:00" },
    sunday: null,
  });

  // Step 5
  const [services, setServices] = useState<PresetService[]>(DEFAULT_SERVICES);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("25");
  const [customDuration, setCustomDuration] = useState("30");

  // Step 6
  const [confettiDone, setConfettiDone] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/onboarding");
        const data = await res.json();
        if (data.profile) {
          if (data.profile.business_name) setBusinessName(data.profile.business_name);
          if (data.profile.accent_color) setAccentColor(data.profile.accent_color);
          if (data.profile.first_name) setFirstName(data.profile.first_name);
          if (data.profile.email) setEmail(data.profile.email);
          if (data.profile.forwarding_number) setPhone(data.profile.forwarding_number);
          if (data.profile.business_hours) setBusinessHours(data.profile.business_hours);
        }
        if (data.googleName && !data.profile?.first_name) setFirstName(data.googleName);
        if (data.googleEmail && !data.profile?.email) setEmail(data.googleEmail);
        if (data.services && data.services.length > 0) {
          setServices(data.services.map((s: { id: string; name: string; price: number; duration_minutes: number; is_active: boolean; sort_order: number }) => ({
            id: s.id,
            name: s.name,
            price: s.price,
            duration: s.duration_minutes,
            enabled: s.is_active,
            sortOrder: s.sort_order,
          })));
        }
      } catch {}
      setLoaded(true);
    }
    load();
  }, []);

  async function saveStep(stepName: string, data: Record<string, unknown>) {
    setSaving(true);
    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: stepName, data }),
      });
    } catch {}
    setSaving(false);
  }

  function goNext() {
    setDirection("forward");
    if (step === 2) {
      saveStep("profile", { businessName, accentColor });
    } else if (step === 3) {
      saveStep("info", { firstName, email, phone });
    } else if (step === 4) {
      saveStep("hours", { businessHours });
    } else if (step === 5) {
      saveStep("services", { services: services.filter((s) => s.enabled) });
    }
    setStep((s) => s + 1);
  }

  function goBack() {
    setDirection("back");
    setStep((s) => s - 1);
  }

  async function handleFinish() {
    setSaving(true);
    await saveStep("complete", {});
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
    setServices((prev) => prev.map((s, i) => i === index ? { ...s, enabled: !s.enabled } : s));
  }

  function updateServiceField(index: number, field: "price" | "duration", value: string) {
    setServices((prev) => prev.map((s, i) => i === index ? { ...s, [field]: parseFloat(value) || 0 } : s));
  }

  function addCustomService() {
    if (!customName.trim()) return;
    setServices((prev) => [...prev, {
      name: customName.trim(),
      price: parseFloat(customPrice) || 0,
      duration: parseInt(customDuration) || 30,
      enabled: true,
      sortOrder: prev.length,
    }]);
    setCustomName("");
    setCustomPrice("25");
    setCustomDuration("30");
    setShowAddCustom(false);
  }

  function canProceed() {
    switch (step) {
      case 1: return true;
      case 2: return true;
      case 3: return true;
      case 4: return true;
      case 5: return services.some((s) => s.enabled);
      case 6: return true;
      default: return true;
    }
  }

  // Confetti
  useEffect(() => {
    if (step !== 6 || confettiDone || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: { x: number; y: number; vx: number; vy: number; color: string; size: number; rotation: number; rotationSpeed: number }[] = [];
    const colors = [accentColor, "#FFD700", "#FF6B6B", "#38BDF8", "#A78BFA", "#FB923C", "#F472B6", "#2DD4BF"];

    for (let i = 0; i < 150; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -10 - Math.random() * canvas.height * 0.5,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
      });
    }

    let frame = 0;
    function animate() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.rotation += p.rotationSpeed;
        if (p.y < canvas.height + 20) alive = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      frame++;
      if (alive && frame < 300) {
        requestAnimationFrame(animate);
      } else {
        setConfettiDone(true);
      }
    }
    animate();
  }, [step, confettiDone, accentColor]);

  const progress = (step / TOTAL_STEPS) * 100;

  if (!loaded) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[#00F5A0]/30 border-t-[#00F5A0] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0d0d] relative overflow-hidden">
      {step === 6 && (
        <canvas ref={canvasRef} className="fixed inset-0 z-50 pointer-events-none" />
      )}

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full blur-[120px] transition-colors duration-700" style={{ backgroundColor: `${accentColor}08` }} />
      </div>

      <div className="relative z-10 max-w-md mx-auto px-4 py-8 min-h-screen flex flex-col">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: accentColor }}>
                <path d="M3 5.5C3 4.12 4.12 3 5.5 3h3.09c.39 0 .74.24.88.6l1.42 3.55c.15.37.05.8-.25 1.06l-1.72 1.47a12.06 12.06 0 005.69 5.69l1.47-1.72c.26-.3.69-.4 1.06-.25l3.55 1.42c.36.14.6.49.6.88v3.09c0 1.38-1.12 2.5-2.5 2.5C9.83 21.29 2.71 14.17 2.71 5.5H3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="text-sm font-bold">
                <span className="text-white">Line</span>
                <span style={{ color: accentColor }}>Catch</span>
              </span>
            </div>
            <span className="text-[11px] text-white/30">{step} of {TOTAL_STEPS}</span>
          </div>
          <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%`, backgroundColor: accentColor }}
            />
          </div>
        </div>

        {/* Step content with transitions */}
        <div className="flex-1">
          <div
            key={step}
            className="animate-fadeSlideIn"
            style={{ animationDirection: direction === "back" ? "reverse" : "normal" }}
          >
            {/* Step 1: Welcome */}
            {step === 1 && (
              <div className="flex flex-col items-center text-center pt-12 space-y-8">
                <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: `${accentColor}15` }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" style={{ color: accentColor }}>
                    <path d="M3 5.5C3 4.12 4.12 3 5.5 3h3.09c.39 0 .74.24.88.6l1.42 3.55c.15.37.05.8-.25 1.06l-1.72 1.47a12.06 12.06 0 005.69 5.69l1.47-1.72c.26-.3.69-.4 1.06-.25l3.55 1.42c.36.14.6.49.6.88v3.09c0 1.38-1.12 2.5-2.5 2.5C9.83 21.29 2.71 14.17 2.71 5.5H3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>

                <div>
                  <h1 className="text-3xl font-extrabold text-white tracking-tight">
                    Welcome to <span style={{ color: accentColor }}>LineCatch</span>
                  </h1>
                  <p className="text-white/40 mt-3 text-base leading-relaxed">
                    30 days free. No card needed.<br />Cancel anytime.
                  </p>
                </div>

                <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5 w-full max-w-xs">
                  <div className="space-y-3 text-left">
                    {["Missed calls get auto-texted", "Clients book instantly", "You never lose a cut"].map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${accentColor}20` }}>
                          <svg className="w-3 h-3" style={{ color: accentColor }} fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <span className="text-sm text-white/60">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Customize Profile */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">Make it yours</h2>
                  <p className="text-sm text-white/40 mt-2">Pick a color and name — this is how clients see you.</p>
                </div>

                {/* Color swatches */}
                <div>
                  <label className="text-xs text-white/40 uppercase tracking-wider font-medium block mb-3">Accent color</label>
                  <div className="flex flex-wrap gap-2.5">
                    {ACCENT_COLORS.map((c) => (
                      <button
                        key={c.hex}
                        onClick={() => setAccentColor(c.hex)}
                        className="w-10 h-10 rounded-xl transition-all duration-200 relative"
                        style={{
                          backgroundColor: c.hex,
                          boxShadow: accentColor === c.hex ? `0 0 0 2px #0d0d0d, 0 0 0 4px ${c.hex}` : "none",
                          transform: accentColor === c.hex ? "scale(1.1)" : "scale(1)",
                        }}
                        title={c.name}
                      >
                        {accentColor === c.hex && (
                          <svg className="w-4 h-4 absolute inset-0 m-auto text-black/60" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Shop name */}
                <div>
                  <label className="text-xs text-white/40 uppercase tracking-wider font-medium block mb-3">Shop name</label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Fresh Cuts by Mike"
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder:text-white/15 focus:outline-none transition-colors"
                    style={{ borderColor: businessName ? `${accentColor}40` : undefined }}
                  />
                </div>

                {/* Live preview */}
                <div>
                  <label className="text-xs text-white/40 uppercase tracking-wider font-medium block mb-3">Preview</label>
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 overflow-hidden">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold" style={{ backgroundColor: `${accentColor}20`, color: accentColor }}>
                        {businessName ? businessName[0].toUpperCase() : "?"}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white/80">{businessName || "Your Shop Name"}</p>
                        <p className="text-[11px] text-white/25">Booking page</p>
                      </div>
                    </div>
                    <div className="h-px w-full mb-4" style={{ backgroundColor: `${accentColor}15` }} />
                    <div className="space-y-2">
                      {["Lineup — $20", "Taper — $30"].map((svc, i) => (
                        <div key={i} className="flex items-center justify-between bg-white/[0.02] border border-white/[0.04] rounded-lg px-3 py-2">
                          <span className="text-xs text-white/50">{svc}</span>
                          <div className="text-xs font-medium px-2 py-0.5 rounded-md" style={{ backgroundColor: `${accentColor}15`, color: accentColor }}>
                            Book
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Your Info */}
            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">Your info</h2>
                  <p className="text-sm text-white/40 mt-2">Just the basics — we pre-filled what we could.</p>
                </div>

                <div className="space-y-4">
                  <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5 space-y-4">
                    <div>
                      <label className="text-xs text-white/40 uppercase tracking-wider font-medium block mb-2">Name</label>
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Your name"
                        className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder:text-white/15 focus:outline-none focus:border-white/20 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-white/40 uppercase tracking-wider font-medium block mb-2">Email</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@email.com"
                        className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder:text-white/15 focus:outline-none focus:border-white/20 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-white/40 uppercase tracking-wider font-medium block mb-2">Personal phone</label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+1 (212) 555-9876"
                        className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder:text-white/15 focus:outline-none focus:border-white/20 transition-colors"
                      />
                      <p className="text-[11px] text-white/20 mt-2">Your personal number stays private — it&apos;s only for account recovery.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Business Hours */}
            {step === 4 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">Business hours</h2>
                  <p className="text-sm text-white/40 mt-2">When are you in the chair? Tap to toggle days on/off.</p>
                </div>

                <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5 space-y-3">
                  {DAYS.map((day) => {
                    const isOpen = !!businessHours[day];
                    return (
                      <div key={day} className="flex items-center gap-3">
                        {/* Toggle switch */}
                        <button
                          onClick={() => toggleDay(day)}
                          className="w-11 h-6 rounded-full relative transition-colors duration-200 shrink-0"
                          style={{ backgroundColor: isOpen ? accentColor : "rgba(255,255,255,0.06)" }}
                        >
                          <div
                            className="w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all duration-200 shadow-sm"
                            style={{ left: isOpen ? "22px" : "2px" }}
                          />
                        </button>

                        <span className={`text-sm w-24 shrink-0 ${isOpen ? "text-white/70" : "text-white/20"}`}>
                          {DAY_LABELS[day]}
                        </span>

                        {isOpen ? (
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="time"
                              value={businessHours[day]!.open}
                              onChange={(e) => updateHours(day, "open", e.target.value)}
                              className="text-xs bg-white/[0.03] border border-white/[0.08] rounded-lg px-2 py-1.5 text-white/60 w-24 focus:outline-none"
                            />
                            <span className="text-white/15 text-xs">–</span>
                            <input
                              type="time"
                              value={businessHours[day]!.close}
                              onChange={(e) => updateHours(day, "close", e.target.value)}
                              className="text-xs bg-white/[0.03] border border-white/[0.08] rounded-lg px-2 py-1.5 text-white/60 w-24 focus:outline-none"
                            />
                          </div>
                        ) : (
                          <span className="text-xs text-white/15">Closed</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 5: Services & Prices */}
            {step === 5 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">Services & prices</h2>
                  <p className="text-sm text-white/40 mt-2">Tap to enable, edit prices and times. At least one required.</p>
                </div>

                <div className="space-y-2">
                  {services.map((svc, i) => (
                    <div
                      key={i}
                      className={`border rounded-2xl p-4 transition-all duration-200 ${
                        svc.enabled
                          ? "bg-white/[0.04] border-white/[0.08]"
                          : "bg-white/[0.01] border-white/[0.03] opacity-50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <button
                          onClick={() => toggleService(i)}
                          className="flex items-center gap-3"
                        >
                          <div
                            className="w-5 h-5 rounded-md flex items-center justify-center transition-colors"
                            style={{
                              backgroundColor: svc.enabled ? accentColor : "transparent",
                              border: svc.enabled ? "none" : "1.5px solid rgba(255,255,255,0.15)",
                            }}
                          >
                            {svc.enabled && (
                              <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                          <span className={`text-sm font-medium ${svc.enabled ? "text-white/80" : "text-white/30"}`}>
                            {svc.name}
                          </span>
                        </button>
                      </div>

                      {svc.enabled && (
                        <div className="flex gap-3 ml-8">
                          <div className="flex-1">
                            <label className="text-[10px] text-white/25 uppercase tracking-wider block mb-1">Price</label>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-white/25">$</span>
                              <input
                                type="number"
                                value={svc.price}
                                onChange={(e) => updateServiceField(i, "price", e.target.value)}
                                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-2 py-1.5 text-sm text-white/70 focus:outline-none"
                              />
                            </div>
                          </div>
                          <div className="flex-1">
                            <label className="text-[10px] text-white/25 uppercase tracking-wider block mb-1">Minutes</label>
                            <input
                              type="number"
                              value={svc.duration}
                              onChange={(e) => updateServiceField(i, "duration", e.target.value)}
                              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-2 py-1.5 text-sm text-white/70 focus:outline-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add custom service */}
                {!showAddCustom ? (
                  <button
                    onClick={() => setShowAddCustom(true)}
                    className="w-full py-3 rounded-xl border border-dashed border-white/[0.08] text-sm text-white/30 hover:text-white/50 hover:border-white/[0.15] transition-colors"
                  >
                    + Add custom service
                  </button>
                ) : (
                  <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-4 space-y-3">
                    <input
                      type="text"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="Service name"
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white/80 placeholder:text-white/15 focus:outline-none"
                      autoFocus
                    />
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="text-[10px] text-white/25 block mb-1">Price ($)</label>
                        <input type="number" value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-2 py-1.5 text-sm text-white/70 focus:outline-none" />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] text-white/25 block mb-1">Minutes</label>
                        <input type="number" value={customDuration} onChange={(e) => setCustomDuration(e.target.value)} className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-2 py-1.5 text-sm text-white/70 focus:outline-none" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setShowAddCustom(false)} className="flex-1 py-2 rounded-lg text-xs text-white/30 bg-white/[0.04]">Cancel</button>
                      <button onClick={addCustomService} disabled={!customName.trim()} className="flex-1 py-2 rounded-lg text-xs font-semibold text-black disabled:opacity-30" style={{ backgroundColor: accentColor }}>Add</button>
                    </div>
                  </div>
                )}

                {!services.some((s) => s.enabled) && (
                  <p className="text-xs text-red-400/70 text-center">Enable at least one service to continue</p>
                )}
              </div>
            )}

            {/* Step 6: You're All Set */}
            {step === 6 && (
              <div className="flex flex-col items-center text-center pt-8 space-y-6">
                <div className="text-5xl">🎉</div>

                <div>
                  <h1 className="text-3xl font-extrabold text-white tracking-tight">You&apos;re all set!</h1>
                  <p className="text-white/40 mt-2 text-sm">Your 30-day free trial starts when your mirror decal arrives.</p>
                </div>

                {/* Summary card */}
                <div className="w-full max-w-xs bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5 text-left">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold" style={{ backgroundColor: `${accentColor}20`, color: accentColor }}>
                      {businessName ? businessName[0].toUpperCase() : "L"}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white/80">{businessName || "Your Shop"}</p>
                      <p className="text-[11px] text-white/25">{firstName || "You"}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {services.filter((s) => s.enabled).slice(0, 3).map((svc, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-xs text-white/40">{svc.name}</span>
                        <span className="text-xs font-medium" style={{ color: accentColor }}>${svc.price}</span>
                      </div>
                    ))}
                    {services.filter((s) => s.enabled).length > 3 && (
                      <p className="text-[11px] text-white/20">+{services.filter((s) => s.enabled).length - 3} more</p>
                    )}
                  </div>

                  <div className="h-px bg-white/[0.06] my-3" />

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-white/25">Working days</span>
                    <span className="text-[11px] text-white/40">
                      {DAYS.filter((d) => businessHours[d]).length} days/week
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation buttons */}
        <div className="mt-8 pb-4">
          <div className="flex gap-3">
            {step > 1 && step < 6 && (
              <button
                onClick={goBack}
                className="flex-none px-4 py-3 rounded-xl text-sm font-medium text-white/40 hover:text-white/60 bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.06] transition-all duration-200"
              >
                Back
              </button>
            )}

            {step === 1 && (
              <button
                onClick={goNext}
                className="flex-1 py-3.5 rounded-xl text-sm font-bold text-black transition-all duration-200 hover:brightness-110"
                style={{ backgroundColor: accentColor }}
              >
                Let&apos;s go
              </button>
            )}

            {step > 1 && step < 6 && (
              <button
                onClick={goNext}
                disabled={!canProceed() || saving}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-black disabled:opacity-30 transition-all duration-200 hover:brightness-110"
                style={{ backgroundColor: accentColor }}
              >
                {saving ? "Saving..." : "Continue"}
              </button>
            )}

            {step === 6 && (
              <button
                onClick={handleFinish}
                disabled={saving}
                className="flex-1 py-3.5 rounded-xl text-sm font-bold text-black disabled:opacity-30 transition-all duration-200 hover:brightness-110"
                style={{ backgroundColor: accentColor }}
              >
                {saving ? "Setting up..." : "Go to Dashboard"}
              </button>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .animate-fadeSlideIn {
          animation: fadeSlideIn 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

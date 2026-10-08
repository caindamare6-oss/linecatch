"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PageSkeleton } from "@/components/ui/skeleton";
import { PageHeader, SectionLabel, Card, SERIF } from "../ui";
import { formatPhone } from "@/lib/clients";
import { DAY_KEYS, type Hours } from "@/lib/validate";
import { useT, useLocale, LanguageToggle, type Locale } from "@/lib/i18n";
import { money, STICKER_PRICE_CENTS, SUPPORT_EMAIL } from "@/lib/config";
import { REWARD_CENTS } from "@/lib/loyalty-rules";
import { type Carrier } from "@/lib/call-mode";
import ForwardSetup from "./forward-setup";
import { MISSED_CALL_PRESETS, MISSED_CALL_STYLES, isMissedCallStyle, missedCallTemplate, withShopName, type MissedCallStyle } from "@/lib/missed-call-text";


type Address = { name: string; line1: string; line2: string | null; city: string; state: string; zip: string };

type Settings = {
  user_id: string;
  first_name: string | null;
  email: string | null;
  business_name: string | null;
  phone_number: string | null;
  call_mode: "forwarded" | "direct";
  numberMissing: string[];
  forwarding_number: string | null;
  google_review_url: string | null;
  booking_link: string | null;
  custom_message: string | null;
  missed_call_style: string | null;
  carrier: Carrier | null;
  loyalty_enabled: boolean | null;
  loyalty_reward_cents: number | null;
  lastMissedCallAt: string | null;
  missedCallPresets?: Partial<Record<"casual" | "professional", { en: string; es: string }>>;
  business_hours: Hours | null;
  timezone: string;
  feature_autotext: boolean | null;
  feature_wednesday: boolean | null;
  feature_reviews: boolean | null;
  barber_language: string;
  winback_offer: string | null;
  slug: string | null;
  is_locked_out: boolean;
  feature_marketing: boolean;
  shipping_address: Address | null;
  sticker_requested_at: string | null;
  marketing: "off" | "on";
  hasActiveSticker: boolean;
  isAdmin: boolean;
  appUrl: string;
};

async function patch(body: Record<string, unknown>): Promise<string | null> {
  const res = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (res.ok) return null;
  return (await res.json().catch(() => ({}))).error || "settings.save_error";
}

export default function SettingsPage() {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const [s, setS] = useState<Settings | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setS)
      .catch(() => setError(t("settings.load_error")));
  }, [t]);

  useEffect(() => {
    if (!s || !window.location.hash) return;
    const el = document.querySelector(window.location.hash);
    if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
  }, [s]);

  if (error) return <p className="py-10 text-center text-sm text-white/50">{error}</p>;
  if (!s) return <PageSkeleton />;

  const set = (patchObj: Partial<Settings>) => setS((prev) => (prev ? { ...prev, ...patchObj } : prev));
  const bookingUrl = `${s.appUrl}/book/${s.user_id}`;
  const vipUrl = `${s.appUrl}/vip/${s.user_id}`;

  return (
    <div className="space-y-6">
      <PageHeader title={t("settings.title")} back="/dashboard" />

      <section id="language">
        <SectionLabel>{t("settings.language")}</SectionLabel>
        <Card className="px-4 py-3.5 flex items-center gap-3">
          <p className="flex-1 text-[12px] text-white/45 leading-snug">{t("settings.language_hint")}</p>
          <LanguageToggle
            onChange={async (l: Locale) => {
              await patch({ barber_language: l });
              set({ barber_language: l });
            }}
          />
        </Card>
      </section>

      <section>
        <SectionLabel>{t("settings.profile")}</SectionLabel>
        <Card className="p-4 flex items-center gap-3.5">
          <span className={`${SERIF} w-12 h-12 rounded-[14px] bg-gradient-to-br from-[var(--accent-color)] to-[#C29A62] text-[#121110] flex items-center justify-center text-xl font-bold`} aria-hidden>
            {(s.first_name?.[0] || "L").toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <EditInline label={t("settings.your_name")} value={s.first_name || ""} placeholder={t("settings.add_your_name")} big onSave={async (v) => (await patch({ first_name: v })) ?? (set({ first_name: v }), null)} />
            <p className="text-[13px] text-white/40 truncate">{s.email}</p>
          </div>
        </Card>
      </section>

      <section id="business">
        <SectionLabel>{t("settings.business")}</SectionLabel>
        <div className="space-y-2">
          <EditRow label={t("settings.business_name")} value={s.business_name || ""} placeholder={t("settings.business_placeholder")} onSave={async (v) => (await patch({ business_name: v })) ?? (set({ business_name: v }), null)} />
          <EditRow
            label={t("settings.cell")}
            hint={t("settings.cell_hint")}
            value={s.forwarding_number ? formatPhone(s.forwarding_number) : ""}
            placeholder="(555) 234-5678"
            type="tel"
            onSave={async (v) => {
              const err = await patch({ forwarding_number: v });
              if (!err) {
                const r = await fetch("/api/settings").then((x) => x.json());
                set({ forwarding_number: r.forwarding_number });
              }
              return err;
            }}
          />
          <div id="reviews">
            <EditRow
              label={t("settings.review_link")}
              value={s.google_review_url || ""}
              placeholder="g.page/r/your-shop/review"
              type="url"
              onSave={async (v) => {
                const err = await patch({ google_review_url: v });
                if (!err) set({ google_review_url: v || null, ...(v ? {} : { feature_reviews: false }) });
                if (!err && !v && s.feature_reviews) await patch({ feature_reviews: false });
                return err;
              }}
            />
          </div>
          <CopyRow label={t("settings.booking_link")} url={bookingUrl} />
          <EditRow
            label={t("settings.outside")}
            hint={t("settings.outside_hint")}
            value={s.booking_link || ""}
            placeholder={t("settings.outside_placeholder")}
            type="url"
            onSave={async (v) => (await patch({ booking_link: v })) ?? (set({ booking_link: v || null }), null)}
          />
          <CopyRow label={t("settings.vip_link")} url={vipUrl} />
        </div>
      </section>

      <section id="missed-calls">
        <SectionLabel>{t("forward.section")}</SectionLabel>
        <ForwardingCard
          s={s}
          onMode={async (m) => (await patch({ call_mode: m })) ?? (set({ call_mode: m }), null)}
          onCarrier={async (c) => (await patch({ carrier: c })) ?? (set({ carrier: c }), null)}
        />
      </section>

      <InstallCard />

      <section id="features">
        <SectionLabel>{t("settings.included")}</SectionLabel>
        <div className="space-y-2">
          <Toggle
            label={t("settings.autotext")}
            hint={t("settings.autotext_hint")}
            on={s.feature_autotext !== false}
            onChange={async (v) => (await patch({ feature_autotext: v })) ?? (set({ feature_autotext: v }), null)}
          />
          <Card className="px-4 py-3.5">
            <p className="text-[14px] text-white/85">{t("settings.service")}</p>
            <p className="text-[12px] text-white/40 mt-0.5">{t("settings.service_hint")}</p>
          </Card>
        </div>
      </section>

      <section id="marketing">
        <SectionLabel>{t("settings.marketing")}</SectionLabel>
        <MarketingCard s={s} onChange={async () => setS(await fetch("/api/settings").then((r) => r.json()))} />
        {s.feature_marketing && (
          <div className="space-y-2 mt-2">
            <Toggle
              label={t("settings.wednesday")}
              hint={t("settings.wednesday_hint")}
              on={!!s.feature_wednesday}
              onChange={async (v) => (await patch({ feature_wednesday: v })) ?? (set({ feature_wednesday: v }), null)}
            />
            <Toggle
              label={t("settings.reviews")}
              hint={s.google_review_url ? t("settings.reviews_hint") : t("settings.reviews_need_link")}
              on={!!s.feature_reviews}
              disabled={!s.google_review_url}
              onChange={async (v) => (await patch({ feature_reviews: v })) ?? (set({ feature_reviews: v }), null)}
            />
            <EditRow
              label={t("settings.winback")}
              hint={t("settings.winback_hint")}
              value={s.winback_offer || ""}
              placeholder={t("settings.winback_placeholder", { reward: money(s.loyalty_reward_cents ?? REWARD_CENTS, locale) })}
              onSave={async (v) => (await patch({ winback_offer: v })) ?? (set({ winback_offer: v || null }), null)}
            />
          </div>
        )}
      </section>

      <section id="loyalty">
        <SectionLabel>{t("loyalty_settings.section")}</SectionLabel>
        <div className="space-y-2">
          <Toggle
            label={t("loyalty_settings.toggle")}
            hint={t("loyalty_settings.hint", { amount: money(s.loyalty_reward_cents ?? REWARD_CENTS, locale) })}
            on={s.loyalty_enabled !== false}
            onChange={async (v) => (await patch({ loyalty_enabled: v })) ?? (set({ loyalty_enabled: v }), null)}
          />
          {s.loyalty_enabled !== false && (
            <EditRow
              label={t("loyalty_settings.amount")}
              hint={t("loyalty_settings.amount_hint")}
              value={money(s.loyalty_reward_cents ?? REWARD_CENTS, locale)}
              placeholder="$5"
              onSave={async (v) => {
                const cents = Math.round(Number(v.replace(/[^\d.,]/g, "").replace(",", ".")) * 100);
                return (await patch({ loyalty_reward_cents: cents })) ?? (set({ loyalty_reward_cents: cents }), null);
              }}
            />
          )}
        </div>
      </section>

      <section>
        <SectionLabel>{t("settings.missed_text")}</SectionLabel>
        <MissedCallText s={s} onSaved={(v) => set(v)} />
      </section>

      <section id="hours">
        <SectionLabel>{t("settings.hours")}</SectionLabel>
        <HoursEditor initial={s.business_hours} timezone={s.timezone} onSaved={(h) => set({ business_hours: h })} />
      </section>

      <section>
        <SectionLabel>{t("settings.shop")}</SectionLabel>
        <div className="space-y-2">
          <NavRow href="/dashboard/services" label={t("settings.services")} />
          <NavRow href="/dashboard/portfolio" label={t("settings.portfolio")} />
        </div>
      </section>

      <StickerSection s={s} onChange={async () => setS(await fetch("/api/settings").then((r) => r.json()))} />

      <ReferCard />

      <section>
        <SectionLabel>{t("settings.account")}</SectionLabel>
        <div className="space-y-2">
          {s.isAdmin && <NavRow href="/dashboard/admin/stickers" label={t("settings.admin_stickers")} />}
          {s.isAdmin && <NavRow href="/dashboard/admin/twilio" label={t("settings.admin_twilio")} />}
          {s.isAdmin && <NavRow href="/dashboard/admin/texts" label={t("settings.admin_texts")} />}
          <NavRow href="/privacy" label={t("settings.privacy")} />
          <NavRow href="/terms" label={t("settings.terms")} />
          <a href={`mailto:${SUPPORT_EMAIL}`} className="block">
            <Card className="px-4 py-3.5 flex items-center justify-between hover:border-white/15">
              <span className="text-[14px] text-white/85">{t("settings.support")}</span>
              <span className="text-white/25">›</span>
            </Card>
          </a>
          <button
            onClick={async () => {
              await createClient().auth.signOut();
              router.push("/login");
            }}
            className="w-full h-12 rounded-[14px] border border-[#F08A8A]/25 text-[#F08A8A] text-sm font-semibold hover:bg-[#F08A8A]/5"
          >
            {t("settings.sign_out")}
          </button>
        </div>
      </section>
    </div>
  );
}

const STEP_LINKS: Record<string, string> = {
  setup: "/onboarding",
  cell: "/dashboard/settings#business",
  services: "/dashboard/services",
  hours: "/dashboard/settings#hours",
  portfolio: "/dashboard/portfolio",
  photo: "/dashboard/portfolio",
};

/** The barber's LineCatch number and how to send unanswered calls to it. */
function ForwardingCard({ s, onMode, onCarrier }: { s: Settings; onMode: (m: "forwarded" | "direct") => Promise<string | null>; onCarrier: (c: Carrier) => Promise<string | null> }) {
  const t = useT();
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState("");
  if (!s.phone_number) {
    const missing = s.numberMissing || [];
    return (
      <Card className="p-4 space-y-2.5">
        <p className="text-[14px] text-white/85">{t("forward.pending_title")}</p>
        <p className="text-[12px] text-white/45 leading-relaxed">{missing.length ? t("forward.pending_body") : t("forward.pending_soon")}</p>
        {missing.length > 0 && (
          <ul className="space-y-1.5">
            {missing.map((m) => (
              <li key={m}>
                <Link href={STEP_LINKS[m] || "/dashboard"} className="flex items-center justify-between text-[13px] text-[var(--accent-color)]">
                  <span>{t(`forward.step_${m}`)}</span>
                  <span aria-hidden>›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    );
  }

  const forwarded = s.call_mode !== "direct";
  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(""), 1500);
    } catch {}
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] text-white/45">{t("forward.your_number")}</p>
          <p className={`${SERIF} text-[20px] font-semibold tracking-[0.3px]`}>{formatPhone(s.phone_number)}</p>
        </div>
        <button onClick={() => copy(s.phone_number!)} className="h-9 px-3 rounded-lg border border-[var(--accent-color)]/35 text-[var(--accent-color)] text-[12px] font-semibold shrink-0">
          {copied === s.phone_number ? t("common.copied") : t("common.copy")}
        </button>
      </div>

      <div role="radiogroup" aria-label={t("forward.mode_label")} className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-white/[0.04]">
        {(["forwarded", "direct"] as const).map((m) => (
          <button
            key={m}
            role="radio"
            aria-checked={s.call_mode === m || (m === "forwarded" && !s.call_mode)}
            onClick={async () => {
              setErr("");
              const e = await onMode(m);
              if (e) setErr(t(e));
            }}
            className={`h-9 rounded-lg text-[12px] font-semibold transition-colors ${(m === "forwarded") === forwarded ? "bg-[var(--accent-color)] text-[var(--accent-fg)]" : "text-white/55"}`}
          >
            {t(`forward.mode_${m}`)}
          </button>
        ))}
      </div>

      {forwarded ? (
        <>
          <ForwardSetup s={s} onCarrier={onCarrier} copy={copy} copied={copied} />
        </>
      ) : (
        <p className="text-[13px] text-white/60 leading-relaxed">{t("forward.direct_how")}</p>
      )}
      {err && <p className="text-[12px] text-[#F08A8A]" role="alert">{err}</p>}
    </Card>
  );
}

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** "Put LineCatch on your home screen": hidden once it's opened from the home screen. */
function InstallCard() {
  const t = useT();
  // Settings only renders in the browser (after it loads), so navigator and matchMedia are there.
  const [installed] = useState(() => window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true);
  const [iphone] = useState(() => /iPhone|iPad|iPod/i.test(navigator.userAgent));
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [done, setDone] = useState(false);
  useEffect(() => {
    // Android Chrome offers a real "Install" button.
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    const onInstalled = () => setDone(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  if (installed) return null;

  return (
    <section id="app">
      <SectionLabel>{t("install.section")}</SectionLabel>
      <Card className="p-4 space-y-3">
        <p className="text-[14px] text-white/85">{t("install.title")}</p>
        {done ? (
          <p className="text-[13px] text-[#7FC79A]">✓ {t("install.done")}</p>
        ) : prompt ? (
          <button
            onClick={async () => {
              await prompt.prompt();
              if ((await prompt.userChoice).outcome === "accepted") setDone(true);
              setPrompt(null);
            }}
            className="w-full h-11 rounded-xl bg-[var(--accent-color)] text-[var(--accent-fg)] text-[13px] font-semibold"
          >
            {t("install.button")}
          </button>
        ) : (
          <ol className="space-y-1.5 text-[13px] text-white/65 list-decimal pl-5">
            {(iphone ? ["iphone_1", "iphone_2", "iphone_3"] : ["android_1", "android_2", "android_3"]).map((k) => (
              <li key={k}>{t(`install.${k}`)}</li>
            ))}
          </ol>
        )}
        <p className="text-[12px] text-white/40 leading-relaxed">{t(iphone ? "install.login_iphone" : "install.login")}</p>
        {iphone && <p className="text-[12px] text-white/40 leading-relaxed">{t("install.safari_tip")}</p>}
      </Card>
    </section>
  );
}

function NavRow({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="block">
      <Card className="px-4 py-3.5 flex items-center justify-between hover:border-white/15 transition-colors">
        <span className="text-[14px] text-white/85">{label}</span>
        <span className="text-white/25">›</span>
      </Card>
    </Link>
  );
}

function CopyRow({ label, url }: { label: string; url: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <Card className="px-4 py-3 flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-[14px] text-white/85">{label}</p>
        <p className="text-[13px] text-white/40 truncate">{url.replace(/^https?:\/\//, "")}</p>
      </div>
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          } catch {}
        }}
        className="h-8 px-3 rounded-lg border border-[var(--accent-color)]/35 text-[var(--accent-color)] text-[12px] font-semibold shrink-0"
      >
        {copied ? t("common.copied") : t("common.copy")}
      </button>
    </Card>
  );
}

function EditInline({ label, value, placeholder, onSave, big }: { label: string; value: string; placeholder: string; onSave: (v: string) => Promise<string | null>; big?: boolean }) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);
  const [err, setErr] = useState("");
  if (!editing) {
    return (
      <button onClick={() => { setV(value); setEditing(true); }} className={`${big ? "text-[16px] font-semibold" : "text-[14px]"} text-left hover:text-[var(--accent-color)] transition-colors`}>
        {value || <span className="text-white/40">{placeholder}</span>}
      </button>
    );
  }
  return (
    <form
      className="flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const er = await onSave(v.trim());
        if (er) setErr(er);
        else setEditing(false);
      }}
    >
      <label className="sr-only" htmlFor={`f-${label}`}>{label}</label>
      <input id={`f-${label}`} autoFocus value={v} onChange={(e) => setV(e.target.value)} className="flex-1 min-w-0 h-9 rounded-lg bg-white/[0.05] border border-white/[0.12] px-2.5 text-[14px] outline-none focus:border-[var(--accent-color)]/50" />
      <button className="h-9 px-3 rounded-lg bg-[var(--accent-color)] text-[var(--accent-fg)] text-[13px] font-semibold">{t("common.save")}</button>
      {err && <span className="sr-only" role="alert">{t(err)}</span>}
    </form>
  );
}

function EditRow({ label, value, placeholder, onSave, hint, type = "text" }: { label: string; value: string; placeholder: string; onSave: (v: string) => Promise<string | null>; hint?: string; type?: string }) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const id = `row-${label.replace(/\W+/g, "-").toLowerCase()}`;

  if (!editing) {
    return (
      <button onClick={() => { setV(value); setErr(""); setEditing(true); }} className="w-full text-left">
        <Card className="px-4 py-3.5 flex items-center justify-between gap-3 hover:border-white/15 transition-colors">
          <div className="min-w-0">
            <p className="text-[14px] text-white/85">{label}</p>
            <p className={`text-[13px] mt-0.5 truncate ${value ? "text-white/45" : "text-white/25"}`}>{value || placeholder}</p>
          </div>
          <span className="text-white/25 shrink-0">›</span>
        </Card>
      </button>
    );
  }
  return (
    <Card className="px-4 py-3.5">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          const er = await onSave(v.trim());
          setSaving(false);
          if (er) setErr(er);
          else setEditing(false);
        }}
      >
        <label htmlFor={id} className="text-[14px] text-white/85">{label}</label>
        {hint && <p className="text-[12px] text-white/40 mt-0.5">{hint}</p>}
        <input
          id={id}
          type={type}
          inputMode={type === "tel" ? "tel" : undefined}
          autoFocus
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder={placeholder}
          className="mt-2 w-full h-11 rounded-xl bg-white/[0.04] border border-white/[0.12] px-3.5 text-[15px] placeholder-white/25 outline-none focus:border-[var(--accent-color)]/50"
        />
        {err && <p className="text-[12px] text-[#F08A8A] mt-1.5" role="alert">{t(err)}</p>}
        <div className="flex gap-2 mt-3">
          <button type="button" onClick={() => setEditing(false)} className="h-10 px-4 rounded-xl border border-white/[0.12] text-[13px] text-white/70">{t("common.cancel")}</button>
          <button type="submit" disabled={saving} className="flex-1 h-10 rounded-xl bg-[var(--accent-color)] text-[var(--accent-fg)] text-[13px] font-semibold disabled:opacity-50">
            {saving ? t("common.saving") : t("common.save")}
          </button>
        </div>
      </form>
    </Card>
  );
}

function Toggle({ label, hint, on, onChange, disabled }: { label: string; hint: string; on: boolean; onChange: (v: boolean) => Promise<string | null>; disabled?: boolean }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <Card className="px-4 py-3.5">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[14px] text-white/85">{label}</p>
          <p className="text-[12px] text-white/40 mt-0.5 leading-snug">{hint}</p>
        </div>
        <button
          role="switch"
          aria-checked={on}
          aria-label={label}
          disabled={disabled || busy}
          onClick={async () => {
            setBusy(true);
            setErr("");
            const er = await onChange(!on);
            if (er) setErr(er);
            setBusy(false);
          }}
          className={`relative w-[46px] h-[26px] rounded-full shrink-0 transition-colors disabled:opacity-40 ${on ? "bg-[var(--accent-color)]" : "bg-white/[0.14]"}`}
        >
          <span className={`absolute top-[3px] w-5 h-5 rounded-full bg-[#FAF7F2] shadow transition-[left] duration-200 ${on ? "left-[23px]" : "left-[3px]"}`} />
        </button>
      </div>
      {err && <p className="text-[12px] text-[#F08A8A] mt-1.5" role="alert">{t(err)}</p>}
    </Card>
  );
}

function MissedCallText({ s, onSaved }: { s: Settings; onSaved: (v: Pick<Settings, "missed_call_style" | "custom_message">) => void }) {
  const t = useT();
  const locale = useLocale();
  const savedStyle: MissedCallStyle = isMissedCallStyle(s.missed_call_style) ? s.missed_call_style : "casual";
  // A saved text without {link} can't carry the booking link, so start the editor from Casual.
  const savedCustom = s.custom_message?.includes("{link}") ? s.custom_message.replace(/\s*(Reply STOP to opt out|Responde STOP[^.]*)\.?\s*$/i, "").trim() : "";
  const [style, setStyle] = useState<MissedCallStyle>(savedStyle);
  const [draft, setDraft] = useState(savedCustom || s.missedCallPresets?.casual?.[locale] || MISSED_CALL_PRESETS.casual[locale]);
  const [saved, setSaved] = useState({ style: savedStyle, custom: savedCustom });
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [err, setErr] = useState("");

  const preset = style === "custom" ? null : s.missedCallPresets?.[style]?.[locale];
  const template = style === "custom" ? draft : preset || missedCallTemplate(style, null, locale);
  const shop = s.business_name?.trim() || s.first_name?.trim() || "";
  const preview = withShopName(template.replace(/\{link\}/g, "www.linecatch.app/c/K7mP2xQa"), shop);
  const unchanged = style === saved.style && (style !== "custom" || draft === saved.custom);
  const missingLink = style === "custom" && !draft.includes("{link}");

  return (
    <Card className="p-4 space-y-3">
      <div role="radiogroup" aria-label={t("settings.missed_text")} className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-white/[0.04]">
        {MISSED_CALL_STYLES.map((id) => (
          <button
            key={id}
            role="radio"
            aria-checked={style === id}
            onClick={() => setStyle(id)}
            className={`h-9 rounded-lg text-[12px] font-semibold transition-colors ${style === id ? "bg-[var(--accent-color)] text-[var(--accent-fg)]" : "text-white/55"}`}
          >
            {t(`settings.style_${id}`)}
          </button>
        ))}
      </div>
      {style === "custom" && (
        <>
          <label htmlFor="mc-text" className="sr-only">{t("settings.missed_text")}</label>
          <textarea
            id="mc-text"
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 300))}
            rows={3}
            className="w-full rounded-xl bg-white/[0.04] border border-white/[0.1] px-3.5 py-3 text-[14px] outline-none focus:border-[var(--accent-color)]/50 resize-none"
          />
          {missingLink && <p className="text-[12px] text-[#E0926A]">{t("settings.keep_link")}</p>}
        </>
      )}
      <div className="rounded-xl bg-white/[0.03] px-3.5 py-3">
        <p className="text-[10px] uppercase tracking-[0.6px] font-semibold text-white/30 mb-1">{t("settings.callers_see", { shop: shop || t("settings.your_barber") })}</p>
        <p className="text-[13px] text-white/70 whitespace-pre-line">{preview}</p>
        <p className="text-[12px] text-white/35 mt-1">{t("settings.stop_footer")}</p>
        <p className="text-[11px] text-white/30 mt-2 leading-snug">{t("settings.stop_first_only")}</p>
      </div>
      {!s.business_name?.trim() && (
        <a href="#business" className="block text-[12px] text-[var(--accent-color)]">{t("settings.add_shop_name")}</a>
      )}
      {err && <p className="text-[12px] text-[#F08A8A]" role="alert">{t(err)}</p>}
      <button
        disabled={unchanged || missingLink || state === "saving"}
        onClick={async () => {
          setState("saving");
          const er = await patch({ missed_call_style: style, ...(style === "custom" ? { custom_message: draft } : {}) });
          if (er) {
            setErr(er);
            setState("idle");
            return;
          }
          setErr("");
          const custom = style === "custom" ? draft : saved.custom;
          setSaved({ style, custom });
          onSaved({ missed_call_style: style, custom_message: style === "custom" ? draft : s.custom_message });
          setState("saved");
          setTimeout(() => setState("idle"), 1500);
        }}
        className="w-full h-11 rounded-xl bg-[var(--accent-color)] text-[var(--accent-fg)] text-[13px] font-semibold disabled:opacity-35"
      >
        {state === "saving" ? t("common.saving") : state === "saved" ? t("common.saved") : t("settings.save_text")}
      </button>
    </Card>
  );
}

function HoursEditor({ initial, timezone, onSaved }: { initial: Hours | null; timezone: string; onSaved: (h: Hours) => void }) {
  const t = useT();
  const [hours, setHours] = useState<Hours>(initial || {});
  const [dirty, setDirty] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [err, setErr] = useState("");
  const update = (day: (typeof DAY_KEYS)[number], val: { open: string; close: string } | null) => {
    setHours((h) => ({ ...h, [day]: val }));
    setDirty(true);
  };
  return (
    <Card className="p-4">
      <ul className="space-y-2.5">
        {DAY_KEYS.map((day) => {
          const v = hours[day];
          return (
            <li key={day} className="flex items-center gap-2.5">
              <button
                role="switch"
                aria-checked={!!v}
                aria-label={t("settings.open_day", { day: t(`days.${day}`) })}
                onClick={() => update(day, v ? null : { open: "10:00", close: "19:00" })}
                className={`relative w-[38px] h-[22px] rounded-full shrink-0 transition-colors ${v ? "bg-[var(--accent-color)]" : "bg-white/[0.14]"}`}
              >
                <span className={`absolute top-[3px] w-4 h-4 rounded-full bg-[#FAF7F2] transition-[left] ${v ? "left-[19px]" : "left-[3px]"}`} />
              </button>
              <span className="w-9 text-[13px] font-semibold capitalize">{t(`days.${day}`)}</span>
              {v ? (
                <span className="flex items-center gap-1.5 flex-1">
                  <input aria-label={t("settings.day_open", { day: t(`days.${day}`) })} type="time" value={v.open} onChange={(e) => update(day, { ...v, open: e.target.value })} className="flex-1 min-w-0 h-9 rounded-lg bg-white/[0.05] border border-white/[0.1] px-2 text-[13px] [color-scheme:dark]" />
                  <span className="text-[12px] text-white/35">{t("settings.to")}</span>
                  <input aria-label={t("settings.day_close", { day: t(`days.${day}`) })} type="time" value={v.close} onChange={(e) => update(day, { ...v, close: e.target.value })} className="flex-1 min-w-0 h-9 rounded-lg bg-white/[0.05] border border-white/[0.1] px-2 text-[13px] [color-scheme:dark]" />
                </span>
              ) : (
                <span className="text-[13px] text-white/30">{t("settings.closed")}</span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] text-white/30 mt-3">{t("settings.tz_note", { tz: timezone.replace(/_/g, " ") })}</p>
      {err && <p className="text-[12px] text-[#F08A8A] mt-2" role="alert">{t(err)}</p>}
      <button
        disabled={!dirty || state === "saving"}
        onClick={async () => {
          setState("saving");
          const er = await patch({ business_hours: hours });
          if (er) {
            setErr(er);
            setState("idle");
            return;
          }
          setErr("");
          setDirty(false);
          onSaved(hours);
          setState("saved");
          setTimeout(() => setState("idle"), 1500);
        }}
        className="mt-3 w-full h-11 rounded-xl bg-[var(--accent-color)] text-[var(--accent-fg)] text-[13px] font-semibold disabled:opacity-35"
      >
        {state === "saving" ? t("common.saving") : state === "saved" ? t("common.saved") : t("settings.save_hours")}
      </button>
    </Card>
  );
}

function MarketingCard({ s, onChange }: { s: Settings; onChange: () => Promise<void> }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const on = s.feature_marketing;
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[14px] text-white/85">{t("settings.marketing")}</p>
          <p className="text-[12px] text-white/40 mt-0.5 leading-snug">{t("settings.marketing_desc")}</p>
          <p className="text-[12px] mt-1.5 leading-snug" style={{ color: on ? "#A8C49A" : "rgba(242,238,230,0.4)" }}>{on ? t("settings.marketing_on") : t("settings.marketing_off")}</p>
        </div>
        <button
          role="switch"
          aria-checked={on}
          aria-label={t("settings.marketing")}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setErr("");
            const er = await patch({ feature_marketing: !on });
            if (er) setErr(er);
            else await onChange();
            setBusy(false);
          }}
          className={`relative w-[46px] h-[26px] rounded-full shrink-0 transition-colors disabled:opacity-40 ${on ? "bg-[var(--accent-color)]" : "bg-white/[0.14]"}`}
        >
          <span className={`absolute top-[3px] w-5 h-5 rounded-full bg-[#FAF7F2] shadow transition-[left] duration-200 ${on ? "left-[23px]" : "left-[3px]"}`} />
        </button>
      </div>
      {err && <p className="text-[12px] text-[#F08A8A] mt-2" role="alert">{t(err)}</p>}
    </Card>
  );
}

/** Optional paid add-on. Nothing else in the app depends on it. */
function StickerSection({ s, onChange }: { s: Settings; onChange: () => Promise<void> }) {
  const t = useT();
  const locale = useLocale();
  const price = money(STICKER_PRICE_CENTS, locale);
  const a = s.shipping_address;
  const [codes, setCodes] = useState<{ code: string; status: string }[] | null>(null);
  const [form, setForm] = useState<Address>({ name: a?.name || s.business_name || "", line1: a?.line1 || "", line2: a?.line2 || "", city: a?.city || "", state: a?.state || "", zip: a?.zip || "" });
  const [ordering, setOrdering] = useState(false);
  const [busy, setBusy] = useState(false);
  const [moreSent, setMoreSent] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/stickers")
      .then((r) => r.json())
      .then((d) => setCodes(d.codes || []))
      .catch(() => setCodes([]));
  }, []);
  if (codes === null) return null;

  async function order(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const er = await patch({ shipping_address: form, request_sticker: true });
    setBusy(false);
    if (er) return setErr(er);
    setOrdering(false);
    await onChange();
  }

  const field = "w-full h-11 rounded-xl bg-white/[0.04] border border-white/[0.12] px-3.5 text-[15px] placeholder-white/25 outline-none focus:border-[var(--accent-color)]/50";
  const active = codes.filter((c) => c.status === "active");

  return (
    <section id="sticker">
      <SectionLabel>{t("settings.sticker")}</SectionLabel>
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[12px] text-white/50 leading-relaxed">{t("settings.sticker_pitch")}</p>
          <span className="text-[11px] font-semibold text-[var(--accent-color)] whitespace-nowrap">{t("settings.sticker_addon", { price })}</span>
        </div>

        {active.map((c) => (
          <div key={c.code} className="flex items-center justify-between mt-3">
            <span className="font-mono tracking-[2px] text-[15px]">{c.code}</span>
            <span className="text-[11px] font-semibold text-[#A8C49A]">{t("settings.sticker_active")}</span>
          </div>
        ))}

        {active.length > 0 ? (
          <button
            onClick={async () => {
              setBusy(true);
              const ok = await fetch("/api/stickers/request", { method: "POST" }).then((r) => r.ok).catch(() => false);
              setBusy(false);
              if (ok) setMoreSent(true);
              else setErr("settings.save_error");
            }}
            disabled={busy || moreSent}
            className="mt-3 w-full h-10 rounded-xl border border-white/[0.12] text-[13px] text-white/70 disabled:opacity-50"
          >
            {moreSent ? t("settings.sticker_more_sent") : busy ? t("settings.sticker_sending") : t("settings.sticker_more", { price })}
          </button>
        ) : s.sticker_requested_at ? (
          <p className="mt-3 text-[12px] text-[#E0926A] leading-relaxed">
            {t("settings.sticker_ordered", { city: s.shipping_address?.city || "", state: s.shipping_address?.state || "" })}
          </p>
        ) : !ordering ? (
          <button onClick={() => setOrdering(true)} className="mt-3 w-full h-10 rounded-xl border border-[var(--accent-color)]/35 text-[var(--accent-color)] text-[13px] font-semibold">
            {t("settings.sticker_order", { price })}
          </button>
        ) : (
          <form onSubmit={order} className="mt-4 space-y-2.5" style={{ animation: "ob-fade-up 220ms ease-out both" }}>
            <p className="text-[12px] text-white/55">{t("settings.ship_to")}</p>
            <label className="block text-[12px] text-white/45" htmlFor="ship-name">{t("step5.ship_name")}</label>
            <input id="ship-name" className={field} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <label className="block text-[12px] text-white/45" htmlFor="ship-line1">{t("step5.ship_street")}</label>
            <input id="ship-line1" className={field} value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} placeholder={t("step5.ship_street_placeholder")} autoComplete="address-line1" required />
            <label className="block text-[12px] text-white/45" htmlFor="ship-line2">{t("step5.ship_unit")}</label>
            <input id="ship-line2" className={field} value={form.line2 || ""} onChange={(e) => setForm({ ...form, line2: e.target.value })} autoComplete="address-line2" />
            <div className="grid grid-cols-[1fr_64px_92px] gap-2">
              <div>
                <label className="block text-[12px] text-white/45 mb-1" htmlFor="ship-city">{t("step5.ship_city")}</label>
                <input id="ship-city" className={field} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} autoComplete="address-level2" required />
              </div>
              <div>
                <label className="block text-[12px] text-white/45 mb-1" htmlFor="ship-state">{t("step5.ship_state")}</label>
                <input id="ship-state" className={field} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase().slice(0, 2) })} placeholder="MA" autoComplete="address-level1" required />
              </div>
              <div>
                <label className="block text-[12px] text-white/45 mb-1" htmlFor="ship-zip">{t("step5.ship_zip")}</label>
                <input id="ship-zip" className={field} value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value.replace(/[^\d-]/g, "").slice(0, 10) })} inputMode="numeric" autoComplete="postal-code" required />
              </div>
            </div>
            <p className="text-[11px] text-white/35">{t("settings.ship_payment")}</p>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setOrdering(false)} className="h-11 px-4 rounded-xl border border-white/[0.12] text-[13px] text-white/70">{t("common.cancel")}</button>
              <button type="submit" disabled={busy} className="flex-1 h-11 rounded-xl bg-[var(--accent-color)] text-[var(--accent-fg)] text-[13px] font-semibold disabled:opacity-50">
                {busy ? t("common.saving") : t("settings.ship_submit", { price })}
              </button>
            </div>
          </form>
        )}
        {err && <p className="text-[12px] text-[#F08A8A] mt-2" role="alert">{t(err)}</p>}
      </Card>
    </section>
  );
}

type Referral = { code: string; link: string; signedUp: number; qualified: number; freeMonths: number; discountPercent: number | null; rewards: { referredPercentOff: number } };

function ReferCard() {
  const t = useT();
  const [r, setR] = useState<Referral | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    fetch("/api/referrals")
      .then((x) => (x.ok ? x.json() : null))
      .then(setR)
      .catch(() => {});
  }, []);
  if (!r) return null;
  const percent = r.rewards.referredPercentOff;
  const shareText = t("settings.refer_share_text", { percent });

  async function share() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text: shareText, url: r!.link });
        return;
      } catch {
        // Cancelled or unsupported: fall back to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(`${shareText} ${r!.link}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  return (
    <section id="refer">
      <SectionLabel>{t("settings.refer")}</SectionLabel>
      <Card className="p-4">
        <p className="text-[12px] text-white/50 leading-relaxed">{t("settings.refer_pitch", { percent })}</p>
        <div className="mt-3 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-white/35">{t("settings.refer_code")}</p>
            <p className="font-mono tracking-[2px] text-[17px] text-[var(--accent-color)]">{r.code}</p>
            <p className="text-[12px] text-white/40 truncate">{r.link.replace(/^https?:\/\//, "")}</p>
          </div>
          <button onClick={share} className="h-10 px-4 rounded-xl bg-[var(--accent-color)] text-[var(--accent-fg)] text-[13px] font-semibold shrink-0">
            {copied ? t("common.copied") : t("settings.refer_share")}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          {[
            [r.signedUp, t("settings.refer_joined")],
            [r.qualified, t("settings.refer_qualified")],
            [r.freeMonths, t("settings.refer_free")],
          ].map(([n, label]) => (
            <div key={String(label)} className="rounded-xl bg-white/[0.03] py-2.5 text-center">
              <p className={`${SERIF} text-[18px] font-semibold`}>{n}</p>
              <p className="text-[10px] text-white/35 mt-0.5 leading-tight px-1">{label}</p>
            </div>
          ))}
        </div>
        {r.discountPercent ? <p className="text-[12px] text-[#A8C49A] mt-3">{t("settings.refer_discount", { percent: r.discountPercent })}</p> : null}
      </Card>
    </section>
  );
}

"use client";

import Link from "next/link";
import { CLIENT_PAYMENTS } from "@/lib/config";
import { PhotoRow } from "./photo-row";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PageSkeleton } from "@/components/ui/skeleton";
import { PageHeader, Card, SERIF } from "../ui";
import { formatPhone } from "@/lib/clients";
import { DAY_KEYS, type Hours } from "@/lib/validate";
import { useT, useLocale, LanguageToggle, type Locale } from "@/lib/i18n";
import { SUPPORT_EMAIL } from "@/lib/config";
import { REWARD_TYPES, rewardLabel, toLoyalty, type RewardType } from "@/lib/loyalty-rules";
import { type Carrier } from "@/lib/call-mode";
import ForwardSetup from "./forward-setup";
import { BillingSection, PaymentsSection, useStripeStatus } from "./payments-section";
import { MISSED_CALL_PRESETS, MISSED_CALL_STYLES, isMissedCallStyle, missedCallTemplate, withShopName, type MissedCallStyle } from "@/lib/missed-call-text";



type Settings = {
  user_id: string;
  first_name: string | null;
  email: string | null;
  business_name: string | null;
  phone_number: string | null;
  call_mode: "forwarded" | "direct";
  numberMissing: string[];
  forwarding_number: string | null;
  booking_link: string | null;
  custom_message: string | null;
  missed_call_style: string | null;
  carrier: Carrier | null;
  loyalty_enabled: boolean | null;
  loyalty_reward_type: RewardType | null;
  lastMissedCallAt: string | null;
  missedCallPresets?: Partial<Record<"casual" | "professional", { en: string; es: string }>>;
  business_hours: Hours | null;
  timezone: string;
  feature_autotext: boolean | null;
  barber_language: string;
  slug: string | null;
  cover_url: string | null;
  is_locked_out: boolean;
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
  const { s: pay, reload: reloadPay } = useStripeStatus();

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setS)
      .catch(() => setError(t("settings.load_error")));
  }, [t]);

  useEffect(() => {
    if (!s || !window.location.hash) return;
    const el = document.querySelector(window.location.hash);
    if (!el) return;
    const group = el.closest("details");
    if (group) group.open = true;
    setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
  }, [s]);

  if (error) return <p className="py-10 text-center text-sm text-white/50">{error}</p>;
  if (!s) return <PageSkeleton />;

  const set = (patchObj: Partial<Settings>) => setS((prev) => (prev ? { ...prev, ...patchObj } : prev));
  const bookingUrl = `${s.appUrl}/book/${s.user_id}`;

  const billingLine = !pay ? "" : pay.billing.status === "active" ? t("settings.sum_billing_active") : pay.billing.status === "past_due" ? t("settings.sum_billing_due") : pay.billing.daysLeft && pay.billing.daysLeft > 0 ? t("settings.sum_billing_trial", { n: pay.billing.daysLeft }) : t("settings.sum_billing_add");

  return (
    <div className="space-y-2.5">
      <PageHeader title={t("settings.title")} back="/dashboard" />

      <Group id="shop" title={t("settings.g_shop")} summary={s.business_name || t("settings.business_placeholder")}>
        <EditRow label={t("settings.business_name")} value={s.business_name || ""} placeholder={t("settings.business_placeholder")} onSave={async (v) => (await patch({ business_name: v })) ?? (set({ business_name: v }), null)} />
        <EditRow label={t("settings.your_name")} value={s.first_name || ""} placeholder={t("settings.add_your_name")} onSave={async (v) => (await patch({ first_name: v })) ?? (set({ first_name: v }), null)} />
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
        <PhotoRow url={s.cover_url} onChange={(u) => set({ cover_url: u })} />
        <CopyRow label={t("settings.booking_link")} url={s.slug ? `${s.appUrl}/${s.slug}` : bookingUrl} />
        <NavRow href="/dashboard/services" label={t("settings.services")} />
        <NavRow href="/dashboard/portfolio" label={t("settings.portfolio")} />
        <div id="hours">
          <HoursEditor initial={s.business_hours} timezone={s.timezone} onSaved={(h) => set({ business_hours: h })} />
        </div>
      </Group>

      <Group id="missed-calls" title={t("settings.g_missed")} summary={s.feature_autotext !== false ? t("settings.sum_on") : t("settings.sum_off")}>
        <Toggle
          label={t("settings.autotext")}
          hint={t("settings.autotext_hint")}
          on={s.feature_autotext !== false}
          onChange={async (v) => (await patch({ feature_autotext: v })) ?? (set({ feature_autotext: v }), null)}
        />
        <MissedCallText s={s} onSaved={(v) => set(v)} />
        <ForwardingCard
          s={s}
          onMode={async (m) => (await patch({ call_mode: m })) ?? (set({ call_mode: m }), null)}
          onCarrier={async (c) => (await patch({ carrier: c })) ?? (set({ carrier: c }), null)}
        />
      </Group>

      <Group id="loyalty" title={t("loyalty_settings.section")} summary={s.loyalty_enabled !== false ? rewardLabel(toLoyalty(s), locale) : t("settings.sum_off")}>
        <Toggle
          label={t("loyalty_settings.toggle")}
          hint={t("loyalty_settings.hint", { amount: rewardLabel(toLoyalty(s), locale) })}
          on={s.loyalty_enabled !== false}
          onChange={async (v) => (await patch({ loyalty_enabled: v })) ?? (set({ loyalty_enabled: v }), null)}
        />
        {s.loyalty_enabled !== false && (
          <RewardPicker
            value={toLoyalty(s).reward}
            onChange={async (v) => (await patch({ loyalty_reward_type: v })) ?? (set({ loyalty_reward_type: v }), null)}
          />
        )}
      </Group>

      <Group id="billing" title={t("billing.section")} summary={billingLine}>
        <BillingSection s={pay} reload={reloadPay} />
        {CLIENT_PAYMENTS && <PaymentsSection s={pay} reload={reloadPay} patch={patch} />}
      </Group>

      <Group id="refer" title={t("settings.refer")} summary={t("settings.sum_refer")}>
        <ReferCard />
      </Group>

      <Group id="account" title={t("settings.account")} summary={s.email || ""}>
        <Card className="px-4 py-3.5 flex items-center gap-3">
          <p className="flex-1 text-[12px] text-white/45 leading-snug">{t("settings.language_hint")}</p>
          <LanguageToggle
            onChange={async (l: Locale) => {
              await patch({ barber_language: l });
              set({ barber_language: l });
            }}
          />
        </Card>
        {s.isAdmin && <NavRow href="/dashboard/admin/twilio" label={t("settings.admin_twilio")} />}
        {s.isAdmin && <NavRow href="/dashboard/admin/texts" label={t("settings.admin_texts")} />}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="block">
          <Card className="px-4 py-3.5 flex items-center justify-between hover:border-white/15">
            <span className="text-[14px] text-white/85">{t("settings.support")}</span>
            <span className="text-white/25">›</span>
          </Card>
        </a>
        <p className="px-1 pt-1 text-[12px] text-white/35">
          <Link href="/privacy" className="hover:text-white/60">{t("settings.privacy")}</Link>
          {" · "}
          <Link href="/terms" className="hover:text-white/60">{t("settings.terms")}</Link>
        </p>
        <button
          onClick={async () => {
            await createClient().auth.signOut();
            router.push("/login");
          }}
          className="w-full h-12 rounded-[14px] border border-[var(--app-danger)]/25 text-[var(--app-danger)] text-sm font-semibold hover:bg-[var(--app-danger)]/5"
        >
          {t("settings.sign_out")}
        </button>
      </Group>
    </div>
  );
}

/** One settings group: a single row (title + current state) that opens to its settings. */
function Group({ id, title, summary, children }: { id: string; title: string; summary: string; children: React.ReactNode }) {
  return (
    <details id={id} className="group scroll-mt-4 rounded-[14px] border border-white/[0.06] bg-[var(--app-card)] open:bg-transparent open:border-transparent">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden group-open:px-1">
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-semibold text-white/90">{title}</span>
          {summary && <span className="block truncate text-[12px] text-white/40 group-open:hidden">{summary}</span>}
        </span>
        <span className="text-white/30 transition-transform group-open:rotate-90" aria-hidden>›</span>
      </summary>
      <div className="space-y-2 pb-4">{children}</div>
    </details>
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
      {err && <p className="text-[12px] text-[var(--app-danger)]" role="alert">{err}</p>}
    </Card>
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
        {err && <p className="text-[12px] text-[var(--app-danger)] mt-1.5" role="alert">{t(err)}</p>}
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

/** What every client's 10th cut gets: 50% off or free. */
function RewardPicker({ value, onChange }: { value: RewardType; onChange: (v: RewardType) => Promise<string | null> }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <Card className="px-4 py-3.5">
      <p className="text-[14px] text-white/85">{t("loyalty_settings.amount")}</p>
      <p className="text-[12px] text-white/40 mt-0.5 leading-snug">{t("loyalty_settings.amount_hint")}</p>
      <div role="radiogroup" aria-label={t("loyalty_settings.amount")} className="mt-3 grid grid-cols-2 gap-2">
        {REWARD_TYPES.map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={value === r}
            disabled={busy}
            onClick={async () => {
              if (r === value) return;
              setBusy(true);
              setErr("");
              const er = await onChange(r);
              if (er) setErr(er);
              setBusy(false);
            }}
            className={`min-h-11 rounded-xl text-[14px] font-semibold transition-colors disabled:opacity-60 ${value === r ? "bg-[var(--accent-color)] text-[var(--accent-fg)]" : "bg-white/[0.06] text-white/70"}`}
          >
            {t(`loyalty_settings.${r}`)}
          </button>
        ))}
      </div>
      {err && <p className="text-[12px] text-[var(--app-danger)] mt-1.5" role="alert">{t(err)}</p>}
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
          <span className={`absolute top-[3px] w-5 h-5 rounded-full bg-[var(--app-fg)] shadow transition-[left] duration-200 ${on ? "left-[23px]" : "left-[3px]"}`} />
        </button>
      </div>
      {err && <p className="text-[12px] text-[var(--app-danger)] mt-1.5" role="alert">{t(err)}</p>}
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
          {missingLink && <p className="text-[12px] text-[var(--app-warn)]">{t("settings.keep_link")}</p>}
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
      {err && <p className="text-[12px] text-[var(--app-danger)]" role="alert">{t(err)}</p>}
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
                <span className={`absolute top-[3px] w-4 h-4 rounded-full bg-[var(--app-fg)] transition-[left] ${v ? "left-[19px]" : "left-[3px]"}`} />
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
      {err && <p className="text-[12px] text-[var(--app-danger)] mt-2" role="alert">{t(err)}</p>}
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

type Referral = { code: string; link: string; signedUp: number; paid: number; discountPending: boolean; percent: number };

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
  const percent = r.percent;
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
    <section>
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
        <div className="grid grid-cols-2 gap-2 mt-3">
          {[
            [r.signedUp, t("settings.refer_joined")],
            [r.paid, t("settings.refer_qualified", { percent })],
          ].map(([n, label]) => (
            <div key={String(label)} className="rounded-xl bg-white/[0.03] py-2.5 text-center">
              <p className={`${SERIF} text-[18px] font-semibold`}>{n}</p>
              <p className="text-[10px] text-white/35 mt-0.5 leading-tight px-1">{label}</p>
            </div>
          ))}
        </div>
        {r.discountPending ? <p className="text-[12px] text-[var(--app-ok)] mt-3">{t("settings.refer_discount", { percent })}</p> : null}
      </Card>
    </section>
  );
}

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

type T = ReturnType<typeof useT>;

type Address = { name: string; line1: string; line2: string | null; city: string; state: string; zip: string };

type Settings = {
  user_id: string;
  first_name: string | null;
  email: string | null;
  business_name: string | null;
  phone_number: string | null;
  forwarding_number: string | null;
  google_review_url: string | null;
  booking_link: string | null;
  custom_message: string | null;
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

const PRESETS = ["casual", "pro", "short"] as const;
const presets = (t: T) => PRESETS.map((id) => ({ id, label: t(`settings.preset_${id}`), message: t(`settings.msg_${id}`) }));

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

      <section>
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
          {s.phone_number && (
            <Card className="px-4 py-3.5">
              <p className="text-[14px] text-white/85">{t("settings.lc_number")}</p>
              <p className="text-[13px] text-white/40 mt-0.5">{t("settings.lc_number_hint", { number: formatPhone(s.phone_number) })}</p>
            </Card>
          )}
        </div>
      </section>

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
              placeholder={t("settings.winback_placeholder", { reward: money(REWARD_CENTS, locale) })}
              onSave={async (v) => (await patch({ winback_offer: v })) ?? (set({ winback_offer: v || null }), null)}
            />
          </div>
        )}
      </section>

      <section>
        <SectionLabel>{t("settings.missed_text")}</SectionLabel>
        <MissedCallText initial={s.custom_message || t("settings.msg_casual")} shop={s.business_name || s.first_name || t("settings.your_barber")} onSaved={(m) => set({ custom_message: m })} />
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

function MissedCallText({ initial, shop, onSaved }: { initial: string; shop: string; onSaved: (m: string) => void }) {
  const t = useT();
  const opts = presets(t);
  const cleaned = initial.replace(/\s*(Reply STOP to opt out|Responde STOP[^.]*)\.?\s*$/i, "").trim();
  // A saved text without {link} can't carry the booking link, so it isn't what callers get.
  const legacy = !cleaned.includes("{link}");
  const [msg, setMsg] = useState(legacy ? opts[0].message : cleaned);
  const [saved, setSaved] = useState(legacy ? "" : cleaned);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [err, setErr] = useState("");
  const preview = msg.replace(/\{link\}/g, "linecatch.app/book/…") + (/\bstop\b/i.test(msg) ? "" : `\n${t("settings.stop_footer")}`);
  return (
    <Card className="p-4 space-y-3">
      {legacy && saved === "" && (
        <p className="text-[12px] text-[#E0926A] leading-relaxed">{t("settings.legacy_text")}</p>
      )}
      <div className="flex gap-1.5 flex-wrap">
        {opts.map((p) => (
          <button
            key={p.id}
            onClick={() => setMsg(p.message)}
            className={`h-8 px-3 rounded-lg text-[12px] ${msg === p.message ? "bg-[var(--accent-color)] text-[var(--accent-fg)] font-semibold" : "bg-white/[0.06] text-white/60"}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <label htmlFor="mc-text" className="sr-only">{t("settings.missed_text")}</label>
      <textarea
        id="mc-text"
        value={msg}
        onChange={(e) => setMsg(e.target.value.slice(0, 300))}
        rows={3}
        className="w-full rounded-xl bg-white/[0.04] border border-white/[0.1] px-3.5 py-3 text-[14px] outline-none focus:border-[var(--accent-color)]/50 resize-none"
      />
      <div className="rounded-xl bg-white/[0.03] px-3.5 py-3">
        <p className="text-[10px] uppercase tracking-[0.6px] font-semibold text-white/30 mb-1">{t("settings.callers_see", { shop })}</p>
        <p className="text-[13px] text-white/70 whitespace-pre-line">{preview}</p>
      </div>
      {!msg.includes("{link}") && <p className="text-[12px] text-[#E0926A]">{t("settings.keep_link")}</p>}
      {err && <p className="text-[12px] text-[#F08A8A]" role="alert">{t(err)}</p>}
      <button
        disabled={msg === saved || !msg.includes("{link}") || state === "saving"}
        onClick={async () => {
          setState("saving");
          const er = await patch({ custom_message: msg });
          if (er) {
            setErr(er);
            setState("idle");
            return;
          }
          setErr("");
          setSaved(msg);
          onSaved(msg);
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
                onClick={() => update(day, v ? null : { open: "09:00", close: "18:00" })}
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

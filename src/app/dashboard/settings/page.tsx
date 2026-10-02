"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PageSkeleton } from "@/components/ui/skeleton";
import { PageHeader, SectionLabel, Card, SERIF } from "../ui";
import { formatPhone } from "@/lib/clients";
import { DAY_KEYS, type Hours } from "@/lib/validate";

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
  marketing: "off" | "awaiting_sticker" | "on";
  isAdmin: boolean;
  appUrl: string;
};

const PRESETS = [
  { id: "casual", label: "Casual", message: "Hey! Sorry I missed your call. Book your next appointment here: {link}" },
  { id: "pro", label: "Professional", message: "Thank you for calling. I'm with a client and can't answer. You can schedule here: {link}" },
  { id: "short", label: "Short", message: "Missed your call! Book here: {link}" },
];

async function patch(body: Record<string, unknown>): Promise<string | null> {
  const res = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (res.ok) return null;
  return (await res.json().catch(() => ({}))).error || "Couldn't save";
}

export default function SettingsPage() {
  const router = useRouter();
  const [s, setS] = useState<Settings | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setS)
      .catch(() => setError("Couldn't load settings."));
  }, []);

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
      <PageHeader title="Settings" back="/dashboard" />

      <section>
        <SectionLabel>Profile</SectionLabel>
        <Card className="p-4 flex items-center gap-3.5">
          <span className={`${SERIF} w-12 h-12 rounded-[14px] bg-gradient-to-br from-[var(--accent-color)] to-[#C29A62] text-[#121110] flex items-center justify-center text-xl font-bold`} aria-hidden>
            {(s.first_name?.[0] || "L").toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <EditInline label="Your name" value={s.first_name || ""} placeholder="Add your name" big onSave={async (v) => (await patch({ first_name: v })) ?? (set({ first_name: v }), null)} />
            <p className="text-[13px] text-white/40 truncate">{s.email}</p>
          </div>
        </Card>
      </section>

      <section>
        <SectionLabel>Business</SectionLabel>
        <div className="space-y-2">
          <EditRow label="Business name" value={s.business_name || ""} placeholder="Fresh Cuts" onSave={async (v) => (await patch({ business_name: v })) ?? (set({ business_name: v }), null)} />
          <EditRow
            label="Your cell"
            hint="Missed calls forward here. Text LATE from this number to warn today's clients."
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
              label="Google review link"
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
          <CopyRow label="Booking link" url={bookingUrl} />
          <EditRow
            label="Outside booking site"
            hint="Use Booksy, Square or Calendly instead? Missed-call texts will point there. Leave empty to use LineCatch booking."
            value={s.booking_link || ""}
            placeholder="Using LineCatch booking"
            type="url"
            onSave={async (v) => (await patch({ booking_link: v })) ?? (set({ booking_link: v || null }), null)}
          />
          <CopyRow label="VIP signup link" url={vipUrl} />
          {s.phone_number && (
            <Card className="px-4 py-3.5">
              <p className="text-[14px] text-white/85">LineCatch number</p>
              <p className="text-[13px] text-white/40 mt-0.5">{formatPhone(s.phone_number)} · clients call and text this</p>
            </Card>
          )}
        </div>
      </section>

      <section id="features">
        <SectionLabel>Included</SectionLabel>
        <div className="space-y-2">
          <Toggle
            label="Auto-text missed calls"
            hint="Callers who opted in get a booking link when you can't pick up."
            on={s.feature_autotext !== false}
            onChange={async (v) => (await patch({ feature_autotext: v })) ?? (set({ feature_autotext: v }), null)}
          />
          <Card className="px-4 py-3.5">
            <p className="text-[14px] text-white/85">Confirmations & reminders</p>
            <p className="text-[12px] text-white/40 mt-0.5">Always on for clients who opt in. No sticker needed.</p>
          </Card>
        </div>
      </section>

      <section id="marketing">
        <SectionLabel>SMS marketing</SectionLabel>
        <MarketingCard s={s} onChange={async () => setS(await fetch("/api/settings").then((r) => r.json()))} />
        {s.feature_marketing && (
          <div className="space-y-2 mt-2">
            <Toggle
              label="Wednesday re-engagement"
              hint="A midweek check-in to clients who haven't booked in 2+ weeks, then win-back texts if they stay quiet."
              on={!!s.feature_wednesday}
              onChange={async (v) => (await patch({ feature_wednesday: v })) ?? (set({ feature_wednesday: v }), null)}
            />
            <Toggle
              label="Google review requests"
              hint={s.google_review_url ? "A few hours after a visit, ask happy clients for a review." : "Add your Google review link above first."}
              on={!!s.feature_reviews}
              disabled={!s.google_review_url}
              onChange={async (v) => (await patch({ feature_reviews: v })) ?? (set({ feature_reviews: v }), null)}
            />
            <EditRow
              label="Win-back offer"
              hint="Included in the last check-in to clients who stopped coming. Leave empty for none."
              value={s.winback_offer || ""}
              placeholder="$5 off"
              onSave={async (v) => (await patch({ winback_offer: v })) ?? (set({ winback_offer: v || null }), null)}
            />
          </div>
        )}
      </section>

      <section>
        <SectionLabel>Missed-call text</SectionLabel>
        <MissedCallText initial={s.custom_message || PRESETS[0].message} shop={s.business_name || s.first_name || "your barber"} onSaved={(m) => set({ custom_message: m })} />
      </section>

      <section id="hours">
        <SectionLabel>Hours</SectionLabel>
        <HoursEditor initial={s.business_hours} timezone={s.timezone} onSaved={(h) => set({ business_hours: h })} />
      </section>

      <section>
        <SectionLabel>Shop</SectionLabel>
        <div className="space-y-2">
          <NavRow href="/dashboard/services" label="Services & prices" />
          <NavRow href="/dashboard/portfolio" label="Portfolio, accent color & background" />
        </div>
      </section>

      <StickerSection />

      <section>
        <SectionLabel>Account</SectionLabel>
        <div className="space-y-2">
          {s.isAdmin && <NavRow href="/dashboard/admin/stickers" label="Admin: stickers" />}
          <NavRow href="/privacy" label="Privacy policy" />
          <NavRow href="/terms" label="Terms" />
          <a href="mailto:caindamare6@gmail.com" className="block">
            <Card className="px-4 py-3.5 flex items-center justify-between hover:border-white/15">
              <span className="text-[14px] text-white/85">Contact support</span>
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
            Sign out
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
        {copied ? "Copied" : "Copy"}
      </button>
    </Card>
  );
}

function EditInline({ label, value, placeholder, onSave, big }: { label: string; value: string; placeholder: string; onSave: (v: string) => Promise<string | null>; big?: boolean }) {
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
      <button className="h-9 px-3 rounded-lg bg-[var(--accent-color)] text-[var(--accent-fg)] text-[13px] font-semibold">Save</button>
      {err && <span className="sr-only" role="alert">{err}</span>}
    </form>
  );
}

function EditRow({ label, value, placeholder, onSave, hint, type = "text" }: { label: string; value: string; placeholder: string; onSave: (v: string) => Promise<string | null>; hint?: string; type?: string }) {
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
        {err && <p className="text-[12px] text-[#F08A8A] mt-1.5" role="alert">{err}</p>}
        <div className="flex gap-2 mt-3">
          <button type="button" onClick={() => setEditing(false)} className="h-10 px-4 rounded-xl border border-white/[0.12] text-[13px] text-white/70">Cancel</button>
          <button type="submit" disabled={saving} className="flex-1 h-10 rounded-xl bg-[var(--accent-color)] text-[var(--accent-fg)] text-[13px] font-semibold disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Card>
  );
}

function Toggle({ label, hint, on, onChange, disabled }: { label: string; hint: string; on: boolean; onChange: (v: boolean) => Promise<string | null>; disabled?: boolean }) {
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
      {err && <p className="text-[12px] text-[#F08A8A] mt-1.5" role="alert">{err}</p>}
    </Card>
  );
}

function MissedCallText({ initial, shop, onSaved }: { initial: string; shop: string; onSaved: (m: string) => void }) {
  const cleaned = initial.replace(/\s*Reply STOP to opt out\.?\s*$/i, "").trim();
  // A saved text without {link} can't carry the booking link, so it isn't what callers get.
  const legacy = !cleaned.includes("{link}");
  const [msg, setMsg] = useState(legacy ? PRESETS[0].message : cleaned);
  const [saved, setSaved] = useState(legacy ? "" : cleaned);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [err, setErr] = useState("");
  const preview = msg.replace(/\{link\}/g, "linecatch.app/book/…") + (/\bstop\b/i.test(msg) ? "" : "\nReply STOP to opt out.");
  return (
    <Card className="p-4 space-y-3">
      {legacy && saved === "" && (
        <p className="text-[12px] text-[#E0926A] leading-relaxed">Your old text had no booking link, so callers get LineCatch&apos;s default instead. Save one below to make it yours.</p>
      )}
      <div className="flex gap-1.5 flex-wrap">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => setMsg(p.message)}
            className={`h-8 px-3 rounded-lg text-[12px] ${msg === p.message ? "bg-[var(--accent-color)] text-[var(--accent-fg)] font-semibold" : "bg-white/[0.06] text-white/60"}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <label htmlFor="mc-text" className="sr-only">Missed-call text</label>
      <textarea
        id="mc-text"
        value={msg}
        onChange={(e) => setMsg(e.target.value.slice(0, 300))}
        rows={3}
        className="w-full rounded-xl bg-white/[0.04] border border-white/[0.1] px-3.5 py-3 text-[14px] outline-none focus:border-[var(--accent-color)]/50 resize-none"
      />
      <div className="rounded-xl bg-white/[0.03] px-3.5 py-3">
        <p className="text-[10px] uppercase tracking-[0.6px] font-semibold text-white/30 mb-1">What {shop}&apos;s callers see</p>
        <p className="text-[13px] text-white/70 whitespace-pre-line">{preview}</p>
      </div>
      {!msg.includes("{link}") && <p className="text-[12px] text-[#E0926A]">Keep {"{link}"} in the text so callers can book.</p>}
      {err && <p className="text-[12px] text-[#F08A8A]" role="alert">{err}</p>}
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
        {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : "Save text"}
      </button>
    </Card>
  );
}

function HoursEditor({ initial, timezone, onSaved }: { initial: Hours | null; timezone: string; onSaved: (h: Hours) => void }) {
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
                aria-label={`Open ${day}`}
                onClick={() => update(day, v ? null : { open: "09:00", close: "18:00" })}
                className={`relative w-[38px] h-[22px] rounded-full shrink-0 transition-colors ${v ? "bg-[var(--accent-color)]" : "bg-white/[0.14]"}`}
              >
                <span className={`absolute top-[3px] w-4 h-4 rounded-full bg-[#FAF7F2] transition-[left] ${v ? "left-[19px]" : "left-[3px]"}`} />
              </button>
              <span className="w-9 text-[13px] font-semibold capitalize">{day.slice(0, 3)}</span>
              {v ? (
                <span className="flex items-center gap-1.5 flex-1">
                  <input aria-label={`${day} open`} type="time" value={v.open} onChange={(e) => update(day, { ...v, open: e.target.value })} className="flex-1 min-w-0 h-9 rounded-lg bg-white/[0.05] border border-white/[0.1] px-2 text-[13px] [color-scheme:dark]" />
                  <span className="text-[12px] text-white/35">to</span>
                  <input aria-label={`${day} close`} type="time" value={v.close} onChange={(e) => update(day, { ...v, close: e.target.value })} className="flex-1 min-w-0 h-9 rounded-lg bg-white/[0.05] border border-white/[0.1] px-2 text-[13px] [color-scheme:dark]" />
                </span>
              ) : (
                <span className="text-[13px] text-white/30">Closed</span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] text-white/30 mt-3">Times are in {timezone.replace(/_/g, " ")}.</p>
      {err && <p className="text-[12px] text-[#F08A8A] mt-2" role="alert">{err}</p>}
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
        {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : "Save hours"}
      </button>
    </Card>
  );
}

function StickerSection() {
  const [codes, setCodes] = useState<{ code: string; status: string }[] | null>(null);
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch("/api/stickers")
      .then((r) => r.json())
      .then((d) => setCodes(d.codes || []))
      .catch(() => setCodes([]));
  }, []);
  if (codes === null) return null;
  return (
    <section>
      <SectionLabel>QR sticker</SectionLabel>
      <Card className="p-4">
        {codes.length === 0 ? (
          <p className="text-[13px] text-white/45">No sticker activated yet. Scan yours from the Home tab to turn on texting.</p>
        ) : (
          <>
            {codes.map((c) => (
              <div key={c.code} className="flex items-center justify-between">
                <span className="font-mono tracking-[2px] text-[15px]">{c.code}</span>
                <span className="text-[11px] font-semibold text-[#A8C49A]">{c.status === "active" ? "Active" : c.status}</span>
              </div>
            ))}
            <button
              onClick={async () => {
                setBusy(true);
                await fetch("/api/stickers/request", { method: "POST" }).catch(() => {});
                setBusy(false);
                setRequested(true);
              }}
              disabled={busy || requested}
              className="mt-3 w-full h-10 rounded-xl border border-white/[0.12] text-[13px] text-white/70 disabled:opacity-50"
            >
              {requested ? "Request sent. We'll mail them out." : busy ? "Sending…" : "Request more stickers"}
            </button>
          </>
        )}
      </Card>
    </section>
  );
}

function MarketingCard({ s, onChange }: { s: Settings; onChange: () => Promise<void> }) {
  const a = s.shipping_address;
  const [form, setForm] = useState<Address>({ name: a?.name || s.business_name || "", line1: a?.line1 || "", line2: a?.line2 || "", city: a?.city || "", state: a?.state || "", zip: a?.zip || "" });
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function turnOn(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setErr("");
    const er = await patch({ feature_marketing: true, shipping_address: form });
    setBusy(false);
    if (er) return setErr(er);
    setAsking(false);
    await onChange();
  }
  async function turnOff() {
    setBusy(true);
    const er = await patch({ feature_marketing: false });
    setBusy(false);
    if (er) return setErr(er);
    await onChange();
  }

  const status =
    s.marketing === "on"
      ? { tone: "#A8C49A", text: "On. Your QR sticker is active." }
      : s.marketing === "awaiting_sticker"
        ? { tone: "#E0926A", text: `Waiting for your QR sticker${s.shipping_address ? ` (shipping to ${s.shipping_address.city}, ${s.shipping_address.state})` : ""}. Scan it from Home when it arrives.` }
        : { tone: "rgba(242,238,230,0.4)", text: "Off. Check-ins, win-backs, broadcasts and review requests don't go out." };
  const field = "w-full h-11 rounded-xl bg-white/[0.04] border border-white/[0.12] px-3.5 text-[15px] placeholder-white/25 outline-none focus:border-[var(--accent-color)]/50";

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[14px] text-white/85">SMS marketing</p>
          <p className="text-[12px] mt-0.5 leading-snug" style={{ color: status.tone }}>{status.text}</p>
        </div>
        <button
          role="switch"
          aria-checked={s.feature_marketing}
          aria-label="SMS marketing"
          disabled={busy}
          onClick={() => (s.feature_marketing ? turnOff() : setAsking(true))}
          className={`relative w-[46px] h-[26px] rounded-full shrink-0 transition-colors disabled:opacity-40 ${s.feature_marketing ? "bg-[var(--accent-color)]" : "bg-white/[0.14]"}`}
        >
          <span className={`absolute top-[3px] w-5 h-5 rounded-full bg-[#FAF7F2] shadow transition-[left] duration-200 ${s.feature_marketing ? "left-[23px]" : "left-[3px]"}`} />
        </button>
      </div>

      {asking && !s.feature_marketing && (
        <form onSubmit={turnOn} className="mt-4 space-y-2.5" style={{ animation: "ob-fade-up 220ms ease-out both" }}>
          <p className="text-[12px] text-white/55 leading-relaxed">
            Marketing texts need a QR sticker at your chair so clients can opt in. We&apos;ll ship you one free. Everything else keeps working while it&apos;s on the way.
          </p>
          <label className="block text-[12px] text-white/45" htmlFor="ship-name">Name or shop</label>
          <input id="ship-name" className={field} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <label className="block text-[12px] text-white/45" htmlFor="ship-line1">Street</label>
          <input id="ship-line1" className={field} value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} placeholder="123 Main St" autoComplete="address-line1" />
          <label className="block text-[12px] text-white/45" htmlFor="ship-line2">Apt / suite (optional)</label>
          <input id="ship-line2" className={field} value={form.line2 || ""} onChange={(e) => setForm({ ...form, line2: e.target.value })} autoComplete="address-line2" />
          <div className="grid grid-cols-[1fr_64px_92px] gap-2">
            <div>
              <label className="block text-[12px] text-white/45 mb-1" htmlFor="ship-city">City</label>
              <input id="ship-city" className={field} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} autoComplete="address-level2" />
            </div>
            <div>
              <label className="block text-[12px] text-white/45 mb-1" htmlFor="ship-state">State</label>
              <input id="ship-state" className={field} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase().slice(0, 2) })} placeholder="MA" autoComplete="address-level1" />
            </div>
            <div>
              <label className="block text-[12px] text-white/45 mb-1" htmlFor="ship-zip">ZIP</label>
              <input id="ship-zip" className={field} value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value.replace(/[^\d-]/g, "").slice(0, 10) })} inputMode="numeric" autoComplete="postal-code" />
            </div>
          </div>
          {err && <p className="text-[12px] text-[#F08A8A]" role="alert">{err}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setAsking(false)} className="h-11 px-4 rounded-xl border border-white/[0.12] text-[13px] text-white/70">Cancel</button>
            <button type="submit" disabled={busy} className="flex-1 h-11 rounded-xl bg-[var(--accent-color)] text-[var(--accent-fg)] text-[13px] font-semibold disabled:opacity-50">
              {busy ? "Saving…" : "Turn on & ship my sticker"}
            </button>
          </div>
        </form>
      )}
      {!asking && err && <p className="text-[12px] text-[#F08A8A] mt-2" role="alert">{err}</p>}
    </Card>
  );
}

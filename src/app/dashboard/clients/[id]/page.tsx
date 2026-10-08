"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader, Card, Badge, SectionLabel, EmptyState, SERIF } from "../../ui";
import { PageSkeleton } from "@/components/ui/skeleton";
import { formatPhone, phoneFromPathId, clientPathId, shortAgo, type ClientSummary } from "@/lib/clients";
import { useT, useFormat, useLocale } from "@/lib/i18n";
import { money } from "@/lib/config";
import { DEFAULT_LOYALTY, type Loyalty } from "@/lib/loyalty-rules";

type Visit = { id: string; time: string; status: string; service: string; price: number };
type Detail = { client: ClientSummary; barberId: string; notes: string; source: string | null; loyalty: Loyalty; history: Visit[] };

const STATUS: Record<string, { label: string; tone: string }> = {
  completed: { label: "", tone: "var(--accent-color)" },
  confirmed: { label: "client.upcoming", tone: "#8FB8DE" },
  cancelled: { label: "client.cancelled", tone: "color-mix(in srgb, var(--app-fg) 35%, transparent)" },
  no_show: { label: "client.no_show", tone: "var(--app-danger)" },
};

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const f = useFormat();
  const locale = useLocale();
  const phone = phoneFromPathId(id);
  const [data, setData] = useState<Detail | null>(null);
  const reward = money((data?.loyalty ?? DEFAULT_LOYALTY).cents, locale);
  const [error, setError] = useState(phone ? "" : t("client.not_found"));

  useEffect(() => {
    if (!phone) return;
    fetch(`/api/clients?phone=${encodeURIComponent(phone)}`)
      .then(async (r) => (r.ok ? r.json() : Promise.reject((await r.json().catch(() => ({}))).error)))
      .then(setData)
      .catch((e) => setError(typeof e === "string" ? t(e) : t("client.load_error")));
  }, [phone, t]);

  if (error) {
    return (
      <>
        <PageHeader title={t("client.title")} back="/dashboard/clients" />
        <EmptyState title={error} />
      </>
    );
  }
  if (!data) return <PageSkeleton />;

  const { client: c, barberId } = data;
  const bookHref = barberId
    ? `/book/${barberId}?src=barber&phone=${encodeURIComponent(c.phone.replace(/^\+1/, ""))}${c.name ? `&name=${encodeURIComponent(c.name)}` : ""}`
    : undefined;

  return (
    <>
      <PageHeader title={t("client.title")} back="/dashboard/clients" />

      <section className="text-center mb-5" style={{ animation: "ob-fade-up 350ms ease-out both" }}>
        <div className={`${SERIF} mx-auto mb-3 w-16 h-16 rounded-[20px] bg-gradient-to-br from-[var(--accent-color)] to-[color-mix(in_srgb,var(--accent-color)_78%,#000)] text-[var(--accent-fg)] flex items-center justify-center text-2xl font-bold`} aria-hidden>
          {(c.name?.[0] || "#").toUpperCase()}
        </div>
        <NameEditor phone={c.phone} initial={c.name} />
        <a href={`tel:${c.phone}`} className="block text-[13px] text-white/40 mt-1">{formatPhone(c.phone)}</a>
        <div className="flex gap-1.5 justify-center mt-2.5">
          {c.isVip && <Badge tone="vip">{t("clients.badge_vip")}</Badge>}
          {c.optedOut ? <Badge tone="danger">{t("clients.badge_optout")}</Badge> : c.isVip ? <Badge tone="gold">{t("client.opted_in")}</Badge> : <Badge tone="muted">{t("clients.badge_notexts")}</Badge>}
          {c.rewardDue && c.visits > 0 && <Badge tone="due">{t("client.reward_next", { reward })}</Badge>}
        </div>
      </section>

      <div className="grid grid-cols-3 gap-2 mb-5">
        <Stat value={String(c.visits)} label={t("client.visits")} gold />
        <Stat value={money(Math.round(c.spent) * 100, locale)} label={t("client.spent")} />
        <Stat value={c.lastVisit ? shortAgo(c.lastVisit, new Date(), t) : "—"} label={t("client.last_visit")} />
      </div>

      <div className="grid grid-cols-3 gap-2 mb-6">
        <Action href={`/dashboard/messages/${clientPathId(c.phone)}`} label={t("common.message")} icon={<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />} />
        <Action href={`tel:${c.phone}`} label={t("common.call")} icon={<path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72" />} />
        <Action href={bookHref} label={t("common.book")} primary icon={<path d="M12 5v14M5 12h14" />} />
      </div>

      {data.loyalty?.enabled !== false && <section className="mb-6">
        <SectionLabel>{t("client.loyalty")}</SectionLabel>
        <Card className="p-4">
          <div className="flex gap-1.5" aria-label={t("client.stamped", { n: c.stamps })}>
            {Array.from({ length: Math.max(c.stamps + c.cutsToReward, 3) }, (_, i) => i).slice(-6).map((i) => {
              const filled = i < c.stamps;
              const isReward = i === c.stamps + c.cutsToReward - 1;
              return (
                <span
                  key={i}
                  className={`flex-1 h-9 rounded-lg flex items-center justify-center text-[11px] font-bold ${
                    filled ? "bg-[var(--accent-color)] text-[var(--accent-fg)]" : isReward ? "border border-dashed border-[var(--app-warn)]/60 text-[var(--app-warn)]" : "bg-white/[0.05] text-white/25"
                  }`}
                >
                  {isReward && !filled ? reward : i + 1}
                </span>
              );
            })}
          </div>
          <p className="text-[12px] text-white/45 mt-3">
            {c.rewardDue ? t("client.reward_due", { reward }) : c.cutsToReward === 1 ? t("client.cuts_to_one", { reward }) : t("client.cuts_to", { n: c.cutsToReward, reward })}
          </p>
        </Card>
      </section>}

      <section className="mb-6">
        <SectionLabel>{t("client.history")}</SectionLabel>
        {data.history.length === 0 ? (
          <Card className="px-4 py-6 text-center text-[13px] text-white/40">{t("client.no_bookings")}</Card>
        ) : (
          <ul className="space-y-0.5">
            {data.history.map((v) => {
              const s = STATUS[v.status] ?? STATUS.completed;
              return (
                <li key={v.id} className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-white/[0.03]">
                  <span className="w-[34px] h-[34px] rounded-[10px] shrink-0 flex items-center justify-center" style={{ color: s.tone, background: `color-mix(in srgb, ${s.tone} 12%, transparent)` }} aria-hidden>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      {v.status === "completed" ? <><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" /></> : <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>}
                    </svg>
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-white/85 truncate">
                      {v.service}
                      {s.label && <span className="ml-1.5 text-[11px] font-normal" style={{ color: s.tone }}>{t(s.label)}</span>}
                    </p>
                    <p className="text-[11px] text-white/30">{f.date(v.time, { month: "short", day: "numeric", year: "numeric" })}</p>
                  </div>
                  <span className={`${SERIF} text-[13px] font-semibold ${v.status === "completed" ? "text-[var(--accent-color)]" : "text-white/30"}`}>{money(Math.round(v.price) * 100, locale)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <SectionLabel>{t("client.notes")}</SectionLabel>
        <NotesEditor phone={c.phone} initial={data.notes} />
      </section>
    </>
  );
}

function Stat({ value, label, gold }: { value: string; label: string; gold?: boolean }) {
  return (
    <Card className="py-3 px-2 text-center">
      <p className={`${SERIF} text-[20px] font-semibold ${gold ? "text-[var(--accent-color)]" : ""}`}>{value}</p>
      <p className="text-[10px] text-white/35 mt-0.5">{label}</p>
    </Card>
  );
}

function Action({ href, label, icon, primary }: { href?: string; label: string; icon: React.ReactNode; primary?: boolean }) {
  const cls = `h-11 rounded-[10px] flex items-center justify-center gap-1.5 text-[13px] font-semibold transition-transform hover:scale-[1.03] ${
    primary ? "bg-[var(--accent-color)] text-[var(--accent-fg)]" : "border border-white/[0.1] text-white/70 hover:text-white hover:border-[var(--accent-color)]/30"
  } ${href ? "" : "opacity-40 pointer-events-none"}`;
  const svg = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>{icon}</svg>;
  if (href?.startsWith("/")) return <Link href={href} className={cls}>{svg}{label}</Link>;
  return <a href={href} className={cls} aria-disabled={!href}>{svg}{label}</a>;
}

function useSaver(phone: string) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  async function save(patch: Record<string, string>) {
    setState("saving");
    const res = await fetch("/api/clients", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, ...patch }) });
    setState(res.ok ? "saved" : "error");
    if (res.ok) setTimeout(() => setState("idle"), 1500);
    return res.ok;
  }
  return { state, save };
}

function NameEditor({ phone, initial }: { phone: string; initial: string | null }) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initial || "");
  const { state, save } = useSaver(phone);
  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className={`${SERIF} text-[22px] font-semibold tracking-[-0.3px] hover:text-[var(--accent-color)] transition-colors`} title={t("client.edit_name")}>
        {name || t("client.add_name")}
      </button>
    );
  }
  return (
    <form
      className="flex gap-2 justify-center"
      onSubmit={async (e) => {
        e.preventDefault();
        await save({ name });
        setEditing(false);
      }}
    >
      <label htmlFor="client-name" className="sr-only">{t("client.name")}</label>
      <input id="client-name" autoFocus value={name} onChange={(e) => setName(e.target.value.slice(0, 60))} className="h-10 w-44 rounded-[10px] bg-white/[0.05] border border-white/[0.12] px-3 text-center outline-none focus:border-[var(--accent-color)]/50" />
      <button type="submit" disabled={state === "saving"} className="h-10 px-3 rounded-[10px] bg-[var(--accent-color)] text-[var(--accent-fg)] text-sm font-semibold">{t("common.save")}</button>
    </form>
  );
}

function NotesEditor({ phone, initial }: { phone: string; initial: string }) {
  const t = useT();
  const [notes, setNotes] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const { state, save } = useSaver(phone);
  const dirty = notes !== saved;
  return (
    <Card className="p-3">
      <label htmlFor="client-notes" className="sr-only">{t("client.notes")}</label>
      <textarea
        id="client-notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value.slice(0, 1000))}
        rows={3}
        placeholder={t("client.notes_placeholder")}
        className="w-full bg-transparent text-[13px] leading-relaxed text-white/80 placeholder-white/25 outline-none resize-none px-1"
      />
      <div className="flex items-center justify-between pt-1 px-1">
        <span className="text-[11px] text-white/30">{state === "saved" ? t("common.saved") : state === "error" ? t("client.save_error") : t("client.notes_private")}</span>
        <button
          onClick={async () => {
            if (await save({ notes })) setSaved(notes);
          }}
          disabled={!dirty || state === "saving"}
          className="h-8 px-3 rounded-lg text-[12px] font-semibold bg-[var(--accent-color)] text-[var(--accent-fg)] disabled:opacity-0 transition-opacity"
        >
          {t("common.save")}
        </button>
      </div>
    </Card>
  );
}

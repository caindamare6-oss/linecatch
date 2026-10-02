"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader, Card, Badge, Avatar, EmptyState, SERIF } from "../ui";
import { PageSkeleton } from "@/components/ui/skeleton";
import { formatPhone, shortAgo, clientPathId, type ClientSummary } from "@/lib/clients";
import { useT, useFormat, useLocale } from "@/lib/i18n";
import { money } from "@/lib/config";
import { REWARD_CENTS } from "@/lib/loyalty-rules";

type Filter = "all" | "vip" | "due" | "notexts";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "clients.f_all" },
  { value: "vip", label: "clients.f_vip" },
  { value: "due", label: "clients.f_due" },
  { value: "notexts", label: "clients.f_notexts" },
];

type T = ReturnType<typeof useT>;

function nextLabel(iso: string, t: T, tag: string) {
  const d = new Date(iso);
  const today = new Date();
  const days = Math.round((new Date(d.toDateString()).getTime() - new Date(today.toDateString()).getTime()) / 86_400_000);
  const time = d.toLocaleTimeString(tag, { hour: "numeric", minute: "2-digit" }).replace(/\s/g, "").replace(/\./g, "").toLowerCase();
  if (days <= 0) return t("clients.next_today", { time });
  if (days === 1) return t("clients.next_tomorrow", { time });
  if (days < 7) return `${d.toLocaleDateString(tag, { weekday: "short" })} · ${time}`;
  return `${d.toLocaleDateString(tag, { month: "short", day: "numeric" })} · ${time}`;
}

export default function ClientsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Clients />
    </Suspense>
  );
}

function Clients() {
  const t = useT();
  const f = useFormat();
  const locale = useLocale();
  const reward = money(REWARD_CENTS, locale);
  const params = useSearchParams();
  const router = useRouter();
  const initial = (FILTERS.find((f) => f.value === params.get("filter"))?.value ?? "all") as Filter;
  const [filter, setFilter] = useState<Filter>(initial);
  const [query, setQuery] = useState("");
  const [clients, setClients] = useState<ClientSummary[] | null>(null);
  const [vipLink, setVipLink] = useState("");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setClients(d.clients);
        setVipLink(d.vipLink);
      })
      .catch(() => setError(t("clients.load_error")));
  }, [t]);

  const shown = useMemo(() => {
    if (!clients) return [];
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    return clients.filter((c) => {
      if (filter === "vip" && !c.isVip) return false;
      if (filter === "due" && !(c.rewardDue && c.visits > 0)) return false;
      if (filter === "notexts" && c.isVip) return false;
      if (!q) return true;
      return (c.name || "").toLowerCase().includes(q) || (digits.length >= 3 && c.phone.includes(digits));
    });
  }, [clients, filter, query]);

  const vipCount = clients?.filter((c) => c.isVip).length ?? 0;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(vipLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  return (
    <>
      <PageHeader
        title={t("clients.title")}
        right={
          <div className="flex items-center gap-3">
            {clients && (
              <span className="text-[13px] text-white/40">
                {t("clients.total", { n: clients.length })} · <span className="text-[#A8C49A] font-semibold">{t("clients.vip_count", { n: vipCount })}</span>
              </span>
            )}
            <button
              onClick={() => setAdding(true)}
              aria-label={t("clients.add")}
              className="w-9 h-9 rounded-[10px] bg-[var(--accent-color)] text-[var(--accent-fg)] flex items-center justify-center"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
            </button>
          </div>
        }
      />

      <label className="relative block">
        <span className="sr-only">{t("clients.search_label")}</span>
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("clients.search")}
          className="w-full h-12 pl-10 pr-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[15px] placeholder-white/30 outline-none focus:border-[var(--accent-color)]/50"
        />
      </label>

      <div className="flex gap-2 mt-3 overflow-x-auto pb-1 -mx-1 px-1" role="tablist" aria-label={t("clients.filter")}>
        {FILTERS.map((fl) => (
          <button
            key={fl.value}
            role="tab"
            aria-selected={filter === fl.value}
            onClick={() => {
              setFilter(fl.value);
              router.replace(fl.value === "all" ? "/dashboard/clients" : `/dashboard/clients?filter=${fl.value}`, { scroll: false });
            }}
            className={`h-8 px-3.5 rounded-[9px] text-[13px] whitespace-nowrap transition-colors ${
              filter === fl.value ? "bg-[var(--accent-color)] text-[var(--accent-fg)] font-semibold" : "bg-white/[0.06] text-white/55 hover:text-white/85"
            }`}
          >
            {t(fl.label)}
          </button>
        ))}
      </div>

      {vipLink && (filter === "vip" || filter === "notexts") && (
        <Card className="mt-3 px-4 py-3.5 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-white/45">{filter === "notexts" ? t("clients.get_on_list") : t("clients.vip_link")}</p>
            <p className={`${SERIF} text-[14px] truncate mt-0.5`}>{vipLink.replace(/^https?:\/\//, "")}</p>
          </div>
          <button onClick={copyLink} className="h-9 px-3 rounded-[10px] border border-[var(--accent-color)]/35 text-[var(--accent-color)] text-[13px] font-semibold shrink-0">
            {copied ? t("common.copied") : t("common.copy")}
          </button>
        </Card>
      )}

      <div className="mt-4">
        {error ? (
          <EmptyState title={error} />
        ) : clients === null ? (
          <PageSkeleton />
        ) : shown.length === 0 ? (
          <EmptyState title={query ? t("clients.no_match") : t("clients.empty")}>
            {query ? t("clients.no_match_body") : t("clients.empty_body")}
          </EmptyState>
        ) : (
          <ul className="space-y-0.5">
            {shown.map((c) => (
              <li key={c.phone}>
                <Link href={`/dashboard/clients/${clientPathId(c.phone)}`} className="flex items-center gap-3.5 px-1.5 py-3 rounded-xl hover:bg-white/[0.03] transition-colors">
                  <Avatar name={c.name || "#"} size={44} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[15px] font-semibold truncate">{c.name || formatPhone(c.phone)}</span>
                      {c.isVip && <Badge tone="vip">{t("clients.badge_vip")}</Badge>}
                      {c.rewardDue && c.visits > 0 && <Badge tone="due">{t("clients.badge_due", { reward })}</Badge>}
                      {c.optedOut ? <Badge tone="danger">{t("clients.badge_optout")}</Badge> : !c.isVip && <Badge tone="muted">{t("clients.badge_notexts")}</Badge>}
                    </div>
                    <p className="text-[12px] text-white/40 mt-0.5 truncate">
                      {c.visits === 1 ? t("clients.visits_one") : t("clients.visits", { n: c.visits })} · {money(Math.round(c.spent) * 100, locale)}
                      {c.lastVisit && ` · ${lastSeen(c.lastVisit, t)}`}
                    </p>
                    <p className={`text-[12px] mt-0.5 ${c.nextBooking ? "text-[var(--accent-color)]" : "text-white/30"}`}>
                      {c.nextBooking
                        ? t("clients.next", { when: nextLabel(c.nextBooking, t, f.tag) })
                        : c.rewardDue
                          ? t("clients.reward_next", { reward })
                          : c.cutsToReward === 1
                            ? t("clients.cuts_to_one", { reward })
                            : t("clients.cuts_to", { n: c.cutsToReward, reward })}
                    </p>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/20 shrink-0" aria-hidden><path d="M9 18l6-6-6-6" /></svg>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {adding && (
        <AddClientSheet
          onClose={() => setAdding(false)}
          onAdded={(phone) => {
            setAdding(false);
            router.push(`/dashboard/clients/${clientPathId(phone)}`);
          }}
        />
      )}
    </>
  );
}

function lastSeen(iso: string, t: T) {
  const ago = shortAgo(iso, new Date(), t);
  return ago === t("ago.today") ? t("clients.last_today") : t("clients.last", { ago });
}

function AddClientSheet({ onClose, onAdded }: { onClose: () => void; onAdded: (phone: string) => void }) {
  const t = useT();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/clients/add", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, name }) });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setError(d.error ? t(d.error) : t("clients.add_error"));
    onAdded(d.phone);
  }

  const field = "w-full h-12 rounded-xl bg-white/[0.04] border border-white/[0.1] px-4 text-[15px] placeholder-white/25 outline-none focus:border-[var(--accent-color)]/50";
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="add-title">
      <button aria-label={t("common.close")} className="absolute inset-0 bg-black/60" onClick={onClose} />
      <form onSubmit={save} className="relative w-full max-w-md bg-[#1B1A18] border border-white/[0.08] rounded-t-2xl sm:rounded-2xl p-5 pb-[calc(20px+env(safe-area-inset-bottom))] space-y-3" style={{ animation: "ob-fade-up 220ms ease-out both" }}>
        <h2 id="add-title" className={`${SERIF} text-xl font-semibold`}>{t("clients.add_title")}</h2>
        <div>
          <label htmlFor="add-name" className="block text-[12px] text-white/45 mb-1.5">{t("clients.add_name")}</label>
          <input id="add-name" className={field} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" placeholder={t("clients.add_name")} />
        </div>
        <div>
          <label htmlFor="add-phone" className="block text-[12px] text-white/45 mb-1.5">{t("clients.add_phone")}</label>
          <input id="add-phone" className={field} value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" placeholder="(555) 234-5678" required />
        </div>
        <p className="text-[12px] text-white/40 leading-relaxed">{t("clients.add_note")}</p>
        {error && <p className="text-[13px] text-[#F08A8A]">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="h-12 px-5 rounded-xl border border-white/[0.12] text-white/70">{t("common.cancel")}</button>
          <button type="submit" disabled={saving || !phone.trim()} className="flex-1 h-12 rounded-xl bg-[var(--accent-color)] text-[var(--accent-fg)] font-semibold disabled:opacity-40">
            {saving ? t("common.saving") : t("clients.add_save")}
          </button>
        </div>
      </form>
    </div>
  );
}

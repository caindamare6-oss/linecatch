"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader, Segmented, Card, EmptyState, Avatar, SERIF } from "../ui";
import { PageSkeleton } from "@/components/ui/skeleton";
import { formatPhone, clientPathId } from "@/lib/clients";
import { listTime, type Conversation, type BroadcastGroup } from "@/lib/conversations";
import { useT, useFormat } from "@/lib/i18n";

type Filter = "all" | "sent" | "received";

export default function MessagesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Messages />
    </Suspense>
  );
}

function Messages() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const [filter, setFilter] = useState<Filter>("all");
  const [items, setItems] = useState<(Conversation | BroadcastGroup)[] | null>(null);
  const [error, setError] = useState("");
  const composing = params.get("compose") === "broadcast";

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/messages?filter=${filter}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (!cancelled) {
          setItems(d.items);
          setError("");
        }
      })
      .catch(() => !cancelled && setError(t("messages.load_error")));
    return () => {
      cancelled = true;
    };
  }, [filter, t]);

  const openComposer = (open: boolean) => router.replace(open ? "/dashboard/messages?compose=broadcast" : "/dashboard/messages", { scroll: false });

  return (
    <>
      <PageHeader
        title={t("messages.title")}
        right={
          <button
            onClick={() => openComposer(true)}
            className="h-10 px-3.5 rounded-xl bg-[var(--accent-color)] text-[var(--accent-fg)] text-[13px] font-semibold flex items-center gap-1.5 hover:-translate-y-px transition-transform"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
            {t("messages.broadcast")}
          </button>
        }
      />

      <Segmented
        label={t("messages.filter")}
        value={filter}
        onChange={(f) => {
          setItems(null);
          setFilter(f);
        }}
        options={[
          { value: "all", label: t("messages.all") },
          { value: "sent", label: t("messages.sent") },
          { value: "received", label: t("messages.received") },
        ]}
      />

      <div className="mt-4">
        {error ? (
          <EmptyState title={t("messages.error_title")}>{error}</EmptyState>
        ) : items === null ? (
          <PageSkeleton />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>}
            title={filter === "received" ? t("messages.empty_received") : t("messages.empty")}
          >
            {t("messages.empty_body")}
          </EmptyState>
        ) : (
          <ul className="space-y-2">
            {items.map((it) => (it.kind === "broadcast" ? <BroadcastRow key={it.id} g={it} /> : <ConversationRow key={it.phone} c={it} />))}
          </ul>
        )}
      </div>

      {composing && <BroadcastSheet onClose={() => openComposer(false)} />}
    </>
  );
}

function ConversationRow({ c }: { c: Conversation }) {
  const t = useT();
  const f = useFormat();
  const missedCall = c.last.template_key === "missed_call" && !c.name;
  return (
    <li>
      <Link href={`/dashboard/messages/${clientPathId(c.phone)}`} className="block group">
        <Card className="px-4 py-3.5 flex items-center gap-3.5 transition-[border-color,transform] group-hover:border-[var(--accent-color)]/20 group-hover:-translate-y-px">
          {missedCall ? (
            <span className="w-10 h-10 shrink-0 rounded-xl bg-white/[0.05] text-white/45 flex items-center justify-center" aria-hidden>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72" /><path d="M15 3h6v6M21 3l-7 7" /></svg>
            </span>
          ) : (
            <Avatar name={c.name} size={40} />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <span className={`text-[15px] truncate ${c.unreplied ? "font-bold" : "font-semibold"}`}>{c.name || formatPhone(c.phone)}</span>
              <span className={`text-[11px] shrink-0 ${c.unreplied ? "text-[var(--accent-color)]" : "text-white/30"}`}>{listTime(c.last.created_at, t("common.yesterday"), f.tag)}</span>
            </div>
            <p className={`text-[13px] truncate mt-0.5 ${c.unreplied ? "text-white/80" : "text-white/40"}`}>
              {c.last.direction === "outbound" && <span className="text-white/30">{t("messages.you")}</span>}
              {c.last.body}
            </p>
          </div>
          {c.unreplied && <span className="w-2 h-2 rounded-full bg-[var(--accent-color)] shrink-0" aria-label={t("messages.new_reply")} />}
        </Card>
      </Link>
    </li>
  );
}

function BroadcastRow({ g }: { g: BroadcastGroup }) {
  const t = useT();
  const f = useFormat();
  return (
    <li>
      <Card className="px-4 py-3.5 flex items-center gap-3.5 border-[var(--accent-color)]/15">
        <span className="w-10 h-10 shrink-0 rounded-xl bg-[var(--accent-color)]/[0.12] text-[var(--accent-color)] flex items-center justify-center" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <span className="text-[15px] font-semibold">{t("messages.broadcast")}</span>
              <span className="text-[10px] font-bold px-1.5 py-[2px] rounded-[5px] text-[var(--accent-color)] bg-[var(--accent-color)]/[0.12]">{t("messages.n_sent", { n: g.sent })}</span>
            </span>
            <span className="text-[11px] text-white/30 shrink-0">{listTime(g.created_at, t("common.yesterday"), f.tag)}</span>
          </div>
          <p className="text-[13px] text-white/40 truncate mt-0.5">{g.body}</p>
        </div>
      </Card>
    </li>
  );
}

function BroadcastSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [text, setText] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "confirm" | "sending" | "done">("idle");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/broadcast")
      .then((r) => r.json())
      .then((d) => {
        setCount(typeof d.total === "number" ? d.total : 0);
        setBlocked(d.blockedReason ? t("messages.bc_blocked") : null);
      })
      .catch(() => setCount(0));
  }, [t]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && state !== "sending" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, state]);

  async function send() {
    setState("sending");
    setError("");
    try {
      const res = await fetch("/api/broadcast", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text }) });
      const d = await res.json();
      if (!res.ok) throw new Error(res.status === 403 ? t("messages.bc_blocked") : d.error ? t(d.error) : t("messages.bc_failed"));
      setResult(t("messages.bc_result", { sent: d.sent, total: d.total }));
      setState("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("messages.bc_failed"));
      setState("idle");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="bc-title">
      <button aria-label={t("common.close")} className="absolute inset-0 bg-black/60" onClick={() => state !== "sending" && onClose()} />
      <div className="relative w-full max-w-md bg-[var(--app-card)] border border-white/[0.08] rounded-t-2xl sm:rounded-2xl p-5 pb-[calc(20px+env(safe-area-inset-bottom))]" style={{ animation: "ob-fade-up 220ms ease-out both" }}>
        <div className="flex items-center justify-between mb-1">
          <h2 id="bc-title" className={`${SERIF} text-xl font-semibold`}>{t("messages.broadcast")}</h2>
          <button onClick={onClose} disabled={state === "sending"} aria-label={t("common.close")} className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <p className={`text-[13px] text-white/45 mb-4 ${blocked ? "hidden" : ""}`}>
          {count === null ? t("messages.bc_counting") : count === 0 ? t("messages.bc_none") : count === 1 ? t("messages.bc_goes_to_one") : t("messages.bc_goes_to", { n: count })}
        </p>

        {blocked ? (
          <>
            <p className="text-sm text-[var(--app-warn)] leading-relaxed">{blocked}</p>
            <Link href="/dashboard/settings#marketing" className="mt-4 w-full h-12 rounded-xl bg-[var(--accent-color)] text-[var(--accent-fg)] font-semibold flex items-center justify-center">
              {t("messages.bc_open_settings")}
            </Link>
          </>
        ) : state === "done" ? (
          <>
            <p className="text-sm text-[var(--app-ok)] font-medium">{result}</p>
            <button onClick={onClose} className="mt-4 w-full h-12 rounded-xl bg-[var(--accent-color)] text-[var(--accent-fg)] font-semibold">{t("common.done")}</button>
          </>
        ) : (
          <>
            <label htmlFor="bc-text" className="sr-only">{t("messages.bc_label")}</label>
            <textarea
              id="bc-text"
              value={text}
              onChange={(e) => {
                setText(e.target.value.slice(0, 320));
                if (state === "confirm") setState("idle");
              }}
              rows={4}
              placeholder={t("messages.bc_placeholder")}
              className="w-full rounded-xl bg-white/[0.04] border border-white/[0.1] px-4 py-3 text-[15px] placeholder-white/25 outline-none focus:border-[var(--accent-color)]/50 resize-none"
            />
            <div className="flex justify-between text-[11px] text-white/35 mt-1.5">
              <span>{t("messages.bc_stop_note")}</span>
              <span>{text.length}/320</span>
            </div>
            {error && <p className="mt-3 text-[13px] text-[var(--app-danger)]">{error}</p>}
            <button
              onClick={() => (state === "confirm" ? send() : setState("confirm"))}
              disabled={!text.trim() || !count || state === "sending"}
              className="mt-4 w-full h-12 rounded-xl bg-[var(--accent-color)] text-[var(--accent-fg)] font-semibold disabled:opacity-40 transition-opacity"
            >
              {state === "sending" ? t("messages.bc_sending") : state === "confirm" ? t("messages.bc_confirm", { n: count ?? 0 }) : t("messages.bc_send")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

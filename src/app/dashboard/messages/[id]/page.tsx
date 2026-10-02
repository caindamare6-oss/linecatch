"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader, EmptyState } from "../../ui";
import { PageSkeleton } from "@/components/ui/skeleton";
import { formatPhone, phoneFromPathId, clientPathId } from "@/lib/clients";
import { templateLabel, type SmsRow } from "@/lib/conversations";

type Thread = { phone: string; name: string | null; messages: SmsRow[]; canText: boolean; cantTextReason: string | null };

function stamp(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function ThreadPage() {
  const { id } = useParams<{ id: string }>();
  const phone = phoneFromPathId(id);
  const [thread, setThread] = useState<Thread | null>(null);
  const [error, setError] = useState(phone ? "" : "That conversation doesn't exist.");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!phone) return;
    const res = await fetch(`/api/messages?phone=${encodeURIComponent(phone)}`);
    if (!res.ok) {
      setError("Couldn't load this conversation.");
      return;
    }
    setThread(await res.json());
  }, [phone]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount; state is set after the request resolves
    load();
  }, [load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [thread?.messages.length]);

  async function send() {
    if (!phone || !draft.trim()) return;
    setSending(true);
    setSendError("");
    const res = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, body: draft }) });
    const d = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) {
      setSendError(d.error || "Text didn't send.");
      return;
    }
    setDraft("");
    load();
  }

  if (error) {
    return (
      <>
        <PageHeader title="Messages" back="/dashboard/messages" />
        <EmptyState title={error} />
      </>
    );
  }
  if (!thread) return <PageSkeleton />;

  return (
    <div className="flex flex-col min-h-[calc(100vh-140px)]">
      <PageHeader
        title={thread.name || formatPhone(thread.phone)}
        sub={thread.name ? formatPhone(thread.phone) : undefined}
        back="/dashboard/messages"
        right={
          <Link href={`/dashboard/clients/${clientPathId(thread.phone)}`} className="text-[13px] text-[var(--accent-color)] font-medium shrink-0">
            Profile
          </Link>
        }
      />

      <div className="flex-1 space-y-2.5">
        {thread.messages.length === 0 && <p className="text-center text-[13px] text-white/35 py-10">No texts with this client yet.</p>}
        {thread.messages.map((m) => {
          const out = m.direction === "outbound";
          const label = out ? templateLabel(m.template_key) : null;
          return (
            <div key={m.id} className={`flex flex-col ${out ? "items-end" : "items-start"}`}>
              {label && <span className="text-[10px] uppercase tracking-[0.5px] font-semibold text-white/30 mb-1 px-1">{label}</span>}
              <div
                className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-[14px] leading-snug whitespace-pre-wrap break-words ${
                  out ? "bg-[var(--accent-color)]/[0.14] text-white/90 rounded-br-md" : "bg-[#1B1A18] border border-white/[0.07] rounded-bl-md"
                } ${m.status === "failed" ? "opacity-50" : ""}`}
              >
                {m.body}
              </div>
              <span className="text-[10px] text-white/25 mt-1 px-1">
                {stamp(m.created_at)}
                {m.status === "failed" && " · didn't send"}
              </span>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] mt-4 pt-3 bg-[#121110]">
        {thread.canText ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-end gap-2"
          >
            <label htmlFor="reply" className="sr-only">Reply</label>
            <textarea
              id="reply"
              rows={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 320))}
              placeholder="Text from your LineCatch number"
              className="flex-1 max-h-32 rounded-xl bg-white/[0.05] border border-white/[0.1] px-3.5 py-3 text-[15px] placeholder-white/25 outline-none focus:border-[var(--accent-color)]/50 resize-none"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              aria-label="Send"
              className="w-12 h-12 shrink-0 rounded-xl bg-[var(--accent-color)] text-[var(--accent-fg)] flex items-center justify-center disabled:opacity-40"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
            </button>
          </form>
        ) : (
          <p className="text-[12px] text-white/40 text-center px-4 py-2">{thread.cantTextReason}</p>
        )}
        {sendError && <p className="text-[12px] text-[#F08A8A] mt-2">{sendError}</p>}
      </div>
    </div>
  );
}

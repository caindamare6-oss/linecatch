"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PhoneIcon, MegaphoneIcon, MessageIcon } from "../icons";

type TwilioMessage = {
  sid: string;
  from: string;
  to: string;
  body: string;
  status: string;
  direction: string;
  dateSent: string;
};

type Conversation = {
  phone: string;
  messages: TwilioMessage[];
  lastTimestamp: string;
  outbound: number;
  inbound: number;
};

export default function MessagesPage() {
  const [messages, setMessages] = useState<TwilioMessage[]>([]);
  const [barberPhone, setBarberPhone] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"conversations" | "broadcast">("conversations");
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastSent, setBroadcastSent] = useState(false);
  const [recipientCount, setRecipientCount] = useState(0);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: barber } = await supabase
        .from("users")
        .select("phone_number")
        .eq("user_id", user.id)
        .single();

      if (barber?.phone_number) {
        setBarberPhone(barber.phone_number);
      }

      try {
        const res = await fetch("/api/messages");
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
        }
      } catch {
        // silent
      }

      // Get broadcast recipient count (VIP + missed calls)
      const { count: vipCount } = await supabase
        .from("vip_clients")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_opted_in", true)
        .is("opted_out_at", null);

      setRecipientCount(vipCount || 0);
      setLoading(false);
    }
    load();
  }, []);

  function formatPhone(phone: string) {
    if (phone.length === 12 && phone.startsWith("+1")) {
      const n = phone.slice(2);
      return `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`;
    }
    return phone;
  }

  function formatDate(ts: string) {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    } else if (days === 1) {
      return "Yesterday";
    } else if (days < 7) {
      return d.toLocaleDateString("en-US", { weekday: "short" });
    }
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function formatFullDate(ts: string) {
    const d = new Date(ts);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }) + " · " + d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getMessageLabel(body: string, direction: string): string {
    if (direction.startsWith("inbound")) {
      const lower = body.trim().toLowerCase();
      if (["stop", "unsubscribe", "cancel", "end", "quit"].includes(lower)) return "Opt-out";
      if (["start", "unstop"].includes(lower)) return "Re-subscribe";
      if (lower === "late") return "Late broadcast";
      if (["en", "es", "pt", "english", "spanish", "portuguese"].includes(lower)) return "Language change";
      return "Client reply";
    }
    const lower = body.toLowerCase();
    if (lower.includes("missed your call")) return "Auto-text";
    if (lower.includes("loyalty") || lower.includes("$5 off") || lower.includes("discount")) return "Loyalty";
    if (lower.includes("review") && lower.includes("google")) return "Review request";
    if (lower.includes("reminder")) return "Reminder";
    if (lower.includes("rescheduled") || lower.includes("new time")) return "Reschedule";
    if (lower.includes("cancelled") || lower.includes("canceled")) return "Cancellation";
    if (lower.includes("running late") || lower.includes("running behind")) return "Late notice";
    if (lower.includes("booked") || lower.includes("confirmed")) return "Booking confirmed";
    return "Outbound";
  }

  function getLabelColor(label: string): string {
    switch (label) {
      case "Auto-text": return "text-[var(--accent-color)] bg-[color-mix(in_srgb,var(--accent-color)_10%,transparent)]";
      case "Loyalty": return "text-yellow-400 bg-yellow-400/10";
      case "Review request": return "text-blue-400 bg-blue-400/10";
      case "Reminder": return "text-purple-400 bg-purple-400/10";
      case "Booking confirmed": return "text-[var(--accent-color)] bg-[color-mix(in_srgb,var(--accent-color)_10%,transparent)]";
      case "Reschedule": return "text-orange-400 bg-orange-400/10";
      case "Cancellation": return "text-red-400 bg-red-400/10";
      case "Late notice": return "text-orange-400 bg-orange-400/10";
      case "Opt-out": return "text-red-400 bg-red-400/10";
      case "Re-subscribe": return "text-[var(--accent-color)] bg-[color-mix(in_srgb,var(--accent-color)_10%,transparent)]";
      case "Late broadcast": return "text-orange-400 bg-orange-400/10";
      case "Language change": return "text-blue-400 bg-blue-400/10";
      case "Client reply": return "text-white/50 bg-white/[0.06]";
      default: return "text-white/40 bg-white/[0.04]";
    }
  }

  // Group messages into conversations by client phone
  const conversations: Conversation[] = [];
  const phoneMap = new Map<string, TwilioMessage[]>();

  for (const msg of messages) {
    const clientPhone = msg.from === barberPhone ? msg.to : msg.from;
    if (clientPhone === barberPhone) continue;
    const existing = phoneMap.get(clientPhone);
    if (existing) {
      existing.push(msg);
    } else {
      phoneMap.set(clientPhone, [msg]);
    }
  }

  for (const [phone, phoneMsgs] of phoneMap) {
    phoneMsgs.sort(
      (a, b) => new Date(b.dateSent).getTime() - new Date(a.dateSent).getTime()
    );
    conversations.push({
      phone,
      messages: phoneMsgs,
      lastTimestamp: phoneMsgs[0].dateSent,
      outbound: phoneMsgs.filter((m) => m.from === barberPhone).length,
      inbound: phoneMsgs.filter((m) => m.to === barberPhone).length,
    });
  }

  conversations.sort(
    (a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime()
  );

  const selectedConvo = selectedPhone
    ? conversations.find((c) => c.phone === selectedPhone)
    : null;

  async function handleBroadcast() {
    if (!broadcastMessage.trim()) return;
    setBroadcastSending(true);

    try {
      const res = await fetch("/api/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: broadcastMessage }),
      });
      if (res.ok) {
        setBroadcastSent(true);
        setBroadcastMessage("");
        setTimeout(() => setBroadcastSent(false), 3000);
      }
    } catch {
      // silently fail for now
    } finally {
      setBroadcastSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'color-mix(in srgb, var(--accent-color) 30%, transparent)', borderTopColor: 'var(--accent-color)' }} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toggle: Conversations / Broadcast */}
      <div className="flex gap-2">
        <button
          onClick={() => { setView("conversations"); setSelectedPhone(null); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${
            view === "conversations"
              ? "bg-[var(--accent-color)] text-[#0d0d0d]"
              : "bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-white/60 hover:bg-white/[0.06]"
          }`}
        >
          <MessageIcon className={view === "conversations" ? "text-[#0d0d0d]" : ""} />
          Conversations
        </button>
        <button
          onClick={() => { setView("broadcast"); setSelectedPhone(null); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${
            view === "broadcast"
              ? "bg-[var(--accent-color)] text-[#0d0d0d]"
              : "bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-white/60 hover:bg-white/[0.06]"
          }`}
        >
          <MegaphoneIcon className={view === "broadcast" ? "text-[#0d0d0d]" : ""} />
          Broadcast
        </button>
      </div>

      {/* Conversations View */}
      {view === "conversations" && !selectedPhone && (
        <div className="space-y-2">
          {conversations.length === 0 ? (
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-8 text-center">
              <MessageIcon className="w-8 h-8 text-white/10 mx-auto mb-3" />
              <p className="text-sm text-white/20">
                No messages yet. Automated texts will appear here.
              </p>
            </div>
          ) : (
            conversations.map((convo) => {
              const lastMsg = convo.messages[0];
              const isOutbound = lastMsg.from === barberPhone;
              const label = getMessageLabel(lastMsg.body, lastMsg.direction);
              const preview = lastMsg.body.length > 60
                ? lastMsg.body.slice(0, 60) + "..."
                : lastMsg.body;

              return (
                <button
                  key={convo.phone}
                  onClick={() => setSelectedPhone(convo.phone)}
                  className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 flex items-center gap-3 hover:bg-white/[0.07] transition-all duration-200 text-left group"
                >
                  <div className="w-10 h-10 rounded-full bg-white/[0.06] flex items-center justify-center shrink-0">
                    <PhoneIcon className="text-white/30" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">
                        {formatPhone(convo.phone)}
                      </p>
                      <span className="text-[11px] text-white/20">
                        {formatDate(convo.lastTimestamp)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${getLabelColor(label)}`}>
                        {label}
                      </span>
                      <span className="text-xs text-white/20 truncate">
                        {isOutbound ? "" : "← "}{preview}
                      </span>
                    </div>
                    <p className="text-[11px] text-white/15 mt-0.5">
                      {convo.messages.length} message{convo.messages.length !== 1 ? "s" : ""}
                      {convo.inbound > 0 && ` · ${convo.inbound} inbound`}
                    </p>
                  </div>
                  <svg className="w-4 h-4 text-white/10 group-hover:text-white/30 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              );
            })
          )}
        </div>
      )}

      {/* Single Conversation Detail */}
      {view === "conversations" && selectedConvo && (
        <div className="space-y-3">
          <button
            onClick={() => setSelectedPhone(null)}
            className="flex items-center gap-2 text-white/40 hover:text-white/60 transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back
          </button>

          <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/[0.06]">
              <div className="w-10 h-10 rounded-full bg-white/[0.06] flex items-center justify-center">
                <PhoneIcon className="text-white/30" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white/90">{formatPhone(selectedConvo.phone)}</p>
                <p className="text-xs text-white/25">
                  {selectedConvo.messages.length} message{selectedConvo.messages.length !== 1 ? "s" : ""}
                  {selectedConvo.inbound > 0 && ` · ${selectedConvo.inbound} inbound`}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {[...selectedConvo.messages].reverse().map((msg) => {
                const isOutbound = msg.from === barberPhone;
                const label = getMessageLabel(msg.body, msg.direction);

                return (
                  <div
                    key={msg.sid}
                    className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 border ${
                        isOutbound ? "" : "bg-white/[0.06] border-white/[0.08]"
                      }`}
                      style={isOutbound ? { backgroundColor: 'color-mix(in srgb, var(--accent-color) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--accent-color) 20%, transparent)' } : undefined}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${getLabelColor(label)}`}>
                          {label}
                        </span>
                        {msg.status === "delivered" && (
                          <span className="text-[9px]" style={{ color: 'color-mix(in srgb, var(--accent-color) 50%, transparent)' }}>✓ Delivered</span>
                        )}
                        {msg.status === "failed" && (
                          <span className="text-[9px] text-red-400/70">✗ Failed</span>
                        )}
                        {msg.status === "undelivered" && (
                          <span className="text-[9px] text-red-400/70">✗ Undelivered</span>
                        )}
                      </div>
                      <p className={`text-sm ${isOutbound ? "text-white/80" : "text-white/60"}`}>
                        {msg.body}
                      </p>
                      <p className="text-[10px] text-white/20 mt-1.5">
                        {formatFullDate(msg.dateSent)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Broadcast View */}
      {view === "broadcast" && (
        <div className="space-y-3">
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <MegaphoneIcon className="text-white/30" />
              <h3 className="text-sm font-medium text-white/60">Mass message</h3>
            </div>
            <p className="text-xs text-white/25 mb-4">
              Send a text to all your opted-in clients. Includes VIP members and missed-call contacts.
            </p>

            <textarea
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              placeholder="e.g. Hey! I have openings this Saturday. Book now: ..."
              rows={4}
              maxLength={320}
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl p-3 text-sm text-white/80 placeholder:text-white/15 resize-none focus:outline-none focus:border-[var(--accent-color)] transition-colors"
            />

            <div className="flex items-center justify-between mt-3">
              <span className="text-[11px] text-white/15">
                {broadcastMessage.length}/320 · {recipientCount} recipient{recipientCount !== 1 ? "s" : ""}
              </span>
              <button
                onClick={handleBroadcast}
                disabled={!broadcastMessage.trim() || broadcastSending || recipientCount === 0}
                className="bg-[var(--accent-color)] text-[#0d0d0d] text-sm font-semibold px-4 py-2 rounded-lg hover:brightness-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
              >
                {broadcastSending ? "Sending..." : broadcastSent ? "Sent!" : "Send to all"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

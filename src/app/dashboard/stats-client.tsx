"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PhoneIcon, CursorArrowRaysIcon } from "./icons";

type Call = {
  call_id: string;
  caller_phone: string;
  status: string;
  timestamp: string;
};

type Click = {
  click_id: string;
  call_id: string;
  clicked_at: string;
};

type DrillDown = "roi" | "clients" | null;

type SuppressedCall = {
  id: string;
  from_number: string;
  received_at: string;
  suppressed_reason: string | null;
};

type FeedEvent = {
  id: string;
  event_type: string;
  client_name: string | null;
  description: string;
  created_at: string;
};

const EVENT_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  qr_scan: { icon: "qr", color: "var(--accent-color)", label: "VIP Sign-up" },
  booking_created: { icon: "calendar", color: "var(--accent-color)", label: "New Booking" },
  booking_completed: { icon: "check", color: "var(--accent-color)", label: "Cut Completed" },
  loyalty_claimed: { icon: "gift", color: "#FBBF24", label: "Loyalty Reward" },
  review_sent: { icon: "star", color: "#FBBF24", label: "Review Request" },
  missed_call_caught: { icon: "phone", color: "var(--accent-color)", label: "Call Caught" },
  cron_reengagement: { icon: "bolt", color: "#FBBF24", label: "Re-engagement" },
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function StatsClient({
  calls,
  clicks,
  avgBookingValue,
  previousCallers,
  totalClients,
  allClientPhones,
  contactNames: initialContactNames,
  vipStatus = {},
  suppressedCalls = [],
  wednesdayTargeted,
  timezone,
  loyaltyActiveClients,
  callsSavedThisWeek,
  googleReviewUrl,
  monthlyRevenue,
  monthlyCompleted,
  midWeekCutsFilled,
  loyaltyClaims,
  activityFeed: initialFeed,
}: {
  calls: Call[];
  clicks: Click[];
  avgBookingValue: number;
  previousCallers: string[];
  totalClients: number;
  allClientPhones: string[];
  contactNames: Record<string, string>;
  vipStatus?: Record<string, boolean>;
  suppressedCalls?: SuppressedCall[];
  wednesdayTargeted: number;
  timezone: string;
  loyaltyActiveClients: number;
  callsSavedThisWeek: number;
  googleReviewUrl: string | null;
  monthlyRevenue: number;
  monthlyCompleted: number;
  midWeekCutsFilled: number;
  loyaltyClaims: number;
  activityFeed: FeedEvent[];
}) {
  const router = useRouter();
  const [drillDown, setDrillDown] = useState<DrillDown>(null);
  const [contactNames, setContactNames] = useState<Record<string, string>>(initialContactNames);
  const [editingPhone, setEditingPhone] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [addingClient, setAddingClient] = useState(false);
  const [clientPhones, setClientPhones] = useState(allClientPhones);

  // Activity feed state
  const [feedEvents, setFeedEvents] = useState<FeedEvent[]>(initialFeed);
  const [feedCursor, setFeedCursor] = useState<string | null>(
    initialFeed.length >= 20 ? initialFeed[initialFeed.length - 1].created_at : null
  );
  const [loadingMore, setLoadingMore] = useState(false);

  const previousSet = new Set(previousCallers);

  const weekPhones = new Set(calls.map((c) => c.caller_phone));
  const newCallerCount = [...weekPhones].filter((p) => !previousSet.has(p)).length;

  const callCountByPhone: Record<string, number> = {};
  for (const call of calls) {
    callCountByPhone[call.caller_phone] = (callCountByPhone[call.caller_phone] || 0) + 1;
  }

  function formatPhone(phone: string) {
    if (phone.length === 12 && phone.startsWith("+1")) {
      const n = phone.slice(2);
      return `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`;
    }
    return phone;
  }

  function formatTime(ts: string) {
    return new Date(ts).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  async function saveContactName(phone: string) {
    setSavingName(true);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caller_phone: phone, name: editName.trim() || null }),
      });
      if (res.ok) {
        if (editName.trim()) {
          setContactNames((prev) => ({ ...prev, [phone]: editName.trim() }));
        } else {
          setContactNames((prev) => {
            const copy = { ...prev };
            delete copy[phone];
            return copy;
          });
        }
      }
    } catch {}
    setSavingName(false);
    setEditingPhone(null);
    setEditName("");
  }

  async function addClient() {
    const phone = newClientPhone.replace(/\D/g, "");
    if (phone.length < 10) return;
    const formatted = phone.length === 10 ? `+1${phone}` : `+${phone}`;
    if (clientPhones.includes(formatted)) {
      setShowAddClient(false);
      setNewClientPhone("");
      setNewClientName("");
      return;
    }
    setAddingClient(true);
    try {
      const res = await fetch("/api/clients/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formatted, name: newClientName.trim() || null }),
      });
      if (res.ok) {
        setClientPhones((prev) => [formatted, ...prev]);
        if (newClientName.trim()) {
          setContactNames((prev) => ({ ...prev, [formatted]: newClientName.trim() }));
        }
      }
    } catch {}
    setAddingClient(false);
    setShowAddClient(false);
    setNewClientPhone("");
    setNewClientName("");
  }

  const loadMoreFeed = useCallback(async () => {
    if (!feedCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/activity?cursor=${encodeURIComponent(feedCursor)}`);
      const data = await res.json();
      if (data.items?.length > 0) {
        setFeedEvents((prev) => [...prev, ...data.items]);
        setFeedCursor(data.nextCursor);
      } else {
        setFeedCursor(null);
      }
    } catch {}
    setLoadingMore(false);
  }, [feedCursor, loadingMore]);

  function EventIcon({ type }: { type: string }) {
    const config = EVENT_CONFIG[type];
    const color = config?.color || "#ffffff";
    const icon = config?.icon || "circle";

    return (
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: `color-mix(in srgb, ${color} 8%, transparent)` }}
      >
        {icon === "qr" && (
          <svg className="w-4 h-4" style={{ color }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
          </svg>
        )}
        {icon === "calendar" && (
          <svg className="w-4 h-4" style={{ color }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
        )}
        {icon === "check" && (
          <svg className="w-4 h-4" style={{ color }} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        )}
        {icon === "gift" && (
          <svg className="w-4 h-4" style={{ color }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
          </svg>
        )}
        {icon === "star" && (
          <svg className="w-4 h-4" style={{ color }} fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        )}
        {icon === "phone" && (
          <PhoneIcon className="w-4 h-4" style={{ color }} />
        )}
        {icon === "bolt" && (
          <svg className="w-4 h-4" style={{ color }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
          </svg>
        )}
        {icon === "circle" && (
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        )}
      </div>
    );
  }

  if (drillDown) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => { setDrillDown(null); setEditingPhone(null); }}
          className="flex items-center gap-2 text-white/40 hover:text-white/60 transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to dashboard
        </button>

        {drillDown === "roi" && (
          <div className="space-y-3">
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5">
              <h3 className="text-xs text-white/40 uppercase tracking-wider font-medium mb-1">Monthly Breakdown</h3>
              <p className="text-3xl font-bold text-[var(--accent-color)] tracking-tight">${monthlyRevenue.toFixed(0)}</p>
              <p className="text-xs text-white/25 mt-0.5">{monthlyCompleted} completed cut{monthlyCompleted !== 1 ? "s" : ""} &times; ${avgBookingValue}/avg</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
                <p className="text-2xl font-bold text-white">{midWeekCutsFilled}</p>
                <p className="text-[11px] text-white/25">Mid-Week Cuts Filled</p>
              </div>
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
                <p className="text-2xl font-bold text-white">{loyaltyClaims}</p>
                <p className="text-[11px] text-white/25">Loyalty Claims</p>
              </div>
            </div>
          </div>
        )}

        {drillDown === "clients" && (
          <div className="space-y-3">
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5">
              <h3 className="text-xs text-white/40 uppercase tracking-wider font-medium mb-1">Your Clients</h3>
              <p className="text-3xl font-bold text-white tracking-tight">{totalClients}</p>
              <p className="text-xs text-white/25 mt-0.5">
                {newCallerCount} new this week &middot; {Object.keys(contactNames).length} named
              </p>
            </div>

            <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs text-white/30 uppercase tracking-wider font-medium">
                  All clients ({clientPhones.length})
                </h3>
                <button
                  onClick={() => setShowAddClient(!showAddClient)}
                  className="flex items-center gap-1 text-[11px] text-[var(--accent-color)] hover:text-[var(--accent-color)] transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Add client
                </button>
              </div>

              {showAddClient && (
                <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-3 mb-4 space-y-2">
                  <input
                    type="tel"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    placeholder="Phone number..."
                    autoFocus
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/15 focus:outline-none focus:border-[color-mix(in_srgb,var(--accent-color)_30%,transparent)] transition-colors"
                  />
                  <input
                    type="text"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    placeholder="Name (optional)..."
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/15 focus:outline-none focus:border-[color-mix(in_srgb,var(--accent-color)_30%,transparent)] transition-colors"
                    onKeyDown={(e) => { if (e.key === "Enter") addClient(); }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={addClient}
                      disabled={addingClient || newClientPhone.replace(/\D/g, "").length < 10}
                      className="flex-1 bg-[var(--accent-color)] text-[#0d0d0d] text-xs font-semibold px-3 py-2 rounded-lg hover:bg-[var(--accent-color)] disabled:opacity-30 transition-colors"
                    >
                      {addingClient ? "Adding..." : "Add"}
                    </button>
                    <button
                      onClick={() => { setShowAddClient(false); setNewClientPhone(""); setNewClientName(""); }}
                      className="px-3 py-2 text-xs text-white/30 hover:text-white/60 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <p className="text-[11px] text-white/15 mb-4">Tap a contact to add or edit their name</p>

              <div className="space-y-1">
                {clientPhones.map((phone) => {
                  const isEditing = editingPhone === phone;
                  const name = contactNames[phone];
                  const isNew = !previousSet.has(phone);
                  const weekCallCount = callCountByPhone[phone] || 0;
                  const isVip = phone in vipStatus;
                  const isOptedIn = vipStatus[phone] === true;

                  return (
                    <div key={phone}>
                      <button
                        onClick={() => {
                          if (isEditing) {
                            setEditingPhone(null);
                            setEditName("");
                          } else {
                            setEditingPhone(phone);
                            setEditName(name || "");
                          }
                        }}
                        className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.03] transition-colors text-left"
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            name ? "" : "bg-white/[0.04]"
                          }`}
                          style={name ? { backgroundColor: 'color-mix(in srgb, var(--accent-color) 10%, transparent)' } : undefined}
                        >
                          {name ? (
                            <span className="text-xs font-bold" style={{ color: 'color-mix(in srgb, var(--accent-color) 70%, transparent)' }}>{name.charAt(0).toUpperCase()}</span>
                          ) : (
                            <PhoneIcon className="w-3.5 h-3.5 text-white/20" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-white/70 truncate">
                              {name || formatPhone(phone)}
                            </p>
                            {isNew && (
                              <span className="text-[9px] text-[var(--accent-color)] px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: 'color-mix(in srgb, var(--accent-color) 10%, transparent)' }}>NEW</span>
                            )}
                            {isVip && isOptedIn && (
                              <span className="text-[9px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-full shrink-0">VIP</span>
                            )}
                            {isVip && !isOptedIn && (
                              <span className="text-[9px] text-white/30 bg-white/[0.06] px-1.5 py-0.5 rounded-full shrink-0">Not Opted In</span>
                            )}
                          </div>
                          <p className="text-[11px] text-white/20">
                            {name ? formatPhone(phone) + " · " : ""}
                            {weekCallCount > 0 ? `${weekCallCount} call${weekCallCount !== 1 ? "s" : ""} this week` : "No calls this week"}
                          </p>
                        </div>
                      </button>

                      {isEditing && (
                        <div className="flex items-center gap-2 px-2.5 pb-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="Client name..."
                            autoFocus
                            className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/15 focus:outline-none focus:border-[color-mix(in_srgb,var(--accent-color)_30%,transparent)] transition-colors"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveContactName(phone);
                              if (e.key === "Escape") { setEditingPhone(null); setEditName(""); }
                            }}
                          />
                          <button
                            onClick={() => saveContactName(phone)}
                            disabled={savingName}
                            className="bg-[var(--accent-color)] text-[#0d0d0d] text-xs font-semibold px-3 py-2 rounded-lg hover:bg-[var(--accent-color)] disabled:opacity-30 transition-colors shrink-0"
                          >
                            {savingName ? "..." : "Save"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const monthName = new Date().toLocaleDateString("en-US", { month: "long" });

  return (
    <div className="space-y-4">
      {/* Monthly Revenue Hero */}
      <button
        onClick={() => setDrillDown("roi")}
        className="w-full text-left bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5 hover:bg-white/[0.06] hover:border-white/[0.1] transition-all duration-200 group"
      >
        <div className="flex items-center justify-between">
          <p className="text-xs text-white/40 uppercase tracking-wider font-medium">Recovered Revenue &middot; {monthName}</p>
          <svg className="w-4 h-4 text-white/10 group-hover:text-white/30 transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </div>
        <p className="text-4xl font-bold text-[var(--accent-color)] tracking-tight mt-1">
          ${monthlyRevenue.toFixed(0)}
        </p>
        <p className="text-xs text-white/30 mt-1">
          {monthlyCompleted} completed &middot; ${avgBookingValue}/avg
        </p>
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-yellow-400/60" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
            <span className="text-xs text-white/40">{midWeekCutsFilled} Mid-Week Cut{midWeekCutsFilled !== 1 ? "s" : ""} Filled</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" style={{ color: 'color-mix(in srgb, var(--accent-color) 60%, transparent)' }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
            <span className="text-xs text-white/40">{loyaltyClaims} Loyalty Claim{loyaltyClaims !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </button>

      {/* Feature Status Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Wednesday Engine */}
        <div className="text-left bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-yellow-400/60" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
            <span className="text-[11px] text-white/30 uppercase tracking-wider">Wed Engine</span>
          </div>
          <p className="text-sm font-semibold text-white/70 mt-1">
            Next: Wed @ 12:30 PM
          </p>
          <p className="text-[11px] text-white/25 mt-0.5">
            {wednesdayTargeted > 0
              ? `${wednesdayTargeted} client${wednesdayTargeted !== 1 ? "s" : ""} targeted`
              : "No clients due yet"}
          </p>
        </div>

        {/* VIPs */}
        <button
          onClick={() => setDrillDown("clients")}
          className="text-left bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 hover:bg-white/[0.06] hover:border-white/[0.1] transition-all duration-200 group"
        >
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4" style={{ color: 'color-mix(in srgb, var(--accent-color) 60%, transparent)' }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.848 8.25l1.536.887M7.848 8.25a3 3 0 11-5.196-3 3 3 0 015.196 3zm1.536.887a2.165 2.165 0 011.083 1.839c.005.351.054.695.14 1.024M9.384 9.137l2.077 1.199M7.848 15.75l1.536-.887m-1.536.887a3 3 0 11-5.196 3 3 3 0 015.196-3zm1.536-.887a2.165 2.165 0 001.083-1.838c.005-.352.054-.696.14-1.025m-1.223 2.863l2.077-1.199m0-3.328a4.323 4.323 0 012.068-1.379l5.325-1.628a4.5 4.5 0 012.48-.044l.803.215-7.794 4.5m-2.882-1.664A4.331 4.331 0 0010.607 12m3.736 0l7.794 4.5-.803.215a4.5 4.5 0 01-2.48-.043l-5.326-1.629a4.324 4.324 0 01-2.068-1.379M14.343 12l-2.882 1.664" />
            </svg>
            <span className="text-[11px] text-white/30 uppercase tracking-wider">VIPs</span>
          </div>
          <p className="text-2xl font-bold text-white">{loyaltyActiveClients}</p>
          <p className="text-[11px] text-white/25 mt-0.5">
            {loyaltyActiveClients === 1 ? "VIP client" : "VIP clients"} &middot; every 3rd = $5 off
          </p>
        </button>

        {/* Missed Call Auto-Respond */}
        <div className="text-left bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <PhoneIcon className="" style={{ color: 'color-mix(in srgb, var(--accent-color) 60%, transparent)' }} />
            <span className="text-[11px] text-white/30 uppercase tracking-wider">Auto-text</span>
          </div>
          <p className="text-2xl font-bold text-white">{callsSavedThisWeek}</p>
          <p className="text-[11px] text-white/25 mt-0.5">
            call{callsSavedThisWeek !== 1 ? "s" : ""} saved this week
          </p>
        </div>

        {/* Google Reviews */}
        {googleReviewUrl ? (
          <div className="text-left bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-yellow-400/60" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <span className="text-[11px] text-white/30 uppercase tracking-wider">Reviews</span>
            </div>
            <p className="text-sm font-semibold text-[var(--accent-color)] mt-1">Active</p>
            <p className="text-[11px] text-white/25 mt-0.5">
              Sent at 2nd visit
            </p>
          </div>
        ) : (
          <button
            onClick={() => router.push("/dashboard/settings#google-reviews")}
            className="text-left bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 hover:bg-white/[0.06] hover:border-white/[0.1] transition-all duration-200 group"
          >
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-white/20" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <span className="text-[11px] text-white/30 uppercase tracking-wider">Reviews</span>
            </div>
            <p className="text-sm font-semibold text-white/40 mt-1">Not set up</p>
            <p className="text-[11px] text-[color-mix(in_srgb,var(--accent-color)_60%,transparent)] mt-0.5 group-hover:text-[var(--accent-color)]">
              Set up Google Reviews &rarr;
            </p>
          </button>
        )}
      </div>

      {/* Suppressed Calls */}
      {suppressedCalls.length > 0 && (
        <div className="bg-yellow-950/20 border border-yellow-800/20 rounded-2xl p-5">
          <h3 className="text-xs text-yellow-400/60 uppercase tracking-wider font-medium mb-3">
            Missed calls without consent ({suppressedCalls.length})
          </h3>
          <p className="text-[11px] text-white/25 mb-3">
            These callers aren&apos;t on your VIP list yet — ask them to scan your QR sticker.
          </p>
          <div className="space-y-2">
            {suppressedCalls.slice(0, 5).map((call) => (
              <div key={call.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PhoneIcon className="text-yellow-400/40" />
                  <span className="text-sm text-white/50">{formatPhone(call.from_number)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-yellow-400/50 bg-yellow-400/5 px-1.5 py-0.5 rounded-full">
                    {call.suppressed_reason === "no_consent" ? "no consent" :
                     call.suppressed_reason === "opted_out" ? "opted out" :
                     call.suppressed_reason === "trial_locked" ? "trial ended" :
                     call.suppressed_reason || "suppressed"}
                  </span>
                  <span className="text-[11px] text-white/20">{formatTime(call.received_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity Feed */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5">
        <h3 className="text-xs text-white/40 uppercase tracking-wider font-medium mb-4">
          Recent activity
        </h3>

        {feedEvents.length === 0 ? (
          <p className="text-sm text-white/20 py-6 text-center">
            No activity yet. Events will appear here as your automations run.
          </p>
        ) : (
          <div className="space-y-3">
            {feedEvents.map((event) => {
              const config = EVENT_CONFIG[event.event_type];
              return (
                <div key={event.id} className="flex items-start gap-3">
                  <EventIcon type={event.event_type} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white/80 truncate">
                        {event.client_name || (config?.label || event.event_type)}
                      </p>
                      <span className="text-[11px] text-white/20 shrink-0">{timeAgo(event.created_at)}</span>
                    </div>
                    <p className="text-xs text-white/30 truncate">{event.description}</p>
                  </div>
                  {config && (
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 mt-0.5"
                      style={{
                        color: config.color,
                        backgroundColor: `color-mix(in srgb, ${config.color} 8%, transparent)`,
                      }}
                    >
                      {config.label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {feedCursor && (
          <button
            onClick={loadMoreFeed}
            disabled={loadingMore}
            className="w-full mt-4 py-2 text-xs text-white/30 hover:text-white/50 transition-colors disabled:opacity-30"
          >
            {loadingMore ? "Loading..." : "Load more"}
          </button>
        )}
      </div>
    </div>
  );
}

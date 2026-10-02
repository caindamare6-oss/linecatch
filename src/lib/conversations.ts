export type SmsRow = {
  id: string;
  to_number: string;
  from_number: string | null;
  direction: "outbound" | "inbound";
  template_key: string | null;
  body: string;
  status: string;
  created_at: string;
};

export type Conversation = {
  kind: "client";
  phone: string;
  name: string | null;
  last: SmsRow;
  hasInbound: boolean;
  unreplied: boolean;
};

export type BroadcastGroup = {
  kind: "broadcast";
  id: string;
  body: string;
  sent: number;
  created_at: string;
};

/** The client on the other end of a row. */
export const counterpart = (r: SmsRow) => (r.direction === "inbound" ? r.from_number || "" : r.to_number);

// Texts to the barber themself (morning summary, booking alerts) aren't client conversations.
const BARBER_TEMPLATES = new Set([
  "morning_summary",
  "weekly_report",
  "completion_nudge",
  "barber_cancel_notify",
  "barber_reschedule_notify",
  "barber_booking_notify",
]);

/**
 * Newest-first inbox: one row per client, plus each broadcast collapsed into one row.
 * Broadcast copies (same body, sent within a few minutes) don't each start a thread.
 */
export function buildInbox(rows: SmsRow[], names: Record<string, string>, filter: "all" | "sent" | "received" = "all") {
  const sorted = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const convs = new Map<string, Conversation>();
  const casts: BroadcastGroup[] = [];

  for (const r of sorted) {
    if (r.template_key && BARBER_TEMPLATES.has(r.template_key)) continue;
    if (r.template_key === "broadcast") {
      const t = new Date(r.created_at).getTime();
      const g = casts.find((c) => c.body === r.body && Math.abs(new Date(c.created_at).getTime() - t) < 10 * 60_000);
      if (g) g.sent++;
      else casts.push({ kind: "broadcast", id: r.id, body: r.body, sent: 1, created_at: r.created_at });
      continue;
    }
    const phone = counterpart(r);
    if (!phone) continue;
    const c = convs.get(phone);
    if (!c) {
      convs.set(phone, { kind: "client", phone, name: names[phone] || null, last: r, hasInbound: r.direction === "inbound", unreplied: r.direction === "inbound" });
    } else if (r.direction === "inbound") {
      c.hasInbound = true;
    }
  }

  let list: (Conversation | BroadcastGroup)[] = [...convs.values(), ...casts];
  if (filter === "received") list = list.filter((x) => x.kind === "client" && x.hasInbound);
  if (filter === "sent") list = list.filter((x) => x.kind === "broadcast" || x.last.direction === "outbound");
  return list.sort((a, b) => time(b).localeCompare(time(a)));
}

const time = (x: Conversation | BroadcastGroup) => (x.kind === "client" ? x.last.created_at : x.created_at);

/** i18n key for an automated text's label (shown above its bubble), or null for a plain message. */
export function templateLabel(key: string | null): string | null {
  if (!key || key === "direct" || key === "broadcast") return null;
  if (key.startsWith("winback")) return "msglabel.winback";
  const known = ["missed_call", "after_hours", "booking_confirm", "reminder_24h", "reminder_2h", "rescheduled", "cancelled", "review_request", "loyalty_progress", "loyalty_earned", "wednesday_dropin", "cadence_nudge", "morning_late_broadcast", "auto_reply_inbound"];
  return known.includes(key) ? `msglabel.${key}` : null;
}

/** "2:15 PM" today, "Yesterday", "Mon" this week, then "Sep 3" (in the given language). */
export function listTime(iso: string, yesterday = "Yesterday", tag = "en-US") {
  const d = new Date(iso);
  const now = new Date();
  const days = Math.floor((new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86_400_000);
  if (days === 0) return d.toLocaleTimeString(tag, { hour: "numeric", minute: "2-digit" });
  if (days === 1) return yesterday;
  if (days < 7) return d.toLocaleDateString(tag, { weekday: "short" });
  return d.toLocaleDateString(tag, { month: "short", day: "numeric" });
}

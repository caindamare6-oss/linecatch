import { isRewardCut, nextRewardCut, type Plan } from "@/lib/loyalty-rules";

export type ClientSummary = {
  phone: string;
  name: string | null;
  isVip: boolean;
  optedOut: boolean;
  visits: number;
  spent: number;
  lastVisit: string | null;
  nextBooking: string | null;
  stamps: number;
  rewardDue: boolean;
  cutsToReward: number;
};

export type VipRow = {
  phone_number: string;
  first_name: string | null;
  is_opted_in: boolean;
  opted_out_at: string | null;
  cut_count: number | null;
};

export type BookingRow = {
  customer_phone: string;
  booking_time: string;
  status: string;
  service_id: string;
};

/**
 * One row per person the barber knows: VIP list, saved contacts, and anyone who booked.
 * Visits and spend come from completed bookings at the service's current price.
 */
export function summarizeClients(input: {
  vips: VipRow[];
  contacts: { caller_phone: string; name: string | null }[];
  bookings: BookingRow[];
  prices: Record<string, number>;
  optOuts: string[];
  plan: Plan;
  now?: Date;
}): ClientSummary[] {
  const now = (input.now ?? new Date()).getTime();
  const byPhone = new Map<string, ClientSummary>();
  const get = (phone: string) => {
    let c = byPhone.get(phone);
    if (!c) {
      c = { phone, name: null, isVip: false, optedOut: false, visits: 0, spent: 0, lastVisit: null, nextBooking: null, stamps: 0, rewardDue: false, cutsToReward: 0 };
      byPhone.set(phone, c);
    }
    return c;
  };

  for (const v of input.vips) {
    const c = get(v.phone_number);
    c.name = v.first_name?.trim() || null;
    c.isVip = v.is_opted_in && !v.opted_out_at;
    c.optedOut = !!v.opted_out_at;
    c.stamps = v.cut_count ?? 0;
  }
  for (const p of input.optOuts) {
    const c = get(p);
    c.optedOut = true;
    c.isVip = false;
  }
  // A name the barber typed beats the one the client gave.
  for (const ct of input.contacts) {
    const c = get(ct.caller_phone); // a number saved without a name still belongs on the list
    if (ct.name?.trim()) c.name = ct.name.trim();
  }
  for (const b of input.bookings) {
    const c = get(b.customer_phone);
    const t = new Date(b.booking_time).getTime();
    if (b.status === "completed") {
      c.visits++;
      c.spent += input.prices[b.service_id] ?? 0;
      if (!c.lastVisit || t > new Date(c.lastVisit).getTime()) c.lastVisit = b.booking_time;
    } else if (b.status === "confirmed" && t > now - 60 * 60 * 1000) {
      if (!c.nextBooking || t < new Date(c.nextBooking).getTime()) c.nextBooking = b.booking_time;
    }
  }
  for (const c of byPhone.values()) {
    c.rewardDue = isRewardCut(c.stamps + 1, input.plan);
    c.cutsToReward = nextRewardCut(c.stamps, input.plan) - c.stamps;
  }

  return [...byPhone.values()].sort((a, b) => {
    // Upcoming first (soonest), then most recent visit, then name.
    if (a.nextBooking && b.nextBooking) return a.nextBooking.localeCompare(b.nextBooking);
    if (a.nextBooking) return -1;
    if (b.nextBooking) return 1;
    if (a.lastVisit && b.lastVisit) return b.lastVisit.localeCompare(a.lastVisit);
    if (a.lastVisit) return -1;
    if (b.lastVisit) return 1;
    return (a.name || "~").localeCompare(b.name || "~");
  });
}

export function formatPhone(phone: string): string {
  if (phone.length === 12 && phone.startsWith("+1")) {
    const n = phone.slice(2);
    return `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`;
  }
  return phone;
}

/** "3d", "2w", "4mo": compact age for list rows. Pass `t` to get it in the app's language. */
export function shortAgo(iso: string | null, now = new Date(), t?: (k: string, v?: Record<string, number>) => string): string {
  if (!iso) return "";
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  const out = (unit: "today" | "d" | "w" | "mo", n = 0) => (t ? t(`ago.${unit}`, { n }) : unit === "today" ? "today" : `${n}${unit}`);
  if (days < 1) return out("today");
  if (days < 7) return out("d", days);
  if (days < 60) return out("w", Math.floor(days / 7));
  return out("mo", Math.floor(days / 30));
}

/** Path segment for a client: digits only, so no "+" in URLs. */
export const clientPathId = (phone: string) => phone.replace(/\D/g, "");
export const phoneFromPathId = (id: string) => (/^\d{11}$/.test(id) ? `+${id}` : null);

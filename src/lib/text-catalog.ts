/**
 * Every default text the founder can rewrite on Admin → Texts. Each lives in message_templates
 * (user_id null). `needs` must stay in the text (the app fills it in and the text is useless
 * without it); `can` lists every fill-in the app provides for it.
 */
export type StopRule = "first" | "always" | "never";
export type CatalogText = {
  key: string;
  title: string;
  to: "client" | "barber";
  when: string;
  stop: StopRule;
  needs: string[];
  can: string[];
};

export const TEXT_CATALOG: CatalogText[] = [
  { key: "missed_call_casual", title: "Missed call: Casual (default)", to: "client", when: "Right after an unanswered call. The shop name is added in front.", stop: "first", needs: ["link"], can: ["link"] },
  { key: "missed_call_professional", title: "Missed call: Professional", to: "client", when: "Same, for barbers who picked Professional.", stop: "first", needs: ["link"], can: ["link"] },
  { key: "booking_confirm", title: "Booking confirmation", to: "client", when: "Right after they book.", stop: "first", needs: ["link"], can: ["date", "time", "link", "party", "reward", "shop_name"] },
  { key: "reminder_24h", title: "Reminder: 24 hours before", to: "client", when: "About 24 hours before the appointment.", stop: "first", needs: ["time"], can: ["time", "link", "shop_name"] },
  { key: "reminder_2h", title: "Reminder: 2 hours before", to: "client", when: "About 2 hours before the appointment.", stop: "first", needs: ["time"], can: ["time", "reward", "shop_name"] },
  { key: "rescheduled", title: "Rescheduled", to: "client", when: "When the appointment is moved.", stop: "first", needs: ["date", "time"], can: ["date", "time", "link", "shop_name"] },
  { key: "cancelled", title: "Cancelled", to: "client", when: "When the appointment is cancelled.", stop: "first", needs: [], can: ["date", "link", "shop_name"] },
  { key: "loyalty_progress", title: "Loyalty: progress", to: "client", when: "After a visit that wasn't a reward visit.", stop: "first", needs: ["next_cut"], can: ["cuts", "next_cut", "cuts_left", "amount", "shop_name", "link"] },
  { key: "loyalty_earned", title: "Loyalty: reward used", to: "client", when: "After the visit where the reward was applied.", stop: "first", needs: [], can: ["next_cut", "amount", "shop_name", "link"] },
  { key: "auto_reply_inbound", title: "Auto-reply when a client texts in", to: "client", when: "When a client texts something that isn't a keyword (once per 12 hours).", stop: "first", needs: ["link"], can: ["link"] },
  { key: "review_request", title: "Google review request", to: "client", when: "2 hours after a visit (marketing).", stop: "always", needs: ["review_url"], can: ["review_url", "shop_name"] },
  { key: "cadence_nudge", title: "Wednesday: first nudge", to: "client", when: "First Wednesday 14+ days after their last cut (marketing).", stop: "always", needs: ["link"], can: ["shop_name", "link", "first_name"] },
  { key: "winback_1", title: "Wednesday: follow-up 1", to: "client", when: "Every 21 days after, the 5 follow-ups take turns (marketing).", stop: "always", needs: ["link"], can: ["shop_name", "link", "first_name"] },
  { key: "winback_2", title: "Wednesday: follow-up 2", to: "client", when: "Takes turns with the other follow-ups.", stop: "always", needs: ["link"], can: ["shop_name", "link", "first_name"] },
  { key: "winback_3", title: "Wednesday: follow-up 3", to: "client", when: "Takes turns with the other follow-ups.", stop: "always", needs: ["link"], can: ["shop_name", "link", "first_name"] },
  { key: "winback_4", title: "Wednesday: follow-up 4", to: "client", when: "Takes turns with the other follow-ups.", stop: "always", needs: ["link"], can: ["shop_name", "link", "first_name"] },
  { key: "winback_5", title: "Wednesday: follow-up 5", to: "client", when: "Takes turns with the other follow-ups.", stop: "always", needs: ["link"], can: ["shop_name", "link", "first_name"] },
  { key: "winback_final_offer", title: "Wednesday: one-time offer", to: "client", when: "Once, for clients gone 8+ weeks, if the barber set an offer.", stop: "always", needs: ["link", "offer"], can: ["shop_name", "link", "offer", "first_name"] },
  { key: "morning_late_broadcast", title: "Running late", to: "client", when: "When the barber texts LATE: to everyone booked for the rest of today.", stop: "first", needs: [], can: ["shop_name"] },
  { key: "barber_booking_notify", title: "Barber: new booking today", to: "barber", when: "Same-day booking, after 9am. A link to the booking is added on its own line.", stop: "never", needs: ["customer_name", "time"], can: ["customer_name", "service", "time"] },
  { key: "barber_cancel_notify", title: "Barber: client cancelled", to: "barber", when: "Client cancels from their link. A link to that day is added.", stop: "never", needs: ["customer_name"], can: ["customer_name", "date", "time"] },
  { key: "barber_reschedule_notify", title: "Barber: client rescheduled", to: "barber", when: "Client moves their appointment. A link to the new day is added.", stop: "never", needs: ["customer_name", "time"], can: ["customer_name", "old_date", "old_time", "time", "date"] },
  { key: "weekly_report", title: "Barber: weekly recap", to: "barber", when: "Sundays 9am.", stop: "never", needs: [], can: ["barber_name", "cuts", "revenue", "new_vips", "missed_caught", "reviews_sent"] },
];

/** Example values for the preview and the character count. */
export const EXAMPLES: Record<string, string> = {
  shop_name: "Fresh Cuts",
  link: "www.linecatch.app/c/K7mP2xQa",
  review_url: "https://g.page/r/CbX9fK2mQ/review",
  customer_name: "Jordan",
  first_name: "Jordan",
  barber_name: "Marcus",
  service: "Mid Fade",
  time: "2:30pm",
  old_time: "1pm",
  old_date: "Thursday",
  date: "Friday",
  cuts: "1",
  next_cut: "2",
  cuts_left: "1",
  amount: "$5",
  offer: "$5 off",
  revenue: "1,240",
  new_vips: "6",
  missed_caught: "11",
  reviews_sent: "3",
  party: "",
  reward: "",
};

export const STOP_LINE = { en: "\nReply STOP to opt out.", es: "\nResponde STOP para no recibir más mensajes." };
export const MAX_TEXT_LENGTH = 320;

export const fillExample = (text: string) => text.replace(/\{([a-z_]+)\}/g, (m, k: string) => EXAMPLES[k] ?? m);

/** Fill-ins the text is missing; empty when it's good to save. */
export function missingFillIns(text: string, item: CatalogText): string[] {
  return item.needs.filter((k) => !text.includes(`{${k}}`));
}

/** Fill-ins the app doesn't know for this text (they'd go out blank). */
export function unknownFillIns(text: string, item: CatalogText): string[] {
  return [...new Set([...text.matchAll(/\{([a-z_]+)\}/g)].map((m) => m[1]))].filter((k) => !item.can.includes(k) && k !== "reward_es" && k !== "party_es");
}

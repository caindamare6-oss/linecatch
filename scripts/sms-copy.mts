// Builds docs/SMS_COPY.md: every text LineCatch sends, when, its length, segments and cost.
// Run: npm run sms-copy   (re-run whenever the copy, the templates or the prices change)
import { readFileSync, writeFileSync } from "node:fs";
import { MISSED_CALL_PRESETS } from "../src/lib/missed-call-text.ts";
import { measure, PER_SEGMENT, TWILIO_PER_SEGMENT, CARRIER_FEE_PER_SEGMENT } from "../src/lib/sms-segments.ts";

// Prices and segment math live in src/lib/sms-segments.ts (the admin texts page uses them too).
// ── Example values, sized like real ones.
const EX: Record<string, string> = {
  shop_name: "Fresh Cuts",
  link: "www.linecatch.app/c/K7mP2xQa", // every long app link is shortened to this size
  review_url: "https://g.page/r/CbX9fK2mQ/review",
  customer_name: "Jordan",
  first_name: "Jordan",
  barber_name: "Marcus",
  service: "Mid Fade",
  time: "2:30pm",
  old_time: "1pm",
  date: "Friday",
  date_es: "viernes",
  cuts: "1",
  next_cut: "2",
  offer: "$5 off",
  amount: "$5", // the barber's loyalty reward (Settings → Loyalty rewards)
  revenue: "1,240",
  new_vips: "6",
  missed_caught: "11",
  reviews_sent: "3",
  party: "",
  party_es: "",
  reward: "",
  reward_es: "",
};
const STOP = { en: "\nReply STOP to opt out.", es: "\nResponde STOP para no recibir más mensajes." };

const T = JSON.parse(readFileSync(new URL("./sms-templates.json", import.meta.url), "utf8"));

const fill = (tpl: string, lang: "en" | "es", vars: Record<string, string> = {}) =>
  tpl.replace(/\{([a-z_]+)\}/g, (_, k) => vars[k] ?? (lang === "es" && EX[`${k}_es`] !== undefined ? EX[`${k}_es`] : EX[k]) ?? "");

type Stop = "first" | "always" | "never" | "in_text";
type Msg = { title: string; key: string; when: string; who: string; stop: Stop; en: string; es?: string; note?: string; vars?: Record<string, string> };

const tpl = (key: string) => ({ en: T[key].en as string, es: T[key].es as string });
const shopFirst = (s: string) => `${EX.shop_name}: ${s}`;

const CLIENT: Msg[] = [
  {
    title: "Missed-call text: Casual (default)",
    key: "missed_call",
    who: "The caller",
    when: "Right after an unanswered call reaches the barber's LineCatch number (forwarded or direct). Once per caller every 3 hours; someone who never opted in gets it only once ever; never after STOP.",
    stop: "first",
    en: shopFirst(MISSED_CALL_PRESETS.casual.en),
    es: shopFirst(MISSED_CALL_PRESETS.casual.es),
    note: "Starts with the shop name (barber's first name if no shop name).",
  },
  {
    title: "Missed-call text: Professional",
    key: "missed_call",
    who: "The caller",
    when: "Same as Casual, if the barber picked Professional in Settings.",
    stop: "first",
    en: shopFirst(MISSED_CALL_PRESETS.professional.en),
    es: shopFirst(MISSED_CALL_PRESETS.professional.es),
  },
  {
    title: "Missed-call text: Write my own",
    key: "missed_call",
    who: "The caller",
    when: "Same as Casual, with the barber's own words (up to 300 characters, must include {link}). Length and cost depend on what they write.",
    stop: "first",
    en: shopFirst("Yo, it's Marcus. Can't pick up, I'm mid-cut. Book here: {link}"),
    note: "Example only.",
  },
  {
    title: "Booking confirmation (manage link)",
    key: "booking_confirm",
    who: "The client who booked",
    when: "Right after a booking, if the client agreed to texts (checkbox on the booking page, VIP page or sticker). The link opens their page to move or cancel.",
    stop: "first",
    ...tpl("booking_confirm"),
    note: "Adds \", party of 3\" for group bookings and \" $5 off this visit.\" (the barber's amount) when a reward is due.",
  },
  {
    title: "Reminder: 24 hours before",
    key: "reminder_24h",
    who: "The client",
    when: "About 24 hours before the appointment (checked every 15 minutes). Only to clients who agreed to texts.",
    stop: "first",
    ...tpl("reminder_24h"),
  },
  {
    title: "Reminder: 2 hours before",
    key: "reminder_2h",
    who: "The client",
    when: "About 2 hours before the appointment. Only to clients who agreed to texts.",
    stop: "first",
    ...tpl("reminder_2h"),
    note: "Adds \" $5 off this visit.\" when a reward is due.",
  },
  {
    title: "Rescheduled",
    key: "rescheduled",
    who: "The client",
    when: "When the client or barber moves the appointment. Only to clients who agreed to texts.",
    stop: "first",
    ...tpl("rescheduled"),
  },
  {
    title: "Cancelled",
    key: "cancelled",
    who: "The client",
    when: "When the client or barber cancels. Only to clients who agreed to texts.",
    stop: "first",
    ...tpl("cancelled"),
  },
  {
    title: "Loyalty: progress",
    key: "loyalty_progress",
    who: "The client",
    when: "After the visit is done (barber taps Done, or automatically 2 hours after it ends). Only to clients who agreed to texts, and only while the barber's loyalty rewards are on. Schedule: 1st cut full price, 2nd off, then every 3rd (5, 8, 11…).",
    stop: "first",
    ...tpl("loyalty_progress"),
  },
  {
    title: "Loyalty: $5 earned",
    key: "loyalty_earned",
    who: "The client",
    when: "Instead of the progress text, on the visit where the $5 reward was used.",
    stop: "first",
    ...tpl("loyalty_earned"),
  },
  {
    title: "Auto-reply when a client texts in",
    key: "auto_reply_inbound",
    who: "A client who texts the LineCatch number",
    when: "When a client texts something that isn't a keyword (STOP, HELP, a language…). At most once every 12 hours per client. Link opens their next booking, or the booking page.",
    stop: "first",
    ...tpl("auto_reply_inbound"),
  },
  {
    title: "Google review request",
    key: "review_request",
    who: "The client",
    when: "2 hours after a visit is done, only if: SMS marketing is on, the barber added a review link, the client agreed to texts, has 2+ cuts, and wasn't asked in the last 30 days.",
    stop: "always",
    ...tpl("review_request"),
  },
  {
    title: "Wednesday: first nudge",
    key: "cadence_nudge",
    who: "Clients who agreed to texts",
    when: "Wednesdays noon–6pm (barber's time), on the first Wednesday at least 14 days after the last cut, if they have nothing booked and SMS marketing is on.",
    stop: "always",
    ...tpl("cadence_nudge"),
  },
  ...[1, 2, 3, 4, 5].map((n) => ({
    title: `Wednesday: follow-up ${n} of 5 (rotates)`,
    key: `winback_${n}`,
    who: "Clients who agreed to texts",
    when: "Every 21 days after the last Wednesday text, Wednesdays noon–6pm, until they book or text STOP. The 5 follow-ups take turns.",
    stop: "always" as Stop,
    ...tpl(`winback_${n}`),
  })),
  {
    title: "Wednesday: one-time offer",
    key: "winback_final_offer",
    who: "Clients gone 8+ weeks",
    when: "Once, in place of a follow-up, when a client has been gone 8+ weeks and the barber set a win-back offer in Settings.",
    stop: "always",
    ...tpl("winback_final_offer"),
  },
  {
    title: "Broadcast",
    key: "broadcast",
    who: "Every client who agreed to texts",
    when: "When the barber sends one from Messages. Words are the barber's; length and cost depend on what they write.",
    stop: "always",
    en: "Open chairs Thursday after 3. Book here: {link}",
    note: "Example only. Cost is per client: 100 clients = 100 texts.",
  },
  {
    title: "Running late (barber texts LATE)",
    key: "morning_late_broadcast",
    who: "Every client booked for the rest of today",
    when: "When the barber texts LATE from their own cell to their LineCatch number.",
    stop: "first",
    ...tpl("morning_late_broadcast"),
  },
  {
    title: "Barber's own message",
    key: "direct",
    who: "One client",
    when: "When the barber types a message to a client in Messages. Words are the barber's.",
    stop: "first",
    en: "No worries, see you soon",
    note: "Example only.",
  },
  {
    title: "Reply to STOP",
    key: "(keyword reply)",
    who: "Anyone who texts STOP (or stop, Stop!, parar…)",
    when: "Immediately. After this, no texts at all until they text START.",
    stop: "in_text",
    en: "You've been unsubscribed. You will not receive further texts. Reply START to resubscribe.",
    es: "Te has dado de baja. No recibirás más mensajes. Responde START para volver a suscribirte.",
  },
  {
    title: "Reply to START",
    key: "(keyword reply)",
    who: "Someone who opted out and texts START",
    when: "Immediately.",
    stop: "never",
    en: "You've been resubscribed. You'll receive texts again.",
    es: "Te has vuelto a suscribir. Recibirás mensajes de nuevo.",
  },
  {
    title: "Reply to HELP",
    key: "(keyword reply)",
    who: "Anyone who texts HELP",
    when: "Immediately (a carrier requirement).",
    stop: "in_text",
    en: `${EX.shop_name}: appointment reminders & updates via LineCatch. Reply STOP to opt out. Help: support@linecatch.app`,
    es: `${EX.shop_name}: recordatorios y avisos de tus citas por LineCatch. Responde STOP para no recibir más mensajes. Ayuda: support@linecatch.app`,
  },
  {
    title: "Reply to a language (\"ESPAÑOL\", \"ENGLISH\")",
    key: "(keyword reply)",
    who: "A client who texts a language name",
    when: "Immediately; future texts switch language.",
    stop: "never",
    en: "Language set to English. Future messages will be in English.",
    es: "Idioma cambiado a español. Los mensajes futuros serán en español.",
  },
];

const BARBER: Msg[] = [
  {
    title: "New booking today",
    key: "barber_booking_notify",
    who: "The barber's cell",
    when: "When a client books for later the same day, after 9am the barber's time. The link opens that booking on their schedule.",
    stop: "never",
    en: T.barber_booking_notify.en + "\n{link}",
    es: T.barber_booking_notify.es + "\n{link}",
  },
  {
    title: "Client cancelled",
    key: "barber_cancel_notify",
    who: "The barber's cell",
    when: "When a client cancels from their link. The link opens that day on the schedule.",
    stop: "never",
    en: T.barber_cancel_notify.en + "\n{link}",
    es: T.barber_cancel_notify.es + "\n{link}",
  },
  {
    title: "Client rescheduled",
    key: "barber_reschedule_notify",
    who: "The barber's cell",
    when: "When a client moves their appointment from their link. The link opens the new day.",
    stop: "never",
    en: T.barber_reschedule_notify.en + "\n{link}",
    es: T.barber_reschedule_notify.es + "\n{link}",
  },
  {
    title: "Morning summary",
    key: "morning_summary",
    who: "The barber's cell",
    when: "Every day at 8am (barber's time), only on days with bookings.",
    stop: "never",
    en: "5 cuts today, first at 10am. 1 gets $5 off (check the badge).",
    es: "5 cortes hoy, el primero a las 10am. 1 tiene $5 de descuento (mira la insignia).",
    note: "The $5 part only appears when a reward is due today.",
  },
  {
    title: "Weekly recap",
    key: "weekly_report",
    who: "The barber's cell",
    when: "Sundays at 9am (barber's time).",
    stop: "never",
    ...tpl("weekly_report"),
  },
  {
    title: "LATE confirmation",
    key: "(keyword reply)",
    who: "The barber's cell",
    when: "Right after the barber texts LATE.",
    stop: "never",
    en: "Got it! Sent a heads-up to 4 clients.",
    note: "English only. \"No bookings found for today.\" if nobody is booked.",
  },
];

const STOP_LABEL: Record<Stop, string> = {
  first: "Only on the client's first text from this barber",
  always: "Always (marketing text)",
  never: "Never",
  in_text: "Already in the text",
};
const money = (n: number) => `$${n.toFixed(4)}`;

function block(m: Msg) {
  const out: string[] = [`### ${m.title}`, "", `- **Sent to:** ${m.who}`, `- **When:** ${m.when}`, `- **"Reply STOP to opt out":** ${STOP_LABEL[m.stop]}`];
  if (m.note) out.push(`- **Note:** ${m.note}`);
  out.push("", "| | Text (with example values) | Characters | Type | Segments | Cost per send |", "|---|---|---|---|---|---|");
  for (const lang of ["en", "es"] as const) {
    const raw = m[lang];
    if (!raw) continue;
    const body = fill(raw, lang, m.vars);
    const versions: [string, string][] = [[lang === "en" ? "English" : "Spanish", body]];
    if (m.stop === "first" || m.stop === "always") versions.push([`${lang === "en" ? "English" : "Spanish"} + STOP line`, body + STOP[lang]]);
    for (const [label, text] of versions) {
      const r = measure(text);
      const why = r.gsm ? "Standard" : `Unicode (${r.nonGsm.join(" ")})`;
      out.push(`| ${label} | ${text.replace(/\n/g, "<br>").replace(/\|/g, "\\|")} | ${r.chars} | ${why} | ${r.segments} | ${money(r.cost)} |`);
    }
  }
  return out.join("\n");
}

// A sample month for one barber (English, missed-call and service texts with STOP on the first one).
const cost = (key: string, lang: "en" | "es" = "en", stop = false) => {
  const all = [...CLIENT, ...BARBER].find((m) => m.key === key)!;
  return measure(fill(all[lang]!, lang) + (stop ? STOP[lang] : "")).cost;
};
const month: [string, number, number][] = [
  ["Missed-call texts (Casual, first text)", 60, cost("missed_call", "en", true)],
  ["Booking confirmations", 80, cost("booking_confirm")],
  ["24-hour reminders", 80, cost("reminder_24h")],
  ["2-hour reminders", 80, cost("reminder_2h")],
  ["Loyalty texts", 75, cost("loyalty_progress")],
  ["Wednesday texts (with STOP line)", 100, cost("cadence_nudge", "en", true)],
  ["Review requests (with STOP line)", 15, cost("review_request", "en", true)],
  ["Auto-replies", 20, cost("auto_reply_inbound")],
  ["Barber: new booking / cancel / reschedule", 30, cost("barber_booking_notify")],
  ["Barber: morning summaries", 26, cost("morning_summary")],
  ["Barber: weekly recaps", 4, cost("weekly_report")],
];
const monthTotal = month.reduce((n, [, count, c]) => n + count * c, 0);

const md = `# LineCatch: every text message

Generated by \`npm run sms-copy\` from the app's code and \`scripts/sms-templates.json\`. Don't edit by hand: change the copy, then re-run it.

## How cost is counted

- **Segments:** a text is billed in segments. **Standard** texts (plain English letters) fit **160 characters** in one segment, then 153 per segment. One character outside that set (á, í, ó, ú, curly quotes ’, emoji) makes the whole text **Unicode**: **70 characters** in one segment, then 67 per segment. That's why many Spanish texts cost double.
- **Price per segment:** $${TWILIO_PER_SEGMENT} (Twilio, US) + ~$${CARRIER_FEE_PER_SEGMENT} (carrier fee for registered A2P numbers) = **$${PER_SEGMENT.toFixed(4)}**. Check Twilio console → Messaging → Pricing and change the numbers in \`src/lib/sms-segments.ts\` if yours differ.
- **Links:** every long link to the app is shortened to \`${EX.link}\` (${EX.link.length} characters), so the counts below use that.
- **Example values:** shop "${EX.shop_name}", client "${EX.customer_name}", ${EX.time} on ${EX.date}. Longer names add characters.
- **Not counted:** the barber's monthly number (about $1.15/month on Twilio) and the one-time A2P registration fees. Incoming texts and the forwarded calls (voice minutes) are billed separately too.

## A sample month for one barber

| Text | Count | Cost each | Total |
|---|---|---|---|
${month.map(([l, n, c]) => `| ${l} | ${n} | ${money(c)} | $${(n * c).toFixed(2)} |`).join("\n")}
| **Total** | **${month.reduce((n, [, c]) => n + c, 0)}** | | **$${monthTotal.toFixed(2)}** |

English texts, busy barber. Spanish-speaking clients cost up to about 2× on texts that turn Unicode.

## Texts to clients

${CLIENT.map(block).join("\n\n")}

## Texts to the barber

${BARBER.map(block).join("\n\n")}

## In the database but never sent

These default templates are still stored but nothing sends them anymore: ${Object.keys(T._unused).map((k) => `\`${k}\``).join(", ")}. (\`missed_call\` was replaced by the Casual / Professional / Write my own styles above.)
`;

writeFileSync(new URL("../docs/SMS_COPY.md", import.meta.url), md);
console.log(`docs/SMS_COPY.md written: ${CLIENT.length + BARBER.length} texts, sample month $${monthTotal.toFixed(2)}`);

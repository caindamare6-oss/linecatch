# LineCatch

**Missed-call texting and booking for barbers.** When a barber can't pick up because they're mid-cut, the caller gets a text with a booking link in seconds. The client books in a few taps, and LineCatch keeps them coming back with reminders, loyalty rewards and Wednesday check-ins. Every text goes only to clients who agreed to receive them.

LineCatch is multi-tenant: every barber has their own account, clients, schedule, phone number, language and settings.

---

## The problem it solves

Barbers lose bookings every day because they can't answer the phone with clippers in their hand. A caller who gets voicemail usually calls the next shop. LineCatch turns each missed call into a booking link, then handles the follow-up a barber never has time for: confirmations, reminders, "you're due for a cut", review requests and win-backs.

## Who uses it

| Who | What they do |
|---|---|
| **Barber** | Signs up, sets services and hours, sees their schedule, clients, messages and revenue in a phone-first app. English or Spanish. |
| **Client** | Calls the shop or scans its QR sticker, books from a link, gets texts in their own language, replies STOP anytime. Never needs an account. |
| **Founder (admin)** | Generates and prints QR stickers, hands them out door to door, and tracks which shops finished setup. |

---

## How it works

### 1. A client calls and the barber misses it
1. Each barber gets a **LineCatch number** (a Twilio number). Clients call it.
2. The call rings through to the barber's own cell for 20 seconds.
3. If nobody answers, the caller gets a text: *"Sorry I missed your call. Book here: link"*. The barber can write their own text.
4. That's the only text a missed call sends. There's no follow-up.
5. Anyone who texted STOP never gets a missed-call text again.

### 2. The client books
- The booking page shows the barber's services, prices and open times in the barber's timezone.
- **Returning clients are recognized** from a token saved on their phone, or from the link in the text, so rebooking takes one tap.
- A consent checkbox lets the client agree to texts. The wording they saw is stored as proof.
- The client gets a confirmation text with a link to reschedule or cancel. "Pay in person": nothing is charged online.

### 3. Texts that keep clients coming back
| Text | When | Needs |
|---|---|---|
| Booking confirmation | Right after booking | Client opted in |
| Reminders | 24 hours and 2 hours before | Client opted in |
| Loyalty progress | After each completed visit | Client opted in |
| Google review request | 2–3 hours after a visit | SMS marketing on, review link set |
| **Wednesday reminder** | Only on Wednesdays, noon–6pm barber's time: the first Wednesday 2–3 weeks after the cut, then every 3 weeks until they book or reply STOP | SMS marketing on |
| Broadcast | When the barber sends one | SMS marketing on |

Every client text ends with *"Reply STOP to opt out"* in the client's language. STOP in any form ("Stop.", "STOP!", "parar") stops everything. START opts back in. Numbers the carrier reports as unreachable are opted out automatically.

### 4. Texts to the barber
- **Morning summary** at 8am: today's appointments.
- **Weekly report** on Sundays at 9am: cuts, revenue, new VIPs, missed calls caught.
- **Same-day booking alert** when a client books for today.
- **"Done with Jamie?"** nudge after an appointment ends, so the visit gets marked complete.
- The barber can text **LATE** from their cell to warn the rest of today's clients that they're running behind.

### 5. Loyalty
A stamp card with $5 off on reward cuts.
- **Basic plan:** every 3rd cut.
- **Full plan:** the 1st cut, then every 3rd after that (4, 7, 10…).

One reward per visit, applied automatically.

### 6. QR stickers
A printed sticker for the mirror or chair, in English and Spanish.

**Before it's set up:** it's tied to no one. The barber scans it and sets up their shop in two steps (name, cell). No address needed.

**After it's set up:** clients who scan it land on the shop's VIP sign-up page to join the text list and book.

The founder hands stickers out door to door: scan the sticker, type the shop's name, hand it over. Barbers who sign up any other way can order one shipped as an optional $7 add-on. Everything works without a sticker.

### 7. Referrals
Every barber gets a code and a share link (`/join/CODE`). A barber who signs up with it gets 50% off their first month, and the referrer earns a free month. Credits are recorded; billing isn't connected yet.

### 8. Language
Every page is available in English and Spanish:
- The barber picks their language in onboarding or Settings.
- Clients pick on any page with the EN/ES switch.
- Each text goes out in the recipient's language.

---

## The barber app

| Screen | What's on it |
|---|---|
| **Home** | Greeting, monthly revenue chart (completed visits only, starts at $0), VIPs, missed calls caught, who gets a Wednesday text this week, bookings, activity feed |
| **Messages** | Inbox and threads with clients, reply, broadcast to opted-in clients |
| **Schedule** | 7-day strip and day timeline, mark done / no-show / cancel, book a client |
| **Clients** | Search and filters (VIP, reward due, no texts); profile with visits, money spent, last visit, loyalty card, history and private notes |
| **Settings** | Language, profile, business info, missed-call text, SMS marketing, hours, services, portfolio, QR sticker, refer a barber |
| **Admin: stickers** | Founder only: generate and print batches, hand-out list, reassign or retire codes |

Public pages:

| Page | Address |
|---|---|
| Booking page | `/book/<barber id>` |
| Manage booking | `/manage/<booking id>` |
| VIP sign-up | `/vip/<barber id>` |
| Shop portfolio | `/<shop-slug>` |
| Sticker scan | `/s/<CODE>` |
| Referral link | `/join/<CODE>` |
| Privacy and terms | `/privacy`, `/terms` |

---

## Tech stack

| Part | Uses |
|---|---|
| App | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Database and login | Supabase: Postgres with row-level security, plus email magic link, Google and phone sign-in |
| Calls and texts | Twilio Programmable Voice and Messaging |
| Hosting and schedules | Vercel, with cron jobs in `vercel.json` |
| QR codes | `qrcode` to make them, `jsqr` to scan in-app, `jszip` for print batches |
| Tests | Vitest unit tests |

## Project layout

```
src/
  app/
    dashboard/          Barber app: home, messages, schedule, clients, settings, services, portfolio, admin
    onboarding/         Barber setup (full flow, or a two-step version from a handed-out sticker)
    book/ manage/ vip/  Client pages
    [slug]/             Public shop portfolio
    s/[code]/           QR sticker scan, setup and hand-out
    join/[code]/        Referral share link
    login/ auth/        Sign-in
    api/
      twilio/           Voice and SMS webhooks (missed calls, STOP/START/HELP, replies, LATE)
      bookings/         Create, cancel, reschedule, complete
      cron/             Wednesday reminders, morning summary, weekly report, completion nudge
      booking-reminders/  24h and 2h reminders, review requests
      …                 Settings, clients, messages, onboarding, referrals, stickers, portfolio
  lib/
    retention.ts        Wednesday reminder schedule
    marketing.ts        Who can receive marketing texts
    twilio.ts           Sending texts: opt-out footer, hourly cap per number, auto opt-out
    messages.ts         Text templates in each language
    loyalty*.ts         Stamp card rules
    referrals.ts        Referral codes and credits
    sticker-*.ts        Claiming, requesting and generating stickers
    i18n*.ts(x)         English/Spanish
    config.ts           App URL, support email, default timezone, sticker price
  locales/en.json, es.json   All interface text
supabase/migrations/    Database changes, run in filename order
docs/
  LAUNCH.md             Deploy checklist
  CHANGES.md            What changed recently
```

## Data, in brief

| Table | Holds |
|---|---|
| `users` | One row per barber: shop, LineCatch number, cell, hours, language, feature switches, plan, referral code |
| `services` | Each barber's services, prices and lengths |
| `bookings` | Appointments and their status |
| `vip_clients` | Each barber's clients: consent, language, visits, last cut, Wednesday reminder state |
| `opt_outs` | Who said STOP (or was opted out by the carrier), per barber |
| `sms_log` | Every text in and out |
| `missed_calls` | Calls that weren't answered and what was sent |
| `message_templates` | Default text templates (English and Spanish) plus barber overrides |
| `sticker_codes` | QR codes: unclaimed, active or retired; who they were handed to |
| `referrals`, `billing_credits` | Who referred whom; free months and discounts earned |
| `activity_feed` | The barber's home-screen feed |

The browser can only read a barber's own rows. All writes go through the server.

---

## Running it locally

```bash
npm install
cp .env.example .env.local   # fill in Supabase and Twilio values
npm run dev                  # http://localhost:3000
npx vitest run               # unit tests
```

- Set `SMS_DEV_MODE=true` to log texts to `sms_log` instead of sending them.
- For testing the schedules, set `ALLOW_TIME_TRAVEL=true` (never in production). Crons then accept `?now=` to simulate a future Wednesday.

## Deploying

See [`docs/LAUNCH.md`](docs/LAUNCH.md) for the full checklist:
- migrations
- settings
- Supabase redirect URL
- Vercel plan for hourly crons
- Twilio webhooks and carrier registration
- printing stickers
- a smoke test after deploy

## Not built yet

- **Phone numbers for new barbers:** assigned by hand for now.
- **Billing (Stripe):** plans, referral credits and the $7 sticker are recorded but not charged.
- **Carrier registration (A2P 10DLC):** needed before marketing texts reach US carriers reliably.

# LineCatch: everything that changed

Work on branch `claude/trusting-goodall-ivxv3b`, Oct 2–3, 2026. Nine commits, from `7e73b34` to `f000332`.

- Screenshots of every change: https://claude.ai/artifact/56p4iaWs5uKqzyvAAsGgFD (private until you share it)
- Deploy steps: [`docs/LAUNCH.md`](LAUNCH.md)

---

## How it works now (the short version)

| Area | How it works now |
|---|---|
| **Returning clients** | Recognized on the booking page by a saved token or the link in their missed-call text. Booking takes one tap. |
| **Missed calls** | The caller gets one text with a booking link, unless they opted out. A caller who never opted in gets it only the first time. No follow-up. |
| **SMS marketing** | One switch for the barber, off by default. Texts only reach clients who opted in. No sticker needed. |
| **Wednesday reminders** | Only on Wednesdays (noon–6pm, barber's time). The first goes out on the first Wednesday at least 2 weeks after the cut, then every 3 weeks until the client books or texts STOP. |
| **Opt-out** | STOP in any form ("Stop.", "STOP!", "parar") stops everything. Numbers the carrier reports as unreachable are opted out automatically. |
| **Google reviews** | Requested 2–3 hours after a visit (needs marketing on and a review link). |
| **QR sticker (door to door)** | You scan a sticker and type the shop name. The barber scans it, then does a two-step setup with no address. The sticker connects automatically. |
| **QR sticker (mailed)** | Optional $7 add-on for referred or self-signup barbers. Everything works without it. |
| **Referrals** | Every barber gets a code and a link. A referred barber gets 50% off the first month; the referrer earns a free month. Both are recorded, not charged yet. |
| **Language** | English or Spanish on every page. The barber picks in onboarding or Settings, clients pick on their pages, and texts follow each person's choice. |
| **Multi-tenant** | No personal email, phone numbers or shop names in the code. Domain, support email, timezone and sticker price come from config. |
| **Revenue** | Starts at $0 and only counts completed visits at real service prices. |

---

## Round 1: returning clients and 1-tap booking (`7e73b34`)

- **Returning clients are recognized.** The booking page remembers a client with a token stored on their phone. The link in a missed-call text also carries a token. Either one greets them by name and pre-fills their last service.
- **1-tap rebooking.** A recognized client books without typing their name or number again.
- **Privacy:** typing someone else's phone number never reveals that person's name or history. A "Not you?" link forgets the device.
- **Migration:** `20261002_client_sessions`.

## Round 2: redesign plus end-to-end testing (`b2ed10d`)

The barber app was reskinned to the gold design canvas, then tested end to end on a local copy of the database.

**New and redesigned screens**
- A bottom tab bar: Home, Messages, Schedule, Clients. Settings is now its own page.
- **Home:** a greeting, a revenue chart built from real service prices, tiles for VIPs, calls caught, Wednesday reminders and bookings, and an activity feed.
- **Messages:** inbox and threads with reply, plus a broadcast with a two-tap confirm.
- **Schedule:** a 7-day strip and a timeline, with done, no-show and cancel actions, plus "Book a client".
- **Clients list** and a **client profile** with stats, loyalty card, visit history and private notes. Both are new.
- Booking, Manage, VIP sign-up, Login and onboarding were restyled.

**Bugs fixed**
- Broadcast texted every missed caller, not just opted-in VIPs. That's a legal risk (TCPA).
- A client texting "late" sent a running-late text to all of that day's clients.
- Barber alerts went to the barber's own LineCatch number instead of their cell.
- Client replies were dropped. They're now saved and answered once per 12 hours with a link.
- Onboarding let one barber edit another barber's services. Going Back and then Continue duplicated services.
- "Add client" failed, and it marked people as opted in without their consent.
- Weekly report: wrong week, missed calls always showed 0, English only.
- Settings saved unvalidated input straight from the browser.
- A missed-call text with no booking link now falls back to the default text, which has one.

**Migrations:** `20261002b_sms_log_inbound`, `20261002c_contact_notes`.

## Round 3: SMS marketing, opt-out hardening, Wednesday texts (`449157b`)

> Parts of this round were changed later: the sticker is no longer required (round 4), and the win-back "ladder" was replaced by the Wednesday schedule (round 5).

- **SMS marketing switch, off by default.** Everyday texts (missed calls, confirmations, reminders) work for everyone. Marketing texts (Wednesday reminders, broadcasts, review requests) need the switch on.
- **Opt-out hardening:**
  - STOP with punctuation now counts.
  - When the carrier reports a number has unsubscribed, it's recorded so that number never gets another missed-call text.
- **Review requests never went out** while there were no appointments in the next 25 hours. Fixed: they now go out 2 hours after the visit.
- **Missed-call follow-up** is skipped if the caller replied, tapped the link or booked, and it always includes a link. (The follow-up was removed later; see "Later changes".)
- **Accessibility:** onboarding switches and inputs are labelled for screen readers, with larger tap targets.
- **Migration:** `20261002d_sms_marketing`.

## Round 4: Spanish everywhere, referrals, multi-tenant cleanup (`58f96d1`)

**Spanish on every page**
- English/Spanish switch in onboarding and Settings. The barber's choice drives the whole app and the texts sent to them.
- An EN/ES switch on every client page (booking, manage, VIP sign-up, shop page, sticker page, privacy, terms). The client's choice is saved and decides the language of their texts.
- Error messages, the consent text, STOP/HELP replies, dates, money and weekdays inside texts ("viernes", not "Friday") are all translated.

**Referrals**
- Every barber gets a code (e.g. `FRESHC851`) and a share link, `/join/CODE`.
- The sign-up page shows "Invited by Fresh Cuts · 50% off".
- Onboarding asks "How did you hear about LineCatch?" and takes a code, checking it as you type.
- Finishing setup records a free month for the referrer and 50% off for the new barber.
- Settings has a "Refer a barber" card with the code, a share button and counts.

**QR sticker became optional**
- SMS marketing turns on without a sticker. Texts still only go to clients who opted in.
- The sticker became a $7 add-on, shipped to the shop. The address is only asked for if they choose it.

**Re-engagement repeats until opt-out** (replaced in round 5 by the Wednesday schedule).

**Multi-tenant cleanup**
- Your personal Gmail address was removed from the HELP reply, Settings, privacy and terms. It's now a support address setting.
- The HELP reply names the barber's shop.
- Real phone numbers and names were removed from placeholders.
- App URL, default timezone and sticker price come from one config file.
- The Google/Apple/Outlook calendar options were removed from onboarding.

**Fixes found along the way**
- The onboarding phone hint called the barber's own cell "the number clients will call".
- "That's 1 cuts" in the loyalty text.
- The last win-back text said "Last one from me" even though texts continued.
- The confirmation text could link to "undefined/manage/…".
- Clients could see raw database errors when cancelling or rescheduling.

**Migrations:** `20261002e_referrals`, `20261002f_winback_copy`.

## Round 5: Wednesday-only reminders and door-to-door stickers (`8abc76c`)

**Wednesday reminders (replaces the ladder)**
- Texts only go out on Wednesday, no matter what day the client came in.
- First text: the first Wednesday at least 14 days after the cut, so 2–3 weeks out.
- Then every 3 weeks on a Wednesday until they book or text STOP.
- Skipped if the client has a booking or texted the shop in the last week. A new cut restarts the count.
- The barber's offer (e.g. "$5 off") goes out once, at 8+ weeks.

**Door to door**
- **You:** scan a fresh sticker while logged in as admin, type the shop name, save, hand it over.
- **The barber:** scans it and sees "Set up Kings Cuts in 2 minutes", signs up, then:
  1. Their name.
  2. Their cell (shop name already filled in).
  3. Done. Services and hours start with defaults they can edit later. SMS marketing is on.
- The sticker connects automatically. Clients who scan it afterwards land on that shop's VIP sign-up page.
- **Your admin page** lists every sticker you've handed out, marked "Waiting for setup" or "Set up".
- Referral and sticker codes survive the sign-up email being opened in another browser, such as inside the Gmail app.

**Referred barbers:** full setup, with the sticker as an optional add-on that starts off.

**Migration:** `20261002g_sticker_handout`.

## Round 6: checks before launch (`1e618f9`, `d219722`, `fa9f847`, `f000332`)

- **Security hole closed (it existed before this work).** Any logged-in barber could give themselves the Full plan, extend their trial to 2099 or lift a lockout, straight from the browser. The browser can now only read that data. A test checks it. Migration: `20261002h_lock_users_writes`.
- **The Wednesday run is more reliable:**
  - If the noon run fails, it retries that same afternoon.
  - Each client is marked before their text goes out, so overlapping runs can't text anyone twice.
  - If a send fails, it's retried that afternoon.
  - Tested with 300 clients due at once: one run, each texted exactly once.
- **Printed stickers were broken (this was there before my changes):**
  - The download printed every sticker as a blank white card. Fixed.
  - Stickers now print in English and Spanish, and the admin page shows the exact URL the QR codes open before you print.
  - Tested by reading the QR code out of the downloaded image and opening it.
- **Existing accounts can use a sticker.** A barber who already has an account taps "Already have an account?" on the sticker page and the sticker connects when they sign in.
- **Launch docs:** `docs/LAUNCH.md` and `.env.example`.
- **One source for the app URL:** every link and Twilio webhook reads the URL from one setting, so none can build "undefined/…" links.

## Later changes

- **Missed-call follow-up removed** (Oct 3). A missed call now sends exactly one text with the booking link. The 2-hour follow-up and its scheduled job are gone.
- **Link previews don't count as taps** (`c95e708`). Phones fetch links on their own to draw a preview; only a person opening the link is counted in click stats.
- **Logic review fixes** (Oct 3):
  - After a missed call, the caller no longer hears "an application error has occurred". The missed-call handler now answers Twilio in the format it expects.
  - Loyalty, cancel and reschedule texts only go to clients who agreed to texts, like every other client text.
  - Rescheduling clears the old reminders, so the new time gets its own 24-hour and 2-hour reminders.
  - Two overlapping reminder runs can't both text the same client.
  - The "Done with Jamie?" nudge goes out once per appointment instead of up to 4 times, and in Spanish for Spanish-speaking barbers.
  - The morning summary counts today's appointments in the barber's timezone (it was using UTC midnight), and is in the barber's language.
  - Broadcasts end with "Reply STOP" in each client's language.
  - **First-time callers now get the missed-call text, once.** Before, only clients who had already opted in got it, so a new caller got nothing. Someone who never opts in is never texted by a missed call again. STOP still blocks it.

---

## Database migrations to run (in order)

| Migration | What it does |
|---|---|
| `20261002_client_sessions` | Tokens for recognizing returning clients |
| `20261002b_sms_log_inbound` | Saves client replies |
| `20261002c_contact_notes` | Private client notes |
| `20261002d_sms_marketing` | Marketing switch and sticker request fields |
| `20261002e_referrals` | Referral codes, referrals, billing credits, opt-out reasons |
| `20261002f_winback_copy` | Fixes the "Last one from me" and "1 cuts" texts |
| `20261002g_sticker_handout` | Which shop each sticker was handed to |
| `20261002h_lock_users_writes` | **Security fix.** Run this one even if nothing else ships. |

## Before you deploy

1. Run the migrations above.
2. Set `NEXT_PUBLIC_APP_URL=https://www.linecatch.app`. It's printed into every QR sticker.
3. Supabase → Auth → Redirect URLs: add `https://www.linecatch.app/auth/callback**`.
4. Add your user id to `ADMIN_USER_IDS` so the hand-out screen works.
5. The reminders run every hour and every 15 minutes, which needs a paid Vercel plan. The free plan rejects the deploy.
6. Twilio: set each number's webhooks and start A2P 10DLC carrier registration.

Full details are in [`docs/LAUNCH.md`](LAUNCH.md).

## Not done yet (needs your decision)

- **Phone numbers for new barbers.** New barbers get no LineCatch number until one is assigned by hand, so their missed-call texts can't go out before that. This is the biggest gap for door to door.
- **Billing.** Referral credits, the 50% discount, the $7 sticker and the plans are recorded, but nothing charges anyone yet.
- **Carrier registration (A2P 10DLC).** Needed before marketing texts. It can take weeks.
- **A real test text to your own phone.** Blocked: there are no Twilio credentials here and the network blocks Twilio. Do it in the smoke test in `LAUNCH.md`.

## How it was tested

Everything was tested on a local copy of the production database schema, with every text logged instead of sent.

| Suite | Tests | What it covers |
|---|---|---|
| Unit tests | 196 | Wednesday schedule (a simulated year, cuts on every weekday), translations, referral codes, loyalty, consent |
| API | 61 | Bookings, texts, opt-outs, settings, security lock-down, referral and sticker codes |
| Time travel | 18 | Wednesday reminders over months, catch-up runs, no double texts, review timing, STOP |
| Browser | 22 | Onboarding, settings, schedule, messages, no sideways scrolling on phones |
| Door to door | 10 | Hand-out, two-step setup, client scan, printed QR decoding, sign-in claims |
| Full demo | 1 run | New barber via referral, client books, visit completed, revenue updated, texts until STOP |

All suites pass, and the production build succeeds.

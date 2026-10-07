# Staging

A second copy of LineCatch for trying changes before they reach barbers.

| | Live | Staging |
|---|---|---|
| Code | `main` branch | `staging` branch |
| Site | www.linecatch.app | the `staging` branch's Vercel address |
| Database | Supabase `yhcddgeffdonadhaypkd` | Supabase `linecatch-staging` (`uprrexhiqkrmnuidllmk`) |
| Texts | sent | not sent (`SMS_DEV_MODE=true`): they show in the app's Messages screen |
| Phone numbers | bought from Twilio | fake 555 numbers |
| Scheduled jobs (reminders, auto-complete, Wednesdays) | run on their own | don't run (Vercel only runs them on live) |

## How a change goes out
1. Built and tested locally (all end-to-end suites).
2. Database changes applied to **staging** first.
3. Pushed to the `staging` branch → Vercel builds the staging site.
4. Tried on a phone on staging.
5. "push to main" → database change on live, then `main`.

## How staging was built (Oct 7, 2026)
`supabase/staging/01–05_*.sql` were read from live's database catalog (tables, rules, indexes,
functions, policies, permissions, storage buckets) and applied to the staging project, plus live's
default texts. One deliberate difference: staging has the users-table security fix
(`20261002h_lock_users_writes`).

## Free plan note
A free Supabase project pauses after a week without use: Supabase dashboard → linecatch-staging → Restore.

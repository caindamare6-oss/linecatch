# PROGRESS.md — Stripe billing for LineCatch

Notes from each chat, newest at the bottom. The builder writes what it changed and how to test it. The planner writes review results and any fixes the builder needs to make.

---

## 2026-10-09 — Setup
- Created the `stripe-billing` branch from `staging`.
- Added PLAN.md and this file.
- **Next task:** Damare creates the Stripe account (test mode) using the EIN and adds the test keys to Vercel's preview environment variables. The builder can't do this one. Once done, the builder starts on "Install Stripe in the app."

import { appUrl, money } from "@/lib/config";
import type { createAdminClient } from "@/lib/supabase/admin";

export type WeeklyNumbers = { caught: number; booked: number; savedCents: number };

/** Nothing worth an email: no missed calls were caught this week. */
export const hasNews = (n: WeeklyNumbers) => n.caught > 0;

/** The headline: "LineCatch caught 6 missed calls. 3 booked, $135 you would have lost." */
export function headline(n: WeeklyNumbers): string {
  const calls = n.caught === 1 ? "1 missed call" : `${n.caught} missed calls`;
  if (n.booked === 0) return `LineCatch caught ${calls} this week and texted them your booking link.`;
  return `LineCatch caught ${calls} this week. ${n.booked} booked, ${money(n.savedCents)} you would have lost.`;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Monday's email to one barber: their own missed calls caught → booked → money saved. */
export function weeklySummaryEmail(n: WeeklyNumbers, shopName: string | null): { subject: string; html: string } {
  const subject = n.booked > 0 ? `Your week: ${money(n.savedCents)} saved from missed calls` : `Your week: ${n.caught} missed ${n.caught === 1 ? "call" : "calls"} caught`;
  const stat = (value: string, label: string) =>
    `<td style="padding:16px 8px;text-align:center;border:1px solid #2a2724;border-radius:12px;background:#1b1917"><div style="font-size:28px;font-weight:600;color:#D4AF7A">${value}</div><div style="font-size:13px;color:#a8a29a;margin-top:4px">${label}</div></td>`;
  const html = `<!doctype html><html><body style="margin:0;background:#121110;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#f2efe9">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
  <div style="font-size:20px;font-weight:600">Line<span style="color:#D4AF7A">Catch</span></div>
  <p style="font-size:14px;color:#a8a29a;margin:24px 0 4px">${shopName ? `${esc(shopName)} · ` : ""}last 7 days</p>
  <h1 style="font-size:22px;line-height:1.35;font-weight:600;margin:0 0 24px">${esc(headline(n))}</h1>
  <table role="presentation" width="100%" cellspacing="8" cellpadding="0" style="border-collapse:separate"><tr>
    ${stat(String(n.caught), "missed calls caught")}
    ${stat(String(n.booked), "booked from the text")}
    ${stat(money(n.savedCents), "you would have lost")}
  </tr></table>
  <p style="margin:28px 0"><a href="${appUrl()}/dashboard" style="display:inline-block;background:#D4AF7A;color:#121110;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px">Open your dashboard</a></p>
  <p style="font-size:12px;color:#7d776f;line-height:1.6">You get this every Monday when LineCatch caught missed calls for you. Turn it off in Settings → Account → Weekly summary email. Questions? Just reply.</p>
</div></body></html>`;
  return { subject, html };
}

type Admin = ReturnType<typeof createAdminClient>;

/** One barber's last 7 days: missed calls texted back, bookings from that text, and their value. */
export async function weeklyNumbers(db: Admin, userId: string, start: Date, end: Date): Promise<WeeklyNumbers> {
  const [{ count: caught }, { data: booked }, { data: services }] = await Promise.all([
    db.from("missed_calls_log").select("call_id", { count: "exact", head: true })
      .eq("user_id", userId).eq("status", "sms_sent").gte("timestamp", start.toISOString()).lt("timestamp", end.toISOString()),
    db.from("bookings").select("service_id, status")
      .eq("user_id", userId).eq("source", "missed_call").neq("status", "cancelled").gte("created_at", start.toISOString()).lt("created_at", end.toISOString()),
    db.from("services").select("id, price").eq("user_id", userId),
  ]);
  const prices = new Map((services || []).map((s) => [s.id, Math.round(Number(s.price) * 100)]));
  return {
    caught: caught || 0,
    booked: (booked || []).length,
    savedCents: (booked || []).reduce((sum, b) => sum + (prices.get(b.service_id) ?? 0), 0),
  };
}


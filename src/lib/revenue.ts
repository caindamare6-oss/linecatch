import { barberLocalToUTC } from "@/lib/format";

/** Calendar parts of `date` as seen on the barber's wall clock. */
export function localParts(date: Date, tz: string) {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", hour12: false }).formatToParts(date);
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour") % 24 };
}

const ymd = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** UTC instants bounding the barber's current and previous calendar month. */
export function monthBounds(now: Date, tz: string) {
  const { year, month } = localParts(now, tz);
  const prevY = month === 1 ? year - 1 : year;
  const prevM = month === 1 ? 12 : month - 1;
  const nextY = month === 12 ? year + 1 : year;
  const nextM = month === 12 ? 1 : month + 1;
  return {
    start: barberLocalToUTC(ymd(year, month, 1), "00:00", tz),
    end: barberLocalToUTC(ymd(nextY, nextM, 1), "00:00", tz),
    prevStart: barberLocalToUTC(ymd(prevY, prevM, 1), "00:00", tz),
    year,
    month,
    prevYear: prevY,
    prevMonth: prevM,
  };
}

export type RevenueBooking = { booking_time: string; service_id: string };

/**
 * Revenue from completed cuts at current service prices.
 * `points` is the running total at the end of each week of this month (week 5 only when the month reaches day 29).
 * `lastMonthToDate` covers the same number of days last month, so the comparison is fair mid-month.
 */
export function monthRevenue(bookings: RevenueBooking[], prices: Record<string, number>, tz: string, now = new Date()) {
  const b = monthBounds(now, tz);
  const today = localParts(now, tz).day;
  const weeks = Math.ceil(daysIn(b.year, b.month) / 7);
  const perWeek = Array(weeks).fill(0);
  let total = 0;
  let cuts = 0;
  let lastMonthToDate = 0;

  for (const bk of bookings) {
    const t = new Date(bk.booking_time);
    const price = prices[bk.service_id] ?? 0;
    if (t >= b.start && t < b.end) {
      const day = localParts(t, tz).day;
      perWeek[Math.min(Math.floor((day - 1) / 7), weeks - 1)] += price;
      total += price;
      cuts++;
    } else if (t >= b.prevStart && t < b.start) {
      const p = localParts(t, tz);
      if (p.day <= today) lastMonthToDate += price;
    }
  }

  const currentWeek = Math.min(Math.floor((today - 1) / 7), weeks - 1);
  let run = 0;
  const points = perWeek.map((v, i) => (i <= currentWeek ? (run += v) : null));
  return { total, cuts, lastMonthToDate, points, currentWeek, monthName: new Date(Date.UTC(b.year, b.month - 1, 15)).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" }) };
}

export function greetingFor(now: Date, tz: string) {
  const h = localParts(now, tz).hour;
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

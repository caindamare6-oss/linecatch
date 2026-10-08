/**
 * Where to go after logging in: a path on this app taken from ?next=, or the dashboard.
 * Only same-site paths ("/dashboard/schedule?…"), never "//evil.com" or "https://…".
 */
export function safeNext(raw: string | null | undefined, fallback = "/dashboard"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  if (raw.startsWith("/login") || raw.startsWith("/auth")) return fallback;
  return raw;
}

/** A booking on the barber's schedule, for links in texts to the barber: opens that day, booking marked. */
export function scheduleLink(appUrl: string, bookingId: string, bookingTime: Date | string, tz: string): string {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(bookingTime));
  return `${appUrl}/dashboard/schedule?day=${day}&booking=${bookingId}`;
}

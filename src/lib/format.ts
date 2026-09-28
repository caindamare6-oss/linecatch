const DEFAULT_TZ = "America/New_York";

export function formatBarberDate(
  date: Date,
  tz: string = DEFAULT_TZ,
  style: "long" | "short" = "long"
): string {
  return date.toLocaleDateString("en-US", {
    weekday: style === "long" ? "long" : "short",
    month: style === "long" ? "long" : "short",
    day: "numeric",
    timeZone: tz,
  });
}

export function formatBarberTime(date: Date, tz: string = DEFAULT_TZ): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  });
}

/**
 * Extract the hour and minute of a Date in a given timezone, as minutes-since-midnight.
 */
export function minutesInTz(date: Date, tz: string = DEFAULT_TZ): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const h = parseInt(parts.find((p) => p.type === "hour")?.value || "0");
  const m = parseInt(parts.find((p) => p.type === "minute")?.value || "0");
  return (h === 24 ? 0 : h) * 60 + m;
}

/**
 * Construct a UTC Date from a wall-clock date+time in the barber's timezone.
 * dateStr: "2026-09-28", timeStr: "16:30", tz: "America/New_York"
 * Returns a Date whose UTC value equals that wall-clock moment in tz.
 */
export function barberLocalToUTC(
  dateStr: string,
  timeStr: string,
  tz: string = DEFAULT_TZ
): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);

  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);

  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });

  const parts = fmt.formatToParts(new Date(utcGuess));
  const get = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value || "0");

  const h = get("hour") === 24 ? 0 : get("hour");
  const tzUTC = Date.UTC(get("year"), get("month") - 1, get("day"), h, get("minute"), get("second"));

  const offset = tzUTC - utcGuess;
  return new Date(utcGuess - offset);
}

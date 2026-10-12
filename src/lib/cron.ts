/**
 * Crons normally use the real clock. For local testing only, `?now=` can move it
 * when ALLOW_TIME_TRAVEL=true (never set in production).
 */
export function cronNow(request: Request): Date {
  const raw = new URL(request.url).searchParams.get("now");
  if (raw && process.env.ALLOW_TIME_TRAVEL === "true" && process.env.NODE_ENV !== "production") {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}

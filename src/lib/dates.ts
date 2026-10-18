export const TZ = "Europe/Lisbon";

/** YYYY-MM-DD for the given instant in Lisbon time. */
export function dayKey(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

/** UTC bounds covering a Lisbon calendar day (padded to cover DST offsets). */
export function dayRange(day: string): { start: Date; end: Date } {
  const start = new Date(`${day}T00:00:00Z`);
  start.setUTCHours(start.getUTCHours() - 2);
  const end = new Date(`${day}T23:59:59Z`);
  return { start, end };
}

export function isOnDay(d: Date, day: string): boolean {
  return dayKey(d) === day;
}

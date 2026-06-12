/**
 * Date math for recurring weekly trips ("every Friday").
 * Shared by the booking UI, the booking API (server-side validation),
 * and admin batch views. All dates are handled as local-date strings
 * (YYYY-MM-DD) to avoid timezone drift between client and server.
 */

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

/** Format a Date as YYYY-MM-DD in local time (NOT toISOString, which is UTC). */
export function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Next N occurrences of a weekday, starting from tomorrow at the earliest
 * (today's departure is never bookable — operations need lead time).
 * Returns YYYY-MM-DD strings.
 */
export function nextOccurrences(weekday: number, count: number, from: Date = new Date()): string[] {
  const out: string[] = [];
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  d.setDate(d.getDate() + 1); // start from tomorrow
  while (out.length < count) {
    if (d.getDay() === weekday) out.push(toDateString(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** Is this YYYY-MM-DD a valid, currently-bookable departure for the trip? */
export function isValidDeparture(
  dateStr: string,
  weekday: number,
  weeksAhead: number,
  from: Date = new Date()
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const allowed = nextOccurrences(weekday, Math.max(1, weeksAhead), from);
  return allowed.includes(dateStr);
}

/** Return date for a batch: departure + (durationDays - 1). */
export function batchEndDate(departure: string, durationDays?: number | null): string {
  const [y, m, d] = departure.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + Math.max(0, (durationDays || 1) - 1));
  return toDateString(date);
}

/** "Fri, 13 Jun 2026" display for a YYYY-MM-DD string (parsed as local). */
export function formatDeparture(dateStr: string, opts?: Intl.DateTimeFormatOptions): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', opts || { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

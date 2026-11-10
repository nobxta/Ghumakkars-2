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

/**
 * Multi-departure trips ("batch" trips, is_recurring = true) can have:
 *   - a weekly rule (recurrence_day + recurrence_weeks_ahead), optional, and/or
 *   - hand-picked custom dates (custom_dates), optional.
 * Departures are the union of both, future-only, sorted.
 */
export interface DepartureSchedule {
  is_recurring?: boolean | null;
  recurrence_day?: number | null;
  recurrence_weeks_ahead?: number | null;
  custom_dates?: (string | null)[] | null;
}

/** Normalise custom dates to unique, sorted YYYY-MM-DD strings. */
export function normalizeCustomDates(dates?: (string | null)[] | null): string[] {
  const set = new Set<string>();
  (dates || []).forEach((d) => {
    const m = d ? /^(\d{4}-\d{2}-\d{2})/.exec(d) : null;
    if (m) set.add(m[1]);
  });
  return Array.from(set).sort();
}

/** All bookable departures (from tomorrow onwards) for a multi-departure trip. */
export function tripDepartures(trip: DepartureSchedule, from: Date = new Date()): string[] {
  if (!trip.is_recurring) return [];
  const out = new Set<string>();
  if (typeof trip.recurrence_day === 'number' && trip.recurrence_day >= 0 && trip.recurrence_day <= 6) {
    nextOccurrences(trip.recurrence_day, Math.max(1, Number(trip.recurrence_weeks_ahead) || 4), from)
      .forEach((d) => out.add(d));
  }
  const tomorrow = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1);
  const minStr = toDateString(tomorrow);
  normalizeCustomDates(trip.custom_dates).forEach((d) => { if (d >= minStr) out.add(d); });
  return Array.from(out).sort();
}

/** Is this YYYY-MM-DD a currently-bookable departure for the trip? */
export function isValidTripDeparture(dateStr: string, trip: DepartureSchedule, from: Date = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  return tripDepartures(trip, from).includes(dateStr);
}

/** Short schedule label: "Every Friday", "Every Friday + 3 dates", "4 dates". */
export function scheduleLabel(trip: DepartureSchedule, short = false): string {
  const hasWeekly = typeof trip.recurrence_day === 'number';
  const dayName = hasWeekly ? DAY_NAMES[trip.recurrence_day as number] : '';
  const weekly = hasWeekly ? `Every ${short ? dayName.slice(0, 3) : dayName}` : '';
  const upcomingCustom = tripDepartures({ ...trip, is_recurring: true, recurrence_day: null }).length;
  const custom = upcomingCustom > 0 ? `${upcomingCustom} date${upcomingCustom === 1 ? '' : 's'}` : '';
  if (weekly && custom) return `${weekly} + ${custom}`;
  if (weekly) return weekly;
  if (custom) return custom;
  return 'Multiple dates';
}

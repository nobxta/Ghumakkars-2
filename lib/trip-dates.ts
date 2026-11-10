import { tripDepartures, toDateString } from './recurrence';

/**
 * Upcoming departure dates for the public trips list.
 *
 * Recurring trips store no start_date (it is NULL) — their departures are
 * derived from recurrence_day / recurrence_weeks_ahead, exactly as the booking
 * page does. One-off trips use start_date (or the postponed date). Past dates
 * are dropped. Everything is a YYYY-MM-DD string compared against "today" in
 * India time, so the server render (UTC) and the browser agree.
 */

export interface TripDateFields {
  start_date?: string | null;
  postponed_to_date?: string | null;
  is_recurring?: boolean | null;
  recurrence_day?: number | null;
  recurrence_weeks_ahead?: number | null;
  custom_dates?: (string | null)[] | null;
}

/** Today's calendar date in Asia/Kolkata, as a local-midnight Date. */
export function todayInIndia(now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now); // "2026-10-26"
  const [y, m, d] = parts.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Leading YYYY-MM-DD of a date or timestamp string, or null if unusable. */
function dateOnly(value?: string | null): string | null {
  if (!value) return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return match ? match[1] : null;
}

export function upcomingDepartures(trip: TripDateFields, today: Date = todayInIndia()): string[] {
  if (trip.is_recurring) {
    // Weekly rule and/or hand-picked custom dates.
    return tripDepartures(trip, today);
  }
  const todayStr = toDateString(today);
  const date = dateOnly(trip.postponed_to_date) || dateOnly(trip.start_date);
  return date && date >= todayStr ? [date] : [];
}

/**
 * Seat-lock balance deadline.
 *
 * The balance must be paid `daysBefore` days before departure. The number is
 * resolved as: per-trip override -> global setting -> 5 (hard fallback).
 * This is the single source of truth — every screen and email should use it.
 */
export function resolveDueDays(tripDaysBefore?: number | null, globalDaysBefore?: number | null): number {
  if (tripDaysBefore != null && !Number.isNaN(Number(tripDaysBefore))) return Number(tripDaysBefore);
  if (globalDaysBefore != null && !Number.isNaN(Number(globalDaysBefore))) return Number(globalDaysBefore);
  return 5;
}

/** Returns the deadline Date (balance due) or null if no departure date. */
export function resolveDueDate(
  departure?: string | Date | null,
  tripDaysBefore?: number | null,
  globalDaysBefore?: number | null
): Date | null {
  if (!departure) return null;
  const base = new Date(departure);
  if (Number.isNaN(base.getTime())) return null;
  const days = resolveDueDays(tripDaysBefore, globalDaysBefore);
  return new Date(base.getTime() - days * 86400000);
}

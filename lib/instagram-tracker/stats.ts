/** Growth maths over follower snapshots. Pure functions — shared by API routes. */

export interface Snap {
  followers_count: number;
  captured_at: string;
  source?: string;
}

export interface Growth {
  /** Net change vs. the value at that point in time (null = no data yet). */
  value: number | null;
  /** True when history doesn't go back the full period (delta is since tracking began). */
  partial: boolean;
}

const IST_OFFSET_MS = 330 * 60_000;
export const istDay = (iso: string) => new Date(new Date(iso).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

/** Snapshots must be sorted ascending by captured_at. */
export function growthSince(snaps: Snap[], current: number | null, sinceMs: number): Growth {
  if (current == null || snaps.length === 0) return { value: null, partial: false };
  let base: Snap | null = null;
  for (const s of snaps) {
    if (new Date(s.captured_at).getTime() <= sinceMs) base = s;
    else break;
  }
  if (base) return { value: current - base.followers_count, partial: false };
  return { value: current - snaps[0].followers_count, partial: true };
}

export interface Bucket {
  key: string;        // YYYY-MM-DD (day / week start) or YYYY-MM
  close: number;      // last follower count in the bucket
  net: number | null; // close − previous bucket's close
}

/** Group ascending snapshots into day / week (Mon start) / month buckets, IST. */
export function buckets(snaps: Snap[], unit: 'day' | 'week' | 'month'): Bucket[] {
  const map = new Map<string, number>();
  for (const s of snaps) {
    const d = istDay(s.captured_at);
    let key = d;
    if (unit === 'month') key = d.slice(0, 7);
    else if (unit === 'week') {
      const dt = new Date(`${d}T00:00:00Z`);
      const dow = (dt.getUTCDay() + 6) % 7; // Mon = 0
      dt.setUTCDate(dt.getUTCDate() - dow);
      key = dt.toISOString().slice(0, 10);
    }
    map.set(key, s.followers_count); // ascending → last write wins = close
  }
  const out: Bucket[] = [];
  let prev: number | null = null;
  map.forEach((close, key) => {
    out.push({ key, close, net: prev == null ? null : close - prev });
    prev = close;
  });
  return out;
}

export const DAY_MS = 86_400_000;

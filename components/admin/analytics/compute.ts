/**
 * Client-side aggregation for the admin Analytics page. Everything is computed
 * from the slim feed returned by /api/admin/analytics, in India time (IST), so
 * changing range / granularity / trip filter never needs a round trip.
 */

export type Trip = {
  id: string; title: string; destination: string; price: number; originalPrice: number; capacity: number;
  start: string | null; end: string | null; recurring: boolean; active: boolean; status: string; createdAt: string;
};
export type Booking = {
  id: string; tripId: string | null; userId: string | null; status: string; effStatus: string; pax: number;
  departure: string | null; method: string; mode: string; offline: boolean; coupon: string | null;
  couponDiscount: number; walletUsed: number; waived: number; addons: number; owed: number; paid: number;
  refunded: number; remaining: number; payStatus: string; partner: string | null; commission: number;
  college: string | null; gender: string | null; pickup: string | null; createdAt: string;
};
export type Payment = {
  id: string; bookingId: string; tripId: string | null; amount: number; refunded: number; status: string;
  method: string; mode: string; type: string | null; upi: string | null; network: string | null; partner: boolean; at: string;
};
export type User = { id: string; createdAt: string; verified: boolean; college: string | null; gender: string | null; referred: boolean };
export type Referral = { id: string; createdAt: string; status: string; reward: number; creditedAt: string | null; converted: boolean };
export type Feed = { generatedAt: string; trips: Trip[]; bookings: Booking[]; payments: Payment[]; users: User[]; referrals: Referral[] };

export type Granularity = 'day' | 'week' | 'month';
export type Range = { from: Date; to: Date };

// ───────────────────────── time (IST) ─────────────────────────
const IST = 330 * 60000;
const DAY = 86400000;
/** Shift an instant so its UTC fields read as IST wall-clock. */
const ist = (d: Date | string | number) => new Date(new Date(d).getTime() + IST);
const pad = (x: number) => String(x).padStart(2, '0');

export const istParts = (d: Date | string) => {
  const s = ist(d);
  return { y: s.getUTCFullYear(), m: s.getUTCMonth(), d: s.getUTCDate(), dow: (s.getUTCDay() + 6) % 7, h: s.getUTCHours() };
};
/** Midnight IST of the given IST calendar day, as a real instant. */
export const istMidnight = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d) - IST);
export const startOfTodayIST = () => { const p = istParts(new Date()); return istMidnight(p.y, p.m, p.d); };

export function bucketKey(iso: string | Date, g: Granularity): string {
  const p = istParts(iso);
  if (g === 'month') return `${p.y}-${pad(p.m + 1)}`;
  if (g === 'week') {
    const mon = new Date(Date.UTC(p.y, p.m, p.d) - p.dow * DAY);
    return `${mon.getUTCFullYear()}-${pad(mon.getUTCMonth() + 1)}-${pad(mon.getUTCDate())}`;
  }
  return `${p.y}-${pad(p.m + 1)}-${pad(p.d)}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function bucketLabel(key: string, g: Granularity, long = false): string {
  const [y, m, d] = key.split('-').map(Number);
  if (g === 'month') return long ? `${MONTHS[m - 1]} ${y}` : `${MONTHS[m - 1]} ’${String(y).slice(2)}`;
  if (g === 'week') return long ? `Week of ${d} ${MONTHS[m - 1]} ${y}` : `${d} ${MONTHS[m - 1]}`;
  return long ? `${d} ${MONTHS[m - 1]} ${y}` : `${d} ${MONTHS[m - 1]}`;
}

/** Every bucket key covering the range, in order (so empty periods show as 0). */
export function bucketKeys(r: Range, g: Granularity): string[] {
  const keys: string[] = [];
  const p = istParts(r.from);
  let cur = Date.UTC(p.y, p.m, p.d);
  const endP = istParts(r.to);
  const end = Date.UTC(endP.y, endP.m, endP.d);
  let guard = 0;
  while (cur <= end && guard++ < 2000) {
    const k = bucketKey(new Date(cur - IST), g);
    if (keys[keys.length - 1] !== k) keys.push(k);
    cur += DAY;
  }
  return keys;
}

export function autoGranularity(r: Range): Granularity {
  const days = (r.to.getTime() - r.from.getTime()) / DAY;
  if (days <= 45) return 'day';
  if (days <= 200) return 'week';
  return 'month';
}

export const previousRange = (r: Range): Range => {
  const len = r.to.getTime() - r.from.getTime();
  return { from: new Date(r.from.getTime() - len - 1), to: new Date(r.from.getTime() - 1) };
};

export const within = (iso: string | null | undefined, r: Range) => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= r.from.getTime() && t <= r.to.getTime();
};

// ───────────────────────── money rules ─────────────────────────
export const COUNTED_PAYMENT = ['verified', 'partially_refunded', 'refunded'];
/** Net money kept from one ledger row on our own (non-partner) bookings. */
export const netOf = (p: Payment) => (p.partner || !COUNTED_PAYMENT.includes(p.status) ? 0 : Math.max(0, p.amount - p.refunded));
export const isLive = (b: Booking) => !['cancelled', 'rejected'].includes(b.status);
export const SEATED = ['confirmed', 'seat_locked', 'on_trip', 'completed', 'referred', 'remaining_submitted'];
export const isSeated = (b: Booking) => SEATED.includes(b.status);

// ───────────────────────── formatting ─────────────────────────
export const inr = (v: number) => `₹${Math.round(v || 0).toLocaleString('en-IN')}`;
export function inrShort(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e7) return `₹${(v / 1e7).toFixed(a >= 1e8 ? 0 : 1)}Cr`;
  if (a >= 1e5) return `₹${(v / 1e5).toFixed(a >= 1e6 ? 0 : 1)}L`;
  if (a >= 1e3) return `₹${(v / 1e3).toFixed(a >= 1e4 ? 0 : 1)}k`;
  return `₹${Math.round(v)}`;
}
export const num = (v: number) => Math.round(v || 0).toLocaleString('en-IN');
export const pct = (v: number, digits = 0) => `${(Number.isFinite(v) ? v * 100 : 0).toFixed(digits)}%`;
export const delta = (cur: number, prev: number): number | null => (prev === 0 ? (cur === 0 ? 0 : null) : (cur - prev) / Math.abs(prev));

export function titleCase(s: string) {
  return s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ───────────────────────── scoped dataset ─────────────────────────
export type Scope = { feed: Feed; tripId: string | 'all'; includePartner: boolean };

export function scoped(s: Scope) {
  const byTrip = (id: string | null) => s.tripId === 'all' || id === s.tripId;
  const bookings = s.feed.bookings.filter((b) => byTrip(b.tripId) && (s.includePartner || !b.partner));
  const payments = s.feed.payments.filter((p) => byTrip(p.tripId));
  return { bookings, payments, users: s.feed.users, trips: s.feed.trips, referrals: s.feed.referrals };
}
export type Scoped = ReturnType<typeof scoped>;

// ───────────────────────── KPIs ─────────────────────────
export type Kpis = {
  revenue: number; bookings: number; travellers: number; newUsers: number; aov: number; commission: number;
  refunds: number; discounts: number; cancelled: number; buyers: number; conversion: number; payments: number; addons: number;
};

export function kpis(d: Scoped, r: Range): Kpis {
  const pays = d.payments.filter((p) => within(p.at, r));
  const revenue = pays.reduce((s, p) => s + netOf(p), 0);
  const refunds = pays.reduce((s, p) => s + (p.partner ? 0 : p.refunded), 0);
  const bk = d.bookings.filter((b) => within(b.createdAt, r));
  const live = bk.filter(isLive);
  const travellers = live.filter(isSeated).reduce((s, b) => s + b.pax, 0);
  const newUsers = d.users.filter((u) => within(u.createdAt, r)).length;
  const commission = live.reduce((s, b) => s + b.commission, 0);
  const discounts = live.reduce((s, b) => s + b.couponDiscount + b.walletUsed + b.waived, 0);
  const addons = live.reduce((s, b) => s + b.addons, 0);
  const own = live.filter((b) => !b.partner);
  const value = own.reduce((s, b) => s + b.owed, 0);
  const buyers = new Set(live.map((b) => b.userId).filter(Boolean)).size;
  const newUserIds = new Set(d.users.filter((u) => within(u.createdAt, r)).map((u) => u.id));
  const converted = new Set(live.filter((b) => b.userId && newUserIds.has(b.userId)).map((b) => b.userId)).size;
  return {
    revenue, refunds, commission, discounts, addons,
    bookings: live.length,
    cancelled: bk.length - live.length,
    travellers,
    newUsers,
    aov: own.length ? value / own.length : 0,
    buyers,
    conversion: newUserIds.size ? converted / newUserIds.size : 0,
    payments: pays.filter((p) => netOf(p) > 0).length,
  };
}

// ───────────────────────── time series ─────────────────────────
export type Metric = 'revenue' | 'bookings' | 'travellers' | 'users' | 'aov';
export const METRIC_LABEL: Record<Metric, string> = {
  revenue: 'Revenue collected', bookings: 'Bookings', travellers: 'Travellers', users: 'New sign-ups', aov: 'Avg. booking value',
};

export function series(d: Scoped, r: Range, g: Granularity, metric: Metric): { key: string; value: number }[] {
  const keys = bucketKeys(r, g);
  const map = new Map<string, number>(keys.map((k) => [k, 0]));
  const cnt = new Map<string, number>();
  const add = (iso: string, v: number) => {
    const k = bucketKey(iso, g);
    if (map.has(k)) { map.set(k, (map.get(k) || 0) + v); cnt.set(k, (cnt.get(k) || 0) + 1); }
  };
  if (metric === 'revenue') d.payments.forEach((p) => within(p.at, r) && add(p.at, netOf(p)));
  else if (metric === 'users') d.users.forEach((u) => within(u.createdAt, r) && add(u.createdAt, 1));
  else d.bookings.filter(isLive).forEach((b) => {
    if (!within(b.createdAt, r)) return;
    if (metric === 'bookings') add(b.createdAt, 1);
    else if (metric === 'travellers') add(b.createdAt, isSeated(b) ? b.pax : 0);
    else if (metric === 'aov' && !b.partner) add(b.createdAt, b.owed);
  });
  return keys.map((k) => ({ key: k, value: metric === 'aov' ? (cnt.get(k) ? (map.get(k) || 0) / (cnt.get(k) || 1) : 0) : map.get(k) || 0 }));
}

/** Per-bucket values for a sparkline in a KPI tile. */
export function spark(d: Scoped, r: Range, metric: Metric) {
  const g: Granularity = autoGranularity(r) === 'day' ? 'day' : 'week';
  return series(d, r, g, metric).map((x) => x.value);
}

/** Revenue in the range split by channel per bucket (stacked bars). */
export function revenueByChannel(d: Scoped, r: Range, g: Granularity) {
  const keys = bucketKeys(r, g);
  const rows = keys.map((k) => ({ key: k, gateway: 0, manual: 0, offline: 0, other: 0 }));
  const idx = new Map(keys.map((k, i) => [k, i]));
  d.payments.forEach((p) => {
    if (!within(p.at, r)) return;
    const i = idx.get(bucketKey(p.at, g));
    if (i == null) return;
    const ch = (['gateway', 'manual', 'offline'].includes(p.mode) ? p.mode : 'other') as 'gateway' | 'manual' | 'offline' | 'other';
    rows[i][ch] += netOf(p);
  });
  return rows;
}

export function cumulative(values: number[]) {
  let s = 0;
  return values.map((v) => (s += v));
}

// ───────────────────────── breakdowns ─────────────────────────
export type Slice = { key: string; label: string; value: number; extra?: number };

export function groupSum<T>(items: T[], keyOf: (x: T) => string | null, valOf: (x: T) => number, labelOf: (k: string) => string = titleCase): Slice[] {
  const m = new Map<string, number>();
  items.forEach((x) => {
    const k = keyOf(x);
    if (!k) return;
    m.set(k, (m.get(k) || 0) + valOf(x));
  });
  return Array.from(m.entries())
    .map(([key, value]) => ({ key, label: labelOf(key), value }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);
}

/** Keep the top N, fold the rest into "Other" (never invent extra hues). */
export function topN(slices: Slice[], n: number): Slice[] {
  if (slices.length <= n) return slices;
  const head = slices.slice(0, n - 1);
  const rest = slices.slice(n - 1).reduce((s, x) => s + x.value, 0);
  return [...head, { key: '__other', label: 'Other', value: rest }];
}

export const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Confirmed', seat_locked: 'Seat locked', remaining_submitted: 'Seat locked', on_trip: 'On trip', completed: 'Completed',
  cancelled: 'Cancelled', referred: 'Partner', pending: 'Pending', rejected: 'Rejected',
};

export const METHOD_LABEL: Record<string, string> = {
  upi: 'UPI', card: 'Card', emi: 'EMI', netbanking: 'Net banking', wallet: 'Wallet', cash: 'Cash', manual: 'Manual transfer', other: 'Other',
};
export const CHANNEL_LABEL: Record<string, string> = { gateway: 'Razorpay', manual: 'Manual UPI', offline: 'Recorded offline', other: 'Other' };

// ───────────────────────── heatmap ─────────────────────────
/** 7 (Mon..Sun) × 24 (hour, IST) count of bookings created. */
export function heatmap(d: Scoped, r: Range, what: 'bookings' | 'payments' | 'users') {
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0) as number[]);
  const add = (iso: string) => { const p = istParts(iso); grid[p.dow][p.h] += 1; };
  if (what === 'bookings') d.bookings.forEach((b) => isLive(b) && within(b.createdAt, r) && add(b.createdAt));
  else if (what === 'payments') d.payments.forEach((p) => netOf(p) > 0 && within(p.at, r) && add(p.at));
  else d.users.forEach((u) => within(u.createdAt, r) && add(u.createdAt));
  return grid;
}

// ───────────────────────── funnel ─────────────────────────
export function funnel(d: Scoped, r: Range) {
  const cohort = d.users.filter((u) => within(u.createdAt, r));
  const ids = new Set(cohort.map((u) => u.id));
  const bookingsByUser = new Map<string, Booking[]>();
  d.bookings.forEach((b) => {
    if (!b.userId || !ids.has(b.userId)) return;
    const arr = bookingsByUser.get(b.userId) || [];
    arr.push(b);
    bookingsByUser.set(b.userId, arr);
  });
  const booked = Array.from(bookingsByUser.values()).filter((bs) => bs.some(isLive));
  const paidAny = booked.filter((bs) => bs.some((b) => isLive(b) && (b.paid > 0 || b.partner)));
  const paidFull = booked.filter((bs) => bs.some((b) => isLive(b) && (b.payStatus === 'paid' || b.partner)));
  const repeat = booked.filter((bs) => bs.filter(isLive).length > 1);
  return [
    { label: 'Signed up', value: cohort.length },
    { label: 'Verified email', value: cohort.filter((u) => u.verified).length },
    { label: 'Made a booking', value: booked.length },
    { label: 'Paid a deposit', value: paidAny.length },
    { label: 'Paid in full', value: paidFull.length },
    { label: 'Booked again', value: repeat.length },
  ];
}

// ───────────────────────── trips ─────────────────────────
export type TripRow = {
  id: string; title: string; destination: string; status: string; start: string | null; recurring: boolean;
  bookings: number; travellers: number; capacity: number; occupancy: number; collected: number; outstanding: number;
  value: number; aov: number; commission: number; cancelled: number; discounts: number; collectionRate: number; leadDays: number | null;
};

export function tripRows(d: Scoped, r: Range | null): TripRow[] {
  return d.trips.map((t) => {
    const bs = d.bookings.filter((b) => b.tripId === t.id && (!r || within(b.createdAt, r)));
    const live = bs.filter(isLive);
    const own = live.filter((b) => !b.partner);
    const travellers = live.filter(isSeated).reduce((s, b) => s + b.pax, 0);
    const collected = d.payments.filter((p) => p.tripId === t.id && (!r || within(p.at, r))).reduce((s, p) => s + netOf(p), 0);
    const value = own.reduce((s, b) => s + b.owed, 0);
    const paidOwn = own.reduce((s, b) => s + b.paid, 0);
    const leads = live
      .filter((b) => b.departure)
      .map((b) => (new Date(b.departure as string).getTime() - new Date(b.createdAt).getTime()) / DAY)
      .filter((x) => x >= 0);
    return {
      id: t.id, title: t.title, destination: t.destination, status: t.status, start: t.start, recurring: t.recurring,
      bookings: live.length,
      travellers,
      capacity: t.capacity,
      occupancy: t.capacity > 0 && !t.recurring ? travellers / t.capacity : 0,
      collected,
      outstanding: own.reduce((s, b) => s + b.remaining, 0),
      value,
      aov: own.length ? value / own.length : 0,
      commission: live.reduce((s, b) => s + b.commission, 0),
      cancelled: bs.length - live.length,
      discounts: live.reduce((s, b) => s + b.couponDiscount + b.walletUsed + b.waived, 0),
      collectionRate: value > 0 ? Math.min(1, paidOwn / value) : 0,
      leadDays: leads.length ? leads.reduce((a, b) => a + b, 0) / leads.length : null,
    };
  });
}

/** Days between booking and departure, bucketed. */
export function leadTimeHistogram(d: Scoped, r: Range) {
  const bins = [
    { label: 'Same week', max: 7 }, { label: '1–2 wks', max: 14 }, { label: '2–4 wks', max: 30 },
    { label: '1–2 mo', max: 60 }, { label: '2–3 mo', max: 90 }, { label: '3 mo+', max: Infinity },
  ].map((b) => ({ ...b, value: 0 }));
  d.bookings.filter(isLive).forEach((b) => {
    if (!b.departure || !within(b.createdAt, r)) return;
    const days = (new Date(b.departure).getTime() - new Date(b.createdAt).getTime()) / DAY;
    if (days < 0) return;
    const bin = bins.find((x) => days < x.max) || bins[bins.length - 1];
    bin.value += 1;
  });
  return bins.map(({ label, value }) => ({ key: label, label, value }));
}

export function groupSizeHistogram(d: Scoped, r: Range) {
  const bins = ['Solo', '2', '3', '4', '5–7', '8+'].map((label) => ({ key: label, label, value: 0 }));
  d.bookings.filter(isLive).forEach((b) => {
    if (!within(b.createdAt, r)) return;
    const p = b.pax;
    const i = p <= 1 ? 0 : p === 2 ? 1 : p === 3 ? 2 : p === 4 ? 3 : p <= 7 ? 4 : 5;
    bins[i].value += 1;
  });
  return bins;
}

// ───────────────────────── customers ─────────────────────────
export function customerStats(d: Scoped, r: Range) {
  const live = d.bookings.filter((b) => isLive(b) && b.userId);
  const perUser = new Map<string, Booking[]>();
  live.forEach((b) => { const a = perUser.get(b.userId as string) || []; a.push(b); perUser.set(b.userId as string, a); });
  const inRangeBuyers = new Set(live.filter((b) => within(b.createdAt, r)).map((b) => b.userId as string));
  let repeat = 0; let returning = 0; let ltvSum = 0;
  inRangeBuyers.forEach((id) => {
    const bs = perUser.get(id) || [];
    if (bs.length > 1) repeat += 1;
    if (bs.some((b) => new Date(b.createdAt).getTime() < r.from.getTime())) returning += 1;
  });
  perUser.forEach((bs) => { ltvSum += bs.reduce((s, b) => s + b.paid, 0); });
  const ltv = perUser.size ? ltvSum / perUser.size : 0;
  return { buyers: inRangeBuyers.size, repeat, returning, firstTime: inRangeBuyers.size - returning, ltv, lifetimeBuyers: perUser.size };
}

export type CustomerSegment = { label: string; value: number };
export function rfmSegments(d: Scoped) {
  const now = Date.now();
  const perUser = new Map<string, Booking[]>();
  d.bookings.filter((b) => isLive(b) && b.userId).forEach((b) => {
    const a = perUser.get(b.userId as string) || []; a.push(b); perUser.set(b.userId as string, a);
  });
  const seg = { Champions: 0, Loyal: 0, 'New travellers': 0, 'At risk': 0, Dormant: 0 };
  perUser.forEach((bs) => {
    const last = Math.max(...bs.map((b) => new Date(b.createdAt).getTime()));
    const days = (now - last) / DAY;
    const freq = bs.length;
    if (freq >= 3 && days <= 120) seg.Champions += 1;
    else if (freq >= 2 && days <= 180) seg.Loyal += 1;
    else if (freq === 1 && days <= 60) seg['New travellers'] += 1;
    else if (days <= 180) seg['At risk'] += 1;
    else seg.Dormant += 1;
  });
  return Object.entries(seg).map(([label, value]) => ({ key: label, label, value }));
}

// ───────────────────────── insights ─────────────────────────
export type Insight = { tone: 'good' | 'warn' | 'bad' | 'info'; title: string; body: string };

export function insights(d: Scoped, r: Range, prevR: Range, cur: Kpis, prev: Kpis): Insight[] {
  const out: Insight[] = [];
  const dr = delta(cur.revenue, prev.revenue);
  if (dr != null && Math.abs(dr) >= 0.05) {
    out.push({
      tone: dr > 0 ? 'good' : 'bad',
      title: `Revenue ${dr > 0 ? 'up' : 'down'} ${pct(Math.abs(dr))} vs previous period`,
      body: `${inr(cur.revenue)} collected against ${inr(prev.revenue)} in the matching period before.`,
    });
  } else if (dr == null && cur.revenue > 0) {
    out.push({ tone: 'good', title: 'First revenue in this window', body: `${inr(cur.revenue)} collected; nothing in the previous period to compare.` });
  }

  const db = delta(cur.bookings, prev.bookings);
  if (db != null && Math.abs(db) >= 0.1) {
    out.push({ tone: db > 0 ? 'good' : 'warn', title: `Bookings ${db > 0 ? 'grew' : 'fell'} ${pct(Math.abs(db))}`, body: `${cur.bookings} bookings vs ${prev.bookings} previously.` });
  }

  const outstanding = d.bookings.filter(isLive).reduce((s, b) => s + b.remaining, 0);
  const soon = d.bookings.filter((b) => isLive(b) && b.remaining > 1 && b.departure && (new Date(b.departure).getTime() - Date.now()) / DAY <= 7 && new Date(b.departure).getTime() >= startOfTodayIST().getTime());
  if (soon.length) {
    out.push({ tone: 'warn', title: `${soon.length} booking${soon.length > 1 ? 's' : ''} depart${soon.length > 1 ? '' : 's'} within 7 days with a balance`, body: `${inr(soon.reduce((s, b) => s + b.remaining, 0))} still to collect before departure. Total outstanding across all bookings: ${inr(outstanding)}.` });
  } else if (outstanding > 0) {
    out.push({ tone: 'info', title: `${inr(outstanding)} outstanding`, body: 'Balance still due on live bookings; none of it departs in the next 7 days.' });
  }

  const grid = heatmap(d, r, 'bookings');
  const byDow = grid.map((row) => row.reduce((a, b) => a + b, 0));
  const byHour = Array.from({ length: 24 }, (_, h) => grid.reduce((s, row) => s + row[h], 0));
  const totalB = byDow.reduce((a, b) => a + b, 0);
  if (totalB >= 5) {
    const bd = byDow.indexOf(Math.max(...byDow));
    const bh = byHour.indexOf(Math.max(...byHour));
    out.push({ tone: 'info', title: `Peak booking time: ${DOW[bd]}s around ${hourLabel(bh)}`, body: `${pct(byDow[bd] / totalB)} of bookings land on ${DOW[bd]}. Schedule promos and WhatsApp blasts just before this window.` });
  }

  const rows = tripRows(d, r).filter((t) => t.bookings > 0).sort((a, b) => b.collected - a.collected);
  if (rows[0]) out.push({ tone: 'good', title: `Top trip: ${rows[0].title}`, body: `${inr(rows[0].collected)} collected from ${rows[0].bookings} booking${rows[0].bookings > 1 ? 's' : ''} (${rows[0].travellers} travellers).` });

  const lowFill = tripRows(d, null).filter((t) => !t.recurring && t.capacity > 0 && t.start && new Date(t.start).getTime() > Date.now() && t.occupancy < 0.5);
  lowFill.slice(0, 2).forEach((t) => {
    const days = Math.round((new Date(t.start as string).getTime() - Date.now()) / DAY);
    out.push({ tone: days <= 14 ? 'bad' : 'warn', title: `${t.title} is ${pct(t.occupancy)} full`, body: `${t.travellers}/${t.capacity} seats, departs in ${days} day${days === 1 ? '' : 's'}. Consider an early-bird coupon or referral push.` });
  });

  if (cur.newUsers > 0) {
    out.push({ tone: cur.conversion >= 0.15 ? 'good' : 'warn', title: `${pct(cur.conversion, 1)} of new sign-ups booked`, body: `${cur.newUsers} people signed up in this window. ${cur.conversion < 0.15 ? 'A follow-up email or WhatsApp nudge to unbooked sign-ups could lift this.' : 'Healthy conversion — keep the onboarding flow as is.'}` });
  }

  if (cur.discounts > 0 && cur.revenue > 0) {
    const share = cur.discounts / (cur.revenue + cur.discounts);
    out.push({ tone: share > 0.15 ? 'warn' : 'info', title: `Discounts are ${pct(share, 1)} of gross`, body: `${inr(cur.discounts)} given via coupons, wallet credit and waivers in this window.` });
  }
  if (cur.refunds > 0) out.push({ tone: 'warn', title: `${inr(cur.refunds)} refunded`, body: 'Refunds in this window are already netted out of revenue.' });
  return out;
}

export const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'am' : 'pm'}`;

// ───────────────────────── export ─────────────────────────
export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

export function download(name: string, text: string, type = 'text/csv') {
  const blob = new Blob([text], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

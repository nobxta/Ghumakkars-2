'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Bone } from '@/components/ui/Skeleton';
import { ui, Badge, SummaryBar, Segmented, Field } from './ui';
import { Search, RefreshCcw, ChevronRight, Copy, Download, ExternalLink } from 'lucide-react';

/* ───────────── Types (shapes returned by /api/admin/settlements) ───────────── */

interface Settlement {
  id: string;
  amount: number;
  fees: number;
  tax: number;
  utr: string | null;
  status: string | null;
  settled_at: string | null;
}

interface Item {
  id: string;
  settlement_id: string;
  entity_id: string;
  type: string;
  razorpay_payment_id: string | null;
  method: string | null;
  amount: number;
  fee: number;
  tax: number;
  credit: number;
  debit: number;
  on_hold: boolean;
  transaction_at: string | null;
  settled_at: string | null;
  settlement_utr: string | null;
  payment_transaction_id: string | null;
  paid_at: string | null;
  payment_type: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  booking_id: string | null;
  booking_exists: boolean;
  description: string | null;
  user_id: string | null;
  primary_passenger_name: string | null;
  primary_passenger_email: string | null;
  trip_title: string | null;
  profile_name: string | null;
  profile_first_name: string | null;
  profile_last_name: string | null;
  profile_email: string | null;
  profile_phone: string | null;
  profile_avatar_url: string | null;
}

interface Pending {
  id: string;
  booking_id: string | null;
  user_id: string | null;
  razorpay_payment_id: string | null;
  transaction_id: string;
  amount: number;
  amount_refunded: number;
  payment_method: string | null;
  payment_type: string | null;
  paid_at: string | null;
  created_at: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  primary_passenger_name: string | null;
  primary_passenger_email: string | null;
  trip_title: string | null;
  profile_name: string | null;
  profile_email: string | null;
  profile_phone: string | null;
  profile_avatar_url: string | null;
}

interface SyncState {
  last_synced_at: string | null;
  last_error: string | null;
}

/** One payment of one customer, settled or not — the unit of the "By customer" view. */
interface Txn {
  key: string;
  rzpId: string;
  paymentTxnId: string | null;
  bookingId: string | null;
  bookingExists: boolean;
  trip: string | null;
  method: string | null;
  paymentType: string | null;
  receivedAt: string | null;
  amount: number;
  fee: number;
  tax: number;
  refunded: number;     // refunds taken back out of a payout
  net: number;          // what reached the bank for this payment
  settledAt: string | null;
  settlementId: string | null;
  utr: string | null;
  expectedAt: string | null;
}

interface Customer {
  key: string;
  userId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  avatar: string | null;
  txns: Txn[];
  received: number;
  settledNet: number;
  fees: number;
  pending: number;
  lastSettledAt: string | null;
}

/* ───────────── Helpers ───────────── */

const fmtINR = (n: number | string | null | undefined, dp = 2) =>
  '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: dp });
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtDay = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const ago = (d: string | null) => {
  if (!d) return 'never';
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
};
/** Razorpay's standard cycle: T+2 working days (weekends skipped; bank holidays not known). */
const expectedPayout = (from: string | null) => {
  if (!from) return null;
  const d = new Date(from);
  let added = 0;
  while (added < 2) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) added++;
  }
  return d.toISOString();
};
const round2 = (n: number) => Math.round(n * 100) / 100;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const nameOf = (r: { profile_name?: string | null; profile_first_name?: string | null; profile_last_name?: string | null; customer_name?: string | null; primary_passenger_name?: string | null; profile_email?: string | null; customer_email?: string | null }) =>
  r.profile_name ||
  [r.profile_first_name, r.profile_last_name].filter(Boolean).join(' ') ||
  r.customer_name || r.primary_passenger_name || r.profile_email || r.customer_email || 'Unknown payer';

type View = 'payouts' | 'customers' | 'pending';
type Preset = 'all' | 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'last_month' | 'quarter' | 'fy' | 'last_fy' | 'custom';
type Basis = 'settled' | 'received';
type PayStatus = '' | 'settled' | 'awaiting' | 'refunded' | 'late';
type CustomerSort = 'received' | 'net' | 'pending' | 'recent' | 'name';
type PayoutSort = 'newest' | 'oldest' | 'largest' | 'smallest';

interface Filters {
  preset: Preset;
  from: string;      // yyyy-mm-dd (custom range)
  to: string;
  basis: Basis;
  method: string;
  trip: string;
  status: PayStatus;
  min: string;
  max: string;
  customerSort: CustomerSort;
  payoutSort: PayoutSort;
}

const DEFAULT_FILTERS: Filters = {
  preset: 'all', from: '', to: '', basis: 'settled', method: '', trip: '', status: '',
  min: '', max: '', customerSort: 'received', payoutSort: 'newest',
};

const PRESETS: [Preset, string][] = [
  ['all', 'All time'], ['today', 'Today'], ['yesterday', 'Yesterday'], ['7d', 'Last 7 days'],
  ['30d', 'Last 30 days'], ['month', 'This month'], ['last_month', 'Last month'],
  ['quarter', 'This quarter'], ['fy', 'This FY'], ['last_fy', 'Last FY'], ['custom', 'Custom range'],
];

const STATUS_LABEL: Record<Exclude<PayStatus, ''>, string> = {
  settled: 'Settled', awaiting: 'Awaiting payout', late: 'Late payout', refunded: 'Has a refund',
};
const METHOD_LABEL: Record<string, string> = {
  upi: 'UPI', card: 'Card', netbanking: 'Net banking', wallet: 'Wallet', emi: 'EMI', paylater: 'Pay later',
};

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** [start, end) in ms for the chosen range (local time). Indian FY runs 1 Apr – 31 Mar. */
function rangeOf(f: Filters): [number, number] | null {
  const now = new Date();
  const today = dayStart(now).getTime();
  const D = 86400000;
  const fy = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  switch (f.preset) {
    case 'today': return [today, today + D];
    case 'yesterday': return [today - D, today];
    case '7d': return [today - 6 * D, today + D];
    case '30d': return [today - 29 * D, today + D];
    case 'month': return [new Date(now.getFullYear(), now.getMonth(), 1).getTime(), new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime()];
    case 'last_month': return [new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime(), new Date(now.getFullYear(), now.getMonth(), 1).getTime()];
    case 'quarter': {
      const q = Math.floor(now.getMonth() / 3) * 3;
      return [new Date(now.getFullYear(), q, 1).getTime(), new Date(now.getFullYear(), q + 3, 1).getTime()];
    }
    case 'fy': return [new Date(fy, 3, 1).getTime(), new Date(fy + 1, 3, 1).getTime()];
    case 'last_fy': return [new Date(fy - 1, 3, 1).getTime(), new Date(fy, 3, 1).getTime()];
    case 'custom': {
      if (!f.from && !f.to) return null;
      const a = f.from ? new Date(`${f.from}T00:00:00`).getTime() : -Infinity;
      const b = f.to ? new Date(`${f.to}T00:00:00`).getTime() + D : Infinity;
      return a <= b ? [a, b] : [b - D, a + D];
    }
    default: return null;
  }
}

const rangeLabel = (f: Filters) => {
  if (f.preset !== 'custom') return PRESETS.find(([k]) => k === f.preset)?.[1] || '';
  if (!f.from && !f.to) return 'Custom range';
  const fmt = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${f.from ? fmt(f.from) : 'Start'} – ${f.to ? fmt(f.to) : 'Today'}`;
};

const STALE_MS = 3 * 3600 * 1000;
const isLate = (expected: string | null) => !!expected && new Date(expected).getTime() + 86400000 < Date.now();

/* ───────────── Component ───────────── */

export default function SettlementsPanel({ onToast }: { onToast: (t: { type: 'success' | 'error'; msg: string }) => void }) {
  const [data, setData] = useState<{ settlements: Settlement[]; items: Item[]; pending: Pending[]; sync: SyncState | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [view, setView] = useState<View>('payouts');
  const [f, setF] = useState<Filters>(DEFAULT_FILTERS);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const autoSynced = useRef(false);
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setF((o) => ({ ...o, [k]: v }));

  const load = async () => {
    try {
      const r = await fetch('/api/admin/settlements');
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed to load settlements');
      setData(j);
      return j;
    } catch (e: any) {
      onToast({ type: 'error', msg: e.message });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const sync = async (full = false, quiet = false) => {
    setSyncing(true);
    try {
      const r = await fetch('/api/admin/settlements/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Sync failed');
      if (!quiet) onToast({ type: 'success', msg: `Synced ${j.settlements} payouts · ${j.items} transactions` });
      await load();
    } catch (e: any) {
      onToast({ type: 'error', msg: `Razorpay sync: ${e.message}` });
      await load();
    } finally {
      setSyncing(false);
    }
  };

  // Load from DB, then pull fresh data from Razorpay if the last pull is old.
  useEffect(() => {
    (async () => {
      const j = await load();
      if (autoSynced.current || !j) return;
      autoSynced.current = true;
      const last = j.sync?.last_synced_at ? new Date(j.sync.last_synced_at).getTime() : 0;
      if (Date.now() - last > STALE_MS) sync(!last, true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Dropdown options, from all data ── */
  const options = useMemo(() => {
    const methods = new Set<string>();
    const trips = new Set<string>();
    data?.items.forEach((i) => { if (i.method) methods.add(i.method.toLowerCase()); if (i.trip_title) trips.add(i.trip_title); });
    data?.pending.forEach((p) => { if (p.payment_method) methods.add(p.payment_method.toLowerCase()); if (p.trip_title) trips.add(p.trip_title); });
    return { methods: [...methods].sort(), trips: [...trips].sort((a, b) => a.localeCompare(b)) };
  }, [data]);

  /* ── Derived data ── */
  const derived = useMemo(() => {
    if (!data) return null;
    const range = rangeOf(f);
    const inRange = (d: string | null) => {
      if (!range) return true;
      const t = d ? new Date(d).getTime() : NaN;
      return t >= range[0] && t < range[1];
    };
    const min = f.min ? Number(f.min) : -Infinity;
    const max = f.max ? Number(f.max) : Infinity;

    // Payments that had a refund (settled refund row, or refunded before payout).
    const refundedPays = new Set<string>();
    data.items.forEach((i) => { if (i.type === 'refund' && i.razorpay_payment_id) refundedPays.add(i.razorpay_payment_id); });
    data.pending.forEach((p) => { if (Number(p.amount_refunded) > 0) refundedPays.add(p.razorpay_payment_id || p.transaction_id); });

    const itemPass = (i: Item) => {
      if (f.status === 'awaiting' || f.status === 'late') return false;
      if (f.status === 'refunded' && !refundedPays.has(i.razorpay_payment_id || i.entity_id)) return false;
      if (!inRange(f.basis === 'settled' ? i.settled_at : i.paid_at || i.transaction_at)) return false;
      if (f.method && (i.method || '').toLowerCase() !== f.method) return false;
      if (f.trip && i.trip_title !== f.trip) return false;
      if (Number(i.amount) < min || Number(i.amount) > max) return false;
      return true;
    };
    const itemFiltersOn = f.basis === 'received' || !!(f.method || f.trip || f.status || f.min || f.max);

    const items = data.items.filter(itemPass);
    const bySettlement = new Map<string, Item[]>();
    items.forEach((i) => {
      const a = bySettlement.get(i.settlement_id) || [];
      a.push(i);
      bySettlement.set(i.settlement_id, a);
    });
    const hasItems = new Set(data.items.map((i) => i.settlement_id));
    const settlements = data.settlements.filter((s) =>
      bySettlement.has(s.id) || (!itemFiltersOn && !hasItems.has(s.id) && inRange(s.settled_at))
    );

    // Group every payment (settled + awaiting) by customer.
    const customers = new Map<string, Customer>();
    const customerFor = (key: string, seed: Omit<Customer, 'txns' | 'received' | 'settledNet' | 'fees' | 'pending' | 'lastSettledAt' | 'key'>) => {
      let c = customers.get(key);
      if (!c) {
        c = { key, ...seed, txns: [], received: 0, settledNet: 0, fees: 0, pending: 0, lastSettledAt: null };
        customers.set(key, c);
      }
      return c;
    };

    // Settled payments, with their refunds folded in.
    const txnByPay = new Map<string, Txn>();
    items.forEach((i) => {
      const rzpId = i.razorpay_payment_id || i.entity_id;
      const key = i.user_id || i.profile_email || i.customer_email || i.primary_passenger_email || `pay:${rzpId}`;
      const c = customerFor(key, {
        userId: i.user_id,
        name: nameOf(i),
        email: i.profile_email || i.customer_email || i.primary_passenger_email,
        phone: i.profile_phone || i.customer_phone,
        avatar: i.profile_avatar_url,
      });
      let t = txnByPay.get(rzpId);
      if (!t) {
        t = {
          key: rzpId, rzpId, paymentTxnId: i.payment_transaction_id, bookingId: i.booking_id, bookingExists: !!i.booking_exists, trip: i.trip_title || i.description,
          method: i.method, paymentType: i.payment_type, receivedAt: i.paid_at || null,
          amount: 0, fee: 0, tax: 0, refunded: 0, net: 0,
          settledAt: null, settlementId: null, utr: null, expectedAt: null,
        };
        txnByPay.set(rzpId, t);
        c.txns.push(t);
      }
      if (i.type === 'payment') {
        t.amount += Number(i.amount);
        t.receivedAt = i.paid_at || i.transaction_at;
        t.settledAt = i.settled_at;
        t.settlementId = i.settlement_id;
        t.utr = i.settlement_utr;
        c.received += Number(i.amount);
        c.fees += Number(i.fee);
        if (!c.lastSettledAt || (i.settled_at && i.settled_at > c.lastSettledAt)) c.lastSettledAt = i.settled_at;
      } else if (i.type === 'refund') {
        t.refunded += Number(i.debit || i.amount);
      }
      t.fee += Number(i.fee);
      t.tax += Number(i.tax);
      t.net = round2(t.net + Number(i.credit) - Number(i.debit));
      c.settledNet = round2(c.settledNet + Number(i.credit) - Number(i.debit));
    });

    // Not yet in a payout.
    const pending = data.pending
      .map((p) => {
        const rzpId = p.razorpay_payment_id || p.transaction_id;
        const received = p.paid_at || p.created_at;
        return { ...p, rzpId, received, expected: expectedPayout(received) };
      })
      .filter((p) => {
        if (f.status === 'settled') return false;
        if (f.status === 'refunded' && !(Number(p.amount_refunded) > 0)) return false;
        if (f.status === 'late' && !isLate(p.expected)) return false;
        // Awaiting payments have no payout date yet, so a settled-date range keeps them all.
        if (f.basis === 'received' && !inRange(p.received)) return false;
        if (f.method && (p.payment_method || '').toLowerCase() !== f.method) return false;
        if (f.trip && p.trip_title !== f.trip) return false;
        if (Number(p.amount) < min || Number(p.amount) > max) return false;
        return true;
      });
    pending.forEach((p) => {
      const key = p.user_id || p.profile_email || p.customer_email || p.primary_passenger_email || `pay:${p.rzpId}`;
      const c = customerFor(key, {
        userId: p.user_id,
        name: nameOf(p),
        email: p.profile_email || p.customer_email || p.primary_passenger_email,
        phone: p.profile_phone || p.customer_phone,
        avatar: p.profile_avatar_url,
      });
      c.txns.push({
        key: p.id, rzpId: p.rzpId, paymentTxnId: p.id, bookingId: p.booking_id, bookingExists: !!p.booking_id, trip: p.trip_title,
        method: p.payment_method, paymentType: p.payment_type, receivedAt: p.received,
        amount: Number(p.amount), fee: 0, tax: 0, refunded: Number(p.amount_refunded || 0), net: 0,
        settledAt: null, settlementId: null, utr: null, expectedAt: p.expected,
      });
      c.received += Number(p.amount);
      c.pending += Number(p.amount) - Number(p.amount_refunded || 0);
    });
    customers.forEach((c) => c.txns.sort((a, b) => (b.receivedAt || '').localeCompare(a.receivedAt || '')));

    // Totals follow the filtered transactions, so they always match the list below.
    const payRows = items.filter((i) => i.type === 'payment');
    const lags = payRows
      .filter((i) => i.settled_at && (i.paid_at || i.transaction_at))
      .map((i) => (new Date(i.settled_at!).getTime() - new Date((i.paid_at || i.transaction_at)!).getTime()) / 86400000);
    const kpi = {
      settled: items.reduce((s, i) => s + Number(i.credit) - Number(i.debit), 0),
      fees: items.reduce((s, i) => s + Number(i.fee), 0),
      tax: items.reduce((s, i) => s + Number(i.tax), 0),
      gross: payRows.reduce((s, i) => s + Number(i.amount), 0),
      refunds: items.filter((i) => i.type === 'refund').reduce((s, i) => s + Number(i.debit || i.amount), 0),
      payments: payRows.length,
      pending: pending.reduce((s, p) => s + Number(p.amount) - Number(p.amount_refunded || 0), 0),
      pendingCount: pending.length,
      overdue: pending.filter((p) => isLate(p.expected)).length,
      avgDays: lags.length ? lags.reduce((a, b) => a + b, 0) / lags.length : null,
      last: data.settlements[0] || null,
    };

    return { settlements, bySettlement, customers: [...customers.values()], pending, kpi };
  }, [data, f]);

  /* ── Search ── */
  const needle = q.trim().toLowerCase();
  const matchItem = (i: Item) =>
    [nameOf(i), i.profile_email, i.customer_email, i.primary_passenger_email, i.profile_phone, i.customer_phone,
     i.entity_id, i.razorpay_payment_id, i.booking_id, i.trip_title, i.settlement_id, i.settlement_utr]
      .some((v) => v && String(v).toLowerCase().includes(needle));

  const shownPayouts = useMemo(() => {
    if (!derived) return [];
    const list = !needle ? [...derived.settlements] : derived.settlements.filter((s) =>
      [s.id, s.utr].some((v) => v?.toLowerCase().includes(needle)) ||
      (derived.bySettlement.get(s.id) || []).some(matchItem)
    );
    const netOf = (s: Settlement) => {
      const rows = derived.bySettlement.get(s.id);
      return rows ? rows.reduce((n, i) => n + Number(i.credit) - Number(i.debit), 0) : Number(s.amount);
    };
    const by: Record<PayoutSort, (a: Settlement, b: Settlement) => number> = {
      newest: (a, b) => (b.settled_at || '').localeCompare(a.settled_at || ''),
      oldest: (a, b) => (a.settled_at || '').localeCompare(b.settled_at || ''),
      largest: (a, b) => netOf(b) - netOf(a),
      smallest: (a, b) => netOf(a) - netOf(b),
    };
    return list.sort(by[f.payoutSort]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [derived, needle, f.payoutSort]);

  const shownCustomers = useMemo(() => {
    if (!derived) return [];
    const list = derived.customers.filter((c) =>
      !needle ||
      [c.name, c.email, c.phone].some((v) => v?.toLowerCase().includes(needle)) ||
      c.txns.some((t) => [t.rzpId, t.bookingId, t.trip, t.utr, t.settlementId].some((v) => v?.toLowerCase().includes(needle)))
    );
    const recent = (c: Customer) => c.txns[0]?.receivedAt || '';
    const by: Record<CustomerSort, (a: Customer, b: Customer) => number> = {
      received: (a, b) => b.received - a.received,
      net: (a, b) => b.settledNet - a.settledNet,
      pending: (a, b) => b.pending - a.pending || b.received - a.received,
      recent: (a, b) => recent(b).localeCompare(recent(a)),
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return list.sort(by[f.customerSort]);
  }, [derived, needle, f.customerSort]);

  const shownPending = useMemo(() => {
    if (!derived) return [];
    return derived.pending
      .filter((p) => !needle || [nameOf(p), p.profile_email, p.customer_email, p.customer_phone, p.rzpId, p.booking_id, p.trip_title]
        .some((v) => v && String(v).toLowerCase().includes(needle)))
      .sort((a, b) => (a.received || '').localeCompare(b.received || ''));
  }, [derived, needle]);

  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const copy = (s: string) => { navigator.clipboard?.writeText(s); onToast({ type: 'success', msg: 'Copied' }); };

  // A removable chip for every filter that differs from the default.
  const chips: { label: string; clear: () => void }[] = [];
  if (f.preset !== 'all') chips.push({ label: `${f.basis === 'settled' ? 'Settled' : 'Received'}: ${rangeLabel(f)}`, clear: () => setF((o) => ({ ...o, preset: 'all', from: '', to: '' })) });
  else if (f.basis !== 'settled') chips.push({ label: 'By received date', clear: () => set('basis', 'settled') });
  if (f.status) chips.push({ label: STATUS_LABEL[f.status], clear: () => set('status', '') });
  if (f.method) chips.push({ label: METHOD_LABEL[f.method] || f.method.toUpperCase(), clear: () => set('method', '') });
  if (f.trip) chips.push({ label: f.trip, clear: () => set('trip', '') });
  if (f.min || f.max) chips.push({ label: `${f.min ? fmtINR(f.min, 0) : '₹0'} – ${f.max ? fmtINR(f.max, 0) : 'any'}`, clear: () => setF((o) => ({ ...o, min: '', max: '' })) });

  const pickPreset = (k: Preset) => setF((o) => ({
    ...o,
    preset: k,
    // Opening "Custom" starts from the last 30 days so the inputs aren't blank.
    ...(k === 'custom' && !o.from && !o.to ? { from: ymd(new Date(Date.now() - 29 * 86400000)), to: ymd(new Date()) } : {}),
  }));

  const downloadCsv = () => {
    if (!derived) return;
    const rows: (string | number | null)[][] = [[
      'Customer', 'Email', 'Phone', 'Booking ID', 'Trip', 'Payment ID', 'Method', 'Received at',
      'Amount', 'Fee (incl GST)', 'GST', 'Refunded', 'Net to bank', 'Status', 'Settled at', 'Settlement ID', 'UTR',
    ]];
    derived.customers.forEach((c) => c.txns.forEach((t) => rows.push([
      c.name, c.email, c.phone, t.bookingId, t.trip, t.rzpId, t.method, t.receivedAt,
      t.amount, round2(t.fee), round2(t.tax), round2(t.refunded), t.settledAt ? t.net : '',
      t.settledAt ? 'Settled' : 'Awaiting payout', t.settledAt, t.settlementId, t.utr,
    ])));
    const csv = rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const tag = f.preset === 'all' ? 'all-time' : rangeLabel(f).replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
    a.download = `settlements-${tag}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  /* ── Render ── */
  if (loading || !derived) {
    return (
      <div className="space-y-4" role="status" aria-busy="true">
        <span className="sr-only">Loading settlements</span>
        <div className="rounded-xl bg-[#1d1433] grid grid-cols-2 lg:grid-cols-4 gap-px">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="px-5 py-4 space-y-2.5">
              <div className="h-3 w-24 rounded bg-white/10" /><div className="h-6 w-32 rounded bg-white/15" /><div className="h-3 w-28 rounded bg-white/10" />
            </div>
          ))}
        </div>
        <div className={`${ui.card} overflow-hidden`}>
          <div className={ui.cardHeader}><Bone className="h-8 w-72 rounded-lg" tone="soft" /></div>
          <div className={ui.toolbar}><Bone className="h-9 w-full rounded-lg" tone="soft" /></div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex gap-4 px-4 py-3.5 border-b border-gray-100 last:border-b-0">
              <Bone className="h-3.5 w-32" /><Bone className="h-3.5 flex-1" tone="soft" /><Bone className="h-3.5 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const { kpi } = derived;
  const feePct = kpi.gross > 0 ? (kpi.fees / kpi.gross) * 100 : 0;
  const filtered = chips.length > 0 || !!needle;
  const clearAll = () => { setF((o) => ({ ...DEFAULT_FILTERS, customerSort: o.customerSort, payoutSort: o.payoutSort })); setQ(''); };

  return (
    <div className="space-y-4">
      <SummaryBar items={[
        { label: 'Settled to bank', value: fmtINR(kpi.settled), note: `${plural(derived.settlements.length, 'payout')} · ${plural(kpi.payments, 'payment')}` },
        { label: 'Fees + GST', value: fmtINR(kpi.fees), note: kpi.gross > 0 ? `${feePct.toFixed(2)}% of ${fmtINR(kpi.gross, 0)} · GST ${fmtINR(kpi.tax)}` : '—' },
        { label: 'Awaiting payout', value: fmtINR(kpi.pending), note: `${plural(kpi.pendingCount, 'payment')}${kpi.overdue ? ` · ${kpi.overdue} late` : ''}`, noteTone: kpi.overdue > 0 ? 'bad' : kpi.pendingCount > 0 ? 'warn' : undefined },
        { label: 'Avg. days to settle', value: kpi.avgDays === null ? '—' : kpi.avgDays.toFixed(1), note: kpi.last ? `Last payout ${fmtINR(kpi.last.amount)} · ${fmtDay(kpi.last.settled_at)}` : 'No payouts yet' },
      ]} />

      <div className={`${ui.card} overflow-hidden`}>
        {/* View switch + actions */}
        <div className={ui.cardHeader}>
          <Segmented<View>
            value={view}
            onChange={setView}
            items={[
              { value: 'payouts', label: 'Payouts', count: derived.settlements.length },
              { value: 'customers', label: 'Customers', count: derived.customers.length },
              { value: 'pending', label: 'Awaiting payout', count: derived.pending.length },
            ]}
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 hidden sm:inline-flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${syncing ? 'bg-amber-500 animate-pulse' : data!.sync?.last_error ? 'bg-red-500' : 'bg-emerald-500'}`} />
              {syncing ? 'Syncing with Razorpay…' : data!.sync?.last_error ? 'Last sync failed' : `Synced ${ago(data!.sync?.last_synced_at || null)}`}
            </span>
            <button onClick={downloadCsv} className={ui.btn}>
              <Download className="h-4 w-4" /> Export
            </button>
            <button onClick={() => sync(false)} disabled={syncing} className={ui.btnPrimary} title="Fetch new payouts from Razorpay">
              <RefreshCcw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} /> Sync
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className={ui.toolbar}>
          <Field label="Search" grow>
            <div className="relative">
              <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email, phone, booking, payment ID, UTR"
                className={`${INPUT} pl-9 w-full`} />
            </div>
          </Field>
          <Field label="Date">
            <select value={f.preset} onChange={(e) => pickPreset(e.target.value as Preset)} className={INPUT}>
              {PRESETS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </Field>
          {f.preset === 'custom' && (
            <>
              <Field label="From">
                <input type="date" value={f.from} max={f.to || ymd(new Date())} onChange={(e) => set('from', e.target.value)} className={INPUT} />
              </Field>
              <Field label="To">
                <input type="date" value={f.to} min={f.from || undefined} max={ymd(new Date())} onChange={(e) => set('to', e.target.value)} className={INPUT} />
              </Field>
            </>
          )}
          <Field label="Date of">
            <select value={f.basis} onChange={(e) => set('basis', e.target.value as Basis)} className={INPUT}>
              <option value="settled">Settlement</option>
              <option value="received">Payment</option>
            </select>
          </Field>
          <Field label="Status">
            <select value={f.status} onChange={(e) => set('status', e.target.value as PayStatus)} className={INPUT}>
              <option value="">All</option>
              <option value="settled">Settled</option>
              <option value="awaiting">Awaiting payout</option>
              <option value="late">Late</option>
              <option value="refunded">Has refund</option>
            </select>
          </Field>
          <Field label="Method">
            <select value={f.method} onChange={(e) => set('method', e.target.value)} className={INPUT}>
              <option value="">All</option>
              {options.methods.map((m) => <option key={m} value={m}>{METHOD_LABEL[m] || m.toUpperCase()}</option>)}
            </select>
          </Field>
          <Field label="Trip">
            <select value={f.trip} onChange={(e) => set('trip', e.target.value)} className={`${INPUT} max-w-[200px]`}>
              <option value="">All</option>
              {options.trips.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Amount (₹)">
            <div className="flex items-center gap-1">
              <input type="number" min={0} inputMode="numeric" placeholder="Min" value={f.min} onChange={(e) => set('min', e.target.value)} className={`${INPUT} w-20`} />
              <span className="text-gray-400">–</span>
              <input type="number" min={0} inputMode="numeric" placeholder="Max" value={f.max} onChange={(e) => set('max', e.target.value)} className={`${INPUT} w-20`} />
            </div>
          </Field>
          {view !== 'pending' && (
            <Field label="Sort">
              {view === 'payouts' ? (
                <select value={f.payoutSort} onChange={(e) => set('payoutSort', e.target.value as PayoutSort)} className={INPUT}>
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="largest">Largest</option>
                  <option value="smallest">Smallest</option>
                </select>
              ) : (
                <select value={f.customerSort} onChange={(e) => set('customerSort', e.target.value as CustomerSort)} className={INPUT}>
                  <option value="received">Received</option>
                  <option value="net">Settled</option>
                  <option value="pending">Awaiting</option>
                  <option value="recent">Latest payment</option>
                  <option value="name">Name</option>
                </select>
              )}
            </Field>
          )}
          {filtered && (
            <button onClick={clearAll} className={`${ui.link} text-sm h-9`}>
              Clear
            </button>
          )}
        </div>
        {f.preset !== 'all' && (
          <p className="px-4 py-2 text-xs text-gray-500 border-b border-gray-200 bg-purple-50/40">
            Showing {f.basis === 'settled' ? 'payouts settled' : 'payments received'}: {rangeLabel(f)}
            {f.basis === 'settled' && view !== 'payouts' && derived.pending.length > 0 && ' (awaiting payments are always shown)'}
          </p>
        )}

        {/* ── Payouts ── */}
        {view === 'payouts' && (
          shownPayouts.length === 0 ? (
            <Empty synced={!!data!.sync?.last_synced_at} text={filtered ? 'No payouts match these filters.' : 'No payouts yet.'} />
          ) : (
            <div className="overflow-x-auto">
              <table className={TABLE}>
                <thead className={THEAD}>
                  <tr>
                    <th className={TH + ' w-6'} />
                    <th className={TH}>Settled on</th>
                    <th className={TH}>UTR</th>
                    <th className={TH + ' text-right'}>Payments</th>
                    <th className={TH + ' text-right'}>Gross</th>
                    <th className={TH + ' text-right'}>Refunds</th>
                    <th className={TH + ' text-right'}>Fees + GST</th>
                    <th className={TH + ' text-right'}>Net to bank</th>
                    <th className={TH}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {shownPayouts.map((s) => {
                    const all = derived.bySettlement.get(s.id) || [];
                    const rows = all.filter((i) => !needle || matchItem(i) || [s.id, s.utr].some((v) => v?.toLowerCase().includes(needle)));
                    const gross = all.filter((i) => i.type === 'payment').reduce((n, i) => n + Number(i.amount), 0);
                    const refunds = all.filter((i) => i.type === 'refund').reduce((n, i) => n + Number(i.debit || i.amount), 0);
                    const fees = all.reduce((n, i) => n + Number(i.fee), 0);
                    const net = round2(all.reduce((n, i) => n + Number(i.credit) - Number(i.debit), 0));
                    const partial = all.length > 0 && Math.abs(net - Number(s.amount)) > 0.009;
                    const isOpen = !!open[s.id];
                    return (
                      <PayoutRows key={s.id}>
                        <tr onClick={() => toggle(s.id)} className={`${TR} cursor-pointer ${isOpen ? 'bg-purple-50/40' : ''}`}>
                          <td className={TD + ' text-gray-400'}>
                            <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                          </td>
                          <td className={TD + ' whitespace-nowrap'}>{fmtDate(s.settled_at)}</td>
                          <td className={TD + ' font-mono text-xs text-gray-600'}>{s.utr || '—'}</td>
                          <td className={NUM}>{all.length}</td>
                          <td className={NUM}>{fmtINR(gross)}</td>
                          <td className={NUM}>{refunds ? `−${fmtINR(refunds)}` : '—'}</td>
                          <td className={NUM}>{fees ? `−${fmtINR(fees)}` : '—'}</td>
                          <td className={NUM + ' font-semibold text-gray-900'}>
                            {fmtINR(partial ? net : s.amount)}
                            {partial && <div className="text-[11px] font-normal text-gray-500">of {fmtINR(s.amount)}</div>}
                          </td>
                          <td className={TD}><StatusText status={s.status} /></td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-gray-50/70 border-b border-gray-200">
                            <td />
                            <td colSpan={8} className="px-4 pb-4 pt-1">
                              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500 mb-2">
                                <span>Settlement ID <span className="font-mono text-gray-700">{s.id}</span>
                                  <button onClick={() => copy(s.id)} className="ml-1 align-middle" aria-label="Copy settlement ID"><Copy className="inline h-3 w-3" /></button>
                                </span>
                                {s.utr && <span>UTR <span className="font-mono text-gray-700">{s.utr}</span>
                                  <button onClick={() => copy(s.utr!)} className="ml-1 align-middle" aria-label="Copy UTR"><Copy className="inline h-3 w-3" /></button>
                                </span>}
                                <a href={`https://dashboard.razorpay.com/app/settlements/${s.id}`} target="_blank" rel="noopener noreferrer" className={`${ui.link} inline-flex items-center gap-1`}>
                                  Open in Razorpay <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                              {rows.length === 0
                                ? <p className="text-sm text-gray-500 py-2">Breakdown not synced yet. Press Sync.</p>
                                : <ItemsTable items={rows} />}
                            </td>
                          </tr>
                        )}
                      </PayoutRows>
                    );
                  })}
                </tbody>
                <tfoot className={TFOOT}>
                  <tr>
                    <td className={TD} />
                    <td className={TD} colSpan={2}>Total ({shownPayouts.length})</td>
                    <td className={NUM}>{shownPayouts.reduce((n, s) => n + (derived.bySettlement.get(s.id)?.length || 0), 0)}</td>
                    <td className={NUM}>{fmtINR(sumItems(shownPayouts, derived.bySettlement, (i) => (i.type === 'payment' ? Number(i.amount) : 0)))}</td>
                    <td className={NUM}>{fmtINR(sumItems(shownPayouts, derived.bySettlement, (i) => (i.type === 'refund' ? Number(i.debit || i.amount) : 0)))}</td>
                    <td className={NUM}>{fmtINR(sumItems(shownPayouts, derived.bySettlement, (i) => Number(i.fee)))}</td>
                    <td className={NUM + ' text-gray-900'}>{fmtINR(sumItems(shownPayouts, derived.bySettlement, (i) => Number(i.credit) - Number(i.debit)))}</td>
                    <td className={TD} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )
        )}

        {/* ── Customers ── */}
        {view === 'customers' && (
          shownCustomers.length === 0 ? (
            <Empty synced={!!data!.sync?.last_synced_at} text={filtered ? 'No customers match these filters.' : 'No customers yet.'} />
          ) : (
            <div className="overflow-x-auto">
              <table className={TABLE}>
                <thead className={THEAD}>
                  <tr>
                    <th className={TH + ' w-6'} />
                    <th className={TH}>Customer</th>
                    <th className={TH}>Contact</th>
                    <th className={TH + ' text-right'}>Payments</th>
                    <th className={TH + ' text-right'}>Received</th>
                    <th className={TH + ' text-right'}>Fees + GST</th>
                    <th className={TH + ' text-right'}>Settled (net)</th>
                    <th className={TH + ' text-right'}>Awaiting</th>
                    <th className={TH}>Last payout</th>
                  </tr>
                </thead>
                <tbody>
                  {shownCustomers.map((c) => {
                    const isOpen = !!open[`c:${c.key}`];
                    return (
                      <PayoutRows key={c.key}>
                        <tr onClick={() => toggle(`c:${c.key}`)} className={`${TR} cursor-pointer ${isOpen ? 'bg-purple-50/40' : ''}`}>
                          <td className={TD + ' text-gray-400'}>
                            <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                          </td>
                          <td className={TD + ' font-medium text-gray-900 whitespace-nowrap'}>
                            {c.userId
                              ? <Link href={`/admin/users/${c.userId}`} onClick={(e) => e.stopPropagation()} className="hover:text-purple-700">{c.name}</Link>
                              : c.name}
                          </td>
                          <td className={TD + ' text-gray-600'}>
                            <div className="truncate max-w-[220px]">{c.email || '—'}</div>
                            {c.phone && <div className="text-xs text-gray-500">{c.phone}</div>}
                          </td>
                          <td className={NUM}>{c.txns.length}</td>
                          <td className={NUM}>{fmtINR(c.received)}</td>
                          <td className={NUM}>{c.fees ? fmtINR(c.fees) : '—'}</td>
                          <td className={NUM + ' text-gray-900 font-medium'}>{c.settledNet ? fmtINR(c.settledNet) : '—'}</td>
                          <td className={NUM + (c.pending > 0 ? ' text-amber-700' : '')}>{c.pending > 0 ? fmtINR(c.pending) : '—'}</td>
                          <td className={TD + ' whitespace-nowrap text-gray-600'}>{fmtDay(c.lastSettledAt)}</td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-gray-50/70 border-b border-gray-200">
                            <td />
                            <td colSpan={8} className="px-4 pb-4 pt-1"><TxnTable txns={c.txns} /></td>
                          </tr>
                        )}
                      </PayoutRows>
                    );
                  })}
                </tbody>
                <tfoot className={TFOOT}>
                  <tr>
                    <td className={TD} />
                    <td className={TD} colSpan={2}>Total ({shownCustomers.length})</td>
                    <td className={NUM}>{shownCustomers.reduce((n, c) => n + c.txns.length, 0)}</td>
                    <td className={NUM}>{fmtINR(shownCustomers.reduce((n, c) => n + c.received, 0))}</td>
                    <td className={NUM}>{fmtINR(shownCustomers.reduce((n, c) => n + c.fees, 0))}</td>
                    <td className={NUM + ' text-gray-900'}>{fmtINR(shownCustomers.reduce((n, c) => n + c.settledNet, 0))}</td>
                    <td className={NUM}>{fmtINR(shownCustomers.reduce((n, c) => n + c.pending, 0))}</td>
                    <td className={TD} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )
        )}

        {/* ── Awaiting payout ── */}
        {view === 'pending' && (
          shownPending.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-gray-500">
              {filtered ? 'No awaiting payments match these filters.' : 'Nothing awaiting payout. Every captured payment has been settled.'}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className={TABLE}>
                  <thead className={THEAD}>
                    <tr>
                      <th className={TH}>Customer</th>
                      <th className={TH}>Trip</th>
                      <th className={TH}>Booking</th>
                      <th className={TH}>Payment ID</th>
                      <th className={TH}>Method</th>
                      <th className={TH}>Received</th>
                      <th className={TH}>Expected payout</th>
                      <th className={TH + ' text-right'}>Amount</th>
                      <th className={TH + ' text-right'}>Refunded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shownPending.map((p) => {
                      const late = isLate(p.expected);
                      return (
                        <tr key={p.id} className={TR}>
                          <td className={TD + ' font-medium text-gray-900 whitespace-nowrap'}>
                            {p.user_id ? <Link href={`/admin/users/${p.user_id}`} className="hover:text-purple-700">{nameOf(p)}</Link> : nameOf(p)}
                            <div className="text-xs font-normal text-gray-500">{p.profile_email || p.customer_email || p.primary_passenger_email || ''}</div>
                          </td>
                          <td className={TD + ' text-gray-600'}><div className="truncate max-w-[200px]">{p.trip_title || '—'}</div></td>
                          <td className={TD}>
                            {p.booking_id ? <Link href={`/admin/bookings/${p.booking_id}`} className={`font-mono text-xs ${ui.link}`}>{p.booking_id.slice(0, 8)}</Link> : '—'}
                          </td>
                          <td className={TD + ' font-mono text-xs text-gray-600'}>{p.rzpId}</td>
                          <td className={TD + ' text-gray-600'}>{methodLabel(p.payment_method)}</td>
                          <td className={TD + ' whitespace-nowrap text-gray-600'}>{fmtDate(p.received)}</td>
                          <td className={TD + ' whitespace-nowrap text-gray-600'}>
                            <span className="mr-2">{fmtDay(p.expected)}</span>
                            {late ? <Badge tone="red">Late</Badge> : <Badge tone="amber">Pending</Badge>}
                          </td>
                          <td className={NUM + ' text-gray-900'}>{fmtINR(p.amount)}</td>
                          <td className={NUM}>{Number(p.amount_refunded) > 0 ? fmtINR(p.amount_refunded) : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className={TFOOT}>
                    <tr>
                      <td className={TD} colSpan={7}>Total ({shownPending.length})</td>
                      <td className={NUM + ' text-gray-900'}>{fmtINR(shownPending.reduce((n, p) => n + Number(p.amount), 0))}</td>
                      <td className={NUM}>{fmtINR(shownPending.reduce((n, p) => n + Number(p.amount_refunded || 0), 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="px-4 py-2.5 text-xs text-gray-500 border-t border-gray-200">
                Expected payout assumes Razorpay&apos;s usual 2 working days. Bank holidays can delay it.
              </p>
            </>
          )
        )}
      </div>
    </div>
  );
}

/* ───────────── Table styles ───────────── */

const TABLE = ui.table;
const THEAD = ui.thead;
const TH = ui.th;
const TR = ui.tr;
const TD = ui.td;
const NUM = ui.num;
const TFOOT = ui.tfoot;
const INPUT = ui.input;

const methodLabel = (m: string | null) => (m ? METHOD_LABEL[m.toLowerCase()] || m.toUpperCase() : '—');

function sumItems(list: Settlement[], by: Map<string, Item[]>, pick: (i: Item) => number) {
  return list.reduce((n, s) => n + (by.get(s.id) || []).reduce((m, i) => m + pick(i), 0), 0);
}

/** Groups a row and its expanded detail row without adding DOM. */
function PayoutRows({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/* ───────────── Pieces ───────────── */

function ItemsTable({ items }: { items: Item[] }) {
  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white">
      <table className={TABLE}>
        <thead className={THEAD}>
          <tr>
            <th className={TH}>Customer</th>
            <th className={TH}>Trip</th>
            <th className={TH}>Booking</th>
            <th className={TH}>Payment ID</th>
            <th className={TH}>Type</th>
            <th className={TH}>Received</th>
            <th className={TH + ' text-right'}>Days</th>
            <th className={TH + ' text-right'}>Amount</th>
            <th className={TH + ' text-right'}>Fee + GST</th>
            <th className={TH + ' text-right'}>Net</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => {
            const net = round2(Number(i.credit) - Number(i.debit));
            const received = i.paid_at || i.transaction_at;
            const days = received && i.settled_at ? Math.max(0, Math.round((new Date(i.settled_at).getTime() - new Date(received).getTime()) / 86400000)) : null;
            return (
              <tr key={i.id} className="border-b border-gray-100 last:border-b-0">
                <td className={TD + ' whitespace-nowrap'}>
                  {i.user_id ? <Link href={`/admin/users/${i.user_id}`} className="text-gray-900 hover:text-purple-700">{nameOf(i)}</Link> : <span className="text-gray-900">{nameOf(i)}</span>}
                  <div className="text-xs text-gray-500 truncate max-w-[200px]">{i.profile_email || i.customer_email || i.primary_passenger_email || ''}</div>
                </td>
                <td className={TD + ' text-gray-600'}><div className="truncate max-w-[180px]">{i.trip_title || i.description || '—'}</div></td>
                <td className={TD}>
                  {i.booking_id && i.booking_exists
                    ? <Link href={`/admin/bookings/${i.booking_id}`} className={`font-mono text-xs ${ui.link}`}>{i.booking_id.slice(0, 8)}</Link>
                    : i.booking_id
                      ? <span className="font-mono text-xs text-gray-400" title="Booking was deleted">{i.booking_id.slice(0, 8)} (deleted)</span>
                      : <span className="text-gray-400">—</span>}
                </td>
                <td className={TD + ' font-mono text-xs text-gray-600'}>{i.entity_id}</td>
                <td className={TD + ' whitespace-nowrap'}>
                  <Badge tone={i.type === 'payment' ? 'green' : i.type === 'refund' ? 'purple' : 'gray'}>{i.type === 'payment' ? 'Payment' : i.type === 'refund' ? 'Refund' : i.type}</Badge>
                  {i.method && <span className="ml-2 text-gray-500">{methodLabel(i.method)}</span>}
                </td>
                <td className={TD + ' whitespace-nowrap text-gray-600'}>{fmtDate(received)}</td>
                <td className={NUM}>{days ?? '—'}</td>
                <td className={NUM}>{fmtINR(i.amount)}</td>
                <td className={NUM}>{Number(i.fee) ? `−${fmtINR(i.fee)}` : '—'}</td>
                <td className={NUM + ' font-medium ' + (net < 0 ? 'text-red-700' : 'text-gray-900')}>{net < 0 ? '−' : ''}{fmtINR(Math.abs(net))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TxnTable({ txns }: { txns: Txn[] }) {
  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white">
      <table className={TABLE}>
        <thead className={THEAD}>
          <tr>
            <th className={TH}>Trip</th>
            <th className={TH}>Booking</th>
            <th className={TH}>Payment ID</th>
            <th className={TH}>Received</th>
            <th className={TH + ' text-right'}>Amount</th>
            <th className={TH + ' text-right'}>Fee + GST</th>
            <th className={TH + ' text-right'}>Refunded</th>
            <th className={TH + ' text-right'}>Net to bank</th>
            <th className={TH}>Settlement</th>
            <th className={TH}>UTR</th>
          </tr>
        </thead>
        <tbody>
          {txns.map((t) => (
            <tr key={t.key} className="border-b border-gray-100 last:border-b-0">
              <td className={TD + ' text-gray-800'}><div className="truncate max-w-[180px]">{t.trip || '—'}</div></td>
              <td className={TD}>
                {t.bookingId && t.bookingExists
                  ? <Link href={`/admin/bookings/${t.bookingId}`} className={`font-mono text-xs ${ui.link}`}>{t.bookingId.slice(0, 8)}</Link>
                  : t.bookingId
                    ? <span className="font-mono text-xs text-gray-400" title="Booking was deleted">{t.bookingId.slice(0, 8)} (deleted)</span>
                    : <span className="text-gray-400">—</span>}
              </td>
              <td className={TD + ' font-mono text-xs text-gray-600'}>{t.rzpId}</td>
              <td className={TD + ' whitespace-nowrap text-gray-600'}>{fmtDate(t.receivedAt)}</td>
              <td className={NUM}>{fmtINR(t.amount)}</td>
              <td className={NUM}>{t.fee ? `−${fmtINR(t.fee)}` : '—'}</td>
              <td className={NUM}>{t.refunded ? fmtINR(t.refunded) : '—'}</td>
              <td className={NUM + ' font-medium text-gray-900'}>{t.settledAt ? fmtINR(t.net) : '—'}</td>
              <td className={TD + ' whitespace-nowrap text-gray-600'}>
                {t.settledAt
                  ? <><Badge tone="green">Settled</Badge><span className="ml-2">{fmtDay(t.settledAt)}</span></>
                  : <><Badge tone={isLate(t.expectedAt) ? 'red' : 'amber'}>{isLate(t.expectedAt) ? 'Late' : 'Awaiting'}</Badge><span className="ml-2 text-gray-500">exp. {fmtDay(t.expectedAt)}</span></>}
              </td>
              <td className={TD + ' font-mono text-xs text-gray-600'}>{t.utr || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusText({ status }: { status: string | null }) {
  const st = status || 'unknown';
  const tone = st === 'processed' ? 'green' : st === 'failed' ? 'red' : 'amber';
  return <Badge tone={tone}>{st.charAt(0).toUpperCase() + st.slice(1)}</Badge>;
}

function Empty({ text, synced }: { text: string; synced: boolean }) {
  return (
    <div className="px-4 py-12 text-center text-sm text-gray-500">
      <p>{text}</p>
      {!synced && <p className="text-xs text-gray-400 mt-1">Settlements haven&apos;t been pulled from Razorpay yet. Press Sync.</p>}
    </div>
  );
}

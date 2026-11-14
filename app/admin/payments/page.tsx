'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Bone } from '@/components/ui/Skeleton';
import SettlementsPanel from '@/components/admin/payments/SettlementsPanel';
import { ui, Badge, SummaryBar, Field, CardTitle, type Tone } from '@/components/admin/payments/ui';
import {
  Search, Filter, IndianRupee, CreditCard, RefreshCcw, Eye, X, Check,
  CheckCircle2, AlertCircle, Clock, ArrowLeft, Copy, Download, ExternalLink
} from 'lucide-react';

interface Payment {
  id: string;
  booking_id: string;
  user_id: string | null;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  transaction_id: string;
  amount: number;
  amount_refunded: number;
  currency: string;
  payment_status: string;
  payment_method: string | null;
  payment_mode: string | null;
  payment_type: string | null;
  captured: boolean;
  vpa: string | null;
  upi_provider: string | null;
  card_network: string | null;
  card_type: string | null;
  card_last4: string | null;
  card_issuer: string | null;
  bank: string | null;
  wallet: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  paid_at: string | null;
  created_at: string;
  primary_passenger_name: string | null;
  primary_passenger_email: string | null;
  trip_title: string | null;
  trip_destination: string | null;
}

interface SettlementLine {
  settlement_id: string;
  entity_id: string;
  type: string;
  amount: number;
  fee: number;
  tax: number;
  credit: number;
  debit: number;
  settled_at: string | null;
  settlement_utr: string | null;
}

interface Refund {
  id: string;
  razorpay_refund_id: string | null;
  amount: number;
  status: string;
  reason: string | null;
  processed_at: string | null;
  created_at: string;
}

const statusBadge = (s: string): { label: string; cls: string; tone: Tone } => {
  switch (s) {
    case 'verified': return { label: 'Paid', tone: 'green', cls: 'bg-green-100 text-green-700 border-green-200' };
    case 'refunded': return { label: 'Refunded', tone: 'purple', cls: 'bg-purple-100 text-purple-700 border-purple-200' };
    case 'partially_refunded': return { label: 'Partial refund', tone: 'amber', cls: 'bg-amber-100 text-amber-700 border-amber-200' };
    case 'failed': return { label: 'Failed', tone: 'red', cls: 'bg-red-100 text-red-700 border-red-200' };
    case 'rejected': return { label: 'Rejected', tone: 'red', cls: 'bg-red-100 text-red-700 border-red-200' };
    case 'pending': return { label: 'Pending', tone: 'amber', cls: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
    default: return { label: s, tone: 'gray', cls: 'bg-gray-100 text-gray-700 border-gray-200' };
  }
};

const METHOD_NAMES: Record<string, string> = {
  upi: 'UPI', card: 'Card', netbanking: 'Net banking', wallet: 'Wallet', emi: 'EMI',
  razorpay: 'Razorpay', cash: 'Cash', manual: 'Manual', paylater: 'Pay later',
};
const methodName = (m: string | null | undefined) => (m ? METHOD_NAMES[m.toLowerCase()] || m.replace(/_/g, ' ') : '—');

const fmtINR = (n: number | string | null | undefined) =>
  '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const fmtDate = (d: string | null) => d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
  const [selected, setSelected] = useState<Payment | null>(null);
  const [detail, setDetail] = useState<{ payment: Payment; refunds: Refund[]; razorpay_raw: any; settlements?: SettlementLine[] } | null>(null);
  const [tab, setTab] = useState<'payments' | 'settlements'>('payments');
  const [refundOpen, setRefundOpen] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  // Lightweight rows for EVERY matching payment, so the totals aren't limited to
  // the page of rows currently shown in the table.
  const [summaryRows, setSummaryRows] = useState<Payment[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);

  const buildParams = (offset = 0) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (status) params.set('status', status);
    if (method) params.set('method', method);
    if (offset) params.set('offset', String(offset));
    return params;
  };

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/payments?${buildParams()}`);
      const j = await r.json();
      if (r.ok) {
        setPayments(j.payments || []);
        setSummaryRows(j.summaryRows || j.payments || []);
        setTotal(j.total || 0);
      } else {
        setToast({ type: 'error', msg: j.error || 'Failed to load payments' });
      }
    } catch {
      setToast({ type: 'error', msg: 'Failed to load payments' });
    }
    setLoading(false);
  };

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const r = await fetch(`/api/admin/payments?${buildParams(payments.length)}`);
      const j = await r.json();
      if (r.ok) {
        setPayments((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          return [...prev, ...(j.payments || []).filter((p: Payment) => !seen.has(p.id))];
        });
      } else {
        setToast({ type: 'error', msg: j.error || 'Failed to load more payments' });
      }
    } catch {
      setToast({ type: 'error', msg: 'Failed to load more payments' });
    }
    setLoadingMore(false);
  };

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [q, status, method]);

  // ?tab=settlements opens the Settlements tab directly (and survives reloads).
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') === 'settlements') setTab('settlements');
  }, []);
  const switchTab = (t: 'payments' | 'settlements') => {
    setTab(t);
    const url = new URL(window.location.href);
    if (t === 'settlements') url.searchParams.set('tab', 'settlements'); else url.searchParams.delete('tab');
    window.history.replaceState(null, '', url.toString());
  };

  const totals = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const yesterdayStart = todayStart - 86400000;

    let collected = 0, refunded = 0, pending = 0, failed = 0;
    let today = 0, yesterday = 0, thisMonth = 0, lastMonth = 0;
    const methodCounts: Record<string, number> = {};
    const tripRevenue: Record<string, { name: string; amount: number }> = {};

    summaryRows.forEach(p => {
      const amt = Number(p.amount || 0);
      const refAmt = Number(p.amount_refunded || 0);
      const paidAt = p.paid_at ? new Date(p.paid_at).getTime() : new Date(p.created_at).getTime();
      const isPaid = ['verified', 'partially_refunded', 'refunded'].includes(p.payment_status);

      if (isPaid) collected += amt;
      refunded += refAmt;
      if (p.payment_status === 'pending') pending += amt;
      if (p.payment_status === 'failed' || p.payment_status === 'rejected') failed += amt;

      if (isPaid) {
        if (paidAt >= todayStart) today += amt;
        else if (paidAt >= yesterdayStart) yesterday += amt;
        if (paidAt >= monthStart) thisMonth += amt;
        else if (paidAt >= lastMonthStart) lastMonth += amt;
      }

      const m = (p.payment_method || p.payment_mode || 'other').toLowerCase();
      methodCounts[m] = (methodCounts[m] || 0) + 1;

      if (isPaid && p.trip_title) {
        const k = p.trip_title;
        if (!tripRevenue[k]) tripRevenue[k] = { name: k, amount: 0 };
        tripRevenue[k].amount += amt;
      }
    });

    const topTrips = Object.values(tripRevenue).sort((a, b) => b.amount - a.amount).slice(0, 3);
    const methodTotal = Object.values(methodCounts).reduce((s, n) => s + n, 0) || 1;
    const methodPct = Object.entries(methodCounts)
      .map(([k, n]) => ({ k, n, pct: Math.round((n / methodTotal) * 100) }))
      .sort((a, b) => b.n - a.n);

    return { collected, pending, refunded, failed, today, yesterday, thisMonth, lastMonth, topTrips, methodPct };
  }, [summaryRows]);

  // Net = collected − refunded
  const net = totals.collected - totals.refunded;
  const todayTrend = totals.yesterday > 0 ? ((totals.today - totals.yesterday) / totals.yesterday) * 100 : 0;
  const monthTrend = totals.lastMonth > 0 ? ((totals.thisMonth - totals.lastMonth) / totals.lastMonth) * 100 : 0;

  const openDetail = async (p: Payment) => {
    setSelected(p);
    setDetail(null);
    const r = await fetch(`/api/admin/payments/${p.id}`);
    const j = await r.json();
    if (r.ok) setDetail(j);
    else setToast({ type: 'error', msg: j.error || 'Failed to load payment' });
  };

  const copy = (s: string) => { navigator.clipboard?.writeText(s); setToast({ type: 'success', msg: 'Copied' }); };

  const syncFromRazorpay = async () => {
    if (!selected) return;
    setDetail(null);
    try {
      const r = await fetch(`/api/admin/payments/${selected.id}/sync`, { method: 'POST' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Sync failed');
      setToast({ type: 'success', msg: 'Synced from Razorpay' });
      // reload detail + list
      const d = await fetch(`/api/admin/payments/${selected.id}`); const dj = await d.json();
      if (d.ok) setDetail(dj);
      load();
    } catch (e: any) {
      setToast({ type: 'error', msg: e.message });
      // try reloading detail anyway
      const d = await fetch(`/api/admin/payments/${selected.id}`); const dj = await d.json();
      if (d.ok) setDetail(dj);
    }
  };

  return (
    <div>
      <div className="max-w-7xl mx-auto">
        <div className="mb-5">
          <Link href="/admin" className="inline-flex items-center text-purple-700 hover:text-purple-900 text-sm font-medium mb-2">
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Admin
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Payments</h1>
          <p className="text-sm text-gray-500 mt-1">
            {tab === 'payments'
              ? <>{total} payments · net <span className="tabular-nums text-gray-700 font-medium">{fmtINR(net)}</span> after refunds</>
              : 'Razorpay payouts to your bank, by booking and customer'}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-6 border-b border-gray-200 mb-5" role="tablist">
          {([['payments', 'Payments'], ['settlements', 'Settlements']] as const).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => switchTab(k)}
              className={`pb-3 text-sm font-semibold border-b-2 -mb-px transition-colors ${tab === k ? 'border-purple-700 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'settlements' ? (
          <SettlementsPanel onToast={setToast} />
        ) : (
        <div className="space-y-4">
          <SummaryBar items={[
            { label: 'Collected', value: fmtINR(totals.collected), note: 'All time' },
            { label: 'Refunded', value: fmtINR(totals.refunded), note: `Net ${fmtINR(net)}` },
            { label: 'Pending', value: fmtINR(totals.pending), note: 'Awaiting verification', noteTone: totals.pending > 0 ? 'warn' : undefined },
            { label: 'Failed', value: fmtINR(totals.failed), note: 'Needs review', noteTone: totals.failed > 0 ? 'bad' : undefined },
            {
              label: 'Today', value: fmtINR(totals.today),
              note: totals.yesterday > 0 ? `${todayTrend >= 0 ? '+' : ''}${todayTrend.toFixed(0)}% vs yesterday` : 'No data yesterday',
              noteTone: totals.yesterday > 0 ? (todayTrend >= 0 ? 'good' : 'bad') : undefined,
            },
            {
              label: 'This month', value: fmtINR(totals.thisMonth),
              note: totals.lastMonth > 0 ? `${monthTrend >= 0 ? '+' : ''}${monthTrend.toFixed(0)}% vs last month` : 'No data last month',
              noteTone: totals.lastMonth > 0 ? (monthTrend >= 0 ? 'good' : 'bad') : undefined,
            },
          ]} />

          <div className={`${ui.card} overflow-hidden`}>
            <div className={ui.cardHeader}>
              <CardTitle title="All payments" count={total} />
              <button onClick={load} className={ui.btn}>
                <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>

            <div className={ui.toolbar}>
              <Field label="Search" grow>
                <div className="relative">
                  <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={q} onChange={(e) => setQ(e.target.value)}
                    placeholder="Payment ID, name, email, phone, trip"
                    className={`${ui.input} pl-9 w-full`}
                  />
                </div>
              </Field>
              <Field label="Status">
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={ui.input}>
                  <option value="">All</option>
                  <option value="verified">Paid</option>
                  <option value="partially_refunded">Partially refunded</option>
                  <option value="refunded">Refunded</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                  <option value="rejected">Rejected</option>
                </select>
              </Field>
              <Field label="Method">
                <select value={method} onChange={(e) => setMethod(e.target.value)} className={ui.input}>
                  <option value="">All</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="netbanking">Net banking</option>
                  <option value="wallet">Wallet</option>
                  <option value="emi">EMI</option>
                </select>
              </Field>
              {(q || status || method) && (
                <button onClick={() => { setQ(''); setStatus(''); setMethod(''); }} className={`${ui.link} text-sm h-9`}>
                  Clear
                </button>
              )}
            </div>

            {loading ? (
              <div role="status" aria-busy="true">
                <span className="sr-only">Loading payments</span>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-3.5 border-b border-gray-100 last:border-b-0">
                    <div className="flex-1 min-w-0 space-y-2">
                      <Bone className="h-3.5 w-2/5" />
                      <Bone className="h-3 w-1/4" tone="soft" />
                    </div>
                    <Bone className="hidden sm:block h-3.5 w-28" tone="soft" />
                    <Bone className="h-4 w-20" />
                    <Bone className="h-5 w-16 rounded-full" tone="soft" />
                  </div>
                ))}
              </div>
            ) : payments.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-gray-500">No payments match these filters.</div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className={ui.table}>
                    <thead className={ui.thead}>
                      <tr>
                        <th className={ui.th}>Customer</th>
                        <th className={ui.th}>Payment ID</th>
                        <th className={ui.th}>Method</th>
                        <th className={`${ui.th} text-right`}>Amount</th>
                        <th className={`${ui.th} text-right`}>Refunded</th>
                        <th className={ui.th}>Status</th>
                        <th className={ui.th}>Date</th>
                        <th className={ui.th}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map(p => {
                        const b = statusBadge(p.payment_status);
                        const name = p.customer_name || p.primary_passenger_name || '—';
                        return (
                          <tr key={p.id} className={`${ui.tr} cursor-pointer`} onClick={() => openDetail(p)}>
                            <td className={ui.td}>
                              <p className="font-medium text-gray-900">{name}</p>
                              <p className="text-xs text-gray-500 truncate max-w-xs">{p.trip_title || '—'}</p>
                            </td>
                            <td className={`${ui.td} ${ui.mono}`}>{p.razorpay_payment_id || p.transaction_id || '—'}</td>
                            <td className={`${ui.td} text-gray-600`}>{methodName(p.payment_method || p.payment_mode)}</td>
                            <td className={`${ui.num} font-semibold text-gray-900`}>{fmtINR(p.amount)}</td>
                            <td className={ui.num}>{p.amount_refunded ? fmtINR(p.amount_refunded) : '—'}</td>
                            <td className={ui.td}><Badge tone={b.tone}>{b.label}</Badge></td>
                            <td className={`${ui.td} text-gray-600 whitespace-nowrap`}>{fmtDate(p.paid_at || p.created_at)}</td>
                            <td className={`${ui.td} text-right`}>
                              <button className="p-1.5 rounded-md text-gray-400 hover:text-purple-700 hover:bg-purple-50" onClick={(e) => { e.stopPropagation(); openDetail(p); }} aria-label="View payment">
                                <Eye className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile list */}
                <div className="md:hidden">
                  {payments.map(p => {
                    const b = statusBadge(p.payment_status);
                    return (
                      <button key={p.id} onClick={() => openDetail(p)} className="w-full text-left px-4 py-3.5 border-b border-gray-100 last:border-b-0 hover:bg-purple-50/40">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 text-sm truncate">{p.customer_name || p.primary_passenger_name || '—'}</p>
                            <p className="text-xs text-gray-500 truncate">{p.trip_title || '—'}</p>
                          </div>
                          <p className="font-semibold text-gray-900 tabular-nums text-sm flex-shrink-0">{fmtINR(p.amount)}</p>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-2">
                          <span className="text-xs text-gray-500 truncate">{fmtDate(p.paid_at || p.created_at)} · {methodName(p.payment_method || p.payment_mode)}</span>
                          <Badge tone={b.tone}>{b.label}</Badge>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {payments.length < total && (
                  <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between gap-3">
                    <span className="text-xs text-gray-500 tabular-nums">{payments.length} of {total} shown</span>
                    <button onClick={loadMore} disabled={loadingMore} className={ui.btn}>
                      {loadingMore ? 'Loading…' : 'Load more'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Breakdowns */}
          {(totals.topTrips.length > 0 || totals.methodPct.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {totals.topTrips.length > 0 && (
                <div className={`${ui.card} overflow-hidden`}>
                  <div className={ui.cardHeader}><CardTitle title="Top trips by revenue" /></div>
                  <table className={ui.table}>
                    <thead className={ui.thead}>
                      <tr>
                        <th className={ui.th}>Trip</th>
                        <th className={`${ui.th} text-right`}>Revenue</th>
                        <th className={`${ui.th} text-right`}>Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {totals.topTrips.map((t) => (
                        <tr key={t.name} className={ui.tr}>
                          <td className={`${ui.td} text-gray-900`}><div className="truncate max-w-[260px]">{t.name}</div></td>
                          <td className={`${ui.num} font-medium text-gray-900`}>{fmtINR(t.amount)}</td>
                          <td className={ui.num}>{totals.collected > 0 ? `${((t.amount / totals.collected) * 100).toFixed(1)}%` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {totals.methodPct.length > 0 && (
                <div className={`${ui.card} overflow-hidden`}>
                  <div className={ui.cardHeader}><CardTitle title="Payment methods" /></div>
                  <table className={ui.table}>
                    <thead className={ui.thead}>
                      <tr>
                        <th className={ui.th}>Method</th>
                        <th className={`${ui.th} text-right`}>Payments</th>
                        <th className={`${ui.th} text-right`}>Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {totals.methodPct.map((m) => (
                        <tr key={m.k} className={ui.tr}>
                          <td className={`${ui.td} text-gray-900`}>{methodName(m.k)}</td>
                          <td className={ui.num}>{m.n}</td>
                          <td className={ui.num}>{m.pct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => { setSelected(null); setDetail(null); }}>
          <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex items-center justify-between z-10">
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-extrabold text-gray-900 truncate">Payment Details</h2>
                <p className="text-xs text-gray-500 font-mono truncate">{selected.razorpay_payment_id || selected.transaction_id}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button onClick={syncFromRazorpay} title="Re-sync from Razorpay" className="px-2 py-1.5 hover:bg-purple-50 text-purple-700 rounded-lg text-xs font-bold flex items-center gap-1">
                  <RefreshCcw className="h-3.5 w-3.5" /><span className="hidden sm:inline">Sync</span>
                </button>
                <a href={`https://dashboard.razorpay.com/app/payments/${selected.razorpay_payment_id || selected.transaction_id}`} target="_blank" rel="noopener noreferrer" title="Open in Razorpay" className="p-1.5 hover:bg-gray-100 rounded-lg">
                  <ExternalLink className="h-4 w-4 text-gray-600" />
                </a>
                <button onClick={() => { setSelected(null); setDetail(null); }} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="h-5 w-5" /></button>
              </div>
            </div>

            {!detail ? (
              <div className="p-4 sm:p-6 space-y-5" role="status" aria-busy="true">
                <span className="sr-only">Loading details</span>
                <div className="rounded-2xl border border-gray-100 p-5 space-y-3">
                  <Bone className="h-3.5 w-24" tone="soft" />
                  <Bone className="h-9 w-40" />
                  <Bone className="h-6 w-24 rounded-full" tone="purple" />
                </div>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex justify-between gap-4">
                    <Bone className="h-3.5 w-1/3" tone="soft" />
                    <Bone className="h-3.5 w-1/4" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 sm:p-6 space-y-5">
                {/* Hero: amount + status */}
                <div className="bg-gradient-to-br from-purple-50 to-fuchsia-50 border border-purple-200 rounded-2xl p-4 sm:p-5">
                  <div className="flex items-baseline justify-between flex-wrap gap-2">
                    <div>
                      <p className="text-3xl sm:text-4xl font-extrabold text-gray-900 flex items-baseline">
                        <IndianRupee className="h-6 w-6 sm:h-7 sm:w-7" />{Number(detail.payment.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{detail.payment.currency || 'INR'} · {detail.payment.captured ? 'Captured' : 'Not captured'}</p>
                    </div>
                    <span className={`inline-block px-3 py-1.5 rounded-full text-xs font-extrabold border ${statusBadge(detail.payment.payment_status).cls}`}>
                      {statusBadge(detail.payment.payment_status).label}
                    </span>
                  </div>
                  {Number(detail.payment.amount_refunded || 0) > 0 && (
                    <p className="text-sm font-bold text-purple-700 mt-2">Refunded: {fmtINR(detail.payment.amount_refunded)}</p>
                  )}
                </div>

                {/* Timeline (Razorpay-style) */}
                <div>
                  <p className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-2.5">Timeline</p>
                  <Timeline payment={detail.payment} raw={detail.razorpay_raw} settlements={detail.settlements || []} />
                </div>

                {/* Two-column details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <Sec title="Payment">
                    <Row label="Payment ID" value={
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono text-xs truncate">{detail.payment.razorpay_payment_id || detail.payment.transaction_id}</span>
                        <button onClick={() => copy(detail.payment.razorpay_payment_id || detail.payment.transaction_id)} className="flex-shrink-0"><Copy className="h-3 w-3 text-gray-400" /></button>
                      </span>
                    } />
                    <Row label="Order ID" value={
                      detail.payment.razorpay_order_id ? (
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono text-xs truncate">{detail.payment.razorpay_order_id}</span>
                          <button onClick={() => copy(detail.payment.razorpay_order_id!)} className="flex-shrink-0"><Copy className="h-3 w-3 text-gray-400" /></button>
                        </span>
                      ) : '—'
                    } />
                    <Row label="Method" value={<span className="uppercase font-bold text-gray-900">{detail.payment.payment_method || detail.payment.payment_mode || '—'}</span>} />
                    <Row label="Bank RRN" value={<span className="font-mono text-xs">{(detail.razorpay_raw as any)?.acquirer_data?.rrn || '—'}</span>} />
                    <Row label="Paid at" value={fmtDate(detail.payment.paid_at)} />
                  </Sec>

                  <Sec title="Customer">
                    <Row label="Name" value={detail.payment.customer_name || detail.payment.primary_passenger_name || '—'} />
                    <Row label="Email" value={detail.payment.customer_email || detail.payment.primary_passenger_email || '—'} />
                    <Row label="Phone" value={
                      detail.payment.customer_phone ? (
                        <a href={`tel:${detail.payment.customer_phone}`} className="text-purple-700">{detail.payment.customer_phone}</a>
                      ) : '—'
                    } />
                  </Sec>
                </div>

                {/* Method-specific section */}
                {(detail.payment.vpa || detail.payment.upi_provider) && (
                  <Sec title="UPI">
                    {detail.payment.vpa && <Row label="VPA" value={<span className="font-mono">{detail.payment.vpa}</span>} />}
                    {detail.payment.upi_provider && <Row label="Provider" value={detail.payment.upi_provider} />}
                  </Sec>
                )}
                {(detail.payment.card_network || detail.payment.card_last4) && (
                  <Sec title="Card">
                    {detail.payment.card_network && <Row label="Network" value={detail.payment.card_network.toUpperCase()} />}
                    {detail.payment.card_type && <Row label="Type" value={detail.payment.card_type} />}
                    {detail.payment.card_last4 && <Row label="Last 4" value={`•••• ${detail.payment.card_last4}`} />}
                    {detail.payment.card_issuer && <Row label="Issuer" value={detail.payment.card_issuer} />}
                  </Sec>
                )}
                {detail.payment.bank && <Sec title="Net Banking"><Row label="Bank" value={detail.payment.bank} /></Sec>}
                {detail.payment.wallet && <Sec title="Wallet"><Row label="Wallet" value={detail.payment.wallet} /></Sec>}

                <Sec title="Booking & Trip">
                  <Row label="Trip" value={detail.payment.trip_title || '—'} />
                  <Row label="Destination" value={detail.payment.trip_destination || '—'} />
                  <Row label="Booking" value={
                    <Link href={`/admin/bookings/${detail.payment.booking_id}`} className="text-purple-700 font-semibold underline">View booking →</Link>
                  } />
                </Sec>

                {/* Refund history */}
                <div>
                  <p className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-2">Refunds ({detail.refunds.length})</p>
                  {detail.refunds.length === 0 ? (
                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                      <p className="text-sm text-gray-500">No refunds yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {detail.refunds.map(r => (
                        <div key={r.id} className="border border-gray-200 rounded-xl p-3 text-sm">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-gray-900">{fmtINR(r.amount)}</span>
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider ${r.status === 'processed' ? 'bg-green-600 text-white' : r.status === 'failed' ? 'bg-red-600 text-white' : 'bg-yellow-500 text-white'}`}>{r.status}</span>
                          </div>
                          <p className="text-xs text-gray-500 font-mono break-all">{r.razorpay_refund_id}</p>
                          {r.reason && <p className="text-xs text-gray-700 mt-1">Reason: {r.reason}</p>}
                          <p className="text-[10px] text-gray-400 mt-1">{fmtDate(r.created_at)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Refund action */}
                {['verified', 'partially_refunded'].includes(detail.payment.payment_status) && detail.payment.payment_mode === 'razorpay' && (
                  <button
                    onClick={() => setRefundOpen(true)}
                    className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-sm"
                  >
                    Initiate Refund
                  </button>
                )}

                {(!detail.payment.razorpay_order_id || !detail.payment.paid_at) && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
                    <p className="font-bold mb-1">⚠️ Some fields missing</p>
                    <p>This payment was created before rich Razorpay data was captured. Click the <strong>Sync</strong> button (top right) to fetch complete details from Razorpay.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Refund modal */}
      {refundOpen && detail && (
        <RefundModal
          payment={detail.payment}
          alreadyRefunded={Number(detail.payment.amount_refunded || 0)}
          onClose={() => setRefundOpen(false)}
          onDone={(msg) => {
            setRefundOpen(false);
            setToast({ type: 'success', msg });
            if (selected) openDetail(selected); // refresh detail
            load();
          }}
          onError={(msg) => setToast({ type: 'error', msg })}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-[60] px-4 py-3 rounded-xl shadow-lg text-sm font-semibold ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'} animate-fade-in`}
             onAnimationEnd={() => setTimeout(() => setToast(null), 2800)}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function Timeline({ payment, raw, settlements }: { payment: Payment; raw: any; settlements: SettlementLine[] }) {
  // Razorpay-style timeline derived from payment + raw data
  const events: { label: string; at: string | null; status: 'done' | 'pending' }[] = [];
  const createdTs = raw?.created_at ? new Date(raw.created_at * 1000).toISOString() : payment.created_at;
  events.push({ label: 'Payment created', at: createdTs, status: 'done' });
  // Authorized & captured: Razorpay marks both at the same time for instant methods
  if (payment.captured || raw?.captured) {
    events.push({ label: 'Payment authorized', at: payment.paid_at || createdTs, status: 'done' });
    events.push({ label: 'Payment captured', at: payment.paid_at || createdTs, status: 'done' });
  } else if (payment.payment_status === 'verified') {
    events.push({ label: 'Payment authorized', at: payment.paid_at || createdTs, status: 'done' });
  }
  // Actual payout(s) once Razorpay has settled; otherwise an estimate.
  const settledLine = settlements.find((s) => s.type === 'payment');
  if (settledLine) {
    const net = Number(settledLine.credit) - Number(settledLine.debit);
    events.push({
      label: `Settled to bank · ${fmtINR(net)} (fee ${fmtINR(settledLine.fee)})${settledLine.settlement_utr ? ` · UTR ${settledLine.settlement_utr}` : ''}`,
      at: settledLine.settled_at,
      status: 'done',
    });
    settlements.filter((s) => s.type === 'refund').forEach((s) => {
      events.push({ label: `Refund ${fmtINR(s.debit || s.amount)} deducted from payout`, at: s.settled_at, status: 'done' });
    });
  } else if (payment.captured || raw?.captured) {
    const settleBy = new Date(new Date(payment.paid_at || createdTs).getTime() + 2 * 86400000).toISOString();
    events.push({ label: 'Settlement (to be processed)', at: settleBy, status: 'pending' });
  }
  if (payment.payment_status === 'refunded') {
    events.push({ label: 'Payment refunded', at: null, status: 'done' });
  }
  if (payment.payment_status === 'partially_refunded') {
    events.push({ label: 'Partial refund issued', at: null, status: 'done' });
  }

  return (
    <ol className="relative border-l-2 border-gray-200 ml-2 pl-5 space-y-3.5">
      {events.map((e, i) => (
        <li key={i} className="relative">
          <span className={`absolute -left-[27px] top-1 h-3.5 w-3.5 rounded-full ring-4 ring-white ${e.status === 'done' ? 'bg-green-500' : 'bg-gray-300'}`}></span>
          <p className="text-sm font-semibold text-gray-900">{e.label}</p>
          <p className="text-xs text-gray-500">{e.at ? fmtDate(e.at) : '—'}</p>
        </li>
      ))}
    </ol>
  );
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-2">{title}</p>
      <dl className="bg-gray-50 rounded-xl px-3 py-2 divide-y divide-gray-200">{children}</dl>
    </div>
  );
}
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2 text-sm">
      <dt className="text-gray-500 min-w-[110px]">{label}</dt>
      <dd className="font-medium text-gray-900 break-all min-w-0 flex-1">{value}</dd>
    </div>
  );
}

function RefundModal({
  payment, alreadyRefunded, onClose, onDone, onError,
}: {
  payment: Payment;
  alreadyRefunded: number;
  onClose: () => void;
  onDone: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const remaining = Number(payment.amount) - alreadyRefunded;
  const [amount, setAmount] = useState<string>(remaining.toFixed(2));
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0 || amt > remaining + 0.001) {
      onError(`Amount must be between ₹0.01 and ₹${remaining.toFixed(2)}`);
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/payments/${payment.id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amt, reason }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Refund failed');
      onDone(`Refund of ₹${amt} initiated successfully`);
    } catch (e: any) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[55] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-5 sm:p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-extrabold text-gray-900 mb-1">Refund Payment</h2>
        <p className="text-sm text-gray-600 mb-4">
          Paid: <strong>{fmtINR(payment.amount)}</strong> · Already refunded: <strong>{fmtINR(alreadyRefunded)}</strong> · Refundable: <strong className="text-purple-700">{fmtINR(remaining)}</strong>
        </p>

        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Refund amount (₹)</label>
        <div className="flex gap-2 mb-3">
          <input
            type="number" step="0.01" min="0.01" max={remaining}
            value={amount} onChange={(e) => setAmount(e.target.value)}
            className="flex-1 px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-purple-500 outline-none"
          />
          <button type="button" onClick={() => setAmount(remaining.toFixed(2))}
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-bold">Full</button>
        </div>

        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Reason</label>
        <textarea
          rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="Why is this being refunded? (visible to your team)"
          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-purple-500 outline-none mb-4"
        />

        <label className="flex items-start gap-2 text-sm mb-4">
          <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-1" />
          <span className="text-gray-700">I confirm this refund. Razorpay will debit ₹{Number(amount).toLocaleString('en-IN')} from our settlement balance.</span>
        </label>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold">Cancel</button>
          <button
            onClick={submit}
            disabled={!confirm || busy}
            className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? 'Processing…' : 'Refund Now'}
          </button>
        </div>
      </div>
    </div>
  );
}

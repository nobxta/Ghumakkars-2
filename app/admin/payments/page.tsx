'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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

interface Refund {
  id: string;
  razorpay_refund_id: string | null;
  amount: number;
  status: string;
  reason: string | null;
  processed_at: string | null;
  created_at: string;
}

const statusBadge = (s: string) => {
  switch (s) {
    case 'verified': return { label: 'Paid', cls: 'bg-green-100 text-green-700 border-green-200' };
    case 'refunded': return { label: 'Refunded', cls: 'bg-purple-100 text-purple-700 border-purple-200' };
    case 'partially_refunded': return { label: 'Partial Refund', cls: 'bg-amber-100 text-amber-700 border-amber-200' };
    case 'failed': return { label: 'Failed', cls: 'bg-red-100 text-red-700 border-red-200' };
    case 'rejected': return { label: 'Rejected', cls: 'bg-red-100 text-red-700 border-red-200' };
    case 'pending': return { label: 'Pending', cls: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
    default: return { label: s, cls: 'bg-gray-100 text-gray-700 border-gray-200' };
  }
};

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
  const [detail, setDetail] = useState<{ payment: Payment; refunds: Refund[]; razorpay_raw: any } | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (status) params.set('status', status);
    if (method) params.set('method', method);
    const r = await fetch(`/api/admin/payments?${params}`);
    const j = await r.json();
    if (r.ok) {
      setPayments(j.payments || []);
      setTotal(j.total || 0);
    } else {
      setToast({ type: 'error', msg: j.error || 'Failed to load payments' });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [q, status, method]);

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

    payments.forEach(p => {
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
  }, [payments]);

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
    <div className="min-h-screen pt-16 pb-20 bg-gradient-to-b from-purple-50/40 via-white to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-5 sm:mb-6 flex items-center justify-between gap-3">
          <div>
            <Link href="/admin" className="inline-flex items-center text-purple-700 hover:text-purple-900 text-sm font-semibold mb-2">
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Admin
            </Link>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">Payments</h1>
            <p className="text-sm text-gray-600 mt-1">{total} total · Net {fmtINR(net)} after refunds</p>
          </div>
          <button onClick={load} className="inline-flex items-center gap-1.5 bg-white border border-gray-200 hover:border-purple-300 px-3 py-2 rounded-lg text-sm font-semibold text-gray-700">
            <RefreshCcw className="h-4 w-4" /> Refresh
          </button>
        </div>

        {/* KPI strip — 6 metrics, single neutral palette */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 mb-5">
          <Kpi label="Collected" value={fmtINR(totals.collected)} tone="green" sub="all-time" />
          <Kpi label="Pending" value={fmtINR(totals.pending)} tone="amber" sub="awaiting verify" />
          <Kpi label="Refunded" value={fmtINR(totals.refunded)} tone="red" sub="all-time" />
          <Kpi label="Failed" value={fmtINR(totals.failed)} tone="red" sub="needs review" />
          <Kpi label="Today" value={fmtINR(totals.today)} tone="purple" sub={totals.yesterday > 0 ? `${todayTrend >= 0 ? '+' : ''}${todayTrend.toFixed(0)}% vs yest.` : 'no prior data'} trend={totals.yesterday > 0 ? todayTrend : undefined} />
          <Kpi label="This month" value={fmtINR(totals.thisMonth)} tone="purple" sub={totals.lastMonth > 0 ? `${monthTrend >= 0 ? '+' : ''}${monthTrend.toFixed(0)}% vs last` : 'no prior data'} trend={totals.lastMonth > 0 ? monthTrend : undefined} />
        </div>

        {/* Quick filters — action-first chips */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-xs uppercase tracking-wider font-bold text-gray-500 mr-1">Quick filters:</span>
          <QuickChip active={status === '' && method === ''} onClick={() => { setStatus(''); setMethod(''); }}>All</QuickChip>
          <QuickChip active={status === 'pending'} onClick={() => setStatus(status === 'pending' ? '' : 'pending')} tone="amber">Pending collection</QuickChip>
          <QuickChip active={status === 'failed'} onClick={() => setStatus(status === 'failed' ? '' : 'failed')} tone="red">Failed</QuickChip>
          <QuickChip active={status === 'partially_refunded'} onClick={() => setStatus(status === 'partially_refunded' ? '' : 'partially_refunded')} tone="amber">Partial refund</QuickChip>
          <QuickChip active={status === 'refunded'} onClick={() => setStatus(status === 'refunded' ? '' : 'refunded')} tone="red">Refunded</QuickChip>
        </div>

        {/* Filters — search grows, dropdowns sized to content */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-3 sm:p-4 mb-5 flex flex-col sm:flex-row gap-2 sm:gap-3 sm:flex-wrap sm:items-center">
          <div className="relative search-flex">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search payment ID, order ID, name, email, trip…"
              className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none"
            />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="filter-small px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white">
            <option value="">All statuses</option>
            <option value="verified">Paid</option>
            <option value="partially_refunded">Partially Refunded</option>
            <option value="refunded">Refunded</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="rejected">Rejected</option>
          </select>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="filter-small px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white">
            <option value="">All methods</option>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
            <option value="netbanking">Net Banking</option>
            <option value="wallet">Wallet</option>
            <option value="emi">EMI</option>
          </select>
        </div>

        {/* Insights — Top trips + Payment method distribution */}
        {(totals.topTrips.length > 0 || totals.methodPct.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-5">
            {totals.topTrips.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-3">Top trips by revenue</p>
                <ul className="space-y-2">
                  {totals.topTrips.map((t, i) => {
                    const maxAmt = totals.topTrips[0].amount;
                    const pct = maxAmt > 0 ? (t.amount / maxAmt) * 100 : 0;
                    return (
                      <li key={t.name}>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-sm font-semibold text-gray-900 truncate flex items-center gap-2">
                            <span className="text-xs text-gray-400">{i + 1}</span>
                            {t.name}
                          </span>
                          <span className="text-sm font-bold text-gray-900 whitespace-nowrap">{fmtINR(t.amount)}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-purple-600 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {totals.methodPct.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-3">Payment method distribution</p>
                <ul className="space-y-2">
                  {totals.methodPct.map((m) => (
                    <li key={m.k}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-semibold text-gray-900 uppercase">{m.k}</span>
                        <span className="text-xs text-gray-500">{m.n} · {m.pct}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-600 rounded-full" style={{ width: `${m.pct}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Table (desktop) / cards (mobile) */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-gray-500">Loading…</div>
          ) : payments.length === 0 ? (
            <div className="p-10 text-center text-gray-500">No payments match these filters.</div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50/70 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                    <tr>
                      <th className="px-4 py-3 text-left">Customer / Trip</th>
                      <th className="px-4 py-3 text-left">Payment ID</th>
                      <th className="px-4 py-3 text-left">Method</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3 text-right">Refunded</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {payments.map(p => {
                      const b = statusBadge(p.payment_status);
                      const name = p.customer_name || p.primary_passenger_name || '—';
                      return (
                        <tr key={p.id} className="hover:bg-purple-50/30 cursor-pointer" onClick={() => openDetail(p)}>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-gray-900">{name}</p>
                            <p className="text-xs text-gray-500 truncate max-w-xs">{p.trip_title || '—'}</p>
                          </td>
                          <td className="px-4 py-3"><span className="font-mono text-xs">{p.razorpay_payment_id || p.transaction_id || '—'}</span></td>
                          <td className="px-4 py-3"><span className="uppercase text-xs font-bold text-gray-700">{p.payment_method || p.payment_mode || '—'}</span></td>
                          <td className="px-4 py-3 text-right font-bold text-gray-900">{fmtINR(p.amount)}</td>
                          <td className="px-4 py-3 text-right text-purple-700 font-semibold">{p.amount_refunded ? fmtINR(p.amount_refunded) : '—'}</td>
                          <td className="px-4 py-3"><span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold border ${b.cls}`}>{b.label}</span></td>
                          <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{fmtDate(p.paid_at || p.created_at)}</td>
                          <td className="px-4 py-3 text-right">
                            <button className="p-2 hover:bg-purple-100 rounded-lg" onClick={(e) => { e.stopPropagation(); openDetail(p); }}>
                              <Eye className="h-4 w-4 text-purple-700" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-gray-100">
                {payments.map(p => {
                  const b = statusBadge(p.payment_status);
                  return (
                    <button key={p.id} onClick={() => openDetail(p)} className="w-full text-left p-4 hover:bg-purple-50/30">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 text-sm truncate">{p.customer_name || p.primary_passenger_name || '—'}</p>
                          <p className="text-xs text-gray-500 truncate">{p.trip_title || '—'}</p>
                        </div>
                        <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${b.cls} flex-shrink-0`}>{b.label}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono text-gray-600 truncate max-w-[55%]">{p.razorpay_payment_id || p.transaction_id}</span>
                        <span className="font-extrabold text-gray-900">{fmtINR(p.amount)}</span>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1">{fmtDate(p.paid_at || p.created_at)} · <span className="uppercase font-bold">{p.payment_method || p.payment_mode || '—'}</span></p>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
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
              <div className="p-10 text-center text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-3 border-purple-200 border-t-purple-600 mx-auto mb-3"></div>
                Loading details…
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
                  <Timeline payment={detail.payment} raw={detail.razorpay_raw} />
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

function Timeline({ payment, raw }: { payment: Payment; raw: any }) {
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
  // Settlement estimate: T+2 business days (Razorpay default)
  if (payment.captured || raw?.captured) {
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

function Kpi({ label, value, sub, tone, trend }: { label: string; value: string; sub?: string; tone?: 'green' | 'amber' | 'red' | 'purple'; trend?: number }) {
  const toneCls = tone === 'green' ? 'text-green-700' : tone === 'amber' ? 'text-amber-700' : tone === 'red' ? 'text-red-700' : tone === 'purple' ? 'text-purple-700' : 'text-gray-900';
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">
      <p className="text-[10px] sm:text-xs uppercase tracking-wider font-semibold text-gray-500">{label}</p>
      <p className={`text-base sm:text-xl font-extrabold mt-1 truncate ${toneCls}`}>{value}</p>
      {sub && (
        <p className={`text-[10px] sm:text-xs mt-1 truncate ${trend !== undefined ? (trend >= 0 ? 'text-green-700 font-semibold' : 'text-red-700 font-semibold') : 'text-gray-500'}`}>
          {sub}
        </p>
      )}
    </div>
  );
}

function QuickChip({ children, active, onClick, tone }: { children: React.ReactNode; active?: boolean; onClick: () => void; tone?: 'amber' | 'red' }) {
  const activeCls = tone === 'amber' ? 'bg-amber-600 text-white border-amber-600' : tone === 'red' ? 'bg-red-600 text-white border-red-600' : 'bg-purple-600 text-white border-purple-600';
  const inactiveCls = tone === 'amber' ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100' : tone === 'red' ? 'bg-red-50 text-red-800 border-red-200 hover:bg-red-100' : 'bg-white text-gray-700 border-gray-200 hover:border-purple-300';
  return (
    <button onClick={onClick} className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${active ? activeCls : inactiveCls}`}>
      {children}
    </button>
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

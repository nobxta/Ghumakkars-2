'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, RefreshCw, AlertCircle } from 'lucide-react';
import { Skeleton, timeAgo } from '@/components/admin/dashboard/utils';
import ActionInbox, { type InboxData } from '@/components/admin/dashboard/ActionInbox';
import DeparturesBoard, { type Departure } from '@/components/admin/dashboard/DeparturesBoard';
import LiveActivity from '@/components/admin/dashboard/LiveActivity';
import { RevenueCard, MoneyHealth, BookingFunnel, TopTrips, PaymentDonut, AudienceCard, BookingHeatmap } from '@/components/admin/dashboard/Insights';
import { useAdminLive } from '@/components/admin/live/AdminLiveProvider';

type RangePreset = '1d' | '1w' | '1m' | '3m' | 'custom';
const RANGE_LABELS: Record<RangePreset, string> = { '1d': 'Today', '1w': '7d', '1m': '30d', '3m': '90d', custom: 'Custom' };
const RANGE_LONG: Record<RangePreset, string> = { '1d': 'today', '1w': 'last 7 days', '1m': 'last 30 days', '3m': 'last 90 days', custom: 'selected range' };
const RANGE_KEY = 'gk_admin_dash_range';
const AUTO_REFRESH_MS = 60_000;

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [d, setD] = useState<any>(null);
  const [loadError, setLoadError] = useState('');
  const [range, setRange] = useState<RangePreset>('1m');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const { toast, openReview, dataVersion, openQuickAdd } = useAdminLive();
  const [, setTick] = useState(0); // re-render "updated Xs ago"
  const reqId = useRef(0);

  // Remember the chosen range per browser.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(RANGE_KEY) as RangePreset | null;
      if (saved && saved !== 'custom' && saved in RANGE_LABELS) setRange(saved);
    } catch { /* storage blocked */ }
  }, []);

  const pickRange = (r: RangePreset) => {
    setRange(r);
    try { if (r !== 'custom') localStorage.setItem(RANGE_KEY, r); } catch { /* ignore */ }
  };

  const resolveRange = useCallback((): { from: string; to: string } => {
    const now = new Date();
    const start = new Date(); start.setHours(0, 0, 0, 0);
    // Parse the picked dates as LOCAL days ("YYYY-MM-DD" alone parses as UTC, which
    // shifted the custom range by 5½ hours in India).
    if (range === 'custom' && customFrom && customTo) return { from: new Date(`${customFrom}T00:00:00`).toISOString(), to: new Date(`${customTo}T23:59:59.999`).toISOString() };
    if (range === '1w') start.setDate(start.getDate() - 6);
    else if (range === '1m') start.setDate(start.getDate() - 29);
    else if (range === '3m') start.setDate(start.getDate() - 89);
    else if (range !== '1d') start.setDate(start.getDate() - 29);
    return { from: start.toISOString(), to: now.toISOString() };
  }, [range, customFrom, customTo]);

  const load = useCallback(async (silent = false) => {
    if (range === 'custom' && !(customFrom && customTo)) return;
    const id = ++reqId.current;
    if (!silent) setLoading(true);
    try {
      // Aggregates run server-side (service role) so RLS doesn't scope them to
      // the admin's own rows.
      const { from, to } = resolveRange();
      const res = await fetch(`/api/admin/dashboard?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load dashboard');
      const json = await res.json();
      if (id === reqId.current) { setD(json); setLoadError(''); }
    } catch (error: any) {
      console.error('Error fetching dashboard:', error);
      if (id === reqId.current) setLoadError(error.message || 'Failed to load dashboard');
    }
    if (id === reqId.current) setLoading(false);
  }, [range, customFrom, customTo, resolveRange]);

  useEffect(() => { load(); }, [load]);

  // New activity or an action elsewhere (review popup, quick add) → quiet refresh.
  const firstVersion = useRef(dataVersion);
  useEffect(() => {
    if (dataVersion !== firstVersion.current) load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataVersion]);

  // Keep it live: quiet refresh every minute and when the tab regains focus.
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(true); }, AUTO_REFRESH_MS);
    const onVis = () => document.visibilityState === 'visible' && load(true);
    document.addEventListener('visibilitychange', onVis);
    const tick = setInterval(() => setTick((x) => x + 1), 15_000);
    return () => { clearInterval(t); clearInterval(tick); document.removeEventListener('visibilitychange', onVis); };
  }, [load]);

  const remind = useCallback(async (bookingIds: string[], label: string) => {
    try {
      const res = await fetch('/api/admin/dashboard/remind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingIds }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not send reminders');
      if (json.sent > 0 && json.failed === 0) toast(`WhatsApp reminder sent to ${label}`);
      else if (json.sent > 0) toast(`Sent ${json.sent}, ${json.failed} failed (${json.results.find((r: any) => !r.ok)?.reason || 'error'})`, 'error');
      else throw new Error(json.results?.[0]?.reason || 'Nothing was sent');
    } catch (e: any) {
      toast(e.message || 'Could not send reminders', 'error');
      throw e;
    }
  }, [toast]);

  /* ───────────── First load: skeleton in the final layout's shape ───────────── */
  if (!d) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3"><Skeleton className="h-8 w-64" /><Skeleton className="h-8 w-72" /></div>
        {loadError ? (
          <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <AlertCircle className="h-4 w-4" /> {loadError}
            <button onClick={() => load()} className="ml-auto rounded-lg bg-white px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">Retry</button>
          </div>
        ) : <Skeleton className="h-28 w-full rounded-xl" />}
        <div className="grid gap-3 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-8"><Skeleton className="h-[300px] rounded-xl" /><Skeleton className="h-40 rounded-xl" /></div>
          <div className="space-y-3 lg:col-span-4"><Skeleton className="h-48 rounded-xl" /><Skeleton className="h-[244px] rounded-xl" /></div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-72 rounded-xl" />)}</div>
        <div className="grid gap-3 lg:grid-cols-12"><Skeleton className="h-64 rounded-xl lg:col-span-5" /><Skeleton className="h-64 rounded-xl lg:col-span-7" /></div>
      </div>
    );
  }

  const period = d.period || {};
  const prev = d.prev || {};
  const series: any[] = d.series || [];
  const inbox: InboxData = d.inbox || { approvals: [], cashPending: [], dueSoon: [], lowFill: [] };
  const departures: Departure[] = d.departures || [];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const todayLabel = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  const needs = inbox.approvals.length + inbox.cashPending.length + inbox.dueSoon.length;
  const rangeLong = RANGE_LONG[range];

  return (
    <div className={`space-y-3 tabular-nums transition-opacity ${loading ? 'opacity-70' : ''}`}>
      {/* ── Header: greeting + status line │ range + primary action ── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
            {greeting}{d.adminName ? `, ${d.adminName}` : ''}
          </h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
            <span>{todayLabel}</span>
            <span className="text-slate-300">•</span>
            {needs > 0
              ? <span className="font-medium text-amber-700">{needs} item{needs > 1 ? 's' : ''} need{needs === 1 ? 's' : ''} you</span>
              : <span className="font-medium text-emerald-700">Nothing waiting on you</span>}
            <span className="text-slate-300">•</span>
            <button onClick={() => load()} className="inline-flex items-center gap-1 hover:text-slate-800" title="Refresh now">
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Updating…' : `Updated ${timeAgo(d.generatedAt)}`}
            </button>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5" role="tablist" aria-label="Date range">
            {(['1d', '1w', '1m', '3m', 'custom'] as RangePreset[]).map((r) => (
              <button
                key={r}
                role="tab"
                aria-selected={range === r}
                onClick={() => pickRange(r)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${range === r ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}
              >
                {RANGE_LABELS[r]}
              </button>
            ))}
          </div>
          {range === 'custom' && (
            <div className="flex items-center gap-1.5">
              <input type="date" value={customFrom} max={customTo || undefined} onChange={(e) => setCustomFrom(e.target.value)} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900" aria-label="From" />
              <span className="text-xs text-slate-400">–</span>
              <input type="date" value={customTo} min={customFrom || undefined} onChange={(e) => setCustomTo(e.target.value)} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900" aria-label="To" />
            </div>
          )}
          <button onClick={openQuickAdd} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-violet-600 px-3 text-xs font-semibold text-white shadow-sm hover:bg-violet-700 sm:hidden">
            <Plus className="h-3.5 w-3.5" /> New
          </button>
        </div>
      </div>

      {/* ── Action inbox ── */}
      <ActionInbox inbox={inbox} unresolvedErrors={d.unresolvedErrors || 0} onReview={openReview} onRemind={remind} />

      {/* ── Row 1: revenue curve │ money health + live feed (fills to the left column's height) ── */}
      <div className="grid gap-3 lg:grid-cols-12">
        <div className="min-w-0 space-y-3 lg:col-span-8">
          <RevenueCard
            collected={period.collected || 0}
            prevCollected={prev.collected || 0}
            series={series}
            prevSeries={d.prevSeries || []}
            avgBookingValue={d.avgBookingValue || 0}
            rangeLabel={rangeLong}
          />
          <DeparturesBoard departures={departures} onRemind={remind} />
        </div>
        <aside className="flex flex-col gap-3 lg:col-span-4">
          <MoneyHealth
            collected={d.collected || 0}
            outstanding={d.outstanding || 0}
            outstandingBookings={d.outstandingBookings || 0}
            partnerCommission={d.partnerCommission || 0}
          />
          <div className="relative min-h-[320px] flex-1">
            <LiveActivity className="lg:absolute lg:inset-0" />
          </div>
        </aside>
      </div>

      {/* ── Row 2: three different lenses on sales ── */}
      <div className="grid items-stretch gap-3 md:grid-cols-2 xl:grid-cols-3">
        <BookingFunnel
          pipeline={d.pipeline || { pending: 0, seatLocked: 0, confirmed: 0, completed: 0, referred: 0, cancelled: 0, total: 0 }}
          travellers={period.travellers || 0}
          bookings={period.bookings || 0}
          prevBookings={prev.bookings || 0}
        />
        <TopTrips trips={d.topTrips || []} />
        <PaymentDonut mix={d.paymentMix || []} />
      </div>

      {/* ── Row 3: people ── */}
      <div className="grid items-stretch gap-3 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <AudienceCard
            newUsers={period.newUsers || 0}
            prevNewUsers={prev.newUsers || 0}
            totalUsers={d.totalUsers || 0}
            verifiedUsers={d.verifiedUsers || 0}
            series={series}
          />
        </div>
        <div className="lg:col-span-7">
          <BookingHeatmap heat={d.bookingHeat || []} />
        </div>
      </div>

      <p className="pt-1 text-center text-[11px] text-slate-400">Figures cover {rangeLong} and compare with the period just before it. Money health and dues are all-time.</p>
    </div>
  );
}

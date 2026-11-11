'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3, RefreshCw, Download, Printer, GitCompare, X, LayoutDashboard, IndianRupee, MapPin, Users, Lightbulb, CalendarDays, Timer,
} from 'lucide-react';
import {
  type Feed, type Granularity, type Range, scoped, kpis, previousRange, autoGranularity, startOfTodayIST, istMidnight,
  series, tripRows, revenueByChannel, bucketLabel, bucketKeys, toCsv, download, within, isLive, CHANNEL_LABEL,
} from '@/components/admin/analytics/compute';
import { OverviewTab, RevenueTab, TripsTab, CustomersTab, InsightsTab, type Ctx } from '@/components/admin/analytics/tabs';
import { Segmented, IconBtn } from '@/components/admin/analytics/ui';

type Preset = '7d' | '30d' | '90d' | '6m' | '12m' | 'ytd' | 'all' | 'custom';
type Tab = 'overview' | 'revenue' | 'trips' | 'customers' | 'insights';
const PRESETS: { value: Preset; label: string; title: string }[] = [
  { value: '7d', label: '7D', title: 'Last 7 days' }, { value: '30d', label: '30D', title: 'Last 30 days' },
  { value: '90d', label: '90D', title: 'Last 90 days' }, { value: '6m', label: '6M', title: 'Last 6 months' },
  { value: '12m', label: '12M', title: 'Last 12 months' }, { value: 'ytd', label: 'YTD', title: 'Year to date' },
  { value: 'all', label: 'All', title: 'All time' }, { value: 'custom', label: 'Custom', title: 'Pick dates' },
];
const TABS: { value: Tab; label: string; Icon: typeof BarChart3 }[] = [
  { value: 'overview', label: 'Overview', Icon: LayoutDashboard },
  { value: 'revenue', label: 'Revenue', Icon: IndianRupee },
  { value: 'trips', label: 'Trips', Icon: MapPin },
  { value: 'customers', label: 'Customers', Icon: Users },
  { value: 'insights', label: 'Insights', Icon: Lightbulb },
];
const DAY = 86400000;

function dateInputToday() {
  const s = new Date(Date.now() + 330 * 60000);
  return s.toISOString().slice(0, 10);
}

export default function AdminAnalyticsPage() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('overview');
  const [preset, setPreset] = useState<Preset>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [compare, setCompare] = useState(true);
  const [gran, setGran] = useState<Granularity | 'auto'>('auto');
  const [tripId, setTripId] = useState<string>('all');
  const [includePartner, setIncludePartner] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const hydrated = useRef(false);

  // ── URL state (shareable / survives reload) ──
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const t = p.get('tab') as Tab | null; if (t && TABS.some((x) => x.value === t)) setTab(t);
    const r = p.get('range') as Preset | null; if (r && PRESETS.some((x) => x.value === r)) setPreset(r);
    if (p.get('from')) setCustomFrom(p.get('from') as string);
    if (p.get('to')) setCustomTo(p.get('to') as string);
    if (p.get('trip')) setTripId(p.get('trip') as string);
    const g = p.get('g') as Granularity | null; if (g && ['day', 'week', 'month'].includes(g)) setGran(g);
    if (p.get('compare') === '0') setCompare(false);
    if (p.get('partner') === '0') setIncludePartner(false);
    hydrated.current = true;
  }, []);
  useEffect(() => {
    if (!hydrated.current) return;
    const p = new URLSearchParams();
    if (tab !== 'overview') p.set('tab', tab);
    if (preset !== '30d') p.set('range', preset);
    if (preset === 'custom' && customFrom) p.set('from', customFrom);
    if (preset === 'custom' && customTo) p.set('to', customTo);
    if (tripId !== 'all') p.set('trip', tripId);
    if (gran !== 'auto') p.set('g', gran);
    if (!compare) p.set('compare', '0');
    if (!includePartner) p.set('partner', '0');
    const qs = p.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
  }, [tab, preset, customFrom, customTo, tripId, gran, compare, includePartner]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/admin/analytics', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load analytics');
      setFeed(json);
    } catch (e: any) {
      setError(e?.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 5 * 60000);
    return () => clearInterval(id);
  }, [autoRefresh, load]);

  // ── range ──
  const range: Range = useMemo(() => {
    const today = startOfTodayIST();
    const now = new Date();
    const back = (days: number) => ({ from: new Date(today.getTime() - (days - 1) * DAY), to: now });
    switch (preset) {
      case '7d': return back(7);
      case '90d': return back(90);
      case '6m': return back(182);
      case '12m': return back(365);
      case 'ytd': { const y = new Date(today.getTime() + 330 * 60000).getUTCFullYear(); return { from: istMidnight(y, 0, 1), to: now }; }
      case 'all': {
        const first = feed ? Math.min(...[...feed.bookings.map((b) => +new Date(b.createdAt)), ...feed.users.map((u) => +new Date(u.createdAt)), Date.now()]) : Date.now() - 365 * DAY;
        const s = new Date(first + 330 * 60000);
        return { from: istMidnight(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()), to: now };
      }
      case 'custom': {
        if (customFrom && customTo) {
          const [fy, fm, fd] = customFrom.split('-').map(Number);
          const [ty, tm, td] = customTo.split('-').map(Number);
          const a = istMidnight(fy, fm - 1, fd); const b = new Date(istMidnight(ty, tm - 1, td).getTime() + DAY - 1);
          return a <= b ? { from: a, to: b } : { from: new Date(b.getTime() - DAY + 1), to: new Date(a.getTime() + DAY - 1) };
        }
        return back(30);
      }
      default: return back(30);
    }
  }, [preset, customFrom, customTo, feed]);
  const prevR = useMemo(() => previousRange(range), [range]);
  const g: Granularity = gran === 'auto' ? autoGranularity(range) : gran;
  const compareOn = compare && preset !== 'all';

  const d = useMemo(() => (feed ? scoped({ feed, tripId, includePartner }) : null), [feed, tripId, includePartner]);
  const cur = useMemo(() => (d ? kpis(d, range) : null), [d, range]);
  const prev = useMemo(() => (d ? kpis(d, prevR) : null), [d, prevR]);
  const trip = feed?.trips.find((t) => t.id === tripId);

  const onTrip = useCallback((id: string) => { setTripId(id); window.scrollTo({ top: 0, behavior: 'smooth' }); }, []);

  // ── keyboard: 1–5 switch tabs, R refresh, C compare ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable) return;
      const i = Number(e.key) - 1;
      if (i >= 0 && i < TABS.length) setTab(TABS[i].value);
      else if (e.key.toLowerCase() === 'r') load();
      else if (e.key.toLowerCase() === 'c') setCompare((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [load]);

  const exportCsv = () => {
    if (!d) return;
    const stamp = `${range.from.toISOString().slice(0, 10)}_${range.to.toISOString().slice(0, 10)}`;
    let rows: Record<string, unknown>[] = [];
    if (tab === 'trips') {
      rows = tripRows(d, null).map((t) => ({
        trip: t.title, destination: t.destination, start: t.start || (t.recurring ? 'recurring' : ''), bookings: t.bookings, travellers: t.travellers,
        capacity: t.capacity, occupancy_pct: Math.round(t.occupancy * 100), collected: Math.round(t.collected), outstanding: Math.round(t.outstanding),
        booked_value: Math.round(t.value), collection_pct: Math.round(t.collectionRate * 100), avg_booking_value: Math.round(t.aov),
        commission: Math.round(t.commission), discounts: Math.round(t.discounts), cancelled: t.cancelled, avg_lead_days: t.leadDays != null ? Math.round(t.leadDays) : '',
      }));
    } else if (tab === 'revenue') {
      rows = revenueByChannel(d, range, g).map((x) => ({
        period: bucketLabel(x.key, g, true), [CHANNEL_LABEL.gateway]: Math.round(x.gateway), [CHANNEL_LABEL.manual]: Math.round(x.manual),
        [CHANNEL_LABEL.offline]: Math.round(x.offline), Other: Math.round(x.other), total: Math.round(x.gateway + x.manual + x.offline + x.other),
      }));
    } else {
      const keys = bucketKeys(range, g);
      const m = (k: 'revenue' | 'bookings' | 'travellers' | 'users') => series(d, range, g, k).map((x) => x.value);
      const [rev, bk, tr, us] = [m('revenue'), m('bookings'), m('travellers'), m('users')];
      rows = keys.map((k, i) => ({ period: bucketLabel(k, g, true), revenue: Math.round(rev[i]), bookings: bk[i], travellers: tr[i], new_signups: us[i] }));
    }
    download(`ghumakkars-analytics-${tab}-${stamp}.csv`, toCsv(rows));
  };

  // ── loading / error ──
  if (!feed && loading) return <AnalyticsSkeleton />;
  if (!feed) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <BarChart3 className="h-10 w-10 text-slate-300" />
        <p className="text-sm text-slate-600">{error || 'Could not load analytics.'}</p>
        <button onClick={load} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700">Try again</button>
      </div>
    );
  }

  const ctx: Ctx | null = d && cur && prev ? { d, r: range, prevR, g, compare: compareOn, cur, prev, onTrip } : null;
  const fmt = (x: Date) => x.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
  const liveCount = d ? d.bookings.filter((b) => isLive(b) && within(b.createdAt, range)).length : 0;

  return (
    <div className="an-root space-y-4 tabular-nums">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 via-fuchsia-600 to-orange-500 text-white shadow-[0_8px_20px_-8px_rgba(147,51,234,0.7)]"><BarChart3 className="h-4.5 w-4.5" /></span>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl md:text-3xl">Analytics</h1>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{fmt(range.from)} – {fmt(range.to)}</span>
            {compareOn && <span className="text-slate-400">vs {fmt(prevR.from)} – {fmt(prevR.to)}</span>}
            <span className="text-slate-300">·</span>
            <span>Updated {new Date(feed.generatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} IST</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 print:hidden">
          <IconBtn title="Refresh data (R)" onClick={load} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /><span className="hidden sm:inline">Refresh</span></IconBtn>
          <IconBtn title="Auto-refresh every 5 minutes" onClick={() => setAutoRefresh((v) => !v)} active={autoRefresh}><Timer className="h-3.5 w-3.5" /><span className="hidden sm:inline">Auto</span></IconBtn>
          <IconBtn title="Export this tab as CSV" onClick={exportCsv}><Download className="h-3.5 w-3.5" /><span className="hidden sm:inline">CSV</span></IconBtn>
          <IconBtn title="Print / save as PDF" onClick={() => window.print()}><Printer className="h-3.5 w-3.5" /><span className="hidden sm:inline">Print</span></IconBtn>
        </div>
      </div>

      {/* Sticky filter bar */}
      <div className="an-toolbar sticky top-14 z-30 -mx-3 border-y border-slate-200/70 bg-[#F8F9FB]/85 px-3 py-2.5 backdrop-blur-md sm:mx-0 sm:rounded-2xl sm:border sm:bg-white/80 sm:px-3 md:top-16 print:static print:border-0">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented ariaLabel="Date range" value={preset} onChange={(v) => { setPreset(v); if (v === 'custom' && !customFrom) { const t = dateInputToday(); setCustomTo(t); setCustomFrom(new Date(Date.now() + 330 * 60000 - 29 * DAY).toISOString().slice(0, 10)); } }} options={PRESETS.map((p) => ({ value: p.value, label: p.label, title: p.title }))} />
          {preset === 'custom' && (
            <div className="flex items-center gap-1.5">
              <input type="date" aria-label="From date" value={customFrom} max={customTo || undefined} onChange={(e) => setCustomFrom(e.target.value)} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900 focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-100" />
              <span className="text-xs text-slate-400">→</span>
              <input type="date" aria-label="To date" value={customTo} min={customFrom || undefined} onChange={(e) => setCustomTo(e.target.value)} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900 focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-100" />
            </div>
          )}
          <div className="hidden h-6 w-px bg-slate-200 md:block" />
          <Segmented ariaLabel="Granularity" size="xs" value={gran} onChange={setGran} options={[
            { value: 'auto', label: `Auto${gran === 'auto' ? ` · ${g[0].toUpperCase()}${g.slice(1)}` : ''}` }, { value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' },
          ]} />
          <button type="button" onClick={() => setCompare((v) => !v)} disabled={preset === 'all'} aria-pressed={compareOn} title="Compare with previous period (C)"
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors disabled:opacity-40 ${compareOn ? 'border-purple-200 bg-purple-50 text-purple-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
            <GitCompare className="h-3.5 w-3.5" />Compare
          </button>
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
            <select aria-label="Filter by trip" value={tripId} onChange={(e) => setTripId(e.target.value)}
              className="h-8 max-w-[220px] truncate rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-100">
              <option value="all">All trips</option>
              {feed.trips.slice().sort((a, b) => a.title.localeCompare(b.title)).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-600" title="Include referred (partner) bookings in booking counts">
              <span className={`relative h-4 w-7 rounded-full transition-colors ${includePartner ? 'bg-purple-600' : 'bg-slate-300'}`}>
                <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${includePartner ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
              </span>
              <input type="checkbox" className="sr-only" checked={includePartner} onChange={(e) => setIncludePartner(e.target.checked)} />
              Partner bookings
            </label>
          </div>
        </div>
        {trip && (
          <div className="mt-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-600 py-1 pl-2.5 pr-1 text-[11px] font-semibold text-white">
              <MapPin className="h-3 w-3" />{trip.title}
              <button type="button" onClick={() => setTripId('all')} className="rounded-full p-0.5 hover:bg-white/20" aria-label="Clear trip filter"><X className="h-3 w-3" /></button>
            </span>
            <span className="text-[11px] text-slate-500">Revenue, bookings and trip charts are filtered · user metrics stay site-wide</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <nav role="tablist" aria-label="Analytics sections" className="an-tabs relative flex gap-1 overflow-x-auto border-b border-slate-200 [scrollbar-width:none] print:hidden">
        {TABS.map((t, i) => {
          const on = t.value === tab;
          return (
            <button key={t.value} role="tab" aria-selected={on} type="button" onClick={() => setTab(t.value)} title={`${t.label} (${i + 1})`}
              className={`relative inline-flex shrink-0 items-center gap-1.5 px-3 pb-2.5 pt-1.5 text-sm font-semibold transition-colors ${on ? 'text-purple-700' : 'text-slate-500 hover:text-slate-800'}`}>
              <t.Icon className="h-4 w-4" />{t.label}
              {t.value === 'insights' && ctx && <span className="rounded-full bg-orange-100 px-1.5 text-[10px] font-bold text-orange-700">new</span>}
              <span className={`absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-500 transition-opacity ${on ? 'opacity-100' : 'opacity-0'}`} />
            </button>
          );
        })}
        <span className="ml-auto hidden shrink-0 items-center pb-2 text-[11px] text-slate-400 lg:inline-flex">{liveCount} bookings in range · keys 1–5, R, C</span>
      </nav>

      <div key={tab} className={`an-panel transition-opacity duration-200 ${loading ? 'opacity-60' : ''}`} role="tabpanel">
        {ctx && tab === 'overview' && <OverviewTab {...ctx} />}
        {ctx && tab === 'revenue' && <RevenueTab {...ctx} />}
        {ctx && tab === 'trips' && <TripsTab {...ctx} />}
        {ctx && tab === 'customers' && <CustomersTab {...ctx} />}
        {ctx && tab === 'insights' && <InsightsTab {...ctx} />}
      </div>
    </div>
  );
}

function AnalyticsSkeleton() {
  const b = 'animate-pulse rounded-2xl bg-slate-200/60';
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading analytics">
      <div className={`${b} h-10 w-56`} />
      <div className={`${b} h-12 w-full`} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className={`${b} h-[128px]`} />)}</div>
      <div className={`${b} h-[340px]`} />
      <div className="grid gap-4 lg:grid-cols-2"><div className={`${b} h-64`} /><div className={`${b} h-64`} /></div>
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  TrendingUp, Users, Package, Wallet, Target, Clock, Handshake, IndianRupee, Activity, Filter, PieChart, CalendarClock,
  MapPin, Ticket, Search, ArrowUpDown, ChevronUp, ChevronDown, GraduationCap, UserCheck, Repeat, Gift, Lightbulb,
  CheckCircle2, AlertTriangle, AlertOctagon, Info, ArrowRight, Layers, BarChart3, LineChart,
} from 'lucide-react';
import {
  type Scoped, type Range, type Granularity, type Kpis, type Metric, type Booking,
  kpis, series, spark, revenueByChannel, cumulative, groupSum, topN, heatmap, funnel, tripRows, leadTimeHistogram,
  groupSizeHistogram, customerStats, rfmSegments, insights, bucketKeys, bucketLabel, within, isLive, netOf, delta,
  inr, inrShort, num, pct, titleCase, hourLabel, DOW, METRIC_LABEL, STATUS_LABEL, METHOD_LABEL, CHANNEL_LABEL, type TripRow,
} from './compute';
import { TimeChart, BarChart, Donut, HBarList, Heatmap, Funnel, Gauge, Legend, Empty, SERIES, MUTED } from './charts';
import { Card, KpiTile, Segmented, Stat } from './ui';

export type Ctx = {
  d: Scoped; r: Range; prevR: Range; g: Granularity; compare: boolean; cur: Kpis; prev: Kpis;
  onTrip: (id: string) => void;
};

const fmtFor = (m: Metric) => (m === 'revenue' || m === 'aov' ? inrShort : (v: number) => num(v));
const fmtFull = (m: Metric) => (m === 'revenue' || m === 'aov' ? inr : (v: number) => num(v));

/** Fixed colour per entity (never by rank). */
const STATUS_COLOR: Record<string, string> = {
  confirmed: SERIES[0], seat_locked: SERIES[3], remaining_submitted: SERIES[3], on_trip: SERIES[2], completed: SERIES[5],
  referred: SERIES[6], pending: MUTED, cancelled: SERIES[7], rejected: SERIES[7],
};
const METHOD_COLOR: Record<string, string> = { upi: SERIES[0], card: SERIES[1], cash: SERIES[2], manual: SERIES[3], emi: SERIES[4], netbanking: SERIES[5], wallet: SERIES[6] };
const CHANNEL_COLOR: Record<string, string> = { gateway: SERIES[0], manual: SERIES[1], offline: SERIES[2], other: MUTED };
const PAY_COLOR: Record<string, string> = { paid: SERIES[5], partial: SERIES[3], pending: SERIES[7], refunded: SERIES[4], partner: SERIES[6] };

function useLabels(r: Range, g: Granularity) {
  return useMemo(() => {
    const keys = bucketKeys(r, g);
    return { keys, short: keys.map((k) => bucketLabel(k, g)), long: keys.map((k) => bucketLabel(k, g, true)) };
  }, [r, g]);
}

// ═════════════════════════ OVERVIEW ═════════════════════════
export function OverviewTab({ d, r, prevR, g, compare, cur, prev }: Ctx) {
  const [metric, setMetric] = useState<Metric>('revenue');
  const [view, setView] = useState<'line' | 'bar' | 'cumulative'>('line');
  const [heat, setHeat] = useState<'bookings' | 'payments' | 'users'>('bookings');
  const { short, long } = useLabels(r, g);

  const curSeries = useMemo(() => series(d, r, g, metric).map((x) => x.value), [d, r, g, metric]);
  const prevSeries = useMemo(() => {
    const p = series(d, prevR, g, metric).map((x) => x.value);
    // Align previous period onto the current axis (pad/trim to same length).
    return curSeries.map((_, i) => p[i] ?? 0);
  }, [d, prevR, g, metric, curSeries]);
  const shown = view === 'cumulative' ? cumulative(curSeries) : curSeries;
  const shownPrev = view === 'cumulative' ? cumulative(prevSeries) : prevSeries;

  const sparks = useMemo(() => ({
    revenue: spark(d, r, 'revenue'), bookings: spark(d, r, 'bookings'), travellers: spark(d, r, 'travellers'),
    users: spark(d, r, 'users'), aov: spark(d, r, 'aov'),
  }), [d, r]);

  const statusSlices = useMemo(() => groupSum(
    d.bookings.filter((b) => within(b.createdAt, r)), (b) => b.effStatus === 'remaining_submitted' ? 'seat_locked' : b.effStatus, () => 1, (k) => STATUS_LABEL[k] || titleCase(k),
  ), [d, r]);
  const steps = useMemo(() => funnel(d, r), [d, r]);
  const grid = useMemo(() => heatmap(d, r, heat), [d, r, heat]);
  const outstanding = d.bookings.filter(isLive).reduce((s, b) => s + b.remaining, 0);

  const tiles: { m?: Metric; label: string; value: string; delta: number | null; sub: string; color: string; icon: JSX.Element; invert?: boolean; hint?: string }[] = [
    { m: 'revenue', label: 'Revenue', value: inr(cur.revenue), delta: delta(cur.revenue, prev.revenue), sub: `${cur.payments} payments · prev ${inrShort(prev.revenue)}`, color: SERIES[0], icon: <IndianRupee />, hint: 'Verified payments minus refunds on your own (non-partner) bookings, by payment date.' },
    { m: 'bookings', label: 'Bookings', value: num(cur.bookings), delta: delta(cur.bookings, prev.bookings), sub: `${cur.cancelled} cancelled · prev ${prev.bookings}`, color: SERIES[1], icon: <Package /> },
    { m: 'travellers', label: 'Travellers', value: num(cur.travellers), delta: delta(cur.travellers, prev.travellers), sub: `${cur.bookings ? (cur.travellers / cur.bookings).toFixed(1) : '0'} per booking`, color: SERIES[2], icon: <Users /> },
    { m: 'users', label: 'New sign-ups', value: num(cur.newUsers), delta: delta(cur.newUsers, prev.newUsers), sub: `prev ${prev.newUsers}`, color: SERIES[6], icon: <UserCheck /> },
    { m: 'aov', label: 'Avg. booking value', value: inr(cur.aov), delta: delta(cur.aov, prev.aov), sub: 'Owed per own booking', color: SERIES[4], icon: <Target /> },
    { label: 'Sign-up → booking', value: pct(cur.conversion, 1), delta: delta(cur.conversion, prev.conversion), sub: 'New users who booked', color: SERIES[5], icon: <Filter /> },
    { label: 'Partner commission', value: inr(cur.commission), delta: delta(cur.commission, prev.commission), sub: 'From referred bookings', color: SERIES[6], icon: <Handshake /> },
    { label: 'Outstanding now', value: inr(outstanding), delta: undefined as unknown as null, sub: 'Balance due, all live bookings', color: SERIES[7], icon: <Clock /> },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => (
          <KpiTile key={t.label} compare={compare} label={t.label} value={t.value} delta={t.delta} invert={t.invert} sub={t.sub} icon={t.icon} hint={t.hint}
            spark={t.m ? sparks[t.m] : undefined} color={t.color} active={t.m === metric} onClick={t.m ? () => setMetric(t.m as Metric) : undefined} />
        ))}
      </div>

      <Card
        title={METRIC_LABEL[metric]} icon={<LineChart />}
        subtitle={<>Total <b className="text-slate-800">{fmtFull(metric)(metric === 'aov' ? cur.aov : curSeries.reduce((a, b) => a + b, 0))}</b>{compare && <> · previous period <b className="text-slate-800">{fmtFull(metric)(metric === 'aov' ? prev.aov : prevSeries.reduce((a, b) => a + b, 0))}</b></>} · click a KPI tile above to switch metric</>}
        actions={<>
          <Segmented ariaLabel="Metric" size="xs" value={metric} onChange={setMetric} options={(['revenue', 'bookings', 'travellers', 'users', 'aov'] as Metric[]).map((m) => ({ value: m, label: METRIC_LABEL[m].replace('Revenue collected', 'Revenue').replace('Avg. booking value', 'AOV').replace('New sign-ups', 'Sign-ups') }))} />
          <Segmented ariaLabel="Chart style" size="xs" value={view} onChange={setView} options={[
            { value: 'line', label: <LineChart className="h-3.5 w-3.5" />, title: 'Line' },
            { value: 'bar', label: <BarChart3 className="h-3.5 w-3.5" />, title: 'Bars' },
            { value: 'cumulative', label: <Layers className="h-3.5 w-3.5" />, title: 'Running total', disabled: metric === 'aov' },
          ]} />
        </>}
      >
        {view === 'bar'
          ? <BarChart labels={short} longLabels={long} stacks={[{ name: METRIC_LABEL[metric], color: SERIES[0], values: shown }]} format={fmtFor(metric)} height={280} highlightMax />
          : <TimeChart labels={short} longLabels={long} format={fmtFull(metric)} yFormat={fmtFor(metric)} height={280}
            series={[
              { name: 'This period', color: SERIES[0], values: view === 'cumulative' && metric === 'aov' ? curSeries : shown, area: true },
              ...(compare ? [{ name: 'Previous period', color: '#94a3b8', values: view === 'cumulative' && metric === 'aov' ? prevSeries : shownPrev, dashed: true }] : []),
            ]} />}
        {compare && view !== 'bar' && <div className="mt-2"><Legend items={[{ label: 'This period', color: SERIES[0] }, { label: 'Previous period', color: '#94a3b8', dashed: true }]} /></div>}
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2" title="Booking status mix" icon={<PieChart />} subtitle="Bookings created in range, by live status">
          <Donut slices={statusSlices} format={num} centerLabel="Bookings" colors={statusSlices.map((s) => STATUS_COLOR[s.key] || MUTED)} />
        </Card>
        <Card className="lg:col-span-3" title="Conversion funnel" icon={<Filter />} subtitle="Users who signed up in range → what they did next (any time)">
          <Funnel steps={steps} />
        </Card>
      </div>

      <Card title="When customers act" icon={<CalendarClock />} subtitle="Day-of-week × hour, India time"
        actions={<Segmented ariaLabel="Heatmap data" size="xs" value={heat} onChange={setHeat} options={[{ value: 'bookings', label: 'Bookings' }, { value: 'payments', label: 'Payments' }, { value: 'users', label: 'Sign-ups' }]} />}>
        <Heatmap grid={grid} rowLabels={DOW} colLabel={hourLabel} unit={heat === 'users' ? 'sign-ups' : heat} />
      </Card>
    </div>
  );
}

// ═════════════════════════ REVENUE ═════════════════════════
export function RevenueTab({ d, r, prevR, g, compare, cur, prev, onTrip }: Ctx) {
  const { short, long } = useLabels(r, g);
  const [split, setSplit] = useState<'method' | 'channel'>('method');
  const channels = useMemo(() => revenueByChannel(d, r, g), [d, r, g]);
  const pays = useMemo(() => d.payments.filter((p) => within(p.at, r) && netOf(p) > 0), [d, r]);
  const methodSlices = useMemo(() => {
    const s = split === 'method'
      ? groupSum(pays, (p) => p.method, netOf, (k) => METHOD_LABEL[k] || titleCase(k))
      : groupSum(pays, (p) => p.mode, netOf, (k) => CHANNEL_LABEL[k] || titleCase(k));
    return topN(s, 6);
  }, [pays, split]);
  const methodColors = methodSlices.map((s) => (split === 'method' ? METHOD_COLOR[s.key] : CHANNEL_COLOR[s.key]) || MUTED);

  const inRangeBookings = useMemo(() => d.bookings.filter((b) => isLive(b) && within(b.createdAt, r)), [d, r]);
  const payStatus = useMemo(() => groupSum(inRangeBookings, (b) => b.payStatus, () => 1, (k) => (k === 'partner' ? 'Partner-settled' : titleCase(k))), [inRangeBookings]);

  const cumCur = useMemo(() => cumulative(series(d, r, g, 'revenue').map((x) => x.value)), [d, r, g]);
  const cumPrev = useMemo(() => {
    const p = cumulative(series(d, prevR, g, 'revenue').map((x) => x.value));
    return cumCur.map((_, i) => p[Math.min(i, p.length - 1)] ?? 0);
  }, [d, prevR, g, cumCur]);

  const owed = inRangeBookings.filter((b) => !b.partner).reduce((s, b) => s + b.owed, 0);
  const paid = inRangeBookings.filter((b) => !b.partner).reduce((s, b) => s + b.paid, 0);
  const remaining = inRangeBookings.reduce((s, b) => s + b.remaining, 0);
  const coupons = inRangeBookings.reduce((s, b) => s + b.couponDiscount, 0);
  const wallet = inRangeBookings.reduce((s, b) => s + b.walletUsed, 0);
  const waived = inRangeBookings.reduce((s, b) => s + b.waived, 0);

  const couponRows = useMemo(() => {
    const m = new Map<string, { uses: number; discount: number; revenue: number }>();
    inRangeBookings.forEach((b) => {
      if (!b.coupon) return;
      const x = m.get(b.coupon) || { uses: 0, discount: 0, revenue: 0 };
      x.uses += 1; x.discount += b.couponDiscount; x.revenue += b.paid;
      m.set(b.coupon, x);
    });
    return Array.from(m.entries()).map(([code, x]) => ({ code, ...x })).sort((a, b) => b.uses - a.uses);
  }, [inRangeBookings]);

  const outstandingByTrip = useMemo(() => {
    const titles = new Map(d.trips.map((t) => [t.id, t.title]));
    return groupSum(d.bookings.filter(isLive), (b) => b.tripId, (b) => b.remaining, (k) => titles.get(k) || 'Unknown trip');
  }, [d]);
  const partners = useMemo(() => groupSum(inRangeBookings.filter((b) => b.partner), (b) => b.partner, (b) => b.commission, (k) => k), [inRangeBookings]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile compare={compare} label="Net revenue" value={inr(cur.revenue)} delta={delta(cur.revenue, prev.revenue)} sub="After refunds" icon={<IndianRupee />} />
        <KpiTile compare={compare} label="Refunds" value={inr(cur.refunds)} delta={delta(cur.refunds, prev.refunds)} invert sub="Netted out above" icon={<Repeat />} />
        <KpiTile compare={compare} label="Discounts given" value={inr(cur.discounts)} delta={delta(cur.discounts, prev.discounts)} invert sub="Coupon · wallet · waiver" icon={<Ticket />} />
        <KpiTile compare={compare} label="Add-on sales" value={inr(cur.addons)} delta={delta(cur.addons, prev.addons)} sub="On bookings in range" icon={<Gift />} />
      </div>

      <Card title="Revenue by channel" icon={<BarChart3 />} subtitle="Net money received each period, split by how it reached you">
        <BarChart labels={short} longLabels={long} format={inrShort}
          stacks={(['gateway', 'manual', 'offline', 'other'] as const)
            .filter((k) => channels.some((c) => c[k] > 0))
            .map((k) => ({ name: CHANNEL_LABEL[k], color: CHANNEL_COLOR[k], values: channels.map((c) => c[k]) }))} />
        <div className="mt-3">
          <Legend items={(['gateway', 'manual', 'offline', 'other'] as const).filter((k) => channels.some((c) => c[k] > 0)).map((k) => ({ label: CHANNEL_LABEL[k], color: CHANNEL_COLOR[k], value: inrShort(channels.reduce((s, c) => s + c[k], 0)) }))} />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="How customers pay" icon={<Wallet />} subtitle="Share of net revenue in range"
          actions={<Segmented ariaLabel="Split by" size="xs" value={split} onChange={setSplit} options={[{ value: 'method', label: 'Instrument' }, { value: 'channel', label: 'Channel' }]} />}>
          <Donut slices={methodSlices} format={inrShort} centerLabel="Revenue" colors={methodColors} />
        </Card>
        <Card title="Collection health" icon={<Activity />} subtitle="Bookings made in range, by payment status">
          <Donut slices={payStatus} format={num} centerLabel="Bookings" colors={payStatus.map((s) => PAY_COLOR[s.key] || MUTED)} />
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Stat label="Booked value" value={inrShort(owed)} />
            <Stat label="Collected" value={inrShort(paid)} tone="good" sub={owed ? `${pct(paid / owed)} of value` : undefined} />
            <Stat label="Still due" value={inrShort(remaining)} tone={remaining > 0 ? 'warn' : 'default'} />
          </div>
        </Card>
      </div>

      <Card title="Running total" icon={<TrendingUp />} subtitle={compare ? 'Cumulative net revenue, this period vs the previous one, aligned day-for-day' : 'Cumulative net revenue across the range'}>
        <TimeChart labels={short} longLabels={long} format={inr} yFormat={inrShort} height={240}
          series={[{ name: 'This period', color: SERIES[0], values: cumCur, area: true }, ...(compare ? [{ name: 'Previous period', color: '#94a3b8', values: cumPrev, dashed: true }] : [])]} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Discount breakdown" icon={<Ticket />} subtitle="On bookings made in range">
          {coupons + wallet + waived > 0 ? (
            <Donut size={150} slices={[{ key: 'c', label: 'Coupons', value: coupons }, { key: 'w', label: 'Wallet credit', value: wallet }, { key: 'v', label: 'Waived balance', value: waived }].filter((x) => x.value > 0)}
              format={inrShort} centerLabel="Discounts" />
          ) : <Empty height={150} text="No discounts in range" />}
        </Card>
        <Card title="Outstanding by trip" icon={<Clock />} subtitle="Balance due today · click to filter">
          <HBarList rows={outstandingByTrip} format={inr} color={SERIES[3]} max={6} onSelect={onTrip} />
        </Card>
        <Card title="Partner commission" icon={<Handshake />} subtitle="Referred bookings in range">
          {partners.length ? <HBarList rows={partners} format={inr} color={SERIES[6]} max={6} /> : <Empty height={150} text="No partner bookings in range" />}
        </Card>
      </div>

      <Card title="Coupon performance" icon={<Ticket />} subtitle="Which codes are driving bookings in range" bodyClass="!px-0 !pb-1">
        {couponRows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead><tr className="border-y border-slate-100 bg-slate-50/60 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-5 py-2 font-semibold">Code</th><th className="px-3 py-2 text-right font-semibold">Uses</th>
                <th className="px-3 py-2 text-right font-semibold">Discount given</th><th className="px-3 py-2 text-right font-semibold">Revenue from these</th>
                <th className="px-5 py-2 text-right font-semibold">ROI</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {couponRows.map((c) => (
                  <tr key={c.code} className="hover:bg-slate-50/60">
                    <td className="px-5 py-2.5"><span className="rounded-md bg-purple-50 px-2 py-0.5 font-mono text-xs font-bold text-purple-700">{c.code}</span></td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{c.uses}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-rose-700">{inr(c.discount)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{inr(c.revenue)}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-slate-600">{c.discount > 0 ? `${(c.revenue / c.discount).toFixed(1)}×` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="px-5 pb-4"><Empty height={100} text="No coupons used in range" /></div>}
      </Card>
    </div>
  );
}

// ═════════════════════════ TRIPS ═════════════════════════
type SortKey = keyof Pick<TripRow, 'title' | 'bookings' | 'travellers' | 'occupancy' | 'collected' | 'outstanding' | 'collectionRate' | 'aov' | 'leadDays' | 'cancelled'>;

export function TripsTab({ d, r, onTrip }: Ctx) {
  const [scope, setScope] = useState<'range' | 'lifetime'>('lifetime');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | 'upcoming' | 'past' | 'recurring'>('all');
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: 'collected', dir: -1 });
  const rows = useMemo(() => tripRows(d, scope === 'range' ? r : null), [d, r, scope]);
  const now = Date.now();
  const filtered = rows
    .filter((t) => !q || `${t.title} ${t.destination}`.toLowerCase().includes(q.toLowerCase()))
    .filter((t) => status === 'all' || (status === 'recurring' ? t.recurring : !t.recurring && t.start && (status === 'upcoming' ? new Date(t.start).getTime() >= now : new Date(t.start).getTime() < now)))
    .sort((a, b) => {
      const av = a[sort.k] ?? -1; const bv = b[sort.k] ?? -1;
      return (typeof av === 'string' ? String(av).localeCompare(String(bv)) : (av as number) - (bv as number)) * sort.dir;
    });
  const totals = filtered.reduce((s, t) => ({ b: s.b + t.bookings, p: s.p + t.travellers, c: s.c + t.collected, o: s.o + t.outstanding }), { b: 0, p: 0, c: 0, o: 0 });

  const dest = useMemo(() => {
    const destOf = new Map(d.trips.map((t) => [t.id, t.destination]));
    return groupSum(d.payments.filter((p) => within(p.at, r)), (p) => (p.tripId ? destOf.get(p.tripId) || null : null), netOf, (k) => k);
  }, [d, r]);
  const lead = useMemo(() => leadTimeHistogram(d, r), [d, r]);
  const groups = useMemo(() => groupSizeHistogram(d, r), [d, r]);
  const pickups = useMemo(() => groupSum(d.bookings.filter((b) => isLive(b) && within(b.createdAt, r)), (b) => b.pickup, (b) => b.pax, (k) => k), [d, r]);

  const Th = ({ k, children, right = true }: { k: SortKey; children: React.ReactNode; right?: boolean }) => (
    <th className={`px-3 py-2 font-semibold ${right ? 'text-right' : 'text-left'}`}>
      <button type="button" onClick={() => setSort((s) => ({ k, dir: s.k === k ? (s.dir === 1 ? -1 : 1) : -1 }))}
        className={`inline-flex items-center gap-1 uppercase tracking-wide hover:text-slate-900 ${sort.k === k ? 'text-purple-700' : ''}`}>
        {children}{sort.k === k ? (sort.dir === 1 ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
      </button>
    </th>
  );

  return (
    <div className="space-y-4">
      <Card title="Trip performance" icon={<MapPin />} subtitle={scope === 'lifetime' ? 'All-time numbers per trip' : 'Bookings and payments made inside the selected range'} bodyClass="!px-0 !pb-1"
        actions={<>
          <label className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search trips" className="h-8 w-36 rounded-lg border border-slate-200 bg-white pl-7 pr-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-100 sm:w-44" />
          </label>
          <Segmented ariaLabel="Trip status" size="xs" value={status} onChange={setStatus} options={[{ value: 'all', label: 'All' }, { value: 'upcoming', label: 'Upcoming' }, { value: 'past', label: 'Past' }, { value: 'recurring', label: 'Recurring' }]} />
          <Segmented ariaLabel="Time scope" size="xs" value={scope} onChange={setScope} options={[{ value: 'lifetime', label: 'Lifetime' }, { value: 'range', label: 'In range' }]} />
        </>}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead><tr className="border-y border-slate-100 bg-slate-50/60 text-[11px] text-slate-500">
              <Th k="title" right={false}>Trip</Th><Th k="bookings">Bookings</Th><Th k="travellers">Pax</Th><Th k="occupancy">Seats filled</Th>
              <Th k="collected">Collected</Th><Th k="outstanding">Due</Th><Th k="collectionRate">Collected %</Th><Th k="aov">AOV</Th>
              <Th k="leadDays">Lead time</Th><Th k="cancelled">Cancelled</Th><th className="px-3 py-2" />
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((t) => (
                <tr key={t.id} className="group/row hover:bg-purple-50/30">
                  <td className="max-w-[240px] px-3 py-2.5 pl-5">
                    <button type="button" onClick={() => onTrip(t.id)} className="block max-w-full text-left" title="Filter the whole page to this trip">
                      <span className="block truncate font-semibold text-slate-900 group-hover/row:text-purple-700">{t.title}</span>
                      <span className="block truncate text-[11px] text-slate-500">{t.destination} · {t.recurring ? 'Recurring' : t.start ? new Date(t.start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}</span>
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{t.bookings}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{t.travellers}</td>
                  <td className="px-3 py-2.5">
                    {t.recurring || !t.capacity ? <span className="block text-right text-xs text-slate-400">{t.capacity ? `${t.capacity}/date` : '—'}</span> : (
                      <div className="ml-auto w-28">
                        <div className="mb-0.5 flex justify-between text-[11px] tabular-nums"><span className="text-slate-600">{t.travellers}/{t.capacity}</span><span className="font-semibold text-slate-900">{pct(t.occupancy)}</span></div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${Math.min(100, t.occupancy * 100)}%`, background: t.occupancy >= 0.8 ? SERIES[5] : t.occupancy >= 0.5 ? SERIES[0] : SERIES[3] }} /></div>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-slate-900">{inr(t.collected)}</td>
                  <td className={`px-3 py-2.5 text-right tabular-nums ${t.outstanding > 0 ? 'text-amber-700' : 'text-slate-400'}`}>{inr(t.outstanding)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{t.value > 0 ? pct(t.collectionRate) : '—'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{t.aov ? inrShort(t.aov) : '—'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{t.leadDays != null ? `${Math.round(t.leadDays)}d` : '—'}</td>
                  <td className={`px-3 py-2.5 text-right tabular-nums ${t.cancelled ? 'text-rose-700' : 'text-slate-400'}`}>{t.cancelled}</td>
                  <td className="px-3 py-2.5 pr-5 text-right">
                    <Link href={`/admin/trips/${t.id}`} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-purple-700 opacity-60 hover:bg-purple-50 group-hover/row:opacity-100">Open <ArrowRight className="h-3 w-3" /></Link>
                  </td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={11} className="px-5 py-10 text-center text-sm text-slate-400">No trips match.</td></tr>}
            </tbody>
            {filtered.length > 1 && (
              <tfoot><tr className="border-t-2 border-slate-200 bg-slate-50/60 text-sm font-bold text-slate-900">
                <td className="px-3 py-2.5 pl-5">{filtered.length} trips</td><td className="px-3 py-2.5 text-right tabular-nums">{totals.b}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{totals.p}</td><td />
                <td className="px-3 py-2.5 text-right tabular-nums">{inr(totals.c)}</td><td className="px-3 py-2.5 text-right tabular-nums text-amber-700">{inr(totals.o)}</td>
                <td colSpan={5} />
              </tr></tfoot>
            )}
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Revenue by destination" icon={<MapPin />} subtitle="Net revenue received in range">
          <HBarList rows={dest} format={inr} color={SERIES[0]} />
        </Card>
        <Card title="Popular pickup points" icon={<MapPin />} subtitle="Travellers booked in range">
          <HBarList rows={pickups} format={(v) => `${num(v)} pax`} color={SERIES[2]} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Booking lead time" icon={<CalendarClock />} subtitle="How far ahead of departure people book">
          {lead.some((x) => x.value) ? <BarChart labels={lead.map((x) => x.label)} stacks={[{ name: 'Bookings', color: SERIES[0], values: lead.map((x) => x.value) }]} format={num} height={220} highlightMax /> : <Empty height={220} />}
        </Card>
        <Card title="Group size" icon={<Users />} subtitle="Travellers per booking">
          {groups.some((x) => x.value) ? <BarChart labels={groups.map((x) => x.label)} stacks={[{ name: 'Bookings', color: SERIES[2], values: groups.map((x) => x.value) }]} format={num} height={220} highlightMax /> : <Empty height={220} />}
        </Card>
      </div>
    </div>
  );
}

// ═════════════════════════ CUSTOMERS ═════════════════════════
export function CustomersTab({ d, r, prevR, g, compare, cur, prev }: Ctx) {
  const { short, long } = useLabels(r, g);
  const [collegeSrc, setCollegeSrc] = useState<'travellers' | 'signups'>('travellers');
  const cs = useMemo(() => customerStats(d, r), [d, r]);
  const csPrev = useMemo(() => customerStats(d, prevR), [d, prevR]);
  const signups = useMemo(() => series(d, r, g, 'users').map((x) => x.value), [d, r, g]);
  const baseUsers = d.users.filter((u) => new Date(u.createdAt).getTime() < r.from.getTime()).length;
  const totalCurve = cumulative(signups).map((v) => v + baseUsers);
  // Bookings often carry no college; fall back to sign-ups' profile college so the chart is never blank.
  const travellerColleges = useMemo(() => groupSum(d.bookings.filter((b) => isLive(b) && within(b.createdAt, r)), (b) => b.college, (b) => b.pax, (k) => k), [d, r]);
  const signupColleges = useMemo(() => groupSum(d.users.filter((u) => within(u.createdAt, r)), (u) => u.college, () => 1, (k) => k), [d, r]);
  const src = collegeSrc === 'travellers' && !travellerColleges.length ? 'signups' : collegeSrc;
  const colleges = src === 'travellers' ? travellerColleges : signupColleges;
  const gender = useMemo(() => groupSum(d.bookings.filter((b) => isLive(b) && within(b.createdAt, r)), (b) => (b.gender ? (b.gender.startsWith('m') ? 'male' : b.gender.startsWith('f') ? 'female' : 'other') : null), (b) => b.pax), [d, r]);
  const segs = useMemo(() => rfmSegments(d), [d]);
  const usersInRange = d.users.filter((u) => within(u.createdAt, r));
  const verifiedRate = usersInRange.length ? usersInRange.filter((u) => u.verified).length / usersInRange.length : 0;
  const referredRate = usersInRange.length ? usersInRange.filter((u) => u.referred).length / usersInRange.length : 0;
  const refs = d.referrals.filter((x) => within(x.createdAt, r));
  const refCredited = refs.filter((x) => ['credited', 'completed', 'paid'].includes(x.status));
  const repeatRate = cs.buyers ? cs.repeat / cs.buyers : 0;

  const topSpenders = useMemo(() => {
    const m = new Map<string, { spend: number; trips: number }>();
    d.bookings.filter((b: Booking) => isLive(b) && b.userId).forEach((b) => {
      const x = m.get(b.userId as string) || { spend: 0, trips: 0 };
      x.spend += b.paid; x.trips += 1; m.set(b.userId as string, x);
    });
    const arr = Array.from(m.values()).sort((a, b) => b.spend - a.spend);
    const total = arr.reduce((s, x) => s + x.spend, 0);
    const top10 = arr.slice(0, Math.max(1, Math.ceil(arr.length * 0.1))).reduce((s, x) => s + x.spend, 0);
    return { share: total ? top10 / total : 0, n: arr.length };
  }, [d]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile compare={compare} label="Paying customers" value={num(cs.buyers)} delta={delta(cs.buyers, csPrev.buyers)} sub={`${cs.firstTime} first-time · ${cs.returning} returning`} icon={<Users />} />
        <KpiTile compare={compare} label="New sign-ups" value={num(cur.newUsers)} delta={delta(cur.newUsers, prev.newUsers)} sub={`${num(d.users.length)} users total`} icon={<UserCheck />} />
        <KpiTile compare={compare} label="Repeat rate" value={pct(repeatRate, 1)} delta={delta(repeatRate, csPrev.buyers ? csPrev.repeat / csPrev.buyers : 0)} sub="Buyers with 2+ bookings" icon={<Repeat />} />
        <KpiTile compare={compare} label="Lifetime value" value={inr(cs.ltv)} sub={`Avg paid per customer · ${num(cs.lifetimeBuyers)} ever`} icon={<IndianRupee />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="User growth" icon={<TrendingUp />} subtitle="Sign-ups per period (bars) · total users (line)">
          <BarChart labels={short} longLabels={long} stacks={[{ name: 'New sign-ups', color: SERIES[6], values: signups }]} format={num} height={180} />
          <div className="mt-2 border-t border-slate-100 pt-2">
            <TimeChart labels={short} longLabels={long} series={[{ name: 'Total users', color: SERIES[0], values: totalCurve, area: true }]} format={num} height={150} />
          </div>
        </Card>
        <Card title="Account health" icon={<UserCheck />} subtitle="Sign-ups in range">
          <div className="grid grid-cols-2 gap-4 py-2">
            <Gauge value={verifiedRate} label="Email verified" color={SERIES[2]} />
            <Gauge value={cur.conversion} label="Booked a trip" color={SERIES[0]} />
            <Gauge value={referredRate} label="Came via referral" color={SERIES[6]} />
            <Gauge value={topSpenders.share} label="Revenue from top 10%" color={SERIES[1]} />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Top colleges" icon={<GraduationCap />} subtitle={src === 'travellers' ? 'Travellers booked in range' : collegeSrc === 'travellers' ? 'Sign-ups in range (bookings have no college recorded)' : 'Sign-ups in range'}
          actions={<Segmented ariaLabel="College source" size="xs" value={src} onChange={setCollegeSrc} options={[{ value: 'travellers', label: 'Travellers', disabled: !travellerColleges.length }, { value: 'signups', label: 'Sign-ups' }]} />}>
          {!travellerColleges.length && !signupColleges.length ? <Empty height={160} text="No college recorded on any profile or booking yet" /> : <HBarList rows={colleges} format={num} color={SERIES[6]} max={8} subFormat={(x) => { const tot = colleges.reduce((s, c) => s + c.value, 0); return tot ? pct(x.value / tot) : ''; }} />}
        </Card>
        <Card title="Traveller gender" icon={<Users />} subtitle="Primary passenger, by pax">
          <Donut size={150} slices={gender} format={num} centerLabel="Travellers" />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Customer segments" icon={<Layers />} subtitle="By recency & frequency of bookings (all time)">
          {segs.some((s) => s.value) ? <BarChart labels={segs.map((s) => s.label)} stacks={[{ name: 'Customers', color: SERIES[0], values: segs.map((s) => s.value) }]} format={num} height={220} highlightMax /> : <Empty height={220} />}
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500"><b>Champions</b> 3+ bookings, active ≤4 mo · <b>Loyal</b> 2+, ≤6 mo · <b>New</b> first booking ≤60 days · <b>At risk</b> quiet 2–6 mo · <b>Dormant</b> 6 mo+.</p>
        </Card>
        <Card title="Referral programme" icon={<Gift />} subtitle="Referrals created in range">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Referrals" value={num(refs.length)} />
            <Stat label="Converted" value={num(refs.filter((x) => x.converted).length)} tone="good" sub={refs.length ? pct(refs.filter((x) => x.converted).length / refs.length) : undefined} />
            <Stat label="Rewards credited" value={num(refCredited.length)} />
            <Stat label="Reward cost" value={inrShort(refCredited.reduce((s, x) => s + x.reward, 0))} tone="warn" />
          </div>
          <div className="mt-4">
            <Donut size={130} slices={groupSum(refs, (x) => x.status, () => 1)} format={num} centerLabel="Referrals" />
          </div>
        </Card>
      </div>
    </div>
  );
}

// ═════════════════════════ INSIGHTS ═════════════════════════
export function InsightsTab({ d, r, prevR, cur, prev }: Ctx) {
  const list = useMemo(() => insights(d, r, prevR, cur, prev), [d, r, prevR, cur, prev]);
  const pendingSeat = d.bookings.filter((b) => isLive(b) && b.status === 'seat_locked' && b.remaining > 1);
  const unpaid = d.bookings.filter((b) => isLive(b) && b.payStatus === 'pending' && !b.partner);
  const tone = {
    good: { Icon: CheckCircle2, cls: 'border-emerald-200 bg-emerald-50/60', ic: 'text-emerald-600' },
    warn: { Icon: AlertTriangle, cls: 'border-amber-200 bg-amber-50/60', ic: 'text-amber-600' },
    bad: { Icon: AlertOctagon, cls: 'border-rose-200 bg-rose-50/60', ic: 'text-rose-600' },
    info: { Icon: Info, cls: 'border-sky-200 bg-sky-50/60', ic: 'text-sky-600' },
  } as const;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-3 lg:col-span-2">
        {list.length === 0 && <Empty height={160} text="Not enough activity in this range for insights yet." />}
        {list.map((x, i) => {
          const t = tone[x.tone];
          return (
            <div key={i} className={`an-insight flex gap-3 rounded-2xl border p-4 ${t.cls}`} style={{ animationDelay: `${i * 50}ms` }}>
              <t.Icon className={`mt-0.5 h-5 w-5 shrink-0 ${t.ic}`} aria-label={x.tone} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{x.title}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-slate-600">{x.body}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="space-y-4">
        <Card title="Action items" icon={<Lightbulb />} subtitle="Live, all-time">
          <ul className="space-y-2 text-sm">
            <ActionRow href="/admin/bookings" label="Seat-locks with balance due" value={pendingSeat.length} money={pendingSeat.reduce((s, b) => s + b.remaining, 0)} />
            <ActionRow href="/admin/bookings" label="Bookings with no payment" value={unpaid.length} />
            <ActionRow href="/admin/payments" label="Refunds in range" value={undefined} money={cur.refunds} />
            <ActionRow href="/admin/coupons" label="Discounts given in range" value={undefined} money={cur.discounts} />
          </ul>
        </Card>
        <Card title="How numbers are counted" icon={<Info />}>
          <ul className="list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-slate-600">
            <li><b>Revenue</b> = verified payments minus refunds, dated by payment time, on your own bookings.</li>
            <li><b>Partner (referred)</b> bookings count only their commission, not trip revenue.</li>
            <li><b>Bookings / travellers</b> are dated by booking creation and exclude cancelled.</li>
            <li><b>Previous period</b> is the same length immediately before the selected range.</li>
            <li>All days and hours are India time (IST).</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

function ActionRow({ href, label, value, money }: { href: string; label: string; value?: number; money?: number }) {
  const hot = (value ?? 0) > 0 || (money ?? 0) > 0;
  return (
    <li>
      <Link href={href} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
        <span className="text-slate-600">{label}</span>
        <span className={`inline-flex items-center gap-1.5 font-semibold tabular-nums ${hot ? 'text-slate-900' : 'text-slate-400'}`}>
          {value != null && <span className={`rounded-full px-1.5 text-[11px] ${hot ? 'bg-amber-100 text-amber-800' : 'bg-slate-100'}`}>{value}</span>}
          {money != null && money > 0 && <span className="text-xs">{inrShort(money)}</span>}
          <ArrowRight className="h-3 w-3 text-slate-300" />
        </span>
      </Link>
    </li>
  );
}

export { kpis };

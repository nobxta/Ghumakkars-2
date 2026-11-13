'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Wallet, PiggyBank, Filter, Trophy, CreditCard, Users, Flame, ArrowRight } from 'lucide-react';
import { Card, CardHeader, Delta, inr, inrShort, fmtDay } from './utils';

/* Every card here answers ONE question and uses its own kind of visual:
 *  Revenue  → area chart vs previous period     Money health → progress ring
 *  Funnel   → tapering stages                    Top trips    → ranked bars
 *  Payments → donut                              Audience     → columns + gauge
 *  When people book → weekday × hour heatmap
 */

/* ───────────────────────── Revenue (area vs previous) ───────────────────────── */

type SeriesPoint = { day: string; collected: number; bookings: number; users: number };

export function RevenueCard({ collected, prevCollected, series, prevSeries, avgBookingValue, rangeLabel }: {
  collected: number; prevCollected: number; series: SeriesPoint[]; prevSeries: number[]; avgBookingValue: number; rangeLabel: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const cur = series.map((s) => s.collected || 0);
  const prev = series.map((_, i) => prevSeries[i] || 0);
  const W = 600, H = 170, P = 6;
  const max = Math.max(...cur, ...prev, 1) * 1.1;
  const x = (i: number) => (series.length <= 1 ? W / 2 : (i / (series.length - 1)) * W);
  const y = (v: number) => H - P - (v / max) * (H - 2 * P);
  const path = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const best = cur.indexOf(Math.max(...cur));
  const h = hover != null ? series[hover] : null;
  const labelEvery = Math.max(1, Math.ceil(series.length / 7));

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 pt-4">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><Wallet className="h-3.5 w-3.5 text-emerald-500" /> Revenue · {rangeLabel}</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900" title={inr(h ? h.collected : collected)}>
            {inrShort(h ? h.collected : collected)}
          </p>
          <div className="mt-0.5 h-4">{h ? <span className="text-[11px] text-slate-500">{fmtDay(h.day, true)} · before: {inrShort(prev[hover!])}</span> : <Delta cur={collected} prev={prevCollected} />}</div>
        </div>
        <div className="flex gap-5 text-right">
          <MiniFigure label="Per day" value={inrShort(series.length ? collected / series.length : 0)} />
          <MiniFigure label="Best day" value={cur[best] > 0 ? inrShort(cur[best]) : '—'} sub={cur[best] > 0 ? fmtDay(series[best].day) : undefined} />
          <MiniFigure label="Avg booking" value={inrShort(avgBookingValue)} />
        </div>
      </div>

      <div className="relative px-2 pb-2 pt-3">
        {series.length < 2 ? (
          <div className="flex h-[170px] items-center justify-center text-xs text-slate-400">Pick a longer range to see the curve</div>
        ) : (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="block h-[170px] w-full"
            onMouseMove={(e) => {
              const r = (e.currentTarget as SVGElement).getBoundingClientRect();
              setHover(Math.max(0, Math.min(series.length - 1, Math.round(((e.clientX - r.left) / r.width) * (series.length - 1)))));
            }}
            onMouseLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient id="revFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0.33, 0.66].map((g) => <line key={g} x1="0" x2={W} y1={H * g} y2={H * g} stroke="#F1F5F9" vectorEffect="non-scaling-stroke" />)}
            <path d={path(prev)} fill="none" stroke="#CBD5E1" strokeWidth="1.5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
            <path d={`${path(cur)} L${W},${H} L0,${H} Z`} fill="url(#revFill)" />
            <path d={path(cur)} fill="none" stroke="#10B981" strokeWidth="2.25" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            {hover != null && <line x1={x(hover)} x2={x(hover)} y1="0" y2={H} stroke="#94A3B8" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />}
          </svg>
        )}
        {hover != null && series.length >= 2 && (
          <span
            className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-emerald-500 shadow"
            style={{ left: `calc(0.5rem + (100% - 1rem) * ${x(hover) / W})`, top: `calc(0.75rem + 170px * ${y(cur[hover]) / H})` }}
          />
        )}
        <div className="relative mx-0 mt-1 h-3 text-[10px] text-slate-400">
          {series.map((s, i) => (i % labelEvery === 0 ? (
            <span key={s.day} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${Math.min(96, Math.max(4, (x(i) / W) * 100))}%` }}>{fmtDay(s.day)}</span>
          ) : null))}
        </div>
        <div className="mt-2 flex gap-4 px-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5"><i className="h-0.5 w-4 rounded bg-emerald-500" />This period</span>
          <span className="flex items-center gap-1.5"><i className="h-0 w-4 border-t-2 border-dashed border-slate-300" />Period before</span>
        </div>
      </div>
    </Card>
  );
}

function MiniFigure({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-slate-800">{value}</p>
      {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
    </div>
  );
}

/* ───────────────────────── Money health (ring) ───────────────────────── */

export function MoneyHealth({ collected, outstanding, outstandingBookings, partnerCommission }: {
  collected: number; outstanding: number; outstandingBookings: number; partnerCommission: number;
}) {
  const expected = collected + outstanding;
  const pct = expected > 0 ? collected / expected : 0;
  const R = 52, C = 2 * Math.PI * R;
  return (
    <Card className="bg-gradient-to-br from-white to-emerald-50/40 p-5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><PiggyBank className="h-3.5 w-3.5 text-emerald-500" /> Money health · all time</p>
      <div className="mt-3 flex items-center gap-5">
        <div className="relative h-32 w-32 shrink-0">
          <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
            <circle cx="64" cy="64" r={R} fill="none" stroke="#FDE68A" strokeWidth="12" />
            <circle cx="64" cy="64" r={R} fill="none" stroke="#10B981" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${C * pct} ${C}`} className="transition-all duration-700" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-slate-900">{Math.round(pct * 100)}%</span>
            <span className="text-[10px] text-slate-500">collected</span>
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <Legend dot="bg-emerald-500" label="In the bank" value={inrShort(collected)} title={inr(collected)} />
          <Legend dot="bg-amber-300" label={`Still due · ${outstandingBookings} booking${outstandingBookings === 1 ? '' : 's'}`} value={inrShort(outstanding)} title={inr(outstanding)} tone="text-amber-600" />
          {partnerCommission > 0 && <Legend dot="bg-violet-400" label="Partner commission" value={inrShort(partnerCommission)} title={inr(partnerCommission)} tone="text-violet-700" />}
        </div>
      </div>
    </Card>
  );
}

function Legend({ dot, label, value, title, tone }: { dot: string; label: string; value: string; title?: string; tone?: string }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[11px] text-slate-500"><i className={`h-2 w-2 rounded-full ${dot}`} />{label}</p>
      <p className={`pl-3.5 text-lg font-bold leading-tight ${tone || 'text-slate-900'}`} title={title}>{value}</p>
    </div>
  );
}

/* ───────────────────────── Booking funnel ───────────────────────── */

export type Pipeline = { pending: number; seatLocked: number; confirmed: number; completed: number; referred: number; cancelled: number; total: number };

export function BookingFunnel({ pipeline, travellers, prevBookings, bookings }: { pipeline: Pipeline; travellers: number; prevBookings: number; bookings: number }) {
  const made = pipeline.total;
  const paid = pipeline.seatLocked + pipeline.confirmed + pipeline.completed + pipeline.referred;
  const confirmed = pipeline.confirmed + pipeline.completed + pipeline.referred;
  const stages = [
    { label: 'Started', value: made, color: 'from-violet-500 to-violet-400' },
    { label: 'Paid a deposit', value: paid, color: 'from-indigo-500 to-indigo-400' },
    { label: 'Fully confirmed', value: confirmed, color: 'from-emerald-500 to-emerald-400' },
  ];
  return (
    <Card className="flex flex-col">
      <CardHeader icon={<Filter className="h-4 w-4" />} title="Booking funnel" right={<Delta cur={bookings} prev={prevBookings} />} />
      <div className="flex flex-1 flex-col justify-center gap-2 px-4 py-4">
        {stages.map((s, i) => {
          const w = made > 0 ? Math.max(18, (s.value / made) * 100) : 100 - i * 20;
          const conv = i > 0 && stages[i - 1].value > 0 ? Math.round((s.value / stages[i - 1].value) * 100) : null;
          return (
            <div key={s.label}>
              {conv != null && <p className="mb-1 text-center text-[10px] text-slate-400">↓ {conv}% move on</p>}
              <div className={`mx-auto flex h-10 items-center justify-between gap-2 rounded-lg bg-gradient-to-r ${s.color} px-3 text-white shadow-sm transition-all duration-700`} style={{ width: `${w}%`, minWidth: '9.5rem' }}>
                <span className="truncate text-[11px] font-medium opacity-90">{s.label}</span>
                <span className="text-base font-bold">{s.value}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between border-t border-slate-100 px-4 py-2.5 text-[11px] text-slate-500">
        <span><b className="font-semibold text-slate-800">{travellers}</b> travellers seated</span>
        {pipeline.cancelled > 0 ? <span className="text-rose-600"><b className="font-semibold">{pipeline.cancelled}</b> dropped / cancelled</span> : <span>No drop-offs</span>}
      </div>
    </Card>
  );
}

/* ───────────────────────── Top trips (ranked bars) ───────────────────────── */

export type TopTrip = { tripId: string; title: string; cover: string | null; bookings: number; travellers: number; collected: number; due: number };

const RANK_BG = ['bg-amber-400 text-white', 'bg-slate-300 text-white', 'bg-orange-300 text-white'];

export function TopTrips({ trips }: { trips: TopTrip[] }) {
  const max = Math.max(...trips.map((t) => t.collected), 1);
  return (
    <Card className="flex flex-col overflow-hidden">
      <CardHeader icon={<Trophy className="h-4 w-4" />} title="Best-selling trips" right={<Link href="/admin/trips" className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700">Trips <ArrowRight className="h-3 w-3" /></Link>} />
      {trips.length === 0 ? (
        <p className="flex flex-1 items-center justify-center px-4 py-10 text-xs text-slate-400">No sales in this range yet</p>
      ) : (
        <ol className="flex-1 space-y-3 px-4 py-4">
          {trips.map((t, i) => (
            <li key={t.tripId}>
              <Link href={`/admin/trips/${t.tripId}`} className="group block">
                <div className="flex items-center gap-2">
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${RANK_BG[i] || 'bg-slate-100 text-slate-500'}`}>{i + 1}</span>
                  <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-800 group-hover:text-violet-700">{t.title}</p>
                  <span className="shrink-0 text-[11px] text-slate-400">{t.travellers} pax</span>
                </div>
                <div className="relative mt-1.5 h-6 overflow-hidden rounded-md bg-slate-100">
                  <div className="flex h-full items-center rounded-md bg-gradient-to-r from-violet-500 to-fuchsia-400 px-2 transition-all duration-700" style={{ width: `${Math.max(12, (t.collected / max) * 100)}%` }}>
                    <span className="text-[11px] font-semibold text-white" title={inr(t.collected)}>{inrShort(t.collected)}</span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/* ───────────────────────── Payment methods (donut) ───────────────────────── */

export type MixRow = { method: string; amount: number; count: number };
const MIX_HEX: Record<string, string> = { Online: '#8B5CF6', UPI: '#10B981', Cash: '#F59E0B', Bank: '#0EA5E9', Wallet: '#EC4899', Other: '#CBD5E1' };

export function PaymentDonut({ mix }: { mix: MixRow[] }) {
  const total = mix.reduce((s, r) => s + r.amount, 0);
  const count = mix.reduce((s, r) => s + r.count, 0);
  const R = 46, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <Card className="flex flex-col">
      <CardHeader icon={<CreditCard className="h-4 w-4" />} title="How customers pay" />
      {total === 0 ? (
        <p className="flex flex-1 items-center justify-center px-4 py-10 text-xs text-slate-400">No verified payments in this range</p>
      ) : (
        <div className="flex flex-1 flex-col items-center gap-4 px-4 py-4">
          <div className="relative h-32 w-32">
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
              {mix.map((r) => {
                const len = (r.amount / total) * C;
                const el = <circle key={r.method} cx="60" cy="60" r={R} fill="none" stroke={MIX_HEX[r.method] || '#CBD5E1'} strokeWidth="16" strokeDasharray={`${Math.max(0, len - 2)} ${C}`} strokeDashoffset={-acc} />;
                acc += len;
                return el;
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold text-slate-900">{count}</span>
              <span className="text-[10px] text-slate-500">payments</span>
            </div>
          </div>
          <ul className="grid w-full grid-cols-2 gap-x-4 gap-y-1.5">
            {mix.map((r) => (
              <li key={r.method} className="flex items-center gap-1.5 text-[12px]" title={`${inr(r.amount)} · ${r.count} payment${r.count === 1 ? '' : 's'}`}>
                <i className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: MIX_HEX[r.method] || '#CBD5E1' }} />
                <span className="text-slate-600">{r.method}</span>
                <span className="ml-auto font-semibold text-slate-900">{Math.round((r.amount / total) * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

/* ───────────────────────── Audience (columns + verified gauge) ───────────────────────── */

export function AudienceCard({ newUsers, prevNewUsers, totalUsers, verifiedUsers, series }: {
  newUsers: number; prevNewUsers: number; totalUsers: number; verifiedUsers: number; series: SeriesPoint[];
}) {
  const vals = series.map((s) => s.users || 0);
  const max = Math.max(...vals, 1);
  const vPct = totalUsers > 0 ? Math.round((verifiedUsers / totalUsers) * 100) : 0;
  return (
    <Card className="flex flex-col overflow-hidden">
      <CardHeader icon={<Users className="h-4 w-4" />} title="Audience" right={<Link href="/admin/users" className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700">Users <ArrowRight className="h-3 w-3" /></Link>} />
      <div className="flex flex-1 flex-col px-4 py-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] text-slate-500">New sign-ups</p>
            <p className="text-3xl font-bold leading-tight text-slate-900">{newUsers.toLocaleString('en-IN')}</p>
            <Delta cur={newUsers} prev={prevNewUsers} />
          </div>
          <div className="w-36 text-right">
            <p className="text-[11px] text-slate-500"><b className="font-semibold text-slate-800">{totalUsers.toLocaleString('en-IN')}</b> members</p>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-sky-100"><div className="h-full rounded-full bg-sky-500" style={{ width: `${vPct}%` }} /></div>
            <p className="mt-1 text-[10px] text-slate-400">{vPct}% email-verified</p>
          </div>
        </div>
        <div className="mt-4 flex h-24 flex-1 items-end gap-[3px]">
          {vals.map((v, i) => (
            <div key={series[i].day} className="group relative flex h-full flex-1 items-end" title={`${fmtDay(series[i].day, true)}: ${v} sign-up${v === 1 ? '' : 's'}`}>
              <div className="w-full rounded-full bg-sky-400/80 transition-colors group-hover:bg-sky-600" style={{ height: `${v > 0 ? Math.max(8, (v / max) * 100) : 4}%`, opacity: v > 0 ? 1 : 0.25 }} />
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

/* ───────────────────────── When people book (heatmap) ───────────────────────── */

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const BLOCKS = ['12a', '3a', '6a', '9a', '12p', '3p', '6p', '9p'];

export function BookingHeatmap({ heat }: { heat: number[][] }) {
  const flat = heat.flat();
  const max = Math.max(...flat, 1);
  const total = flat.reduce((a, b) => a + b, 0);
  let peak = { d: 0, b: 0, v: -1 };
  heat.forEach((row, d) => row.forEach((v, b) => { if (v > peak.v) peak = { d, b, v }; }));
  const dayTotals = heat.map((r) => r.reduce((a, b) => a + b, 0));
  const bestDay = dayTotals.indexOf(Math.max(...dayTotals));

  return (
    <Card className="flex flex-col overflow-hidden">
      <CardHeader icon={<Flame className="h-4 w-4" />} title="When people book" right={<span className="text-[11px] text-slate-400">India time</span>} />
      <div className="flex flex-1 flex-col px-4 py-4">
        {total === 0 ? (
          <p className="flex flex-1 items-center justify-center py-8 text-xs text-slate-400">No bookings in this range</p>
        ) : (
          <>
            <p className="mb-3 text-[13px] text-slate-600">
              Busiest: <b className="font-semibold text-slate-900">{DAYS[peak.d]} {BLOCKS[peak.b]}–{BLOCKS[(peak.b + 1) % 8]}</b>
              <span className="text-slate-400"> · best day {DAYS[bestDay]}</span>
            </p>
            <div className="grid grid-cols-[2rem_repeat(8,minmax(0,1fr))] gap-1">
              <span />
              {BLOCKS.map((b) => <span key={b} className="text-center text-[9px] text-slate-400">{b}</span>)}
              {heat.map((row, d) => (
                <div key={d} className="contents">
                  <span className="self-center text-[10px] font-medium text-slate-500">{DAYS[d]}</span>
                  {row.map((v, b) => (
                    <div
                      key={b}
                      title={`${DAYS[d]} ${BLOCKS[b]}–${BLOCKS[(b + 1) % 8]}: ${v} booking${v === 1 ? '' : 's'}`}
                      className="h-6 rounded-[4px] ring-1 ring-inset ring-black/[0.03]"
                      style={{ background: v ? `rgba(244, 63, 94, ${0.15 + 0.85 * (v / max)})` : '#F8FAFC' }}
                    />
                  ))}
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-slate-400">
              Fewer
              {[0.15, 0.4, 0.65, 1].map((o) => <i key={o} className="h-2.5 w-4 rounded-sm" style={{ background: `rgba(244, 63, 94, ${o})` }} />)}
              More
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
